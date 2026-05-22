/**
 * Converts electron/assets/icon.svg → icon.png, icon.ico, icon.icns
 * Run once from the project root:  node scripts/generate-icons.mjs
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import png2icons from "png2icons";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assets = join(__dirname, "..", "electron", "assets");

console.log("Generating icons from icon.svg …\n");

// Render SVG at 1024×1024 — the source for all other formats.
const src = await sharp(join(assets, "icon.svg"))
  .resize(1024, 1024)
  .png()
  .toBuffer();

// ── PNG 512×512 (Linux tray / AppImage) ──────────────────────────────────────
const png512 = await sharp(src).resize(512, 512).png().toBuffer();
writeFileSync(join(assets, "icon.png"), png512);
console.log("✔  icon.png   (512×512, Linux)");

// ── ICO (Windows — embeds 16, 32, 48, 64, 128, 256 px) ───────────────────────
const ico = png2icons.createICO(src, png2icons.HERMITE, 0, true);
if (!ico) throw new Error("ICO generation failed");
writeFileSync(join(assets, "icon.ico"), ico);
console.log("✔  icon.ico   (multi-res, Windows)");

// ── ICNS (macOS — embeds 16 … 1024 px) ───────────────────────────────────────
const icns = png2icons.createICNS(src, png2icons.HERMITE, 0);
if (!icns) throw new Error("ICNS generation failed");
writeFileSync(join(assets, "icon.icns"), icns);
console.log("✔  icon.icns  (multi-res, macOS)");

console.log("\nAll icons written to electron/assets/");
