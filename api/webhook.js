import { botFromEnv } from "../lib/bot.js";

let bot;
let ready;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("Road Podcast bot ishlayapti ✅");

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) return res.status(401).send("Unauthorized");

  try {
    bot ??= botFromEnv();
    ready ??= bot.init();
    await ready;
    await bot.handleUpdate(req.body); // javobdan oldin hammasini tugatish shart (Vercel funksiyani to'xtatib qo'yadi)
  } catch (e) {
    console.error("Webhook xatosi:", e);
  }
  // Doim 200 qaytaramiz, aks holda Telegram bir xil xabarni qayta-qayta yuboradi
  res.status(200).send("ok");
}
