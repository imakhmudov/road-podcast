// Ishlatish: npm run webhook -- https://SIZNING-LOYIHA.vercel.app
import { loadEnv } from "../lib/env.js";
loadEnv();
const base = process.argv[2];
const { BOT_TOKEN, WEBHOOK_SECRET } = process.env;
if (!base || !BOT_TOKEN) {
  console.log("Ishlatish: npm run webhook -- https://SIZNING-LOYIHA.vercel.app\n(.env faylida BOT_TOKEN bo'lishi kerak)");
  process.exit(1);
}
const url = base.replace(/\/$/, "") + "/api/webhook";
const body = { url, allowed_updates: ["message", "callback_query"], drop_pending_updates: true };
if (WEBHOOK_SECRET) body.secret_token = WEBHOOK_SECRET;
const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log(await r.json());
