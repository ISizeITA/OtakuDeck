import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundledDir = path.join(root, "src-tauri/bundled");
const bundledPath = path.join(bundledDir, "mal.config.json");

function readEnvMalClientId(envPath) {
  if (!fs.existsSync(envPath)) return null;
  let text = fs.readFileSync(envPath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "VITE_MAL_CLIENT_ID" && key !== "MAL_CLIENT_ID") continue;
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (value && !/your_client_id|INCOLLA/i.test(value)) return value;
  }
  return null;
}

function readMalConfigJson(configPath) {
  if (!fs.existsSync(configPath)) return null;
  try {
    const json = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const value = String(json.clientId ?? json.client_id ?? "").trim();
    if (value && !/your_client_id|INCOLLA/i.test(value)) return value;
  } catch {
    return null;
  }
  return null;
}

function developerMalConfigPath() {
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (local) return path.join(local, "OtakuDeck", "mal.config.json");
  }
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "OtakuDeck",
      "mal.config.json",
    );
  }
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg || path.join(os.homedir(), ".local", "share");
  return path.join(base, "OtakuDeck", "mal.config.json");
}

const sources = [
  ["project mal.config.json", path.join(root, "mal.config.json")],
  [".env", path.join(root, ".env")],
  ["developer mal.config.json", developerMalConfigPath()],
];

let clientId = null;
let source = null;

for (const [label, configPath] of sources) {
  if (label.includes(".env")) {
    const fromEnv = readEnvMalClientId(configPath);
    if (fromEnv) {
      clientId = fromEnv;
      source = label;
      break;
    }
    continue;
  }

  const fromFile = readMalConfigJson(configPath);
  if (fromFile) {
    clientId = fromFile;
    source = label;
    break;
  }
}

if (!clientId) {
  console.error(
    "[sync-bundled-mal-client] MAL Client ID not found.\n" +
      "Set VITE_MAL_CLIENT_ID in .env or save it once in the desktop app (Settings / landing setup).\n" +
      "Checked: project mal.config.json, .env, " +
      developerMalConfigPath(),
  );
  process.exit(1);
}

fs.mkdirSync(bundledDir, { recursive: true });
fs.writeFileSync(
  bundledPath,
  JSON.stringify({ clientId }, null, 2) + "\n",
  "utf8",
);

console.log(
  `[sync-bundled-mal-client] Bundled Client ID from ${source} (${clientId.length} chars)`,
);
