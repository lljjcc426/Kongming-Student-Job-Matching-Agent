const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const harmonyRoot = path.join(repoRoot, "harmony");
const required = [
  "build-profile.json5",
  "oh-package.json5",
  "AppScope/app.json5",
  "entry/build-profile.json5",
  "entry/src/main/module.json5",
  "entry/src/main/ets/entryability/EntryAbility.ets",
  "entry/src/main/ets/pages/Index.ets",
  "entry/src/main/ets/applicationformability/ApplicationFormAbility.ets",
  "entry/src/main/ets/applicationform/pages/ApplicationCard.ets",
  "entry/src/main/ets/common/CareerFormStore.ets",
  "entry/src/main/resources/base/profile/main_pages.json",
  "entry/src/main/resources/base/profile/form_config.json",
  "entry/src/main/resources/resfile/index.html",
];

required.forEach((relative) => {
  assert.equal(
    fs.existsSync(path.join(harmonyRoot, relative)),
    true,
    `missing HarmonyOS project file: ${relative}`,
  );
});

const readRepoFile = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const readHarmonyFile = (relative) => fs.readFileSync(path.join(harmonyRoot, relative), "utf8");

const buildProfile = readHarmonyFile("build-profile.json5");
const appScope = readHarmonyFile("AppScope/app.json5");
const moduleProfile = readHarmonyFile("entry/src/main/module.json5");
const page = readHarmonyFile("entry/src/main/ets/pages/Index.ets");
const packagedIndex = readHarmonyFile("entry/src/main/resources/resfile/index.html");
const packageJson = readRepoFile("package.json");
const syncScript = readRepoFile("scripts/sync-harmony-web.ps1");
const appSource = readRepoFile("src/App.tsx");
const arkClientSource = readRepoFile("src/arkClient.ts");
const jobApiSource = readRepoFile("src/jobApi.ts");
const harmonyBuildScript = readRepoFile("scripts/build-harmony.ps1");
const harmonyRunScript = readRepoFile("scripts/run-harmony-emulator.ps1");
const harmonyBridgeSource = readRepoFile("src/harmonyBridge.ts");
const pdfSource = readRepoFile("src/pdfResumeReader.ts");
const live2dSource = readRepoFile("src/components/interview/Live2DInterviewerAvatar.tsx");
const interviewPageSource = readRepoFile("src/pages/InterviewPage.tsx");

assert.match(buildProfile, /"targetSdkVersion"\s*:\s*"6\.1\.1\(24\)"/);
assert.match(appScope, /"bundleName"\s*:\s*"cn\.kongming\.jobmatch"/);
assert.doesNotMatch(appScope, /com\.example/);

assert.match(moduleProfile, /ohos\.want\.action\.sendData/);
assert.match(moduleProfile, /general\.text/);
assert.match(moduleProfile, /ohos\.permission\.INTERNET/);
assert.match(moduleProfile, /ohos\.permission\.CAMERA/);
assert.match(moduleProfile, /ohos\.permission\.MICROPHONE/);
assert.match(moduleProfile, /\$string:camera_permission_reason/);
assert.match(moduleProfile, /ApplicationFormAbility/);
assert.match(moduleProfile, /ohos\.extension\.form/);

assert.match(page, /from '@kit\.ArkWeb'/);
assert.match(page, /from '@kit\.CoreVisionKit'/);
assert.match(page, /from '@kit\.ShareKit'/);
assert.match(page, /from '@kit\.CoreSpeechKit'/);
assert.match(page, /setPathAllowingUniversalAccess\(\[resourceDir\]\)/);
assert.match(page, /loadUrl\(`file:\/\/\$\{resourceDir\}\/index\.html`\)/);
assert.match(page, /\.javaScriptAccess\(true\)/);
assert.match(page, /\.domStorageAccess\(true\)/);
assert.match(page, /\.onPermissionRequest\(/);
assert.match(page, /requestPermissionsFromUser\(context, nativePermissions\)/);
assert.doesNotMatch(page, /getContext\(this\)/);
assert.match(page, /request\.getOrigin\(\)\.startsWith\('file:\/\/'\)/);
assert.match(page, /recognizeResumeImage/);
assert.match(page, /textRecognition\.recognizeText/);
assert.match(page, /shareController\.show/);
assert.match(page, /startSpeechRecognition/);
assert.match(page, /updateApplicationForm/);
assert.match(page, /onlyMediaResources/);
assert.doesNotMatch(page, /https?:\/\/[^'"]+/);

assert.match(packageJson, /"build:web:harmony"\s*:\s*"tsc -b && vite build --base \.\/"/);
assert.match(packageJson, /"sync:harmony:web"/);
assert.match(packageJson, /"build:harmony"/);
assert.match(packageJson, /"build:harmony:release"/);
assert.match(syncScript, /harmony\\entry\\src\\main\\resources\\resfile/);
assert.match(syncScript, /Refusing to sync outside the Harmony resources directory/);
assert.match(syncScript, /npm run build:web:harmony/);

assert.match(packagedIndex, /\.\/assets\//);
assert.doesNotMatch(packagedIndex, /(?:src|href)="\/assets\//);
assert.match(appSource, /import\.meta\.env\.BASE_URL\}kongming-ip\.png/);
assert.match(arkClientSource, /import\.meta\.env\.VITE_ARK_API_URL\?\.trim\(\)/);
assert.match(arkClientSource, /window\.location\.protocol === "file:" \? "" : "\/api\/ark"/);
assert.doesNotMatch(arkClientSource, /vercel\.app/);
assert.match(jobApiSource, /import\.meta\.env\.VITE_JOBS_API_URL\?\.trim\(\)/);
assert.match(jobApiSource, /window\.location\.protocol === "file:" \? "" : "\/api\/jobs"/);
assert.match(harmonyBuildScript, /LocalDevApiBaseUrl/);
assert.match(harmonyBuildScript, /VITE_JOBS_API_URL/);
assert.match(harmonyBuildScript, /VITE_HEALTH_API_URL/);
assert.match(harmonyBuildScript, /RequireOnlineServices/);
assert.match(harmonyRunScript, /rport "tcp:\$LocalDevPort" "tcp:\$LocalDevPort"/);
assert.match(pdfSource, /import\.meta\.env\.BASE_URL\}vendor\/pdfjs\/cmaps\//);
assert.match(live2dSource, /const PUBLIC_BASE = import\.meta\.env\.BASE_URL/);
assert.match(interviewPageSource, /import\.meta\.env\.BASE_URL\}avatars\/interviewer\/interview-room\.png/);
assert.match(harmonyBridgeSource, /recognizeImageWithHarmony/);
assert.match(harmonyBridgeSource, /shareTextWithHarmony/);
assert.match(harmonyBridgeSource, /startSpeechRecognitionWithHarmony/);
assert.match(harmonyBridgeSource, /updateApplicationFormWithHarmony/);

console.log("HarmonyOS hybrid project verification passed");
