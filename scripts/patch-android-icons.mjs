import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const TRANSPARENT_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function patchDir(resDir) {
  if (!existsSync(resDir)) return false;

  const valuesDir = join(resDir, "values");
  mkdirSync(valuesDir, { recursive: true });

  const colorsPath = join(valuesDir, "colors.xml");
  let colorsXml = existsSync(colorsPath)
    ? readFileSync(colorsPath, "utf8")
    : `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n`;

  if (colorsXml.includes("ic_launcher_background")) {
    colorsXml = colorsXml.replace(
      /<color name="ic_launcher_background">[^<]*<\/color>/,
      '<color name="ic_launcher_background">#00000000</color>',
    );
  } else {
    colorsXml = colorsXml.replace(
      "</resources>",
      '  <color name="ic_launcher_background">#00000000</color>\n</resources>',
    );
  }

  writeFileSync(colorsPath, colorsXml);

  const legacyBgPath = join(valuesDir, "ic_launcher_background.xml");
  if (existsSync(legacyBgPath)) {
    unlinkSync(legacyBgPath);
  }

  for (const entry of readdirSync(resDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("mipmap")) continue;
    const bgPath = join(resDir, entry.name, "ic_launcher_background.png");
    writeFileSync(bgPath, TRANSPARENT_1X1_PNG);
  }

  return true;
}

const candidates = [
  join(root, "src-tauri", "gen", "android", "app", "src", "main", "res"),
  join(root, "src-tauri", "icons", "android"),
];

let patched = false;
for (const dir of candidates) {
  if (patchDir(dir)) {
    console.log("Patched Android icons:", dir);
    patched = true;
  }
}

if (!patched) {
  console.log("No Android res directory found yet — run after `tauri android build` if needed.");
}
