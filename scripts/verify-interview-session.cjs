const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const runtimeRoot = process.env.KONGMING_TEST_RUNTIME || "D:\\Kongming-RAG\\test-runtime\\interview-session";
fs.mkdirSync(runtimeRoot, { recursive: true });
const bundlePath = path.join(runtimeRoot, "interview-session.cjs");

buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/sessionPlanner.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});

delete require.cache[require.resolve(bundlePath)];
const { evaluateInterviewSession, getInterviewSessionPolicy } = require(bundlePath);

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
  bonus: [],
  keywords: ["用户研究", "需求分析", "数据分析"],
  priority: "高",
};

const strongAnswer = "在课程项目中，我负责用户调研和方案验证。因为团队需要在两周内确定方向，我访谈了18名用户并设计问卷，依据价值、成本和风险比较3个方案；随后通过原型测试和数据复核验证，最终任务完成率提升32%，复盘后补充了异常流程与长期指标。";
const dimensions = ["user-insight", "requirement-priority", "product-solution", "product-data"];
const turn = (answer, competencyId, index) => ({
  question: `问题${index + 1}`,
  answer,
  competencyId,
  questionIntent: index % 2 ? "challenge" : "opening",
  timestamp: Date.now() + index,
  inputMode: "text",
});

const empty = evaluateInterviewSession({ job, interviewType: "综合面", turns: [] });
if (empty.readiness !== "not_ready" || empty.canGenerateFormal || empty.shouldAutoFinish) {
  throw new Error(`Empty session decision is invalid: ${JSON.stringify(empty)}`);
}

const oneWeak = evaluateInterviewSession({
  job,
  interviewType: "综合面",
  turns: [turn("用AI", dimensions[0], 0)],
});
if (
  oneWeak.readiness !== "stage_ready"
  || oneWeak.canGenerateFormal
  || oneWeak.effectiveAnswers !== 0
  || oneWeak.evidenceDimensions !== 0
  || oneWeak.missingRequirements.length !== 2
) {
  throw new Error(`One vague answer must remain stage-only: ${JSON.stringify(oneWeak)}`);
}

const minimumFormalTurns = [0, 1, 2, 3, 0].map((dimensionIndex, index) => (
  turn(strongAnswer, dimensions[dimensionIndex], index)
));
const minimumFormal = evaluateInterviewSession({
  job,
  interviewType: "综合面",
  turns: minimumFormalTurns,
  elapsedSeconds: 420,
});
if (
  !minimumFormal.canGenerateFormal
  || minimumFormal.readiness !== "formal_ready"
  || minimumFormal.shouldAutoFinish
  || minimumFormal.evidenceDimensions !== 4
  || minimumFormal.effectiveAnswers !== 5
) {
  throw new Error(`Minimum formal threshold is invalid: ${JSON.stringify(minimumFormal)}`);
}

const targetTurns = [0, 1, 2, 3, 0, 1, 2].map((dimensionIndex, index) => (
  turn(strongAnswer, dimensions[dimensionIndex], index)
));
const targetReached = evaluateInterviewSession({ job, interviewType: "综合面", turns: targetTurns });
if (!targetReached.canGenerateFormal || !targetReached.shouldAutoFinish || targetReached.readiness !== "complete") {
  throw new Error(`Target completion must automatically close: ${JSON.stringify(targetReached)}`);
}

const weakLimitTurns = Array.from({ length: 9 }, (_, index) => turn("用AI", dimensions[index % dimensions.length], index));
const weakLimit = evaluateInterviewSession({ job, interviewType: "综合面", turns: weakLimitTurns });
if (!weakLimit.shouldAutoFinish || weakLimit.canGenerateFormal || weakLimit.readiness !== "limit_reached") {
  throw new Error(`Hard round limit must close with a stage report: ${JSON.stringify(weakLimit)}`);
}

const technicalPolicy = getInterviewSessionPolicy("技术面");
const hrPolicy = getInterviewSessionPolicy("HR面");
if (
  technicalPolicy.targetDimensions !== 5
  || technicalPolicy.minimumEffectiveAnswers !== 6
  || technicalPolicy.maximumRounds !== 10
  || hrPolicy.targetDimensions !== 3
  || hrPolicy.minimumEffectiveAnswers !== 4
  || hrPolicy.maximumRounds !== 8
) {
  throw new Error(`Interview-type policies are invalid: ${JSON.stringify({ technicalPolicy, hrPolicy })}`);
}

console.log(JSON.stringify({
  ok: true,
  policies: {
    comprehensive: getInterviewSessionPolicy("综合面"),
    technical: technicalPolicy,
    hr: hrPolicy,
  },
  decisions: {
    oneWeak: oneWeak.readiness,
    minimumFormal: minimumFormal.readiness,
    targetReached: targetReached.readiness,
    weakLimit: weakLimit.readiness,
  },
  minimumFormalConfidence: minimumFormal.estimatedConfidence,
}, null, 2));
