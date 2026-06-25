import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iconsDir = join(root, "src-tauri", "icons");
const svgPath = join(root, "src", "assets", "app-icon.svg");

mkdirSync(iconsDir, { recursive: true });

const svg = readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
  background: "transparent",
});
const png = resvg.render().asPng();
const sourcePath = join(iconsDir, "icon.png");

writeFileSync(sourcePath, png);
console.log("Rendered app-icon.svg ->", sourcePath);

execSync(`npx tauri icon "${sourcePath}"`, {
  cwd: root,
  stdio: "inherit",
});

execSync("node scripts/patch-android-icons.mjs", {
  cwd: root,
  stdio: "inherit",
});

console.log("Tauri platform icons updated.");
