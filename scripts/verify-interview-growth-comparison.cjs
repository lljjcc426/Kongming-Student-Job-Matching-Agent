const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const runtimeRoot = process.env.KONGMING_TEST_RUNTIME || "D:\\Kongming-RAG\\test-runtime\\interview-growth-comparison";
fs.mkdirSync(runtimeRoot, { recursive: true });
const bundlePath = path.join(runtimeRoot, "interview-growth-comparison.cjs");

buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/growthComparison.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});

delete require.cache[require.resolve(bundlePath)];
const { buildInterviewGrowthComparison } = require(bundlePath);

const job = {
  id: "product-intern",
  title: "产品经理实习生",
  track: "AI产品",
  city: "北京",
  level: "实习",
  companyScenario: "互联网产品团队",
  summary: "负责用户研究、需求分析和数据复盘。",
  responsibilities: ["用户研究", "产品设计"],
  requirements: ["需求分析", "数据分析"],
  bonus: [],
  keywords: ["用户研究", "需求分析"],
  priority: "高",
};

const snapshot = (id, name, score, status, confidence = 60) => ({
  id,
  name,
  weight: 16,
  score,
  confidence,
  status,
  attempts: status === "untested" ? 0 : 1,
  evidenceCount: status === "untested" ? 0 : 1,
});

const currentDimension = (id, name, score, status, confidence = 65) => ({
  ...snapshot(id, name, score, status, confidence),
  anchorLevel: status === "untested" ? null : 3,
  anchorText: "测试锚点",
  strongestEvidence: "测试证据",
  gaps: [],
  recommendation: "继续复测",
  evidence: [],
});

const evidenceStats = {
  answerCount: 6,
  substantiveAnswers: 5,
  starEvidence: 3,
  quantifiedEvidence: 2,
};

const reference = (overrides = {}) => ({
  id: "same-job-old",
  jobId: job.id,
  jobTitle: job.title,
  modelTrack: "product",
  interviewType: "综合面",
  reportKind: "formal",
  overallScore: 60,
  confidenceScore: 62,
  coverageScore: 80,
  integrityScore: 96,
  evidenceStats: { ...evidenceStats, substantiveAnswers: 4 },
  summary: "历史报告",
  dimensions: [
    snapshot("d1", "维度一", 50, "insufficient"),
    snapshot("d2", "维度二", 70, "supported"),
    snapshot("d3", "维度三", 0, "untested", 0),
    snapshot("d4", "维度四", 60, "supported"),
    snapshot("d5", "维度五", 50, "insufficient"),
  ],
  weakDimensions: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

const currentDimensions = [
  currentDimension("d1", "维度一", 62, "supported"),
  currentDimension("d2", "维度二", 63, "supported"),
  currentDimension("d3", "维度三", 55, "insufficient"),
  currentDimension("d4", "维度四", 0, "untested", 0),
  currentDimension("d5", "维度五", 53, "insufficient"),
  currentDimension("d6", "维度六", 0, "untested", 0),
];

const commonInput = {
  job,
  modelTrack: "product",
  interviewType: "综合面",
  reportKind: "formal",
  overallScore: 68,
  confidenceScore: 70,
  coverageScore: 80,
  evidenceStats,
  dimensions: currentDimensions,
};

if (buildInterviewGrowthComparison({ ...commonInput, history: [] }) !== null) {
  throw new Error("首次面试不应生成虚假的成长对比。");
}

const sameTrackNewer = reference({
  id: "same-track-newer",
  jobId: "another-product-role",
  jobTitle: "商业产品经理",
  createdAt: "2026-08-01T00:00:00.000Z",
});
const wrongInterviewType = reference({
  id: "same-job-technical",
  interviewType: "技术面",
  createdAt: "2026-08-02T00:00:00.000Z",
});
const comparison = buildInterviewGrowthComparison({
  ...commonInput,
  history: [sameTrackNewer, wrongInterviewType, reference()],
});

if (!comparison || comparison.baselineInterviewId !== "same-job-old" || comparison.comparisonScope !== "same_job") {
  throw new Error(`应优先选择同岗位、同面试类型基线：${JSON.stringify(comparison)}`);
}
if (!comparison.overallComparable || comparison.overallDelta !== 8 || comparison.comparisonQuality !== "high") {
  throw new Error(`同口径综合分应可比较：${JSON.stringify(comparison)}`);
}

const statusById = Object.fromEntries(comparison.dimensionTrends.map((item) => [item.id, item.status]));
if (
  statusById.d1 !== "improved"
  || statusById.d2 !== "regressed"
  || statusById.d3 !== "new_evidence"
  || statusById.d4 !== "not_retested"
  || statusById.d5 !== "stable"
  || statusById.d6 !== "not_comparable"
) {
  throw new Error(`维度趋势分类错误：${JSON.stringify(statusById)}`);
}
if (comparison.improvedDimensions !== 1 || comparison.newEvidenceDimensions !== 1 || !comparison.summary.includes("不计入提升")) {
  throw new Error(`新增证据不应被计为提升：${JSON.stringify(comparison)}`);
}

const stageComparison = buildInterviewGrowthComparison({
  ...commonInput,
  reportKind: "stage",
  confidenceScore: 20,
  coverageScore: 35,
  history: [reference()],
});
if (!stageComparison || stageComparison.overallComparable || stageComparison.comparisonQuality !== "low") {
  throw new Error(`跨报告口径或低置信度时不应声称综合成长：${JSON.stringify(stageComparison)}`);
}
if (!stageComparison.cautions.some((item) => item.includes("报告类型不同"))) {
  throw new Error(`跨口径比较缺少解释：${JSON.stringify(stageComparison.cautions)}`);
}

const legacyOnly = buildInterviewGrowthComparison({
  ...commonInput,
  history: [reference({ dimensions: [] })],
});
if (legacyOnly !== null) throw new Error("没有历史维度快照的旧记录应安全回退为首次基线。");

console.log("Interview cross-session growth comparison verification passed.");
