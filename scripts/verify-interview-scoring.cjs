const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const runtimeRoot = process.env.KONGMING_TEST_RUNTIME || "D:\\Kongming-RAG\\test-runtime\\interview-report";
fs.mkdirSync(runtimeRoot, { recursive: true });
const bundlePath = path.join(runtimeRoot, "interview-report.cjs");

buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/reportEngine.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});

delete require.cache[require.resolve(bundlePath)];
const {
  analyzeInterviewEvidence,
  buildInterviewFeedbackReport,
  parseInterviewNarrative,
} = require(bundlePath);

const job = {
  id: "product-intern",
  title: "产品经理实习生",
  track: "AI产品",
  city: "北京",
  level: "实习",
  companyScenario: "互联网产品团队",
  summary: "负责用户研究、需求分析、产品方案和数据复盘。",
  responsibilities: ["开展用户研究", "输出产品方案"],
  requirements: ["需求分析", "数据分析", "跨团队协作"],
  bonus: ["有上线产品经验"],
  keywords: ["用户研究", "需求分析", "数据分析"],
  priority: "高",
};

const answer = (text, index = 0) => ({
  question: `问题${index + 1}`,
  answer: text,
  timestamp: Date.now() + index,
  inputMode: "text",
});

const optimisticNarrative = {
  summary: "候选人综合表现很好，完全胜任该岗位。",
  improvements: ["继续练习", "补充更多量化成果"],
  optimizedAnswer: "在具体项目中，我会说明背景、本人行动、量化结果和复盘。",
};

const reportOf = (turns, narrative = optimisticNarrative) => buildInterviewFeedbackReport({
  job,
  turns,
  interviewType: "综合面",
  narrative,
});

const shortTurns = [answer("用AI")];
const shortQuality = analyzeInterviewEvidence(shortTurns);
const shortReport = reportOf(shortTurns);
if (
  shortQuality.scoreCap !== 22
  || shortReport.overallScore > 22
  || shortReport.professionalFit > 22
  || shortReport.reportVersion !== 2
  || shortReport.reportKind !== "stage"
  || shortReport.dimensionReports.length !== 6
) {
  throw new Error(`Short generic answer was not strictly capped: ${JSON.stringify({ shortQuality, shortReport })}`);
}
if (shortReport.summary.includes("完全胜任") || shortReport.confidenceScore > 35) {
  throw new Error(`Optimistic model narrative must not override weak local evidence: ${shortReport.summary}`);
}

const oneDetailedTurn = [answer("在用户调研项目中，我负责设计问卷并使用AI辅助整理开放题，人工复核后分析286份样本，最终形成3项校园服务改进建议。")];
const oneDetailedQuality = analyzeInterviewEvidence(oneDetailedTurn);
const oneDetailedReport = reportOf(oneDetailedTurn);
if (
  oneDetailedQuality.scoreCap !== 58
  || oneDetailedReport.overallScore > 58
  || oneDetailedReport.coverageScore !== 20
  || oneDetailedReport.dimensionReports.filter((item) => item.status !== "untested").length !== 1
) {
  throw new Error(`Single detailed answer report is invalid: ${JSON.stringify({ oneDetailedQuality, oneDetailedReport })}`);
}

const strongTurns = [
  answer("在用户调研项目中，我负责设计问卷和访谈提纲，通过分层抽样回收286份有效问卷，最终识别3个关键问题并推动服务方案调整。", 0),
  answer("项目中团队对需求优先级有分歧，我组织2次评审并用预调研数据验证问题，最终统一5项需求指标，问卷无效率下降18%。", 1),
  answer("复盘时我发现开放题编码一致性不足，因此设计双人复核流程并抽查30%样本，使一致性从72%提升到91%。", 2),
];
const strongQuality = analyzeInterviewEvidence(strongTurns);
const strongReport = reportOf(strongTurns, {
  summary: "回答引用了286份问卷、2次评审和一致性提升等事实，但未覆盖维度仍需继续验证。",
  improvements: ["补充产品上线后的持续指标"],
  optimizedAnswer: optimisticNarrative.optimizedAnswer,
});
if (
  strongQuality.scoreCap !== 92
  || strongReport.overallScore < 60
  || strongReport.overallScore > 85
  || strongReport.coverageScore <= oneDetailedReport.coverageScore
  || strongReport.confidenceScore <= oneDetailedReport.confidenceScore
) {
  throw new Error(`Multi-round evidence report was not calibrated: ${JSON.stringify({ strongQuality, strongReport })}`);
}
if (!strongReport.summary.includes("286份问卷") || !strongReport.improvements.includes("补充产品上线后的持续指标")) {
  throw new Error(`Safe narrative was not merged into the evidence report: ${JSON.stringify(strongReport)}`);
}

const formalDimensionIds = ["user-insight", "requirement-priority", "product-solution", "product-data", "user-insight"];
const formalTurns = formalDimensionIds.map((competencyId, index) => ({
  ...answer("在校园服务项目中，我负责需求分析与方案验证。因为两周内必须确定方向，我访谈18名用户并分析286份问卷，依据价值、成本和风险比较3个方案；随后完成原型测试和数据复核，最终任务完成率提升32%，复盘后补充异常流程与长期指标。", index),
  competencyId,
  questionIntent: index === 4 ? "challenge" : "opening",
}));
const formalReport = reportOf(formalTurns, {});
if (
  formalReport.reportKind !== "formal"
  || !formalReport.sessionEvaluation.canGenerateFormal
  || formalReport.sessionEvaluation.evidenceDimensions !== 4
  || formalReport.sessionEvaluation.effectiveAnswers !== 5
) {
  throw new Error(`Formal report gate is invalid: ${JSON.stringify(formalReport.sessionEvaluation)}`);
}
const forcedStageReport = buildInterviewFeedbackReport({
  job,
  turns: formalTurns,
  interviewType: "综合面",
  reportKind: "stage",
  completionReason: "user_early",
});
if (forcedStageReport.reportKind !== "stage") {
  throw new Error(`Explicit stage report must remain stage-only: ${JSON.stringify(forcedStageReport)}`);
}

const malformedNarrative = parseInterviewNarrative("not-json");
const malformedReport = reportOf(shortTurns, malformedNarrative);
if (malformedReport.overallScore > 22 || malformedReport.dimensionReports.length !== 6) {
  throw new Error(`Malformed narrative fallback was invalid: ${JSON.stringify(malformedReport)}`);
}

console.log(JSON.stringify({
  ok: true,
  shortAnswer: {
    cap: shortQuality.scoreCap,
    score: shortReport.overallScore,
    confidence: shortReport.confidenceScore,
  },
  oneDetailedAnswer: {
    cap: oneDetailedQuality.scoreCap,
    score: oneDetailedReport.overallScore,
    coverage: oneDetailedReport.coverageScore,
  },
  strongInterview: {
    cap: strongQuality.scoreCap,
    score: strongReport.overallScore,
    coverage: strongReport.coverageScore,
    confidence: strongReport.confidenceScore,
  },
  formalGate: {
    kind: formalReport.reportKind,
    evidenceDimensions: formalReport.sessionEvaluation.evidenceDimensions,
    effectiveAnswers: formalReport.sessionEvaluation.effectiveAnswers,
  },
  dimensions: strongReport.dimensionReports.map((item) => ({
    name: item.name,
    score: item.score,
    status: item.status,
  })),
}, null, 2));
