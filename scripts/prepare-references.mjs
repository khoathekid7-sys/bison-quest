// Shrinks reference photos in public/references/ so the photo checker can use
// them (phone photos are often 5–12 MB; the API accepts up to 5 MB per image).
// Each photo is rotated upright, resized to at most 1280 px, and re-saved as
// JPEG in place. Safe to run more than once.
//
// The GitHub Pages deploy runs this automatically. You can also run it yourself:
//   node scripts/prepare-references.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../public/references/", import.meta.url));
const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
let count = 0;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (exts.has(path.extname(entry.name).toLowerCase())) yield p;
  }
}

for (const file of walk(root)) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== ".jpg" && ext !== ".jpeg") {
    console.warn(`Skipping ${path.relative(root, file)}: please save reference photos as .jpg (list the .jpg name in hunt.ts).`);
    continue;
  }
  const input = fs.readFileSync(file);
  const out = await sharp(input)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  if (out.length < input.length) fs.writeFileSync(file, out);
  count++;
  console.log(`✓ ${path.relative(root, file)} (${Math.round(Math.min(out.length, input.length) / 1024)} KB)`);
}
console.log(count ? `Prepared ${count} reference photo(s).` : "No reference photos yet (that's OK).");
