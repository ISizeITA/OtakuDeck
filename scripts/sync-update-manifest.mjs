import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const manifestPath = join(root, "updates", "manifest.json");

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node scripts/sync-update-manifest.mjs v0.1.2");
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const repo = "ISizeITA/OtakuDeck";

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
manifest.released_at = new Date().toISOString().slice(0, 10);
manifest.release_url = `https://github.com/${repo}/releases/tag/${tag}`;
manifest.platforms = {
  windows: {
    download_url: `https://github.com/${repo}/releases/download/${tag}/OtakuDeck_${version}_x64-setup.exe`,
  },
  android: {
    download_url: `https://github.com/${repo}/releases/download/${tag}/OtakuDeck-universal-release.apk`,
  },
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updated manifest to ${version}`);
