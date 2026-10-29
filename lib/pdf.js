import { PDFDocument, StandardFonts, PDFName, PDFString, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { THEMES, PAGE, SIZE, CHANNEL_URL, CHANNEL_LABEL, CHANNEL_NAME, CTA_TEXT } from "./brand.js";

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const col = (c) => rgb(c.r, c.g, c.b);

async function loadFontkit() {
  try {
    return (await import("@pdf-lib/fontkit")).default;
  } catch {
    return null;
  }
}

async function loadFonts(pdfDoc) {
  const fontkit = await loadFontkit();
  if (fontkit) {
    try {
      pdfDoc.registerFontkit(fontkit);
      const f = async (n) => pdfDoc.embedFont(await readFile(path.join(ASSETS, n)), { subset: false, features: { liga: false, clig: false, dlig: false, calt: false } });
      return {
        regular: await f("Carlito-Regular.ttf"),
        bold: await f("Carlito-Bold.ttf"),
        italic: await f("Carlito-Italic.ttf"),
        custom: true,
      };
    } catch (e) {
      console.error("Carlito yuklanmadi, standart shriftga o'tdim:", e.message);
    }
  }
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    custom: false,
  };
}

function makeCleaner(font) {
  const ok = new Set(font.getCharacterSet());
  return (s) =>
    [...String(s)
      .replace(/[\u00a0\u2009\u202f\u2007]/g, " ")
      .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
      .replace(/\u2011/g, "-")]
      .map((ch) => (ok.has(ch.codePointAt(0)) ? ch : ch === "\n" || ch === "\t" ? " " : ""))
      .join("");
}

function wrap(text, font, size, width) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  const push = () => { if (cur) lines.push(cur); cur = ""; };
  for (let w of words) {
    // juda uzun so'zni bo'lib tashlash
    while (font.widthOfTextAtSize(w, size) > width) {
      let i = w.length - 1;
      while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
      if (cur) push();
      lines.push(w.slice(0, i));
      w = w.slice(i);
    }
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= width) cur = t;
    else { push(); cur = w; }
  }
  push();
  return lines;
}

function addLink(pdfDoc, page, x, y, w, h, url) {
  const ref = pdfDoc.context.register(
    pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + w, y + h],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    })
  );
  const annots = page.node.Annots();
  if (annots) annots.push(ref);
  else page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([ref]));
}

export async function buildPdf(doc, { theme = "dark" } = {}) {
  const T = THEMES[theme] || THEMES.dark;
  const { w: W, h: H, mx: MX, top: TOP, bottom: BOTTOM } = PAGE;
  const TW = W - MX * 2;

  const pdfDoc = await PDFDocument.create();
  const F = await loadFonts(pdfDoc);
  const clean = makeCleaner(F.regular);
  const logo = await pdfDoc.embedPng(await readFile(path.join(ASSETS, "logo-header.png")));

  let page;
  let y;
  const pages = [];

  const newPage = () => {
    page = pdfDoc.addPage([W, H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: col(T.bg) });
    y = H - TOP;
  };
  const ensure = (h) => { if (y - h < BOTTOM) newPage(); };
  const text = (s, x, size, font, color, opts = {}) =>
    page.drawText(s, { x, y: y - size, size, font, color: col(color), ...opts });

  /** Matn bloki: so'zlar bo'yicha o'raydi, kerak bo'lsa keyingi sahifaga o'tadi */
  const para = (s, { size = SIZE.body, font = F.regular, color = T.text, x = MX, width = TW, lh = size * 1.48, minLines = 1 } = {}) => {
    const lines = wrap(clean(s), font, size, width);
    ensure(lh * Math.min(lines.length, minLines));
    for (const line of lines) {
      ensure(lh);
      text(line, x, size, font, color);
      y -= lh;
    }
  };

  /* ---------- 1-sahifa: sarlavha qismi ---------- */
  newPage();
  const lw = 132;
  const lh = lw * (logo.height / logo.width);
  if (theme === "light") {
    page.drawRectangle({ x: 0, y: H - (TOP + lh + 18), width: W, height: TOP + lh + 18, color: rgb(36 / 255, 39 / 255, 44 / 255) });
  }
  page.drawImage(logo, { x: (W - lw) / 2, y: y - lh, width: lw, height: lh });
  y -= lh + 22;

  const center = (s, size, font, color, lhk) => {
    for (const line of wrap(clean(s), font, size, TW)) {
      const wd = font.widthOfTextAtSize(line, size);
      page.drawText(line, { x: (W - wd) / 2, y: y - size, size, font, color: col(color) });
      y -= size * lhk;
    }
  };
  if (doc.kicker) { center(doc.kicker.toUpperCase(), SIZE.kicker, F.bold, T.gold, 1.5); y -= 6; }
  center(doc.title, SIZE.title, F.bold, T.text, 1.22);
  y -= 8;
  // page.drawRectangle({ x: (W - 46) / 2, y: y - 2.5, width: 46, height: 2.5, color: col(T.gold) });
  // y -= 30;

  /* ---------- Asosiy matn ---------- */
  for (const it of doc.items) {
    if (it.type === "turn") {
      y -= 6;
      ensure(SIZE.label * 1.5 + SIZE.body * 1.48 * 2);
      text(clean(it.speaker), MX, SIZE.label, F.bold, T.gold);
      y -= SIZE.label * 1.5;
      it.parts.forEach((part, i) => {
        if (i > 0) y -= 8;
        if (part.type === "p") para(part.text, { minLines: 2 });
        else listBlock(part.items);
      });
      y -= 10;
    } else if (it.type === "p") {
      para(it.text);
      y -= 12;
    } else if (it.type === "list") {
      listBlock(it.items);
      y -= 10;
    } else if (it.type === "heading") {
      y -= 14;
      ensure(SIZE.heading * 1.4 + 40);
      page.drawRectangle({ x: MX, y: y - 1.2, width: TW, height: 1.2, color: col(T.rule) });
      y -= 18;
      const label = it.text.charAt(0) + it.text.slice(1).toLowerCase();
      text(clean(label), MX, SIZE.heading, F.bold, T.gold);
      y -= SIZE.heading * 1.5;
    } else if (it.type === "glossary") {
      for (const e of it.entries) {
        ensure(SIZE.body * 1.48 + SIZE.small * 1.45 * 2);
        para(e.term, { font: F.bold, color: T.gold, size: SIZE.body });
        para(e.def, { color: T.soft, size: SIZE.small, lh: SIZE.small * 1.45 });
        y -= 14;
      }
    }
  }

  function listBlock(items) {
    for (const raw of items) {
      const m = raw.match(/^(\S{1,3})\s+(.*)$/);
      const marker = m ? m[1] : "•";
      const body = m ? m[2] : raw;
      const lines = wrap(clean(body), F.regular, SIZE.body, TW - 40);
      const lhh = SIZE.body * 1.48;
      ensure(lhh * Math.min(2, lines.length));
      text(clean(marker), MX + 12, SIZE.body, F.bold, T.gold);
      for (const line of lines) {
        ensure(lhh);
        text(line, MX + 40, SIZE.body, F.regular, T.text);
        y -= lhh;
      }
      y -= 4;
    }
  }

  /* ---------- Oxirgi blok: manba + "Follow for more" ---------- */
  y -= 6;
  if (doc.credit) {
    para(doc.credit, { size: 11.5, font: F.italic, color: T.muted, lh: 16 });
    y -= 14;
  }
  const btnH = 76;
  ensure(btnH + 10);
  const by = y - btnH;
  page.drawRectangle({ x: MX, y: by, width: TW, height: btnH, color: col(T.gold) });
  const c1 = CTA_TEXT + "  →";
  const w1 = F.bold.widthOfTextAtSize(clean(c1), 21);
  page.drawText(clean(c1) || CTA_TEXT, { x: (W - w1) / 2, y: by + btnH - 33, size: 21, font: F.bold, color: col(T.onGold) });
  const w2 = F.regular.widthOfTextAtSize(CHANNEL_LABEL, 16.5);
  page.drawText(CHANNEL_LABEL, { x: (W - w2) / 2, y: by + 16, size: 16.5, font: F.regular, color: col(T.onGold) });
  addLink(pdfDoc, page, MX, by, TW, btnH, CHANNEL_URL);
  y = by - 10;

  /* ---------- Har sahifa pastki qismi ---------- */
  pages.forEach((p, i) => {
    p.drawRectangle({ x: MX, y: 40, width: TW, height: 0.8, color: col(T.rule) });
    p.drawText(CHANNEL_LABEL, { x: MX, y: 22, size: SIZE.footer, font: F.bold, color: col(T.gold) });
    addLink(pdfDoc, p, MX, 16, 120, 20, CHANNEL_URL);
    const n = `${i + 1} / ${pages.length}`;
    p.drawText(n, { x: W - MX - F.regular.widthOfTextAtSize(n, SIZE.footer), y: 22, size: SIZE.footer, font: F.regular, color: col(T.muted) });
  });

  pdfDoc.setTitle(clean(doc.title) || "Transcript");
  pdfDoc.setAuthor(CHANNEL_NAME);
  pdfDoc.setSubject(CHANNEL_URL);
  pdfDoc.setCreator(CHANNEL_NAME + " bot");
  pdfDoc.setProducer(CHANNEL_NAME);
  return pdfDoc.save();
}
