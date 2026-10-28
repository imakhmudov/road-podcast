# Road Podcast bot

Transcript PDF yuborasiz -> bot uni Road Podcast shablonida qayta yig'adi (logotip, ranglar, katta shrift),
logotipni thumbnail qilib qo'yadi va sizga ko'rib chiqish uchun qaytaradi. "✅ Kanalga joylash" bosilsa,
kanalga (t.me/road_podcasts) "Follow for more" caption va tugma bilan joylanadi.

## 1. O'rnatish va botsiz sinash (kompyuterda)
```
npm install
npm run convert -- namuna.pdf natija.pdf
```
`natija.pdf` ni oching va dizaynni tekshiring. Yorug' variant: `npm run convert -- namuna.pdf natija.pdf light`

## 2. Bot va kanal
1. @BotFather -> /newbot -> tokenni oling.
2. Botni kanalga **admin** qiling (post yuborish huquqi bilan).
3. `.env.example` ni `.env` ga nusxalab, `BOT_TOKEN` ni yozing.
4. `npm run dev` -> botga /start yozing, u sizning Telegram ID raqamingizni aytadi -> `.env` dagi `OWNER_IDS` ga yozing, `npm run dev` ni qayta ishga tushiring.
5. Botga PDF yuborib sinab ko'ring. Ctrl+C bilan to'xtating.

## 3. Vercel'ga joylash
```
npm i -g vercel
vercel login
vercel
```
Vercel dashboard -> Project -> Settings -> Environment Variables: `BOT_TOKEN`, `OWNER_IDS`, `CHANNEL_ID`, `WEBHOOK_SECRET`, `THEME` ni kiriting.
Keyin: `vercel --prod`.

## 4. Webhook
Deploydan keyingi manzil bilan (bir marta):
```
npm run webhook -- https://SIZNING-LOYIHA.vercel.app
```
Natija `ok: true` bo'lishi kerak. Endi bot Vercel'da ishlaydi.

## Ishlatish
- PDF yuboring. Ixtiyoriy caption: 1-qator sarlavha, 2-qator seriya/manba, 3-qator credit.
- Bot qaytargan faylni ko'ring -> "✅ Kanalga joylash".

## Sozlash
- Rang, sahifa va shrift o'lchamlari: `lib/brand.js` (`SIZE.body` = 17 — asosiy matn).
- Kanal manzili va CTA matni: `lib/brand.js`.
- Shrift: Carlito (SIL OFL 1.1 litsenziyasi).
