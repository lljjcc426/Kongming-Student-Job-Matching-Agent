const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const harmonyRoot = path.join(repoRoot, "harmony");
const required = [
  "build-profile.json5",
  "oh-package.json5",
  "AppScope/app.json5",
  "AppScope/resources/base/profile/configuration.json",
  "entry/build-profile.json5",
  "entry/src/main/module.json5",
  "entry/src/main/ets/entryability/EntryAbility.ets",
  "entry/src/main/ets/pages/NativeIndex.ets",
  "entry/src/main/ets/common/NativeAiService.ets",
  "entry/src/main/ets/common/NativeCapabilityService.ets",
  "entry/src/main/ets/common/NativeCalendarService.ets",
  "entry/src/main/ets/common/NativeEvidenceService.ets",
  "entry/src/main/ets/common/NativeJobService.ets",
  "entry/src/main/ets/common/NativeWorkspaceModel.ets",
  "entry/src/main/ets/components/NativeApplicationTracker.ets",
  "entry/src/main/ets/components/NativeEvidenceLedger.ets",
  "entry/src/main/ets/components/NativeResumeVersionPanel.ets",
  "entry/src/main/ets/applicationformability/ApplicationFormAbility.ets",
  "entry/src/main/ets/applicationform/pages/ApplicationCard.ets",
  "entry/src/main/ets/common/CareerFormStore.ets",
  "entry/src/main/resources/base/profile/main_pages.json",
  "entry/src/main/resources/base/profile/form_config.json",
  "entry/src/main/resources/base/media/startIconNative.png",
  "entry/src/main/resources/dark/element/color.json",
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
const hvigorConfig = readHarmonyFile("hvigor/hvigor-config.json5");
const appScope = readHarmonyFile("AppScope/app.json5");
const appConfiguration = readHarmonyFile("AppScope/resources/base/profile/configuration.json");
const moduleProfile = readHarmonyFile("entry/src/main/module.json5");
const entryAbility = readHarmonyFile("entry/src/main/ets/entryability/EntryAbility.ets");
const page = readHarmonyFile("entry/src/main/ets/pages/NativeIndex.ets");
const nativeAiService = readHarmonyFile("entry/src/main/ets/common/NativeAiService.ets");
const nativeService = readHarmonyFile("entry/src/main/ets/common/NativeCapabilityService.ets");
const nativeCalendarService = readHarmonyFile("entry/src/main/ets/common/NativeCalendarService.ets");
const nativeEvidenceService = readHarmonyFile("entry/src/main/ets/common/NativeEvidenceService.ets");
const nativeJobService = readHarmonyFile("entry/src/main/ets/common/NativeJobService.ets");
const workspaceModel = readHarmonyFile("entry/src/main/ets/common/NativeWorkspaceModel.ets");
const applicationTracker = readHarmonyFile("entry/src/main/ets/components/NativeApplicationTracker.ets");
const evidenceLedger = readHarmonyFile("entry/src/main/ets/components/NativeEvidenceLedger.ets");
const resumeVersionPanel = readHarmonyFile("entry/src/main/ets/components/NativeResumeVersionPanel.ets");
const careerFormStore = readHarmonyFile("entry/src/main/ets/common/CareerFormStore.ets");
const applicationCard = readHarmonyFile("entry/src/main/ets/applicationform/pages/ApplicationCard.ets");
const applicationFormAbility = readHarmonyFile("entry/src/main/ets/applicationformability/ApplicationFormAbility.ets");
const nativeColors = readHarmonyFile("entry/src/main/resources/base/element/color.json");
const nativeDarkColors = readHarmonyFile("entry/src/main/resources/dark/element/color.json");
const nativeStrings = readHarmonyFile("entry/src/main/resources/base/element/string.json");
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
assert.match(hvigorConfig, /"parallel"\s*:\s*false/);
assert.match(hvigorConfig, /"optimizationStrategy"\s*:\s*"memory"/);
assert.match(appScope, /"bundleName"\s*:\s*"cn\.kongming\.jobmatch"/);
assert.doesNotMatch(appScope, /com\.example/);
assert.match(appScope, /"configuration"\s*:\s*"\$profile:configuration"/);
assert.match(appConfiguration, /"fontSizeScale"\s*:\s*"followSystem"/);
assert.match(appConfiguration, /"fontSizeMaxScale"\s*:\s*"1\.75"/);

assert.match(moduleProfile, /ohos\.want\.action\.sendData/);
assert.match(moduleProfile, /general\.text/);
assert.match(moduleProfile, /ohos\.permission\.INTERNET/);
assert.match(moduleProfile, /ohos\.permission\.CAMERA/);
assert.match(moduleProfile, /ohos\.permission\.MICROPHONE/);
assert.match(moduleProfile, /\$string:camera_permission_reason/);
assert.match(moduleProfile, /ApplicationFormAbility/);
assert.match(moduleProfile, /ohos\.extension\.form/);
assert.match(moduleProfile, /\$media:startIconNative/);

assert.match(page, /@Entry/);
assert.match(page, /@Component/);
assert.match(page, /private buildHome\(\)/);
assert.match(page, /private buildResume\(\)/);
assert.match(page, /private buildJobs\(\)/);
assert.match(page, /private buildInterview\(\)/);
assert.match(page, /private buildGrowth\(\)/);
assert.match(page, /private buildTargetJobSnapshot\(\)/);
assert.match(page, /private buildTrackedJobCard\(\)/);
assert.match(page, /private buildPublicJobSearch\(\)/);
assert.match(page, /private buildPublicJobCard\(job: NativePublicJob\)/);
assert.match(page, /private buildPublicJobDetail\(job: NativePublicJob\)/);
assert.match(page, /refreshPublicJobs/);
assert.match(page, /openPublicJob/);
assert.match(page, /Text\('今日重点'\)/);
assert.match(page, /private buildFieldLabel\(label: string/);
assert.match(page, /struct NativeFieldError/);
assert.match(page, /struct NativeStatusMessage/);
assert.match(page, /struct NativeAsyncStatePanel/);
assert.match(page, /publicJobsSearched/);
assert.match(page, /workspaceLoadFailed/);
assert.match(page, /publicJobsFailed/);
assert.match(page, /showDataCenter/);
assert.match(page, /private buildDataCenter\(\)/);
assert.match(page, /private requestClearWorkspaceData\(\)/);
assert.match(page, /await store\.delete\('snapshot'\)/);
assert.match(page, /华为账号登录状态和系统权限不会改变/);
assert.match(page, /private buildTaskContinuityBar\(\)/);
assert.match(page, /private buildWorkspaceContent\(\)/);
assert.match(page, /private primaryActionDestinationLabel\(\)/);
assert.match(page, /if \(!this\.resumeSummary\.trim\(\)\) return '导入或填写真实经历，建立求职画像'/);
assert.match(page, /Text\(`下一行动 · \$\{this\.primaryActionDestinationLabel\(\)\}`\)/);
assert.match(page, /private updateResumeDirtyState\(\)/);
assert.match(page, /private updateJobEditorDirtyState\(\)/);
assert.match(page, /private updateApplicationScheduleDirtyState\(\)/);
assert.doesNotMatch(page, /this\.resumeDirty = true/);
assert.doesNotMatch(page, /this\.jobEditorDirty = true/);
assert.doesNotMatch(page, /this\.applicationScheduleDirty = true/);
assert.match(page, /暂时无法恢复本机工作区/);
assert.match(page, /暂时无法读取官方岗位/);
assert.match(page, /private buildNavigationItem\(icon: Resource/);
assert.match(page, /sys\.symbol\.checkmark_circle/);
assert.match(page, /sys\.symbol\.exclamationmark_triangle/);
assert.match(page, /sys\.symbol\.info_circle/);
assert.match(page, /sys\.symbol\.house/);
assert.match(page, /sys\.symbol\.doc_text/);
assert.match(page, /sys\.symbol\.briefcase/);
assert.match(page, /sys\.symbol\.mic/);
assert.match(page, /sys\.symbol\.ranking/);
assert.doesNotMatch(page, /Text\('ArkUI 原生工作台'\)|Text\('原生能力边界'\)|Text\('原生 AI 模拟面试'\)/);
assert.match(page, /preferences\.getPreferences/);
assert.match(page, /saveWorkspace/);
assert.match(page, /updateAllCareerForms/);
assert.match(page, /@StorageProp\('FormRouteRequest'\).*@Watch\('onFormRouteRequestChanged'\)/);
assert.match(page, /private async syncCareerFormData\(\)/);
assert.match(page, /formData\.empiricalCoverage = this\.empiricalCoverage/);
assert.match(page, /formData\.growthCompletedCount = this\.verifiedGrowthCount\(\)/);
assert.match(page, /formData\.routePage = this\.formRoutePage\(\)/);
assert.match(page, /calendarService\.openReminderEditor/);
assert.doesNotMatch(page, /ArkWeb|WebviewController|Web\(\{|\.loadUrl\(|setPathAllowingUniversalAccess/);
assert.match(entryAbility, /FormRouteRequest/);
assert.match(entryAbility, /AppStorage\.setOrCreate\('FormRouteRequest'/);
assert.doesNotMatch(entryAbility, /pageStorage\.setOrCreate\('FormRouteRequest'/);
assert.match(entryAbility, /buildFormRouteRequest/);
assert.match(entryAbility, /want\.parameters\?\.\['params'\]/);
assert.match(entryAbility, /JSON\.parse\(serializedParams\)/);
assert.match(entryAbility, /FORM_ROUTE_PAGES\.includes\(page\)/);
assert.match(nativeService, /export class NativeCapabilityService/);
assert.match(nativeService, /@kit\.AccountKit/);
assert.match(nativeService, /@kit\.CoreVisionKit/);
assert.match(nativeService, /@kit\.CoreSpeechKit/);
assert.match(nativeService, /@kit\.ShareKit/);
assert.match(nativeService, /updateApplicationForm/);
assert.match(nativeService, /async loginWithHuawei\(\)/);
assert.match(nativeService, /async shareText\(/);
assert.match(nativeService, /async speakText\(/);
assert.match(nativeService, /async startSpeechRecognition\(\)/);
assert.match(nativeCalendarService, /@kit\.CalendarKit/);
assert.match(nativeCalendarService, /calendarManager\.getCalendarManager/);
assert.match(nativeCalendarService, /manager\.editEvent/);
assert.match(nativeCalendarService, /reminderTime:/);
assert.match(nativeCalendarService, /YYYY-MM-DD HH:mm/);
assert.equal(nativeCalendarService.includes('/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/'), true);
assert.match(nativeJobService, /export class NativeJobService/);
assert.match(nativeJobService, /@kit\.NetworkKit/);
assert.match(nativeJobService, /http\.createHttp\(\)/);
assert.match(nativeJobService, /job_service_url/);
assert.match(nativeJobService, /connectTimeout:\s*10000/);
assert.match(nativeJobService, /failed: boolean/);
assert.match(nativeJobService, /new NativeJobFeed\(true, true/);
assert.match(nativeStrings, /"name"\s*:\s*"job_service_url"/);
assert.match(nativeAiService, /export class NativeAiService/);
assert.match(nativeAiService, /@kit\.NetworkKit/);
assert.match(nativeAiService, /ark_service_url/);
assert.match(nativeAiService, /http\.RequestMethod\.POST/);
assert.match(nativeAiService, /task:\s*'career-chat'/);
assert.match(nativeAiService, /generateInterviewQuestion/);
assert.match(nativeAiService, /generateInterviewFeedback/);
assert.match(nativeAiService, /手机号已隐藏/);
assert.match(nativeAiService, /邮箱已隐藏/);
assert.match(nativeAiService, /身份证号已隐藏/);
assert.match(nativeAiService, /readTimeout:\s*45000/);
assert.doesNotMatch(nativeAiService, /Authorization|ARK_API_KEY|ArkWeb|WebviewController|Web\(\{/);
assert.match(nativeEvidenceService, /export class NativeEvidenceService/);
assert.match(nativeEvidenceService, /@kit\.NetworkKit/);
assert.match(nativeEvidenceService, /connection\.getAddressesByName/);
assert.match(nativeEvidenceService, /url\.URL\.parseURL/);
assert.match(nativeEvidenceService, /http\.RequestMethod\.HEAD/);
assert.match(nativeEvidenceService, /http\.RequestMethod\.GET/);
assert.match(nativeEvidenceService, /requestInStream/);
assert.match(nativeEvidenceService, /Range:\s*'bytes=0-0'/);
assert.match(nativeEvidenceService, /shouldFallbackToGet/);
assert.match(nativeEvidenceService, /maxRedirects:\s*0/);
assert.match(nativeEvidenceService, /first === 192 && \(second === 0 \|\| second === 168\)/);
assert.match(nativeEvidenceService, /2300047/);
assert.match(nativeEvidenceService, /sourceHost/);
assert.doesNotMatch(nativeEvidenceService, /Authorization|ARK_API_KEY|ArkWeb|WebviewController|Web\(\{/);
assert.match(nativeStrings, /"name"\s*:\s*"ark_service_url"/);
assert.match(nativeColors, /"name"\s*:\s*"km_page_background"/);
assert.match(nativeColors, /"name"\s*:\s*"km_primary"/);
assert.match(nativeColors, /"name"\s*:\s*"km_teal"/);
assert.match(nativeColors, /"name"\s*:\s*"km_text_on_primary"/);
assert.match(nativeColors, /"name"\s*:\s*"km_surface_elevated"/);
assert.match(nativeDarkColors, /"name"\s*:\s*"km_page_background"/);
assert.match(nativeDarkColors, /"name"\s*:\s*"km_primary_hero"/);
const nativeColorNames = JSON.parse(nativeColors).color.map((item) => item.name).sort();
const nativeDarkColorNames = JSON.parse(nativeDarkColors).color.map((item) => item.name).sort();
assert.deepEqual(nativeDarkColorNames, nativeColorNames);
assert.match(workspaceModel, /export class NativeGrowthTask/);
assert.match(workspaceModel, /export class NativeGrowthEvidenceRecord/);
assert.match(workspaceModel, /export class NativeJobEvidence/);
assert.match(workspaceModel, /export class NativeApplicationEvent/);
assert.match(workspaceModel, /export class NativeApplicationStageOption/);
assert.match(workspaceModel, /export class NativeResumeVersion/);
assert.match(workspaceModel, /export class NativeInterviewTurn/);
assert.match(workspaceModel, /applicationDeadline: string/);
assert.match(workspaceModel, /nextInterviewAt: string/);
assert.match(workspaceModel, /applicationEvents: NativeApplicationEvent\[\]/);
assert.match(workspaceModel, /applicationResumeVersionId: string/);
assert.match(workspaceModel, /resumeVersions: NativeResumeVersion\[\]/);
assert.match(workspaceModel, /interviewTurns: NativeInterviewTurn\[\]/);
assert.match(workspaceModel, /interviewFeedback: string/);
assert.match(workspaceModel, /growthEvidenceRecords: NativeGrowthEvidenceRecord\[\]/);
assert.match(workspaceModel, /growthBaselineCoverage: number/);
assert.match(workspaceModel, /sourceVerification: string/);
assert.match(workspaceModel, /sourceCheckedAt: string/);
assert.match(workspaceModel, /sourceHttpStatus: number/);
assert.match(workspaceModel, /sourceCheckMethod: string/);
assert.match(workspaceModel, /trackedJobSource: string/);
assert.match(workspaceModel, /trackedJobDescription: string/);
assert.match(page, /buildNativeCapabilityCard/);
assert.match(page, /loginHuawei/);
assert.match(page, /shareProgress/);
assert.match(page, /toggleSpeechInput/);
assert.match(page, /saveTrackedJob/);
assert.match(page, /applicationStage: this\.applicationStage/);
assert.match(page, /applicationEvents: this\.applicationEvents/);
assert.match(page, /updateApplicationStage/);
assert.match(page, /saveApplicationSchedule/);
assert.match(page, /saveNativeResumeVersion/);
assert.match(page, /bindNativeResumeVersion/);
assert.match(page, /deleteNativeResumeVersion/);
assert.match(page, /进入“\$\{this\.applicationStageLabel\(stageId\)\}”前，请先在简历页保存并绑定实际投递版本/);
assert.match(page, /modelConsent/);
assert.match(page, /submitInterviewAnswer/);
assert.match(page, /generateInterviewQuestion/);
assert.match(page, /generateInterviewFeedback/);
assert.match(page, /growthEvidenceFingerprint/);
assert.match(page, /evidenceService\.verifyPublicHttps/);
assert.match(page, /evidenceChecking: this\.evidenceChecking/);
assert.match(page, /revokeGrowthEvidence/);
assert.match(page, /growthBaselineCoverage \+ this\.growthGainForTasks\(nextTasks\)/);
assert.match(page, /private growthGainForTasks\(tasks: NativeGrowthTask\[\]\): number/);
assert.match(page, /KeyboardAvoidMode\.RESIZE/);
assert.match(page, /matchMediaSync\('\(600vp<=width\)'\)/);
assert.match(page, /private buildRailNavigation\(\)/);
assert.match(page, /constraintSize\(\{ minHeight:/);
assert.match(page, /expandSafeArea\(\[SafeAreaType\.SYSTEM\], \[SafeAreaEdge\.TOP, SafeAreaEdge\.BOTTOM\]\)/);
assert.match(page, /private showConfirmDialog\(/);
assert.match(page, /private hasUnsavedChanges\(\): boolean/);
assert.match(page, /private requestDeleteNativeResumeVersion\(/);
assert.match(page, /private requestRemoveTrackedJob\(/);
assert.match(page, /private requestResetInterview\(/);
assert.match(page, /private requestRevokeGrowthEvidence\(/);
assert.match(page, /workspaceSaveFailed/);
assert.match(page, /private validateResumeSummary\(/);
assert.match(page, /private validateLocalDateTime\(/);
assert.match(page, /Progress\(\{ value: this\.empiricalCoverage, total: 100/);
assert.match(page, /struct NativeMetricCard/);
assert.match(page, /@Prop value: string/);
assert.match(page, /请补充可核验的 HTTPS 代码仓库、报告或演示链接/);
assert.match(page, /growthEvidenceRecords: this\.growthEvidenceRecords/);
assert.match(page, /本次训练使用智能增强/);
assert.match(page, /外部模型未授权，已完成本机结构化反馈/);
assert.match(page, /NativeApplicationTracker\(\{/);
assert.match(page, /NativeResumeVersionPanel\(\{/);
assert.match(page, /formData\.applicationStage/);
assert.match(page, /formData\.nextAction = this\.primaryNextAction\(\)/);
assert.match(page, /请填写可追溯的岗位来源链接/);
assert.match(page, /const resumeText = this\.resumeSummary\.toLowerCase\(\)/);
assert.match(page, /ForEach\(this\.jobEvidence/);
assert.doesNotMatch(page, /https?:\/\/[^'"]+/);
assert.match(applicationTracker, /@Component/);
assert.match(applicationTracker, /投递进度/);
assert.match(applicationTracker, /阶段时间线/);
assert.match(applicationTracker, /保存投递日程/);
assert.match(applicationTracker, /投递截止/);
assert.match(applicationTracker, /下一场面试/);
assert.match(applicationTracker, /applicationDeadlineError/);
assert.match(applicationTracker, /nextInterviewAtError/);
assert.match(applicationTracker, /添加截止提醒/);
assert.match(applicationTracker, /添加面试提醒/);
assert.doesNotMatch(applicationTracker, /ArkWeb|WebviewController|Web\(\{/);
assert.match(evidenceLedger, /export struct NativeEvidenceLedger/);
assert.match(evidenceLedger, /Text\('证据说明'\)/);
assert.match(evidenceLedger, /Text\('来源链接'\)/);
assert.match(evidenceLedger, /我确认内容真实，且来源链接可供核验/);
assert.match(evidenceLedger, /证据账本/);
assert.match(evidenceLedger, /撤销验证/);
assert.match(evidenceLedger, /打开来源/);
assert.match(evidenceLedger, /正在核验 HTTPS 来源/);
assert.match(evidenceLedger, /evidenceDraftError/);
assert.match(evidenceLedger, /evidenceSourceError/);
assert.match(evidenceLedger, /来源可访问/);
assert.match(evidenceLedger, /`\$\{task\.id\}-\$\{task\.status\}`/);
assert.match(evidenceLedger, /`\$\{record\.id\}-\$\{record\.status\}`/);
assert.doesNotMatch(evidenceLedger, /ArkWeb|WebviewController|Web\(\{/);
assert.match(resumeVersionPanel, /投递简历版本/);
assert.match(resumeVersionPanel, /保存并绑定当前投递版本/);
assert.match(resumeVersionPanel, /绑定此版本/);
assert.doesNotMatch(resumeVersionPanel, /ArkWeb|WebviewController|Web\(\{/);
assert.match(careerFormStore, /application_stage/);
assert.match(careerFormStore, /empirical_coverage/);
assert.match(careerFormStore, /growth_completed_count/);
assert.match(careerFormStore, /route_page/);
assert.match(careerFormStore, /empiricalCoverage: number = 42/);
assert.match(careerFormStore, /function normalizedFormData\(/);
assert.match(careerFormStore, /const MAX_FORM_IDS: number = 100/);
assert.match(careerFormStore, /function normalizedFormIds\(/);
assert.match(careerFormStore, /ids\.includes\(formId\)/);
assert.match(careerFormStore, /FORM_ROUTE_PAGES\.includes\(routePage\)/);
assert.match(careerFormStore, /Application form synchronization preparation failed/);
assert.match(page, /Application form synchronization failed/);
assert.match(applicationFormAbility, /private runFormTask\(/);
assert.match(applicationFormAbility, /task\.catch\(\(error: Error\)/);
assert.match(applicationCard, /applicationStage/);
assert.match(applicationCard, /postCardAction\(this, \{/);
assert.match(applicationCard, /bundleName: 'cn\.kongming\.jobmatch'/);
assert.match(applicationCard, /moduleName: 'entry'/);
assert.match(applicationCard, /params: \{ page: this\.targetPage\(\) \}/);
assert.match(applicationCard, /growthCompletedCount/);
assert.match(applicationCard, /Progress\(\{ value: this\.empiricalCoverage/);
assert.match(applicationCard, /private compactUpdatedAt\(\): string/);

assert.match(packageJson, /"build:web:harmony"\s*:\s*"tsc -b && vite build --base \.\/"/);
assert.match(packageJson, /"sync:harmony:web"/);
assert.match(packageJson, /"build:harmony"/);
assert.match(packageJson, /"build:harmony:web-compat"/);
assert.match(packageJson, /"build:harmony:release"/);
assert.match(packageJson, /build:harmony:local[^\n]+10\.0\.2\.2:5173/);
assert.match(harmonyBuildScript, /IncludeWebCompatibility/);
assert.match(harmonyBuildScript, /Native ArkUI build selected/);
assert.match(harmonyBuildScript, /DevEcoRoot = 'D:\\DevEco Studio'/);
assert.match(harmonyBuildScript, /AsciiBuildRoot = 'D:\\KongMing-Harmony-Build'/);
assert.match(harmonyBuildScript, /TempRoot = 'D:\\KongMing-Harmony-Temp'/);
assert.match(harmonyBuildScript, /--max-semi-space-size=128/);
assert.match(harmonyBuildScript, /Using ASCII staging path/);
assert.match(harmonyBuildScript, /Set-NativeStringResource/);
assert.match(harmonyBuildScript, /Embedding native job service URL/);
assert.match(harmonyBuildScript, /Embedding native model service URL/);
assert.match(harmonyBuildScript, /Set-NativeStringResource \$buildHarmonyRoot 'ark_service_url'/);
assert.match(harmonyBuildScript, /'10\.0\.2\.2'/);
assert.match(syncScript, /harmony\\entry\\src\\main\\resources\\resfile/);
assert.match(syncScript, /Refusing to sync outside the Harmony resources directory/);
assert.match(syncScript, /npm run build:web:harmony/);

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
assert.match(harmonyRunScript, /LocalDevHost = '10\.0\.2\.2'/);
assert.match(harmonyRunScript, /\[string\]\$BootMode = 'coldboot'/);
assert.match(harmonyRunScript, /DevEcoRoot = 'D:\\DevEco Studio'/);
assert.match(harmonyRunScript, /Running emulator has no connected HDC target/);
assert.match(pdfSource, /import\.meta\.env\.BASE_URL\}vendor\/pdfjs\/cmaps\//);
assert.match(live2dSource, /const PUBLIC_BASE = import\.meta\.env\.BASE_URL/);
assert.match(interviewPageSource, /import\.meta\.env\.BASE_URL\}avatars\/interviewer\/interview-room\.png/);
assert.match(harmonyBridgeSource, /recognizeImageWithHarmony/);
assert.match(harmonyBridgeSource, /shareTextWithHarmony/);
assert.match(harmonyBridgeSource, /startSpeechRecognitionWithHarmony/);
assert.match(harmonyBridgeSource, /updateApplicationFormWithHarmony/);

console.log("HarmonyOS native project verification passed");
