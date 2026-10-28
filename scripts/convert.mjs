// Botsiz sinash: node scripts/convert.mjs kirish.pdf [chiqish.pdf] [dark|light]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "../lib/env.js";
loadEnv();
const { convertPdf } = await import("../lib/convert.js");

const [input, output = "natija.pdf", theme] = process.argv.slice(2);
if (!input) {
  console.log("Ishlatish: npm run convert -- kirish.pdf [natija.pdf] [dark|light]");
  process.exit(1);
}
const out = await convertPdf(readFileSync(input), { filename: path.basename(input), theme });
writeFileSync(output, out.pdf);
console.log(`Tayyor: ${output}`);
console.log(`Sarlavha: ${out.title}`);
console.log("\nCaption:\n" + out.caption);
