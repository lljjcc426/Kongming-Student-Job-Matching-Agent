const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const runtimeRoot = process.env.KONGMING_TEST_RUNTIME || "D:\\Kongming-RAG\\test-runtime\\interview-integrity";
fs.mkdirSync(runtimeRoot, { recursive: true });
const bundlePath = path.join(runtimeRoot, "interview-integrity.cjs");

buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/integrityAnalyzer.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});
delete require.cache[require.resolve(bundlePath)];
const { analyzeInterviewIntegrity } = require(bundlePath);

const controllerBundlePath = path.join(runtimeRoot, "interview-controller.cjs");
buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/followUpController.ts")],
  outfile: controllerBundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});
delete require.cache[require.resolve(controllerBundlePath)];
const { planNextInterviewQuestion } = require(controllerBundlePath);

const sessionBundlePath = path.join(runtimeRoot, "interview-session.cjs");
buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/sessionPlanner.ts")],
  outfile: sessionBundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});
delete require.cache[require.resolve(sessionBundlePath)];
const { evaluateInterviewSession } = require(sessionBundlePath);

const reportBundlePath = path.join(runtimeRoot, "interview-report.cjs");
buildSync({
  entryPoints: [path.resolve(__dirname, "../src/features/interview/reportEngine.ts")],
  outfile: reportBundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});
delete require.cache[require.resolve(reportBundlePath)];
const { buildInterviewFeedbackReport } = require(reportBundlePath);

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

const turn = (answer, competencyId = "user-insight", index = 0, extra = {}) => ({
  question: `问题${index + 1}`,
  answer,
  competencyId,
  questionIntent: "opening",
  timestamp: Date.now() + index,
  inputMode: "text",
  ...extra,
});

const ownershipClaim = turn(
  "在校园服务调研中，我独立负责用户访谈、问卷设计和数据分析。我访谈18名用户并回收286份问卷，最终提出3项改进建议。",
  "user-insight",
  0,
);
const ownershipDenial = turn(
  "需要说明的是，同一个校园服务案例中的调研不是我负责，访谈和问卷交给了其他同学，我只参与了最后的汇报。",
  "user-insight",
  1,
);
const ownershipTurns = [ownershipClaim, ownershipDenial];
const pendingOwnership = analyzeInterviewIntegrity({ job, turns: ownershipTurns });
const ownershipRisk = pendingOwnership.risks.find((risk) => risk.kind === "ownership_conflict");
if (!ownershipRisk || ownershipRisk.severity !== "high" || ownershipRisk.status !== "pending") {
  throw new Error(`Ownership conflict was not identified: ${JSON.stringify(pendingOwnership)}`);
}

const integrityDecision = planNextInterviewQuestion({ job, turns: ownershipTurns, interviewType: "综合面" });
if (
  integrityDecision.strategy !== "clarify"
  || integrityDecision.integrityRisk?.id !== ownershipRisk.id
  || !integrityDecision.questionSeed.includes("独立完成")
) {
  throw new Error(`Integrity risk must take follow-up priority: ${JSON.stringify(integrityDecision)}`);
}

const explainedTurn = turn(
  "我需要更正前面的表述：访谈和问卷由两名同学负责，我实际负责汇总数据、制作汇报文档并提出3项建议。可以核验的个人产出是数据汇总表和评审记录，团队成果不能全部算作我的贡献。",
  "user-insight",
  2,
  { integrityRiskId: ownershipRisk.id, questionIntent: "clarify" },
);
const explained = analyzeInterviewIntegrity({ job, turns: [...ownershipTurns, explainedTurn] });
if (explained.pendingCount !== 0 || explained.explainedCount !== 1 || explained.risks[0].responseTurn !== 3) {
  throw new Error(`Detailed clarification should explain the risk: ${JSON.stringify(explained)}`);
}

const unresolvedTurn = turn(
  "我记不清了，也没有证据。",
  "user-insight",
  2,
  { integrityRiskId: ownershipRisk.id, questionIntent: "clarify" },
);
const unresolved = analyzeInterviewIntegrity({ job, turns: [...ownershipTurns, unresolvedTurn] });
if (unresolved.pendingCount !== 0 || unresolved.unresolvedCount !== 1) {
  throw new Error(`Vague clarification should remain unresolved: ${JSON.stringify(unresolved)}`);
}

const factConflict = analyzeInterviewIntegrity({
  job,
  turns: [
    turn("在调研中我负责分析286份问卷，并完成数据验证。", "product-data", 0),
    turn("同一个调研案例最终回收120份问卷，我据此完成指标分析。", "product-data", 1),
  ],
});
if (!factConflict.risks.some((risk) => risk.kind === "fact_inconsistency" && risk.claim.includes("286份问卷") && risk.conflictingClaim.includes("120份问卷"))) {
  throw new Error(`Stable fact conflict was not identified: ${JSON.stringify(factConflict)}`);
}

const toolConflict = analyzeInterviewIntegrity({
  job,
  turns: [
    turn("在产品实验中我使用A/B实验验证两个方案，负责指标设计和结果分析。", "product-data", 0),
    turn("同一个实验里我没有使用A/B实验，只看了上线前后的数据变化。", "product-data", 1),
  ],
});
if (!toolConflict.risks.some((risk) => risk.kind === "tool_claim_conflict" && risk.title.includes("A/B"))) {
  throw new Error(`Tool practice conflict was not identified: ${JSON.stringify(toolConflict)}`);
}

const resumeSignal = analyzeInterviewIntegrity({
  job,
  resumeSummary: "简历包含大学生压力与睡眠质量调查项目、校园服务实习和SPSS技能。",
  turns: [turn("我独立负责星火推荐系统项目，完成需求分析、原型和上线复盘。", "product-solution", 0)],
});
if (!resumeSignal.risks.some((risk) => risk.kind === "resume_unverified_claim" && risk.severity === "low")) {
  throw new Error(`Resume-external claim should trigger neutral verification: ${JSON.stringify(resumeSignal)}`);
}

const strongAnswer = "在校园服务项目中，我负责用户调研和方案验证。因为两周内必须确定方向，我访谈18名用户并分析286份问卷，依据价值、成本和风险比较3个方案；随后完成原型测试，最终任务完成率提升32%，复盘后补充异常流程与长期指标。";
const formalBase = ["user-insight", "requirement-priority", "product-solution", "product-data", "user-insight"].map((id, index) => turn(strongAnswer, id, index));
const blockedTurns = [...formalBase, ownershipDenial];
const blockedSession = evaluateInterviewSession({ job, interviewType: "综合面", turns: blockedTurns });
if (
  blockedSession.canGenerateFormal
  || blockedSession.integrityReady
  || blockedSession.integrityPendingCount < 1
  || !blockedSession.missingRequirements.some((item) => item.includes("一致性信号"))
) {
  throw new Error(`Pending integrity risk must block formal certification: ${JSON.stringify(blockedSession)}`);
}

const blockedReport = buildInterviewFeedbackReport({
  job,
  turns: blockedTurns,
  interviewType: "综合面",
});
if (
  blockedReport.reportKind !== "stage"
  || blockedReport.integrityEvaluation.pendingCount < 1
  || blockedReport.scoreCap > 55
  || !blockedReport.summary.includes("回答一致性")
) {
  throw new Error(`Integrity risk was not preserved in report calibration: ${JSON.stringify(blockedReport)}`);
}

console.log(JSON.stringify({
  ok: true,
  signals: {
    ownership: ownershipRisk.kind,
    stableFact: factConflict.risks[0]?.kind,
    toolPractice: toolConflict.risks.find((risk) => risk.kind === "tool_claim_conflict")?.kind,
    resumeExternalClaim: resumeSignal.risks[0]?.kind,
  },
  resolution: {
    explained: explained.explainedCount,
    unresolved: unresolved.unresolvedCount,
  },
  report: {
    kind: blockedReport.reportKind,
    scoreCap: blockedReport.scoreCap,
    integrityScore: blockedReport.integrityEvaluation.score,
  },
}, null, 2));
