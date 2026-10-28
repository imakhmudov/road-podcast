import { loadEnv } from "../lib/env.js";
loadEnv();
const { botFromEnv } = await import("../lib/bot.js");
const bot = botFromEnv();
console.log("Bot mahalliy rejimda ishga tushdi (polling). To'xtatish: Ctrl+C");
console.log("Eslatma: bu rejim webhook'ni o'chiradi. Deploydan keyin `npm run webhook -- https://SIZNING-LOYIHA.vercel.app` ni qayta bajaring.");
await bot.start({ drop_pending_updates: true });
