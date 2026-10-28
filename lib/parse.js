// PDF (pdf.js hujjati) ichidan matnni olib, tuzilmaga ajratadi:
// sarlavha, suhbat navbatlari (speaker), ro'yxatlar, bo'limlar, lug'at.
// Bu fayl hech qanday tashqi kutubxonaga bog'liq emas.

const TERMINAL = /[.?!:;"”’)\]…]$/;
const LIST_RE = /^(?:[a-zA-Z0-9]{1,2}[).]|[•\-–*])\s+/;
const BOILERPLATE = /word-for-word|^this is not a|©|copyright|all rights reserved|^page\s*\d+/i;
const GLOSSARY_RE = /vocab|glossary|key\s*words|new\s*words|word\s*list/i;

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const norm = (s) => s.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/* ---------- 1. PDF -> qatorlar ---------- */
export async function readLines(pdf) {
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const [, y0, , y1] = page.view;
    const H = y1 - y0;
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((i) => typeof i.str === "string" && i.str.trim() !== "")
      .map((i) => ({
        str: i.str,
        x: i.transform[4],
        y: i.transform[5],
        w: i.width || 0,
        size: Math.abs(i.transform[3]) || i.height || 10,
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    // y bo'yicha qatorlarga guruhlash
    const rows = [];
    for (const it of items) {
      const row = rows.find((r) => Math.abs(r.y - it.y) < Math.max(r.size, it.size) * 0.45);
      if (row) row.items.push(it);
      else rows.push({ y: it.y, size: it.size, items: [it] });
    }
    const lines = rows
      .map((r) => {
        r.items.sort((a, b) => a.x - b.x);
        let text = "";
        let prev = null;
        for (const it of r.items) {
          if (prev) {
            const gap = it.x - (prev.x + prev.w);
            const needSpace = gap > it.size * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str);
            if (needSpace) text += " ";
          }
          text += it.str;
          prev = it;
        }
        return {
          text: text.replace(/\s+/g, " ").trim(),
          y: r.y,
          size: Math.max(...r.items.map((i) => i.size)),
          fromTop: (y1 - r.y) / H,
          page: n,
        };
      })
      .filter((l) => l.text)
      .sort((a, b) => b.y - a.y);
    pages.push(lines);
  }
  return pages;
}

/* ---------- 2. Kolontitul (har sahifadagi header/footer) ni olib tashlash ---------- */
function stripRunning(pages) {
  const removed = [];
  const count = new Map();
  for (const lines of pages) {
    const seen = new Set();
    for (const l of lines) {
      if (l.fromTop > 0.87 || l.fromTop < 0.06) seen.add(norm(l.text));
    }
    for (const k of seen) count.set(k, (count.get(k) || 0) + 1);
  }
  const need = pages.length >= 3 ? 2 : 99; // 1-2 sahifali hujjatda faqat aniq belgilar
  const kept = pages.map((lines) =>
    lines.filter((l) => {
      const zone = l.fromTop > 0.87 || l.fromTop < 0.06;
      if (!zone) return true;
      const k = norm(l.text);
      const isRunning =
        (count.get(k) || 0) >= need ||
        /^page\s*\d+(\s*(of|\/)\s*\d+)?$/i.test(l.text) ||
        /^\d{1,3}$/.test(l.text) ||
        /©/.test(l.text);
      if (isRunning) removed.push(l.text);
      return !isRunning;
    })
  );
  return { pages: kept, removed };
}

/* ---------- 3. Qatorlar -> bloklar (abzatslar) ---------- */
function toBlocks(pages) {
  // qatorlar orasidagi masofa / shrift o'lchami; eng tor masofa — abzats ichidagi qator
  const ratios = [];
  for (const lines of pages)
    for (let i = 0; i < lines.length - 1; i++) {
      const g = lines[i].y - lines[i + 1].y;
      if (g > 0) ratios.push(g / Math.max(lines[i].size, 1));
    }
  const sorted = [...ratios].sort((a, b) => a - b);
  const base = sorted.length ? sorted[Math.floor(sorted.length * 0.15)] : 1.3;
  const limit = base * 1.3;

  const blocks = [];
  pages.forEach((lines, pi) => {
    let cur = null;
    lines.forEach((l, i) => {
      const prev = lines[i - 1];
      const brk = !prev || (prev.y - l.y) / Math.max(prev.size, 1) > limit;
      if (brk) {
        cur = { lines: [l.text], size: l.size, firstOnPage: i === 0, page: pi };
        blocks.push(cur);
      } else {
        cur.lines.push(l.text);
      }
    });
  });

  // sahifa oxiridan keyingisiga o'tgan abzatsni qayta ulash
  const merged = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (
      last &&
      b.firstOnPage &&
      b.page !== last.page &&
      !TERMINAL.test(last.lines[last.lines.length - 1]) &&
      /^[a-z]/.test(b.lines[0])
    ) {
      last.lines.push(...b.lines);
      last.page = b.page;
    } else merged.push(b);
  }
  return merged;
}

/* ---------- 4. Bloklar -> hujjat ---------- */
const joinLines = (lines) =>
  lines.reduce((acc, l) => (!acc ? l : /-$/.test(acc) ? acc + l : acc + " " + l), "").trim();

const isAllCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase();
const labelShape = (s) =>
  s.length <= 32 &&
  s.split(/\s+/).length <= 4 &&
  /^\p{Lu}/u.test(s) &&
  !/[.?!,;]$/.test(s) &&
  !isAllCaps(s);

function inlineSpeaker(line) {
  const m = line.match(/^(\p{Lu}[\p{L}.'’-]*(?:\s\p{Lu}[\p{L}.'’-]*){0,2})\s*:\s+(.+)$/u);
  return m && m[1].length <= 28 ? { name: m[1], rest: m[2] } : null;
}

export function structure(blocks) {
  // takrorlanuvchi ismlar (ko'p marta gapirganlar)
  const freq = new Map();
  for (const b of blocks) {
    const f = b.lines[0].replace(/:$/, "");
    if (labelShape(f)) freq.set(f.toLowerCase(), (freq.get(f.toLowerCase()) || 0) + 1);
    const inl0 = inlineSpeaker(b.lines[0]);
    if (inl0) freq.set(inl0.name.toLowerCase(), (freq.get(inl0.name.toLowerCase()) || 0) + 1);
  }
  const known = new Set([...freq].filter(([, c]) => c >= 2).map(([k]) => k));

  const out = [];
  const header = [];
  let turn = null;
  let pending = null;
  let glossary = null;
  let seenTurn = false;

  const startTurn = (name, parts) => {
    seenTurn = true;
    glossary = null;
    turn = { type: "turn", speaker: name, parts };
    out.push(turn);
  };

  for (const b of blocks) {
    const lines = b.lines;
    const first = lines[0].replace(/:$/, "");

    // (a) bo'lim sarlavhasi: BUTUN HARFLI bitta qator
    if (lines.length === 1 && isAllCaps(lines[0]) && lines[0].length >= 4 && seenTurn) {
      turn = null;
      pending = null;
      out.push({ type: "heading", text: lines[0] });
      glossary = GLOSSARY_RE.test(lines[0]) ? { type: "glossary", entries: [] } : null;
      if (glossary) out.push(glossary);
      continue;
    }

    // (b) lug'at yozuvi
    if (glossary && lines.length >= 2) {
      glossary.entries.push({ term: lines[0], def: joinLines(lines.slice(1)) });
      continue;
    }

    // (c) ro'yxat (a) b) c) yoki - •)
    if (lines.every((l) => LIST_RE.test(l)) && !pending) {
      const part = { type: "list", items: lines.map((l) => l.replace(LIST_RE, (m) => m.trim() + " ")) };
      if (turn) turn.parts.push(part);
      else if (!seenTurn) header.push(b);
      else out.push(part);
      continue;
    }

    // (d) "Ism: matn"
    const inl = inlineSpeaker(lines[0]);
    if (inl && known.has(inl.name.toLowerCase())) {
      startTurn(inl.name, [{ type: "p", text: joinLines([inl.rest, ...lines.slice(1)]) }]);
      pending = null;
      continue;
    }

    // (e) alohida qator ism + keyingi qatorlar matn
    if (labelShape(first) && lines.length >= 2 && (known.has(first.toLowerCase()) || first.length <= 28)) {
      startTurn(first, [{ type: "p", text: joinLines(lines.slice(1)) }]);
      pending = null;
      continue;
    }

    // (f) ism alohida blokda, matn keyingi blokda
    if (labelShape(first) && lines.length === 1 && known.has(first.toLowerCase())) {
      pending = first;
      continue;
    }
    if (pending) {
      startTurn(pending, [{ type: "p", text: joinLines(lines) }]);
      pending = null;
      continue;
    }

    // (g) oddiy abzats
    const p = { type: "p", text: joinLines(lines) };
    if (!seenTurn) header.push(b);
    else if (turn) turn.parts.push(p);
    else out.push(p);
  }
  return { header, items: out, hasTurns: seenTurn };
}

/* ---------- 5. Sarlavha, kicker, credit ---------- */
export function pickMeta(header, hasTurns, removed, fallbackTitle) {
  const lines = header.flatMap((b) => b.lines).filter((l) => !BOILERPLATE.test(l));
  const titleish = lines.filter((l) => l.length <= 90 && !/[.,;]$/.test(l));
  const intro = lines.filter((l) => !titleish.includes(l));

  let title = "";
  let kicker = "";
  if (titleish.length) {
    title = titleish[titleish.length - 1];
    kicker = titleish.slice(0, -1).slice(-2).join(" · ");
  }
  if (!title) title = fallbackTitle || "Transcript";

  // asl nashr ma'lumoti (©) — qoldiramiz
  let credit = "";
  const joined = removed.join(" | ");
  const c = joined.match(/©\s*[^|]*?\d{4}/);
  const d = joined.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|co\.uk|uz|io|edu)\b/i);
  if (c || d) credit = ["Original: " + (d ? d[0] : ""), c ? c[0].replace("©", "© ") : ""].filter((x) => x !== "Original: ").join(" · ");

  return { title, kicker, credit, intro };
}

/* ---------- Asosiy funksiya ---------- */
export async function parseTranscript(pdf, { fallbackTitle = "" } = {}) {
  const raw = await readLines(pdf);
  const { pages, removed } = stripRunning(raw);
  const blocks = toBlocks(pages);
  const { header, items, hasTurns } = structure(blocks);

  let metaHeader = header;
  let body = items;
  // suhbatsiz (oddiy matn) hujjatda birinchi qisqa blok sarlavha deb olinadi
  if (!hasTurns && header.length) {
    const first = header[0];
    if (first.lines.length <= 2 && first.lines.join(" ").length <= 90) {
      metaHeader = [first];
      body = [...header.slice(1).map((b) => ({ type: "p", text: joinLines(b.lines) })), ...items];
    } else {
      metaHeader = [];
      body = [...header.map((b) => ({ type: "p", text: joinLines(b.lines) })), ...items];
    }
  }
  const meta = pickMeta(metaHeader, hasTurns, removed, fallbackTitle);
  if (hasTurns) body = [...meta.intro.map((t) => ({ type: "p", text: t })), ...body];
  return { title: meta.title, kicker: meta.kicker, credit: meta.credit, items: body };
}
