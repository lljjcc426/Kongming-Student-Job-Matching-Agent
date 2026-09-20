import type { Job } from "../../data";
import type {
  InterviewAnswerAssessment,
  InterviewCompetencyProgress,
  InterviewFollowUpDecision,
  InterviewQuestionIntent,
  InterviewTurn,
  InterviewType,
} from "../../types/interview";
import {
  getCompetencyModel,
  type CompetencyDimension,
  type JobCompetencyModel,
} from "./competencyModels";
import { analyzeInterviewIntegrity, nextInterviewIntegrityRisk } from "./integrityAnalyzer";

const compact = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const CONTEXT_PATTERN = /背景|当时|项目|实习|任务|目标|需求|场景|团队|用户|业务/;
const ACTION_PATTERN = /我负责|我设计|我实现|我分析|我调研|我优化|我解决|我协调|我推进|我开发|我测试|我部署|我验证|我提出|我组织|我选择/;
const RESULT_PATTERN = /结果|最终|提升|降低|完成|交付|获得|达到|产出|上线|落地|准确率|效率|留存|转化|解决/;
const NUMBER_PATTERN = /\d+(?:\.\d+)?\s*(?:%|个|人|份|次|天|周|月|小时|万|条|项|分|ms|秒|qps)?/i;
const REASONING_PATTERN = /因为|原因|依据|权衡|取舍|相比|所以|考虑到|假设|为什么|优先/;
const VALIDATION_PATTERN = /验证|对照|测试|实验|日志|监控|指标|复现|评审|反馈|抽样|回滚/;
const REFLECTION_PATTERN = /复盘|不足|改进|如果重来|下一次|边界|风险|失败|教训/;
const BOUNDARY_PATTERN = /没做过|没有做过|不清楚|不知道|不会|不了解|没有考虑|没考虑|无法回答|不确定|交给别人|不是我负责|选择跳过|未作答/;
const GENERIC_PATTERN = /^(会|用过|了解|熟悉|做过|可以|是|否|不知道|不清楚|没有|没做过)?[a-z0-9+#.\u4e00-\u9fff]{0,8}$/i;

const levelOf = (score: number): InterviewAnswerAssessment["level"] => {
  if (score < 38) return "insufficient";
  if (score < 62) return "basic";
  if (score < 82) return "supported";
  return "strong";
};

const includesTerm = (answer: string, term: string) => compact(answer).includes(compact(term));

export const assessCompetencyAnswer = (
  answer: string,
  dimension: CompetencyDimension,
  intent: InterviewQuestionIntent = "opening",
): InterviewAnswerAssessment => {
  const normalized = answer.trim();
  const dense = compact(normalized);
  const signalHits = dimension.positiveSignals.filter((signal) => includesTerm(normalized, signal));
  const riskHits = dimension.riskSignals.filter((signal) => includesTerm(normalized, signal));
  const hasContext = CONTEXT_PATTERN.test(normalized);
  const hasAction = ACTION_PATTERN.test(normalized);
  const hasResult = RESULT_PATTERN.test(normalized);
  const hasNumber = NUMBER_PATTERN.test(normalized);
  const hasReasoning = REASONING_PATTERN.test(normalized);
  const hasValidation = VALIDATION_PATTERN.test(normalized);
  const hasReflection = REFLECTION_PATTERN.test(normalized);
  const explicitBoundary = BOUNDARY_PATTERN.test(normalized);
  const generic = dense.length <= 10 || GENERIC_PATTERN.test(dense);

  let score = dense.length >= 120 ? 22 : dense.length >= 70 ? 18 : dense.length >= 35 ? 13 : dense.length >= 16 ? 7 : 2;
  score += hasContext ? 10 : 0;
  score += hasAction ? 17 : 0;
  score += hasResult ? 14 : 0;
  score += hasNumber ? 10 : 0;
  score += hasReasoning ? 10 : 0;
  score += hasValidation ? 9 : 0;
  score += hasReflection ? 6 : 0;
  score += Math.min(12, signalHits.length * 3);
  score -= Math.min(18, riskHits.length * 7);
  score -= generic ? 18 : 0;
  score -= explicitBoundary ? 22 : 0;
  score = clamp(score);

  const boundaryReached = explicitBoundary || (intent === "challenge" && score < 42);
  const missingEvidence: string[] = [];
  if (!hasContext) missingEvidence.push("具体场景与任务");
  if (!hasAction) missingEvidence.push("本人采取的行动");
  if (!hasResult) missingEvidence.push("可观察结果");
  if (!hasNumber) missingEvidence.push("量化证据");
  if (!hasReasoning) missingEvidence.push("选择依据与取舍");
  if (!hasValidation) missingEvidence.push("验证方法");
  if (signalHits.length === 0) missingEvidence.push(`${dimension.name}专业细节`);

  const level = levelOf(score);
  const summary = boundaryReached
    ? `候选人在“${dimension.name}”上已暴露当前能力边界，证据得分 ${score}。`
    : level === "strong"
      ? `回答包含具体行动、结果与验证，能够较强支撑“${dimension.name}”。`
      : level === "supported"
        ? `回答能够支撑“${dimension.name}”，仍可通过压力追问确认适用边界。`
        : level === "basic"
          ? `回答具备部分事实，但“${missingEvidence.slice(0, 3).join("、") || "专业细节"}”仍不足。`
          : `回答证据不足，暂时无法判断“${dimension.name}”。`;

  return {
    score,
    level,
    signalHits,
    missingEvidence: missingEvidence.slice(0, 5),
    boundaryReached,
    summary,
  };
};

const resolvedDimensionForTurn = (
  model: JobCompetencyModel,
  turn: InterviewTurn,
  index: number,
) => model.dimensions.find((item) => item.id === turn.competencyId)
  ?? model.dimensions[index % model.dimensions.length];

const assessedTurns = (model: JobCompetencyModel, turns: InterviewTurn[]) => turns.map((turn, index) => {
  const dimension = resolvedDimensionForTurn(model, turn, index);
  return {
    turn,
    dimension,
    assessment: turn.assessment ?? assessCompetencyAnswer(turn.answer, dimension, turn.questionIntent),
  };
});

export const buildCompetencyProgress = (
  model: JobCompetencyModel,
  turns: InterviewTurn[],
): InterviewCompetencyProgress[] => {
  const evaluated = assessedTurns(model, turns);
  return model.dimensions.map((dimension) => {
    const relevant = evaluated.filter((item) => item.dimension.id === dimension.id);
    const bestScore = relevant.reduce((best, item) => Math.max(best, item.assessment.score), 0);
    const boundary = relevant.some((item) => item.assessment.boundaryReached);
    return {
      id: dimension.id,
      name: dimension.name,
      weight: dimension.weight,
      attempts: relevant.length,
      bestScore,
      status: relevant.length === 0
        ? "untested"
        : boundary
          ? "boundary"
          : bestScore >= 62
            ? "supported"
            : "exploring",
    };
  });
};

const chooseNextDimension = (
  model: JobCompetencyModel,
  progress: InterviewCompetencyProgress[],
  excludedId = "",
  eligibleIds = model.dimensions.map((item) => item.id),
) => {
  const progressById = new Map(progress.map((item) => [item.id, item]));
  const eligible = new Set(eligibleIds);
  const usesRestrictedDimensions = eligibleIds.length < model.dimensions.length;
  const restrictedPriority = (id: string) => usesRestrictedDimensions
    ? Math.max(0, eligibleIds.length - eligibleIds.indexOf(id)) * 10
    : 0;
  return [...model.dimensions]
    .filter((item) => eligible.has(item.id))
    .filter((item) => item.id !== excludedId)
    .sort((left, right) => {
      const leftProgress = progressById.get(left.id)!;
      const rightProgress = progressById.get(right.id)!;
      const leftPriority = (leftProgress.attempts === 0 ? 100 : 0)
        + left.weight
        + restrictedPriority(left.id)
        - leftProgress.bestScore * 0.15;
      const rightPriority = (rightProgress.attempts === 0 ? 100 : 0)
        + right.weight
        + restrictedPriority(right.id)
        - rightProgress.bestScore * 0.15;
      return rightPriority - leftPriority;
    })[0] ?? model.dimensions[0];
};

const HR_DIMENSIONS: Record<JobCompetencyModel["track"], string[]> = {
  ai_algorithm: ["ai-business-collaboration", "diagnosis-research", "data-experiment"],
  frontend: ["frontend-product", "frontend-quality", "frontend-performance"],
  backend: ["backend-delivery", "backend-security-diagnosis", "backend-architecture"],
  product: ["user-insight", "product-delivery", "business-retrospective"],
  fullstack: ["fullstack-product", "fullstack-delivery", "fullstack-architecture"],
};

export const getInterviewEligibleDimensionIds = (model: JobCompetencyModel, interviewType: InterviewType) => (
  interviewType === "HR面" ? HR_DIMENSIONS[model.track] : model.dimensions.map((item) => item.id)
);

const questionSeedFor = (
  target: CompetencyDimension,
  strategy: InterviewQuestionIntent,
  interviewType: InterviewType,
) => {
  if (interviewType !== "HR面") return target.questions[strategy === "switch" ? "opening" : strategy];
  if (strategy === "clarify") return `请用一段真实经历补充说明你在“${target.name}”相关任务中的具体职责、沟通对象和结果。`;
  if (strategy === "deepen") return `在刚才的经历中，你为什么采取这种做法？相关方有什么不同意见，你如何推动并复盘？`;
  if (strategy === "challenge") return `如果团队目标、个人判断和交付压力同时发生冲突，你会如何处理，并如何判断自己的边界？`;
  return `请讲一次最能体现你“${target.name}”的真实经历，说明情境、个人行动、结果和复盘。`;
};

const rationaleFor = (
  strategy: InterviewQuestionIntent,
  dimension: CompetencyDimension,
  assessment: InterviewAnswerAssessment | null,
) => {
  if (strategy === "opening") return `优先考察权重较高的“${dimension.name}”，建立首项能力基线。`;
  if (strategy === "switch") return assessment?.boundaryReached
    ? `${assessment.summary}因此切换到“${dimension.name}”扩大能力覆盖。`
    : `上一能力已有足够轮次与证据，切换到“${dimension.name}”提高评估完整度。`;
  if (strategy === "clarify") return `上一回答证据不足，缺少${assessment?.missingEvidence.slice(0, 2).join("、") || "具体事实"}，先进行澄清追问。`;
  if (strategy === "deepen") return `上一回答已有部分事实，但尚不足以稳定判断“${dimension.name}”，继续追问方法与验证过程。`;
  return `上一回答已形成较好证据，通过反事实或约束变化测试“${dimension.name}”的适用边界。`;
};

export const planNextInterviewQuestion = (input: {
  job: Job;
  turns: InterviewTurn[];
  interviewType?: InterviewType;
  resumeSummary?: string;
}): InterviewFollowUpDecision => {
  const model = getCompetencyModel(input.job);
  const interviewType = input.interviewType ?? "综合面";
  const eligibleIds = getInterviewEligibleDimensionIds(model, interviewType);
  const progress = buildCompetencyProgress(model, input.turns);
  const integrityEvaluation = analyzeInterviewIntegrity({
    job: input.job,
    turns: input.turns,
    resumeSummary: input.resumeSummary,
  });
  const integrityTrace = {
    score: integrityEvaluation.score,
    riskCount: integrityEvaluation.riskCount,
    pendingCount: integrityEvaluation.pendingCount,
  };
  if (input.turns.length === 0) {
    const target = chooseNextDimension(model, progress, "", eligibleIds);
    return {
      track: model.track,
      modelName: model.name,
      targetCompetencyId: target.id,
      targetCompetencyName: target.name,
      strategy: "opening",
      rationale: rationaleFor("opening", target, null),
      questionSeed: questionSeedFor(target, "opening", interviewType),
      previousAssessment: null,
      progress,
      integrityRisk: null,
      integrityTrace,
    };
  }

  const latestTurn = input.turns.at(-1)!;
  const currentDimension = resolvedDimensionForTurn(model, latestTurn, input.turns.length - 1);
  const assessment = latestTurn.assessment
    ?? assessCompetencyAnswer(latestTurn.answer, currentDimension, latestTurn.questionIntent);
  const currentProgress = progress.find((item) => item.id === currentDimension.id)!;
  const integrityRisk = nextInterviewIntegrityRisk(integrityEvaluation);
  if (integrityRisk) {
    const target = model.dimensions.find((item) => item.id === integrityRisk.competencyId) ?? currentDimension;
    return {
      track: model.track,
      modelName: model.name,
      targetCompetencyId: target.id,
      targetCompetencyName: target.name,
      strategy: "clarify",
      rationale: `一致性核验优先：${integrityRisk.rationale}`,
      questionSeed: integrityRisk.verificationQuestion,
      previousAssessment: assessment,
      progress,
      integrityRisk,
      integrityTrace,
    };
  }
  let strategy: InterviewQuestionIntent;
  let target = currentDimension;

  if (assessment.boundaryReached || currentProgress.attempts >= 3) {
    strategy = "switch";
    target = chooseNextDimension(model, progress, currentDimension.id, eligibleIds);
  } else if (assessment.score < 38) {
    strategy = "clarify";
  } else if (assessment.score < 62) {
    strategy = "deepen";
  } else if (currentProgress.attempts < 2) {
    strategy = "challenge";
  } else {
    strategy = "switch";
    target = chooseNextDimension(model, progress, currentDimension.id, eligibleIds);
  }

  return {
    track: model.track,
    modelName: model.name,
    targetCompetencyId: target.id,
    targetCompetencyName: target.name,
    strategy,
    rationale: rationaleFor(strategy, target, assessment),
    questionSeed: questionSeedFor(target, strategy, interviewType),
    previousAssessment: assessment,
    progress,
    integrityRisk: null,
    integrityTrace,
  };
};
