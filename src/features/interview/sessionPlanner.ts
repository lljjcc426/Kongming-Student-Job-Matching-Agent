import type { Job } from "../../data";
import type {
  InterviewIntegrityEvaluation,
  InterviewSessionEvaluation,
  InterviewSessionPolicy,
  InterviewTurn,
  InterviewType,
} from "../../types/interview";
import { getCompetencyModel } from "./competencyModels";
import { assessCompetencyAnswer, getInterviewEligibleDimensionIds } from "./followUpController";
import { analyzeInterviewIntegrity } from "./integrityAnalyzer";

const SESSION_POLICIES: Record<InterviewType, InterviewSessionPolicy> = {
  综合面: {
    targetDimensions: 4,
    minimumEffectiveAnswers: 5,
    targetEffectiveAnswers: 7,
    maximumRounds: 9,
    targetMinutes: 12,
    maximumProbesPerDimension: 3,
  },
  技术面: {
    targetDimensions: 5,
    minimumEffectiveAnswers: 6,
    targetEffectiveAnswers: 8,
    maximumRounds: 10,
    targetMinutes: 15,
    maximumProbesPerDimension: 3,
  },
  HR面: {
    targetDimensions: 3,
    minimumEffectiveAnswers: 4,
    targetEffectiveAnswers: 6,
    maximumRounds: 8,
    targetMinutes: 10,
    maximumProbesPerDimension: 3,
  },
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const getInterviewSessionPolicy = (interviewType: InterviewType): InterviewSessionPolicy => ({
  ...SESSION_POLICIES[interviewType],
});

export const evaluateInterviewSession = (input: {
  job: Job;
  interviewType: InterviewType;
  turns: InterviewTurn[];
  elapsedSeconds?: number;
  resumeSummary?: string;
  integrityEvaluation?: InterviewIntegrityEvaluation;
}): InterviewSessionEvaluation => {
  const model = getCompetencyModel(input.job);
  const configuredPolicy = getInterviewSessionPolicy(input.interviewType);
  const eligibleDimensionIds = getInterviewEligibleDimensionIds(model, input.interviewType);
  const policy = {
    ...configuredPolicy,
    targetDimensions: Math.min(configuredPolicy.targetDimensions, eligibleDimensionIds.length),
  };
  const eligibleSet = new Set(eligibleDimensionIds);
  const evaluated = input.turns.map((turn, index) => {
    const dimension = model.dimensions.find((item) => item.id === turn.competencyId)
      ?? model.dimensions[index % model.dimensions.length];
    const assessment = turn.assessment
      ?? assessCompetencyAnswer(turn.answer, dimension, turn.questionIntent);
    return { dimension, assessment };
  }).filter((item) => eligibleSet.has(item.dimension.id));
  const attemptedDimensionIds = [...new Set(evaluated.map((item) => item.dimension.id))];
  const effective = evaluated.filter((item) => item.assessment.score >= 38 && !item.assessment.boundaryReached);
  const evidenceDimensionIds = [...new Set(effective.map((item) => item.dimension.id))];
  const effectiveAnswers = effective.length;
  const evidenceDimensions = evidenceDimensionIds.length;
  const totalRounds = input.turns.length;
  const integrityEvaluation = input.integrityEvaluation ?? analyzeInterviewIntegrity({
    job: input.job,
    turns: input.turns,
    resumeSummary: input.resumeSummary,
  });
  const integrityReady = integrityEvaluation.pendingCount === 0 && integrityEvaluation.unresolvedCount === 0;
  const averageEvidenceScore = effectiveAnswers
    ? effective.reduce((sum, item) => sum + item.assessment.score, 0) / effectiveAnswers
    : 0;
  const coveragePercent = clamp((attemptedDimensionIds.length / Math.max(1, policy.targetDimensions)) * 100);
  const evidenceCoveragePercent = clamp((evidenceDimensions / Math.max(1, policy.targetDimensions)) * 100);
  const answerProgress = Math.min(1, effectiveAnswers / Math.max(1, policy.targetEffectiveAnswers));
  const estimatedConfidence = clamp(
    Math.min(1, evidenceDimensions / Math.max(1, policy.targetDimensions)) * 50
    + answerProgress * 30
    + (averageEvidenceScore / 100) * 20
    - integrityEvaluation.pendingCount * 10
    - integrityEvaluation.unresolvedCount * 14,
  );
  const canGenerateFormal = evidenceDimensions >= policy.targetDimensions
    && effectiveAnswers >= policy.minimumEffectiveAnswers
    && integrityReady;
  const targetReached = canGenerateFormal && effectiveAnswers >= policy.targetEffectiveAnswers;
  const roundLimitReached = totalRounds >= policy.maximumRounds;
  const shouldAutoFinish = targetReached || roundLimitReached;
  const missingRequirements: string[] = [];
  if (evidenceDimensions < policy.targetDimensions) {
    missingRequirements.push(`还需形成 ${policy.targetDimensions - evidenceDimensions} 个能力维度的有效证据`);
  }
  if (effectiveAnswers < policy.minimumEffectiveAnswers) {
    missingRequirements.push(`还需 ${policy.minimumEffectiveAnswers - effectiveAnswers} 条有效回答`);
  }
  if (integrityEvaluation.pendingCount > 0) {
    missingRequirements.push(`还需完成 ${integrityEvaluation.pendingCount} 个一致性信号的核验追问`);
  }
  if (integrityEvaluation.unresolvedCount > 0) {
    missingRequirements.push(`仍有 ${integrityEvaluation.unresolvedCount} 个一致性信号未获得充分解释`);
  }
  const readiness = roundLimitReached
    ? "limit_reached"
    : targetReached
      ? "complete"
      : canGenerateFormal
        ? "formal_ready"
        : totalRounds > 0
          ? "stage_ready"
          : "not_ready";
  const statusMessage = roundLimitReached
    ? canGenerateFormal
      ? "已达到最大轮次，将基于现有证据生成正式报告。"
      : "已达到最大轮次，将生成阶段性报告并标明证据缺口。"
    : targetReached
      ? "核心考察目标已完成，可以生成正式评估报告。"
      : canGenerateFormal
        ? `已达到正式报告门槛，再完成 ${Math.max(0, policy.targetEffectiveAnswers - effectiveAnswers)} 条有效回答可提高结论稳定性。`
        : missingRequirements.join("；") || "继续回答以建立能力证据。";

  return {
    policy,
    eligibleDimensionIds,
    attemptedDimensionIds,
    evidenceDimensionIds,
    attemptedDimensions: attemptedDimensionIds.length,
    evidenceDimensions,
    effectiveAnswers,
    totalRounds,
    elapsedSeconds: Math.max(0, input.elapsedSeconds ?? 0),
    coveragePercent,
    evidenceCoveragePercent,
    estimatedConfidence,
    integrityScore: integrityEvaluation.score,
    integrityReady,
    integrityPendingCount: integrityEvaluation.pendingCount,
    integrityUnresolvedCount: integrityEvaluation.unresolvedCount,
    readiness,
    canGenerateFormal,
    shouldAutoFinish,
    missingRequirements,
    statusMessage,
  };
};
