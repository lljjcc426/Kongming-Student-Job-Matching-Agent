const assert = require("node:assert/strict");
const path = require("node:path");
const { buildSync } = require("esbuild");

const repoRoot = path.resolve(__dirname, "..");
const source = [
  'export { analyzeMatch } from "./src/matchEngine.ts";',
  'export { buildOptimizedResumeDraft, formatOptimizedResumeDraft, validateOptimizedResumeDraft } from "./src/resumeOptimizer.ts";',
  'export { parseCustomJob } from "./src/jobParser.ts";',
  'export { parseModelJobs, parseStructuredResume, profileFromStructuredResume } from "./src/modelParsers.ts";',
  'export { buildJobCatalog, isVerifiedActiveJob } from "./src/core/job/repositories.ts";',
  'export { redactSensitiveText, defaultPrivacyPreferences } from "./src/core/privacy/redaction.ts";',
  'export { createApplicationRecord, upsertApplication, updateApplicationStage, bindApplicationResumeVersion, buildDailyApplicationActions, loadApplicationRecords, saveApplicationRecords } from "./src/core/tracking/applicationRepository.ts";',
  'export { createResumeVersion, summarizeResumeVersionChanges, loadCareerWorkspace, saveCareerWorkspace } from "./src/core/workspace/workspaceRepository.ts";',
].join("\n");
const bundled = buildSync({
  absWorkingDir: repoRoot,
  stdin: { contents: source, resolveDir: repoRoot, loader: "ts" },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  write: false,
}).outputFiles[0].text;
const loadedModule = { exports: {} };
new Function("module", "exports", "require", bundled)(loadedModule, loadedModule.exports, require);
const {
  analyzeMatch,
  buildOptimizedResumeDraft,
  formatOptimizedResumeDraft,
  validateOptimizedResumeDraft,
  parseCustomJob,
  parseModelJobs,
  parseStructuredResume,
  profileFromStructuredResume,
  buildJobCatalog,
  isVerifiedActiveJob,
  redactSensitiveText,
  defaultPrivacyPreferences,
  createApplicationRecord,
  upsertApplication,
  updateApplicationStage,
  bindApplicationResumeVersion,
  buildDailyApplicationActions,
  loadApplicationRecords,
  saveApplicationRecords,
  createResumeVersion,
  summarizeResumeVersionChanges,
  loadCareerWorkspace,
  saveCareerWorkspace,
} = loadedModule.exports;

const job = {
  id: "python-intern",
  jobKind: "imported-jd",
  title: "数据分析实习生",
  track: "数据方向",
  city: "上海",
  level: "实习",
  companyScenario: "用户导入 JD",
  summary: "使用 Python 和 SQL 完成数据分析。",
  responsibilities: ["完成业务数据分析并解释指标变化"],
  requirements: ["本科及以上", "熟练掌握 Python", "能够使用 SQL"],
  bonus: [],
  keywords: ["Python", "SQL"],
  priority: "中",
};

const profile = (overrides = {}) => ({
  name: "林晨",
  grade: "本科",
  major: "计算机科学与技术",
  school: "示例大学",
  target: "数据分析",
  cityPreference: ["上海"],
  skills: ["Python"],
  interests: ["数据分析"],
  experiences: [{
    id: "resume-evidence-1",
    title: "课程项目",
    role: "待确认角色",
    evidence: "使用 Python 清洗公开数据集并完成可视化。",
    tags: ["Python"],
    sourceSection: "project",
    confirmedByUser: false,
  }],
  resumeText: "本科。使用 Python 清洗公开数据集并完成可视化。",
  resumeConfirmed: false,
  ...overrides,
});

const unconfirmed = analyzeMatch(profile(), job, profile().resumeText);
assert.equal(unconfirmed.hardGateResult, "uncertain", "Unconfirmed education must not pass the hard gate.");
assert.ok(unconfirmed.requirementMatrix.some((item) => item.status === "partially-supported"));

const confirmedProfile = profile({
  resumeConfirmed: true,
  experiences: profile().experiences.map((item) => ({ ...item, confirmedByUser: true })),
});
const confirmed = analyzeMatch(confirmedProfile, job, confirmedProfile.resumeText);
assert.equal(confirmed.hardGateResult, "pass");
assert.ok(confirmed.evidenceCoverage > unconfirmed.evidenceCoverage);
assert.ok(confirmed.requirementMatrix.some((item) => item.evidenceIds.includes("resume-evidence-1")));

const negatedProfile = profile({
  skills: ["Python"],
  resumeText: "本人尚未使用 Python，计划后续学习。",
  resumeConfirmed: true,
  experiences: [],
});
const negated = analyzeMatch(negatedProfile, job, negatedProfile.resumeText);
assert.equal(negated.coveredKeywords.includes("Python"), false, "Negated skill must not be treated as covered.");
assert.ok(negated.requirementMatrix.some((item) => item.requirementText.includes("Python") && item.status === "unsupported"));

const shortProfile = profile({ skills: [], experiences: [], resumeText: "本科。", resumeConfirmed: true });
const longProfile = profile({ skills: [], experiences: [], resumeText: `本科。${"与岗位无关的社团介绍。".repeat(80)}`, resumeConfirmed: true });
assert.equal(
  analyzeMatch(shortProfile, job, shortProfile.resumeText).evidenceCoverage,
  analyzeMatch(longProfile, job, longProfile.resumeText).evidenceCoverage,
  "Unrelated resume length must not improve evidence coverage.",
);

const otherCity = { ...confirmedProfile, cityPreference: ["北京"] };
assert.equal(
  analyzeMatch(confirmedProfile, job, confirmedProfile.resumeText).evidenceCoverage,
  analyzeMatch(otherCity, job, otherCity.resumeText).evidenceCoverage,
  "City preference must not alter professional evidence coverage when it is not a JD requirement.",
);

const draft = buildOptimizedResumeDraft(confirmedProfile, job, confirmed);
assert.equal(draft.skillLine.includes("SQL"), false, "A missing skill must not be copied into the resume skill line.");
assert.ok(draft.learningSuggestions.some((item) => item.includes("SQL")));
assert.ok(draft.proposals.every((item) => item.originalText && item.evidenceIds.length > 0));

const adversarialClaims = [
  "Java", "Spring Boot", "微服务", "线上部署", "主导项目", "负责架构", "提升50%", "100万用户", "Go", "Kubernetes",
  "Redis", "Kafka", "React Native", "Flutter", "AWS", "Tableau", "PyTorch", "发表论文", "国家级获奖", "管理十人团队",
];
for (const [index, claim] of adversarialClaims.entries()) {
  const adversarialJob = {
    ...job,
    id: `adversarial-${index + 1}`,
    requirements: [`要求具备${claim}经验`],
    keywords: [claim],
  };
  const adversarialResult = analyzeMatch(confirmedProfile, adversarialJob, confirmedProfile.resumeText);
  const adversarialDraft = buildOptimizedResumeDraft(confirmedProfile, adversarialJob, adversarialResult);
  const generatedText = adversarialDraft.proposals.map((item) => item.suggestedText).join("\n");
  assert.equal(generatedText.includes(claim), false, `Unsupported claim must not enter generated resume text: ${claim}`);
  assert.ok(adversarialDraft.learningSuggestions.some((item) => item.includes(claim)), `Unsupported claim must enter learning plan: ${claim}`);
}

const validEvidenceIds = confirmedProfile.experiences.map((item) => item.id);
assert.equal(validateOptimizedResumeDraft(draft, [], validEvidenceIds).ok, false, "No proposal may be exported without acceptance.");
assert.equal(validateOptimizedResumeDraft(draft, ["missing-proposal"], validEvidenceIds).ok, false, "Stale proposal IDs must be rejected.");
assert.equal(validateOptimizedResumeDraft(draft, [draft.proposals[0].id], validEvidenceIds).ok, false, "Placeholder text must be rejected.");
const confirmedDraft = {
  ...draft,
  proposals: draft.proposals.map((item) => ({ ...item, suggestedText: item.originalText })),
};
const confirmedValidation = validateOptimizedResumeDraft(confirmedDraft, [confirmedDraft.proposals[0].id], validEvidenceIds);
assert.equal(confirmedValidation.ok, true);
assert.match(formatOptimizedResumeDraft(confirmedDraft, confirmedValidation.acceptedProposalIds), /证据：resume-evidence-1/);

const unsupportedJob = parseCustomJob("临床医生", "要求执业医师资格并完成住院医师规范化培训");
assert.equal(unsupportedJob.track, "当前领域未深度支持");
assert.deepEqual(unsupportedJob.keywords, [], "Unsupported domains must not receive generic internet keywords.");

const directions = parseModelJobs(JSON.stringify([
  { title: "前端开发实习生", track: "软件开发", city: "上海", level: "实习", summary: "React", requirements: ["React"], keywords: ["React"], priority: "中", applicationLinks: [{ company: "错误链接", url: "https://example.com" }] },
  { title: "临床医生", track: "医学", city: "上海", level: "岗位", summary: "临床", requirements: ["执业医师"], keywords: ["临床"], priority: "中" },
]));
assert.equal(directions.length, 1, "The competition build must retain only supported internet/digital directions.");
assert.equal(directions[0].jobKind, "career-direction");
assert.deepEqual(directions[0].applicationLinks, [], "Model-generated directions must never expose application links.");

const verifiedJob = {
  ...job,
  id: "verified",
  jobKind: "verified-job",
  sourceMetadata: {
    sourceType: "official-career-site",
    sourceName: "企业招聘官网",
    sourceUrl: "https://example.com/job/1",
    verification: "official-live-api",
    publishedAt: null,
    updatedAt: null,
    lastSeenAt: "2026-07-22T00:00:00.000Z",
    verifiedAt: "2026-07-22T00:00:00.000Z",
    status: "active",
    isDemoData: false,
  },
};
const catalog = buildJobCatalog([verifiedJob, unsupportedJob, ...directions]);
assert.equal(catalog["verified-job"].length, 1);
assert.equal(catalog["imported-jd"].length, 1);
assert.equal(catalog["career-direction"].length, 1);
assert.equal(isVerifiedActiveJob(verifiedJob), true);
assert.equal(isVerifiedActiveJob(directions[0]), false);

assert.equal(createApplicationRecord(directions[0]), null, "Career directions must never enter application tracking.");
const tracked = upsertApplication([], verifiedJob, new Date("2026-07-20T00:00:00.000Z"));
assert.equal(tracked.length, 1);
assert.equal(tracked[0].stage, "interested");
const applied = updateApplicationStage(tracked, tracked[0].id, "applied", new Date("2026-07-20T01:00:00.000Z"));
assert.equal(applied[0].events.length, 2, "Stage history must be append-only.");
const actions = buildDailyApplicationActions(applied, new Date("2026-07-24T01:00:00.000Z"));
assert.equal(actions[0].priority, "medium");
assert.match(actions[0].action, /超过 3 天/);
const memoryStorage = {
  value: null,
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; },
};
saveApplicationRecords(memoryStorage, applied);
assert.deepEqual(loadApplicationRecords(memoryStorage), applied, "Application records must survive local serialization.");

const resumeVersion = createResumeVersion({
  name: "数据分析实习生 · 投递版 1",
  jobId: verifiedJob.id,
  jobTitle: verifiedJob.title,
  content: formatOptimizedResumeDraft(confirmedDraft, confirmedValidation.acceptedProposalIds),
  acceptedProposalIds: confirmedValidation.acceptedProposalIds,
  proposalEdits: { [confirmedDraft.proposals[0].id]: confirmedDraft.proposals[0].originalText },
  evidenceCoverage: confirmed.evidenceCoverage,
  sourceFingerprint: "source-1",
  changeSummary: summarizeResumeVersionChanges("版本一"),
});
const bound = bindApplicationResumeVersion(applied, applied[0].id, resumeVersion.id, new Date("2026-07-20T02:00:00.000Z"));
assert.equal(bound[0].resumeVersionId, resumeVersion.id, "Application record must bind the actual resume version.");

const workspaceStorage = {
  value: null,
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; },
  removeItem() { this.value = null; },
};
const workspace = {
  resumeText: confirmedProfile.resumeText,
  structuredResume: null,
  resumeConfirmed: true,
  resumeSource: "test",
  customTitle: "",
  customJdText: "",
  customJobs: [],
  publicJobs: [verifiedJob],
  modelJobs: [],
  selectedJobId: verifiedJob.id,
  activeJobTab: "verified-job",
  proposalContextKey: "context",
  proposalDecisions: { [confirmedDraft.proposals[0].id]: "accepted" },
  proposalEdits: resumeVersion.proposalEdits,
  resumeVersions: [resumeVersion],
  privacyPreferences: defaultPrivacyPreferences,
  savedAt: "",
};
assert.equal(saveCareerWorkspace(workspaceStorage, workspace), true);
const restoredWorkspace = loadCareerWorkspace(workspaceStorage);
assert.equal(restoredWorkspace.resumeText, confirmedProfile.resumeText, "Resume must survive workspace serialization.");
assert.equal(restoredWorkspace.resumeVersions[0].id, resumeVersion.id, "Resume versions must survive workspace serialization.");
workspaceStorage.value = "{broken-json";
assert.equal(loadCareerWorkspace(workspaceStorage).resumeText, "", "Corrupted workspace data must fail closed.");
assert.equal(summarizeResumeVersionChanges("a\nb", "a\nc"), "相较上一版本新增 1 行、移除 1 行");

const structured = parseStructuredResume(JSON.stringify({
  name: "林晨",
  education: ["示例大学 计算机科学与技术 本科"],
  internships: [],
  projects: ["使用 React 完成课程项目"],
  campus: [],
  honors: [],
  skills: ["React", "Python"],
  targetRoles: ["前端开发"],
  summary: "",
}));
const parsedProfile = profileFromStructuredResume(structured, "示例大学 计算机科学与技术 本科", false);
assert.equal(parsedProfile.school, "示例大学");
assert.equal(parsedProfile.grade, "本科");
assert.equal(parsedProfile.major, "计算机科学与技术");
assert.deepEqual(parsedProfile.experiences[0].tags, ["React"], "Skills must be associated with the experience where they appear.");

const redacted = redactSensitiveText(
  "姓名：林晨\n手机：13800138000\n邮箱：student@example.com\n身份证号：110101200101011234\n地址：上海市浦东新区示例路 1 号",
  { ...defaultPrivacyPreferences, hideName: true },
);
assert.equal(redacted.text.includes("13800138000"), false);
assert.equal(redacted.text.includes("student@example.com"), false);
assert.equal(redacted.text.includes("110101200101011234"), false);
assert.equal(redacted.text.includes("上海市浦东新区示例路 1 号"), false);
assert.equal(redacted.text.includes("林晨"), false);
assert.equal(redacted.redactedFields.length, 5);

console.log(JSON.stringify({
  ok: true,
  confirmedCoverage: confirmed.evidenceCoverage,
  unconfirmedCoverage: unconfirmed.evidenceCoverage,
  hardGate: confirmed.hardGateResult,
  directionCount: directions.length,
  adversarialCases: adversarialClaims.length,
  resumeVersionBound: bound[0].resumeVersionId === resumeVersion.id,
}, null, 2));
