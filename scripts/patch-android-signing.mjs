import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gradlePath = path.join(
  root,
  "src-tauri/gen/android/app/build.gradle.kts",
);

if (!fs.existsSync(gradlePath)) {
  console.warn("[patch-android-signing] Gradle file not found, skipping patch.");
  process.exit(0);
}

const marker = "signingConfigs {";
let content = fs.readFileSync(gradlePath, "utf8");

if (content.includes(marker)) {
  console.log("[patch-android-signing] Signing config already present.");
  process.exit(0);
}

const signingBlock = `
    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()
            if (keystorePropertiesFile.exists()) {
                keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["password"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["password"] as String
            } else {
                storeFile = file("\${System.getProperty("user.home")}/.android/debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }
`;

if (!content.includes("buildTypes {")) {
  console.error("[patch-android-signing] Unexpected build.gradle.kts layout.");
  process.exit(1);
}

content = content.replace("    buildTypes {", `${signingBlock}\n    buildTypes {`);

content = content.replace(
  /getByName\("release"\) \{\s*\n(\s*)isMinifyEnabled = true/,
  'getByName("release") {\n$1signingConfig = signingConfigs.getByName("release")\n$1isMinifyEnabled = true',
);

fs.writeFileSync(gradlePath, content);
console.log("[patch-android-signing] Applied release signing to build.gradle.kts");
