const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const runtimeRoot = process.env.KONGMING_TEST_RUNTIME || "D:\\Kongming-RAG\\test-runtime\\interview-competency";
fs.mkdirSync(runtimeRoot, { recursive: true });
const bundlePath = path.join(runtimeRoot, "interview-competency.cjs");

buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/followUpController.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});

delete require.cache[require.resolve(bundlePath)];
const {
  assessCompetencyAnswer,
  buildCompetencyProgress,
  planNextInterviewQuestion,
} = require(bundlePath);

const modelsBundlePath = path.join(runtimeRoot, "competency-models.cjs");
buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/competencyModels.ts")],
  outfile: modelsBundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});
delete require.cache[require.resolve(modelsBundlePath)];
const {
  competencyModels,
  detectCompetencyTrack,
  getCompetencyModel,
  validateCompetencyModels,
} = require(modelsBundlePath);

const job = (title, track, keywords = []) => ({
  id: title,
  title,
  track,
  city: "上海",
  level: "实习",
  companyScenario: "信息技术企业",
  summary: `${title}岗位`,
  responsibilities: ["完成岗位核心任务"],
  requirements: keywords,
  bonus: [],
  keywords,
  priority: "高",
});

const classificationCases = [
  [job("AI算法工程师", "人工智能", ["机器学习", "模型训练"]), "ai_algorithm"],
  [job("前端开发工程师", "研发", ["React", "TypeScript"]), "frontend"],
  [job("Java后端开发工程师", "服务端", ["Spring", "数据库"]), "backend"],
  [job("产品经理", "互联网产品", ["需求分析", "用户研究"]), "product"],
  [job("全栈开发工程师", "研发", ["React", "Node.js"]), "fullstack"],
];

for (const [input, expected] of classificationCases) {
  const actual = detectCompetencyTrack(input);
  if (actual !== expected) throw new Error(`Track classification failed for ${input.title}: ${actual} !== ${expected}`);
}

const validation = validateCompetencyModels();
if (validation.length !== 5 || validation.some((item) => (
  item.dimensionCount !== 6
  || item.totalWeight !== 100
  || !item.validAnchors
  || !item.validQuestions
))) {
  throw new Error(`Competency model integrity failed: ${JSON.stringify(validation)}`);
}

const aiJob = classificationCases[0][0];
const model = getCompetencyModel(aiJob);
let decision = planNextInterviewQuestion({ job: aiJob, turns: [] });
if (decision.track !== "ai_algorithm" || decision.strategy !== "opening" || decision.progress.length !== 6) {
  throw new Error(`Opening decision is invalid: ${JSON.stringify(decision)}`);
}

const hrDecision = planNextInterviewQuestion({ job: aiJob, turns: [], interviewType: "HR面" });
if (
  hrDecision.targetCompetencyId !== "ai-business-collaboration"
  || !hrDecision.questionSeed.includes("真实经历")
) {
  throw new Error(`HR interview must prioritize behavioral evidence: ${JSON.stringify(hrDecision)}`);
}

const turn = (answer, intent = decision.strategy, competencyId = decision.targetCompetencyId) => ({
  question: decision.questionSeed,
  answer,
  competencyId,
  competencyName: model.dimensions.find((item) => item.id === competencyId)?.name,
  questionIntent: intent,
  timestamp: Date.now(),
  inputMode: "text",
});

const vagueTurn = turn("用AI");
decision = planNextInterviewQuestion({ job: aiJob, turns: [vagueTurn] });
if (decision.strategy !== "clarify" || decision.targetCompetencyId !== vagueTurn.competencyId || decision.previousAssessment.score >= 38) {
  throw new Error(`Vague answer must trigger clarification: ${JSON.stringify(decision)}`);
}

const basicTurn = turn("在课程项目中我负责模型训练，因为样本规模比较小，所以采用了逻辑回归。", "opening");
decision = planNextInterviewQuestion({ job: aiJob, turns: [basicTurn] });
if (decision.strategy !== "deepen" || decision.previousAssessment.level !== "basic") {
  throw new Error(`Partial evidence must trigger deepening: ${JSON.stringify(decision)}`);
}

const strongAnswer = "在用户流失预测项目中，我负责算法设计和实验验证。因为正负样本比例约1比8，我先建立逻辑回归基线，再比较XGBoost；使用分层五折验证和F1指标，最终F1从0.61提升到0.74，并通过消融实验验证特征贡献，复盘发现时间泄漏是主要风险。";
const strongTurn = turn(strongAnswer, "opening");
decision = planNextInterviewQuestion({ job: aiJob, turns: [strongTurn] });
if (decision.strategy !== "challenge" || !["supported", "strong"].includes(decision.previousAssessment.level)) {
  throw new Error(`Strong first evidence must trigger a boundary challenge: ${JSON.stringify(decision)}`);
}

const challengeTurn = turn(
  "如果不能使用当前算法，我会保留同一数据切分和F1基线，比较线性模型与轻量神经网络；同时记录训练耗时和推理延迟。此前我完成3组对照测试，轻量方案延迟降低35%，最终依据效果、成本和稳定性选择上线版本。",
  "challenge",
);
decision = planNextInterviewQuestion({ job: aiJob, turns: [strongTurn, challengeTurn] });
if (decision.strategy !== "switch" || decision.targetCompetencyId === challengeTurn.competencyId) {
  throw new Error(`Two supported probes must switch competency: ${JSON.stringify(decision)}`);
}

const boundaryTurn = turn("这部分我没有做过，也不清楚底层原理，实际工作交给了其他同学。", "challenge");
decision = planNextInterviewQuestion({ job: aiJob, turns: [boundaryTurn] });
const boundaryProgress = buildCompetencyProgress(model, [boundaryTurn]);
if (decision.strategy !== "switch" || !decision.previousAssessment.boundaryReached || boundaryProgress.find((item) => item.id === boundaryTurn.competencyId)?.status !== "boundary") {
  throw new Error(`Explicit inability must establish a boundary and switch: ${JSON.stringify({ decision, boundaryProgress })}`);
}

const assessment = assessCompetencyAnswer(strongAnswer, model.dimensions[0], "opening");
if (assessment.score < 62 || assessment.signalHits.length < 1 || assessment.missingEvidence.length > 3) {
  throw new Error(`Strong evidence assessment is unexpectedly weak: ${JSON.stringify(assessment)}`);
}

console.log(JSON.stringify({
  ok: true,
  tracks: Object.keys(competencyModels),
  validation,
  decisions: {
    vague: "clarify",
    basic: "deepen",
    strong: "challenge",
    repeatedStrong: "switch",
    explicitBoundary: "switch",
    hrBehavioralOpening: hrDecision.targetCompetencyId,
  },
  strongEvidenceScore: assessment.score,
}, null, 2));
