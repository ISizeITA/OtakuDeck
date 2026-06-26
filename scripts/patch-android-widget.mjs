import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const extras = join(root, "android-extras");
const packageName = "com.otakudeck.app";

const androidRoots = [
  join(root, "src-tauri", "gen", "android", "app", "src", "main"),
];

function copyRecursive(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

function mergeStringsXml(targetPath, extraPath) {
  if (!existsSync(extraPath)) return;
  const extra = readFileSync(extraPath, "utf8");
  if (!existsSync(targetPath)) {
    writeFileSync(targetPath, extra);
    return;
  }
  let base = readFileSync(targetPath, "utf8");
  const matches = extra.match(/<string name="[^"]+">[^<]*<\/string>/g) ?? [];
  for (const line of matches) {
    const name = line.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    if (base.includes(`name="${name}"`)) continue;
    base = base.replace("</resources>", `    ${line}\n</resources>`);
  }
  writeFileSync(targetPath, base);
}

function patchManifest(manifestPath) {
  if (!existsSync(manifestPath)) return false;
  let xml = readFileSync(manifestPath, "utf8");
  if (xml.includes("AiringTodayWidgetProvider")) return true;

  const receiver = `
        <receiver
            android:name=".AiringTodayWidgetProvider"
            android:exported="false"
            android:label="@string/widget_airing_title">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/airing_today_widget_info" />
        </receiver>`;

  if (!xml.includes("REQUEST_INSTALL_PACKAGES")) {
    xml = xml.replace(
      "<application",
      '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application',
    );
  }

  xml = xml.replace("</application>", `${receiver}\n    </application>`);
  writeFileSync(manifestPath, xml);
  return true;
}

function patchMainActivity(mainPath) {
  if (!existsSync(mainPath)) return false;
  let source = readFileSync(mainPath, "utf8");
  if (source.includes("WidgetRefresh.updateAll")) return true;

  if (!source.includes("import com.otakudeck.app.WidgetRefresh")) {
    const pkg = packageName;
    source = source.replace(
      `package ${pkg}`,
      `package ${pkg}\n\nimport com.otakudeck.app.WidgetRefresh`,
    );
  }

  source = source.replace(
    /override fun onResume\(\)\s*\{/,
    "override fun onResume() {\n        WidgetRefresh.updateAll(this)",
  );

  writeFileSync(mainPath, source);
  return true;
}

let patched = false;
for (const mainRoot of androidRoots) {
  if (!existsSync(mainRoot)) continue;

  const javaDir = join(mainRoot, "java", ...packageName.split("."));
  mkdirSync(javaDir, { recursive: true });
  copyRecursive(join(extras, "kotlin"), javaDir);
  copyRecursive(join(extras, "res", "layout"), join(mainRoot, "res", "layout"));
  copyRecursive(join(extras, "res", "xml"), join(mainRoot, "res", "xml"));
  mergeStringsXml(
    join(mainRoot, "res", "values", "strings.xml"),
    join(extras, "res", "values", "widget_strings.xml"),
  );

  patchManifest(join(mainRoot, "AndroidManifest.xml"));
  patchMainActivity(join(javaDir, "MainActivity.kt"));
  patched = true;
  console.log("Patched Android widget:", mainRoot);
}

if (!patched) {
  console.log("Android project not found — widget patch runs before `tauri android build`.");
}
