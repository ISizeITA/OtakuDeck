import { copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const envExample = join(root, ".env.example");

console.log("OtakuDeck setup\n");

if (!existsSync(envPath)) {
  copyFileSync(envExample, envPath);
  console.log("Created .env from .env.example — add your VITE_MAL_CLIENT_ID");
} else {
  console.log(".env already exists");
}

console.log("\nGenerating icons...");
execSync("node scripts/generate-icons.mjs", { cwd: root, stdio: "inherit" });

console.log("\nInstalling npm dependencies...");
execSync("npm install", { cwd: root, stdio: "inherit" });

console.log(`
Setup complete!

Next steps:
1. Edit .env and set VITE_MAL_CLIENT_ID from https://myanimelist.net/apiconfig
2. Register BOTH redirect URIs in your MAL app:
   - http://127.0.0.1:14568/callback  (Windows)
   - otakudeck://callback              (Android)
3. Run: npm run tauri:dev
`);
