import { parseTranscript } from "./parse.js";
import { buildPdf } from "./pdf.js";
import { CHANNEL_URL, CHANNEL_LABEL, CTA_TEXT } from "./brand.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function openPdf(buffer) {
  const { getDocumentProxy } = await import("unpdf");
  return getDocumentProxy(new Uint8Array(buffer));
}

const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80);

/** BBC LEARNING ENGLISH, 6 Minute English va ajratuvchi belgilarni olib tashlaydi */
const normalizeTitle = (value) =>
  String(value ?? "")
    .replace(/BBC\s+LEARNING\s+ENGLISH/gi, " ")
    .replace(/6\s+Minute\s+English/gi, " ")
    .replace(/[·•|–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Kiruvchi PDF -> brendlangan PDF + Telegram caption.
 * userCaption: botga PDF bilan birga yozilgan matn (ixtiyoriy)
 *   1-qator = sarlavha, 2-qator = kicker (seriya/manba), 3-qator = manba (credit)
 */
export async function convertPdf(buffer, { userCaption = "", filename = "transcript.pdf", theme, open = openPdf } = {}) {
  const pdf = await open(buffer);
  const fallbackTitle = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const doc = await parseTranscript(pdf, { fallbackTitle });

  const [t, k, c] = userCaption.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (t) doc.title = t;
  if (k) doc.kicker = k;
  if (c) doc.credit = c;

  const bytes = await buildPdf(doc, { theme: theme || process.env.THEME || "dark" });

  // Caption, fayl nomi va PDF sarlavhasi bir xil manbadan olinadi
  const fullTitle = normalizeTitle(doc.title);
  const kicker = normalizeTitle(doc.kicker || "");
  const title = normalizeTitle([kicker, fullTitle].filter(Boolean).join(" ")).slice(0, 200);

  const caption = [
    `🎧 <b>${esc(title)}</b>`,
    "",
    "<i>-TRANSCRIPT-</i>",
    "",
    "#transcript #podcast",
    ""
    `<a href="${CHANNEL_URL}">${CTA_TEXT}</a>`,
  ].join("\n");

  return {
    pdf: bytes,
    filename: `${safeName(title) || "transcript"} (@${CHANNEL_LABEL.split("/")[1]}).pdf`,
    caption,
    title,
    doc,
  };
}