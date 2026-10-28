import { Bot, InputFile, InlineKeyboard } from "grammy";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { convertPdf } from "./convert.js";
import { CHANNEL_URL, CTA_TEXT } from "./brand.js";

const THUMB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "logo-thumb.jpg");

const previewKb = () =>
  new InlineKeyboard().text("✅ Kanalga joylash", "post").text("❌ Bekor qilish", "cancel");
const channelKb = () => new InlineKeyboard().url(`🎧 ${CTA_TEXT}`, CHANNEL_URL);

export function createBot({ token, ownerIds = [], channelId }) {
  const bot = new Bot('9163565636:AAElCItEp1X00t2Nr0LSzolibSetNJnMRt8');

  // Faqat egasi foydalanadi
  bot.use(async (ctx, next) => {
    if (!ownerIds.length) {
      if (ctx.chat?.type === "private")
        await ctx.reply(`Sizning Telegram ID raqamingiz: ${ctx.from?.id}\n\nUni Vercel'da OWNER_IDS o'zgaruvchisiga yozing va qayta deploy qiling.`);
      return;
    }
    if (!ownerIds.includes(ctx.from?.id)) return;
    await next();
  });

  bot.command("start", (ctx) =>
    ctx.reply(
      "Salom! Menga transcript PDF faylini yuboring — men uni Road Podcast shablonida qayta tayyorlayman.\n\n" +
        "Xohlasangiz, PDF bilan birga caption yozing:\n" +
        "1-qator: sarlavha\n2-qator: seriya/manba (ixtiyoriy)\n3-qator: asl nashr/credit (ixtiyoriy)\n\n" +
        "Avval sizga ko'rib chiqish uchun yuboraman, tasdiqlasangiz kanalga joylayman."
    )
  );

  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    const isPdf = doc.mime_type === "application/pdf" || /\.pdf$/i.test(doc.file_name || "");
    if (!isPdf) return ctx.reply("Iltimos, PDF fayl yuboring.");
    if ((doc.file_size || 0) > 19 * 1024 * 1024) return ctx.reply("Fayl juda katta (20 MB dan kichik bo'lsin).");

    const wait = await ctx.reply("⏳ Tayyorlanmoqda...");
    try {
      const file = await ctx.api.getFile(doc.file_id);
      const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
      if (!res.ok) throw new Error("Faylni yuklab olib bo'lmadi");
      const buf = Buffer.from(await res.arrayBuffer());

      const out = await convertPdf(buf, { userCaption: ctx.message.caption || "", filename: doc.file_name || "transcript.pdf" });

      await ctx.replyWithDocument(new InputFile(out.pdf, out.filename), {
        thumbnail: new InputFile(await readFile(THUMB), "logo.jpg"),
        caption: out.caption,
        parse_mode: "HTML",
        reply_markup: previewKb(),
      });
    } catch (e) {
      console.error(e);
      await ctx.reply("❌ Xatolik: " + (e?.message || e));
    } finally {
      await ctx.api.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {});
    }
  });

  bot.callbackQuery("post", async (ctx) => {
    const msg = ctx.callbackQuery.message;
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text("⏳ Joylanmoqda...", "noop") }).catch(() => {});
    try {
      await ctx.api.copyMessage(channelId, msg.chat.id, msg.message_id, { reply_markup: channelKb() });
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text("✅ Kanalga joylandi", "noop") }).catch(() => {});
      await ctx.answerCallbackQuery({ text: "Kanalga joylandi ✅" });
    } catch (e) {
      console.error(e);
      await ctx.editMessageReplyMarkup({ reply_markup: previewKb() }).catch(() => {});
      await ctx.answerCallbackQuery({ text: "Xatolik: " + (e?.description || e?.message || e), show_alert: true });
    }
  });

  bot.callbackQuery("cancel", async (ctx) => {
    await ctx.deleteMessage().catch(() => {});
    await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  });
  bot.callbackQuery("noop", (ctx) => ctx.answerCallbackQuery());

  bot.catch((err) => console.error("Bot xatosi:", err.error || err));
  return bot;
}

export function botFromEnv() {
  const { BOT_TOKEN, OWNER_IDS = "", CHANNEL_ID = "@road_podcasts" } = process.env;
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN o'rnatilmagan");
  const ownerIds = OWNER_IDS.split(",").map((s) => Number(s.trim())).filter(Boolean);
  return createBot({ token: BOT_TOKEN, ownerIds, channelId: CHANNEL_ID });
}
