const fs = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");

const root = path.resolve(__dirname, "..");
const artifactDir = path.join(root, "artifacts", ".growth-verify");
const bundlePath = path.join(artifactDir, "growthEngine.cjs");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const fixtureJob = {
  id: "growth-fixture-job",
  jobKind: "demo-fixture",
  title: "前端开发实习生",
  track: "软件开发",
  city: "上海",
  level: "实习",
  companyScenario: "互联网与数字技术职业方向",
  summary: "成长引擎验证岗位。",
  responsibilities: ["完成前端功能开发"],
  requirements: ["本科及以上", "具备 React 项目经历", "能够清晰说明个人贡献"],
  bonus: ["TypeScript"],
  keywords: ["React", "TypeScript"],
  priority: "高",
};

const fixtureMatchResult = {
  evidenceCoverage: 40,
  verdict: "补证据后投递",
  hardGateResult: "uncertain",
  riskLevel: "medium",
  recommendation: "complete-evidence-first",
  requirementMatrix: [
    {
      requirementId: "react",
      requirementText: "具备 React 项目经历",
      type: "skill",
      importance: "required",
      status: "unsupported",
      evidenceIds: [],
      evidenceText: [],
      explanation: "当前没有找到项目证据。",
      missingReason: "缺少可核验的 React 项目成果。",
    },
    {
      requirementId: "contribution",
      requirementText: "能够清晰说明个人贡献",
      type: "responsibility",
      importance: "required",
      status: "partially-supported",
      evidenceIds: ["experience-1"],
      evidenceText: ["参与过页面开发"],
      explanation: "已有部分经历，但结果表达不足。",
      missingReason: "缺少明确的个人行动和结果。",
    },
    {
      requirementId: "education",
      requirementText: "本科及以上",
      type: "hard-constraint",
      importance: "required",
      status: "supported",
      evidenceIds: ["profile-education"],
      evidenceText: ["本科"],
      explanation: "教育背景满足要求。",
      missingReason: "",
    },
  ],
  coveredKeywords: ["TypeScript"],
  missingKeywords: ["React"],
  strengths: [],
  risks: [],
  resumeActions: [],
  actionPlan: [],
};

const weakFeedback = {
  feedbackAvailable: true,
  overallLevel: "developing",
  expression: "developing",
  professionalEvidence: "needs-evidence",
  logic: "developing",
  improvements: ["补充个人动作和结果"],
  optimizedAnswer: "建议用 STAR 结构回答。",
  summary: "回答中缺少可核验的项目结果。",
};

const turns = [{
  question: "请介绍一个你负责的项目。",
  answer: "我参与过页面开发。",
  timestamp: Date.now(),
  inputMode: "text",
}];

function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  buildSync({
    entryPoints: [path.join(root, "src", "features", "growth", "growthEngine.ts")],
    outfile: bundlePath,
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    logLevel: "silent",
  });

  const {
    createGrowthPlan,
    refreshGrowthPlanFromInterview,
    submitGrowthEvidence,
  } = require(bundlePath);
  const interview = {
    interviewType: "综合面",
    feedback: weakFeedback,
    turns,
    completedAt: new Date().toISOString(),
  };
  const plan = createGrowthPlan({ job: fixtureJob, matchResult: fixtureMatchResult, interview });

  assert(plan.tasks.length === 3, `expected three growth tasks, got ${plan.tasks.length}`);
  assert(plan.baselineCoverage === 40, `expected baseline coverage 40, got ${plan.baselineCoverage}`);
  assert(plan.empiricalCoverage === 40, `expected empirical coverage to start at 40, got ${plan.empiricalCoverage}`);
  assert(plan.projectedCoverage === 61, `expected projected coverage 61, got ${plan.projectedCoverage}`);
  assert(plan.tasks.some((task) => task.kind === "interview"), "expected an interview task from the interview gap");

  const firstTask = plan.tasks[0];
  const rejected = submitGrowthEvidence(plan, firstTask.id, "我做了一个项目。", "not-a-url");
  const rejectedTask = rejected.tasks.find((task) => task.id === firstTask.id);
  assert(rejectedTask.status === "needs_revision", `expected weak evidence to need revision, got ${rejectedTask.status}`);
  assert(rejected.empiricalCoverage === 40, `weak evidence must not increase empirical coverage, got ${rejected.empiricalCoverage}`);
  assert(rejected.assessments.length === 2, `expected a rejection assessment, got ${rejected.assessments.length}`);

  const verified = submitGrowthEvidence(
    rejected,
    firstTask.id,
    "我负责设计并实现 React 页面，提交代码仓库和部署演示，页面加载时间降低 30%，并完成复盘。",
    "https://example.com/demo",
  );
  const verifiedTask = verified.tasks.find((task) => task.id === firstTask.id);
  assert(verifiedTask.status === "verified", `expected strong evidence to verify, got ${verifiedTask.status}`);
  assert(verified.empiricalCoverage === 49, `expected empirical coverage 49 after verification, got ${verified.empiricalCoverage}`);
  assert(verified.projectedCoverage === 61, `expected projected coverage to remain 61, got ${verified.projectedCoverage}`);

  const retested = refreshGrowthPlanFromInterview(verified, weakFeedback, turns, "技术面");
  assert(retested.empiricalCoverage === 49, "interview retest must not fabricate empirical coverage");
  assert(retested.assessments.length === 4, `expected retest assessment, got ${retested.assessments.length}`);
  assert(retested.interview.interviewType === "技术面", "expected the latest interview type to be recorded");

  console.log(JSON.stringify({
    tasks: plan.tasks.length,
    baselineCoverage: plan.baselineCoverage,
    projectedCoverage: plan.projectedCoverage,
    rejectedStatus: rejectedTask.status,
    verifiedStatus: verifiedTask.status,
    empiricalCoverageAfterVerification: verified.empiricalCoverage,
    assessmentCountAfterRetest: retested.assessments.length,
  }, null, 2));
}

try {
  main();
} finally {
  fs.rmSync(artifactDir, { recursive: true, force: true });
}
