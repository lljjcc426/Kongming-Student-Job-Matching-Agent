import type { MatchResult, RequirementMatch } from "../../matchEngine";
import type { InterviewFeedbackReport, InterviewTurn, InterviewType } from "../../types/interview";
import type {
  GrowthAssessment,
  GrowthEvidenceReview,
  GrowthGap,
  GrowthInterviewSnapshot,
  GrowthPlan,
  GrowthPlanInput,
  GrowthTask,
} from "./types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const now = () => new Date().toISOString();

const taskKindOf = (requirement: string): GrowthTask["kind"] => {
  if (/表达|面试|沟通|动机|协作|逻辑/.test(requirement)) return "interview";
  if (/简历|关键词|项目经历|成果/.test(requirement)) return "resume";
  return "project";
};

const taskTitleOf = (requirement: string, kind: GrowthTask["kind"]) => {
  if (kind === "interview") return "针对“" + requirement + "”完成一次岗位追问复盘";
  if (kind === "resume") return "补充“" + requirement + "”的可验证简历证据";
  return "完成“" + requirement + "”实践任务并提交成果";
};

const evidenceRequirementOf = (requirement: string, kind: GrowthTask["kind"]) => {
  if (kind === "interview") return "提交一次 5 分钟岗位模拟回答，包含背景、行动、结果和复盘。";
  if (kind === "resume") return "提交一段真实经历补充，至少包含个人动作、产出物和可核验结果。";
  return "提交与“" + requirement + "”直接相关的代码、报告、截图、部署链接或演示记录。";
};

const gapFromRequirement = (requirement: RequirementMatch, index: number): GrowthGap => ({
  id: "job-gap-" + (requirement.requirementId || index + 1),
  requirementId: requirement.requirementId || "requirement-" + (index + 1),
  title: requirement.requirementText,
  source: "job",
  status: requirement.status,
  reason: requirement.missingReason || requirement.explanation || "当前尚未形成可引用的岗位证据。",
  targetEvidence: evidenceRequirementOf(requirement.requirementText, taskKindOf(requirement.requirementText)),
});

const interviewGap = (snapshot: GrowthInterviewSnapshot): GrowthGap | null => {
  if (!snapshot.feedback.feedbackAvailable || snapshot.feedback.overallLevel === "strong") return null;
  return {
    id: "interview-gap-evidence",
    requirementId: "interview-evidence",
    title: "面试回答中的岗位证据与结果表达",
    source: "interview",
    status: "needs-evidence",
    reason: snapshot.feedback.summary || "本轮回答还需要更清晰地说明个人行动和结果。",
    targetEvidence: "提交一次基于真实项目的 STAR 结构回答，并补充结果数据或可核验产出物。",
  };
};

const taskFromGap = (gap: GrowthGap, index: number): GrowthTask => {
  const kind = taskKindOf(gap.title);
  return {
    id: "growth-task-" + gap.id,
    gapId: gap.id,
    title: taskTitleOf(gap.title, kind),
    description: gap.reason,
    kind,
    priority: index === 0 ? "high" : "medium",
    evidenceRequirement: gap.targetEvidence,
    projectedGain: index === 0 ? 9 : 6,
    status: "todo",
    evidenceText: "",
    evidenceUrl: "",
    evidenceReview: null,
    submittedAt: null,
    verifiedAt: null,
  };
};

const assessment = (
  trigger: GrowthAssessment["trigger"],
  empiricalCoverage: number,
  projectedCoverage: number,
  verifiedTaskCount: number,
  summary: string,
): GrowthAssessment => ({
  id: "growth-assessment-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
  trigger,
  createdAt: now(),
  empiricalCoverage: clamp(empiricalCoverage),
  projectedCoverage: clamp(projectedCoverage),
  verifiedTaskCount,
  summary,
});

const scoreOf = (plan: GrowthPlan) => {
  const verifiedGain = plan.tasks
    .filter((task) => task.status === "verified")
    .reduce((sum, task) => sum + task.projectedGain, 0);
  const allGain = plan.tasks.reduce((sum, task) => sum + task.projectedGain, 0);
  return {
    empiricalCoverage: clamp(plan.baselineCoverage + verifiedGain),
    projectedCoverage: clamp(Math.max(plan.baselineCoverage + verifiedGain, plan.baselineCoverage + allGain)),
  };
};

export function createInterviewSnapshot(
  interviewType: InterviewType,
  feedback: InterviewFeedbackReport,
  turns: InterviewTurn[],
): GrowthInterviewSnapshot {
  return { interviewType, feedback, turns, completedAt: now() };
}

export function createGrowthPlan(input: GrowthPlanInput): GrowthPlan {
  const interviewGapItem = input.interview ? interviewGap(input.interview) : null;
  const requirementGaps = input.matchResult.requirementMatrix
    .filter((item) => item.status !== "supported")
    .slice(0, 3)
    .map(gapFromRequirement);
  const gaps = [...requirementGaps, ...(interviewGapItem ? [interviewGapItem] : [])].slice(0, 3);
  const fallbackGap: GrowthGap = {
    id: "growth-gap-review",
    requirementId: "growth-review",
    title: "把已有经历转化为岗位可验证成果",
    source: "job",
    status: "needs-evidence",
    reason: "当前岗位没有明显硬性冲突，下一步应补充可以被面试和岗位要求共同验证的成果证据。",
    targetEvidence: "提交一个真实项目的代码、报告、演示或复盘材料，并说明个人贡献。",
  };
  const resolvedGaps = gaps.length ? gaps : [fallbackGap];
  const tasks = resolvedGaps.map(taskFromGap);
  const baselineCoverage = clamp(input.matchResult.evidenceCoverage);
  const plan: GrowthPlan = {
    id: "growth-plan-" + Date.now(),
    targetJobId: input.job.id,
    targetJobTitle: input.job.title,
    createdAt: now(),
    updatedAt: now(),
    baselineCoverage,
    empiricalCoverage: baselineCoverage,
    projectedCoverage: clamp(baselineCoverage + tasks.reduce((sum, task) => sum + task.projectedGain, 0)),
    gaps: resolvedGaps,
    tasks,
    interview: input.interview ?? null,
    assessments: [],
  };
  plan.assessments.push(assessment("initial", plan.empiricalCoverage, plan.projectedCoverage, 0, "基于当前岗位证据和面试结果建立初始成长基线。"));
  return plan;
}

export function reviewGrowthEvidence(task: GrowthTask, evidenceText: string, evidenceUrl: string): GrowthEvidenceReview {
  const text = evidenceText.trim();
  const url = evidenceUrl.trim();
  const hasArtifact = /代码|仓库|提交|文档|报告|截图|录音|视频|测验|证书|作品|原型|README|链接|部署|演示/i.test(text);
  const hasAction = /负责|设计|实现|分析|验证|修复|构建|整理|复盘|提交|输出|发布|完成|对比|测试/.test(text);
  const hasOutcome = /\d|%|提升|降低|增长|覆盖|产出|通过|上线|发布|排名|获奖|耗时|用户|样本/.test(text);
  const hasLink = !url || /^https?:\/\//i.test(url);
  const score = clamp((text.length >= 40 ? 35 : 15) + (hasArtifact ? 20 : 0) + (hasAction ? 20 : 0) + (hasOutcome ? 15 : 0) + (url && hasLink ? 10 : 0));
  const verified = text.length >= 40 && hasAction && (hasArtifact || hasOutcome) && hasLink;
  return {
    decision: verified ? "verified" : "needs_revision",
    score,
    summary: verified ? "已通过“" + task.title + "”的本地证据检查，可用于更新实证覆盖率。" : "证据还不足以证明个人行动和真实产出，补充具体成果后再提交。",
    reasons: [
      hasAction ? "已识别个人行动。" : "缺少明确的个人行动。",
      hasArtifact || hasOutcome ? "已识别产出物或结果信号。" : "缺少代码、报告、截图或结果数据。",
      hasLink ? "链接格式可用。" : "链接格式无效。",
    ],
    reviewedAt: now(),
  };
}

export function submitGrowthEvidence(plan: GrowthPlan, taskId: string, evidenceText: string, evidenceUrl: string): GrowthPlan {
  const target = plan.tasks.find((task) => task.id === taskId);
  if (!target) return plan;
  const review = reviewGrowthEvidence(target, evidenceText, evidenceUrl);
  const tasks = plan.tasks.map((task): GrowthTask => task.id === taskId ? {
    ...task,
    evidenceText: evidenceText.trim(),
    evidenceUrl: evidenceUrl.trim(),
    status: review.decision === "verified" ? "verified" : "needs_revision" as GrowthTask["status"],
    evidenceReview: review,
    submittedAt: now(),
    verifiedAt: review.decision === "verified" ? now() : null,
  } : task);
  const next = { ...plan, tasks, updatedAt: now() };
  const scores = scoreOf(next);
  next.empiricalCoverage = scores.empiricalCoverage;
  next.projectedCoverage = scores.projectedCoverage;
  const verifiedCount = tasks.filter((task) => task.status === "verified").length;
  next.assessments = [
    ...plan.assessments,
    assessment("evidence_review", next.empiricalCoverage, next.projectedCoverage, verifiedCount, review.decision === "verified" ? "新增证据已通过审核，实证覆盖率发生变化。" : "证据已保存，但未通过验证，因此实证覆盖率不变。"),
  ];
  return next;
}

export function refreshGrowthPlanFromInterview(plan: GrowthPlan, feedback: InterviewFeedbackReport, turns: InterviewTurn[], interviewType: InterviewType): GrowthPlan {
  const interview = createInterviewSnapshot(interviewType, feedback, turns);
  const next = { ...plan, interview, updatedAt: now() };
  const scores = scoreOf(next);
  next.empiricalCoverage = scores.empiricalCoverage;
  next.projectedCoverage = scores.projectedCoverage;
  const verifiedCount = next.tasks.filter((task) => task.status === "verified").length;
  next.assessments = [
    ...plan.assessments,
    assessment("interview_retest", next.empiricalCoverage, next.projectedCoverage, verifiedCount, "已记录新一轮面试，可继续对比能力证据和表达质量。"),
  ];
  return next;
}
