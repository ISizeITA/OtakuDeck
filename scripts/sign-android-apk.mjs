import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apkDir = path.join(
  root,
  "src-tauri/gen/android/app/build/outputs/apk/universal/release",
);

function findBuildTools() {
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), "AppData/Local/Android/Sdk");

  const buildToolsDir = path.join(sdkRoot, "build-tools");
  if (!fs.existsSync(buildToolsDir)) {
    throw new Error(`Android build-tools not found under ${buildToolsDir}`);
  }

  const versions = fs
    .readdirSync(buildToolsDir)
    .filter((name) => fs.statSync(path.join(buildToolsDir, name)).isDirectory())
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const version = versions[0];
  if (!version) {
    throw new Error("No build-tools versions installed.");
  }

  return path.join(buildToolsDir, version);
}

function verifyApk(apksigner, apkPath) {
  execSync(`"${apksigner}" verify --verbose "${apkPath}"`, {
    stdio: "inherit",
    shell: true,
  });
}

if (!fs.existsSync(apkDir)) {
  console.warn("[sign-android-apk] APK output directory not found.");
  process.exit(0);
}

const signedApk = path.join(apkDir, "app-universal-release.apk");
const unsignedApk = path.join(apkDir, "app-universal-release-unsigned.apk");

if (fs.existsSync(signedApk)) {
  const buildTools = findBuildTools();
  const apksigner = path.join(
    buildTools,
    process.platform === "win32" ? "apksigner.bat" : "apksigner",
  );
  console.log("[sign-android-apk] Verifying signed APK...");
  verifyApk(apksigner, signedApk);
  const dest = path.join(root, "OtakuDeck-universal-release.apk");
  fs.copyFileSync(signedApk, dest);
  console.log(`[sign-android-apk] Ready: ${dest}`);
  process.exit(0);
}

if (!fs.existsSync(unsignedApk)) {
  console.warn("[sign-android-apk] No APK found to sign.");
  process.exit(1);
}

const debugKeystore = path.join(os.homedir(), ".android/debug.keystore");
if (!fs.existsSync(debugKeystore)) {
  throw new Error(
    `Debug keystore not found at ${debugKeystore}. Run an Android emulator build once or create a keystore.`,
  );
}

const buildTools = findBuildTools();
const apksigner = path.join(
  buildTools,
  process.platform === "win32" ? "apksigner.bat" : "apksigner",
);
const zipalign = path.join(
  buildTools,
  process.platform === "win32" ? "zipalign.exe" : "zipalign",
);

const alignedApk = path.join(apkDir, "app-universal-release-aligned.apk");
execSync(
  `"${zipalign}" -f -p 4 "${unsignedApk}" "${alignedApk}"`,
  { stdio: "inherit", shell: true },
);

execSync(
  `"${apksigner}" sign --ks "${debugKeystore}" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "${signedApk}" "${alignedApk}"`,
  { stdio: "inherit", shell: true },
);

fs.unlinkSync(alignedApk);

console.log("[sign-android-apk] Verifying signed APK...");
verifyApk(apksigner, signedApk);

const dest = path.join(root, "OtakuDeck-universal-release.apk");
fs.copyFileSync(signedApk, dest);
console.log(`[sign-android-apk] Ready: ${dest}`);
