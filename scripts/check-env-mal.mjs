import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

if (!fs.existsSync(envPath)) {
  console.error("MISSING .env");
  process.exit(1);
}

const raw = fs.readFileSync(envPath);
const bom =
  raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
    ? "utf8-bom"
    : raw[1] === 0
      ? "utf16"
      : "none";

let text = raw.toString(bom === "utf16" ? "utf16le" : "utf8");
if (bom === "utf8-bom") text = text.slice(1);

for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  if (!key.includes("MAL")) continue;
  const value = trimmed
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  console.log(`${key}: len=${value.length} placeholder=${/your_client_id|INCOLLA/i.test(value)}`);
}
