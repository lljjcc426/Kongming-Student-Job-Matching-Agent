const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const runtimeRoot = process.env.KONGMING_TEST_RUNTIME || "D:\\Kongming-RAG\\test-runtime\\growth-loop";
fs.mkdirSync(runtimeRoot, { recursive: true });
const bundlePath = path.join(runtimeRoot, "growth-engine.cjs");

buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/growth/growthEngine.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});

delete require.cache[require.resolve(bundlePath)];
const {
  createGrowthPlan,
  growthDateAfterDays,
  growthPlanProgress,
  normalizeGrowthPlan,
  reassessGrowthPlan,
  updateGrowthTaskEvidence,
} = require(bundlePath);

const job = {
  id: "ai-product-intern",
  title: "AI产品实习生",
  track: "AI产品",
  city: "上海",
  level: "实习",
  companyScenario: "人工智能平台",
  summary: "围绕大模型应用完成需求分析、原型验证和效果评估。",
  responsibilities: ["分析用户需求并设计AI产品方案", "协同研发完成原型和数据验证"],
  requirements: ["掌握需求分析与数据分析", "理解大模型应用和提示词工程"],
  bonus: ["有可运行AI项目或量化验证报告"],
  keywords: ["需求分析", "数据分析", "大模型", "提示词工程"],
  priority: "高",
};

const profile = {
  name: "测试用户",
  grade: "本科",
  major: "计算机科学",
  school: "测试大学",
  target: job.title,
  cityPreference: ["上海"],
  skills: ["需求分析"],
  interests: ["AI产品"],
  experiences: [],
  resumeText: "计算机本科，参与过需求分析。",
};

const matchResult = {
  total: 68,
  dimensions: [{ name: "能力匹配", score: 54 }],
  missingKeywords: ["数据分析", "大模型", "提示词工程"],
  abilityGraph: {
    nodes: [
      { name: "数据分析", score: 48 },
      { name: "大模型", score: 45 },
      { name: "提示词工程", score: 42 },
    ],
  },
  scoreExplanation: { evidenceCoverage: 42 },
};

const interview = {
  interviewType: "technical",
  feedback: {
    overallScore: 58,
    expression: 62,
    professionalFit: 52,
    logic: 57,
    summary: "岗位证据不足，需要补充行动、产物和量化结果。",
    improvements: ["使用STAR结构说明项目中的个人动作与结果"],
  },
  turns: [],
  completedAt: new Date().toISOString(),
};

const input = {
  profile,
  job,
  matchResult,
  interview,
  targetDate: growthDateAfterDays(42),
};

let plan = createGrowthPlan(input);
if (plan.planningDays !== 42 || plan.tasks.length !== 12) {
  throw new Error(`Dynamic schedule invariant failed: ${plan.planningDays} days, ${plan.tasks.length} tasks`);
}
if (plan.verifiedMatchScore !== 68 || plan.projectedMatchScore !== 68) {
  throw new Error("Initial verified and projected scores must share the measured baseline");
}

const firstTask = plan.tasks[0];
const actualGapScores = new Map(plan.gaps.map((gap) => [gap.id, gap.currentScore]));
const vagueEvidence = "我已经完成了这个学习任务，学习了相关内容，并且感觉自己有了很多收获。";
plan = updateGrowthTaskEvidence(plan, firstTask.id, vagueEvidence, "", true);
let reviewedTask = plan.tasks.find((task) => task.id === firstTask.id);
if (reviewedTask.evidenceStatus !== "needs_revision" || reviewedTask.completed) {
  throw new Error("Vague evidence must require revision and must not complete the task");
}
if (plan.projectedMatchScore !== plan.verifiedMatchScore || growthPlanProgress(plan).completed !== 0) {
  throw new Error("Rejected evidence must not change progress or projected score");
}

const firstStage = plan.stages[0];
const firstStageTasks = plan.tasks.filter((task) => task.stageDays === firstStage.days);
const passCount = Math.ceil(firstStageTasks.length * 0.75);
for (const task of firstStageTasks.slice(0, passCount)) {
  const gapNames = plan.gaps.filter((gap) => task.gapIds.includes(gap.id)).map((gap) => gap.name).join("、");
  const strongEvidence = `围绕${gapNames || task.title}，我亲自分析需求、设计并实现可运行成果，提交了GitHub仓库和README。完成3组测试与前后对比，关键指标提升18%，并记录问题修复和复盘结论。`;
  plan = updateGrowthTaskEvidence(
    plan,
    task.id,
    strongEvidence,
    `https://github.com/luxury221/kongming-evidence-${task.week}`,
    true,
  );
}

reviewedTask = plan.tasks.find((task) => task.id === firstStageTasks[0].id);
if (!reviewedTask.completed || reviewedTask.evidenceStatus !== "verified" || reviewedTask.evidenceReview.score < 62) {
  throw new Error("Strong, relevant evidence must pass the local review threshold");
}
if (plan.projectedMatchScore <= plan.verifiedMatchScore) {
  throw new Error("Verified task evidence must raise only the projected score");
}
if (plan.gaps.some((gap) => gap.currentScore !== actualGapScores.get(gap.id))) {
  throw new Error("Task evidence must not mutate measured gap scores before reassessment");
}
if (!plan.stages[1].unlocked) {
  throw new Error("Passing evidence review for 75% of a stage must unlock the next stage");
}

const reassessedMatch = {
  ...matchResult,
  total: 76,
  abilityGraph: {
    nodes: matchResult.abilityGraph.nodes.map((node) => ({ ...node, score: node.score + 14 })),
  },
  scoreExplanation: { evidenceCoverage: 64 },
};
const reassessedInterview = {
  ...interview,
  feedback: { ...interview.feedback, overallScore: 67, expression: 70, professionalFit: 64, logic: 68 },
};
const priorAssessments = plan.assessments.length;
plan = reassessGrowthPlan(plan, { profile, job, matchResult: reassessedMatch, interview: reassessedInterview }, "manual_reassessment");
if (plan.verifiedMatchScore !== 76 || plan.verifiedInterviewScore !== 67 || plan.verifiedEvidenceCoverage !== 64) {
  throw new Error("Reassessment must update measured match, interview, and coverage scores");
}
if (plan.assessments.length !== priorAssessments + 1 || plan.assessments.at(-1).previousMatchScore !== 68) {
  throw new Error("Reassessment history must preserve the before/after score trail");
}
if (plan.projectedMatchScore < plan.verifiedMatchScore) {
  throw new Error("Post-reassessment projection must start from the latest verified score");
}

const legacyPlan = JSON.parse(JSON.stringify(plan));
delete legacyPlan.verifiedMatchScore;
delete legacyPlan.verifiedInterviewScore;
delete legacyPlan.verifiedEvidenceCoverage;
delete legacyPlan.lastReassessedAt;
delete legacyPlan.assessments;
legacyPlan.tasks[0].completed = true;
delete legacyPlan.tasks[0].evidenceStatus;
delete legacyPlan.tasks[0].evidenceReview;
delete legacyPlan.tasks[0].submittedAt;
const migrated = normalizeGrowthPlan(legacyPlan);
if (migrated.tasks[0].completed || migrated.tasks[0].evidenceStatus !== "needs_revision") {
  throw new Error("Legacy unaudited completion must be migrated to evidence revision state");
}
if (migrated.assessments.length !== 1 || migrated.assessments[0].matchScore !== migrated.verifiedMatchScore) {
  throw new Error("Legacy plans must receive a recoverable measured-score baseline");
}

console.log(JSON.stringify({
  ok: true,
  planningDays: plan.planningDays,
  taskCount: plan.tasks.length,
  verifiedTasks: growthPlanProgress(plan).completed,
  verifiedMatchScore: plan.verifiedMatchScore,
  projectedMatchScore: plan.projectedMatchScore,
  assessmentCount: plan.assessments.length,
  weakEvidenceDecision: "needs_revision",
  legacyMigration: migrated.tasks[0].evidenceStatus,
}, null, 2));
