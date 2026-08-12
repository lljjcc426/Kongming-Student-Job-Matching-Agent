import type { Job } from "../../data";
import type {
  InterviewCompetencyTrack,
  InterviewDimensionGrowthTrend,
  InterviewDimensionReport,
  InterviewGrowthComparison,
  InterviewMemoryReference,
  InterviewReportEvidenceStats,
  InterviewReportKind,
  InterviewType,
} from "../../types/interview";

const SCORE_CHANGE_THRESHOLD = 6;
const MAX_COVERAGE_GAP = 25;
const MIN_OVERALL_CONFIDENCE = 35;
const MIN_DIMENSION_CONFIDENCE = 30;

const testedStatus = (status: InterviewDimensionReport["status"] | null | undefined) => (
  status === "insufficient" || status === "supported" || status === "boundary"
);

const dateValue = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sameJob = (reference: InterviewMemoryReference, job: Job) => (
  reference.jobId === job.id
  || reference.jobTitle === job.title
  || reference.jobTitle.includes(job.title)
  || job.title.includes(reference.jobTitle)
);

const baselinePriority = (
  reference: InterviewMemoryReference,
  job: Job,
  modelTrack: InterviewCompetencyTrack,
) => {
  if (reference.jobId === job.id) return 30;
  if (reference.jobTitle === job.title) return 24;
  if (sameJob(reference, job)) return 18;
  if (reference.modelTrack === modelTrack) return 10;
  return 0;
};

const selectBaseline = (input: {
  job: Job;
  modelTrack: InterviewCompetencyTrack;
  interviewType: InterviewType;
  history: InterviewMemoryReference[];
}) => input.history
  .filter((reference) => (
    reference.interviewType === input.interviewType
    && Array.isArray(reference.dimensions)
    && reference.dimensions.length > 0
    && baselinePriority(reference, input.job, input.modelTrack) > 0
  ))
  .sort((left, right) => (
    baselinePriority(right, input.job, input.modelTrack) - baselinePriority(left, input.job, input.modelTrack)
    || dateValue(right.createdAt) - dateValue(left.createdAt)
  ))[0] ?? null;

const dimensionTrend = (
  current: InterviewDimensionReport,
  previous: InterviewMemoryReference["dimensions"][number] | undefined,
): InterviewDimensionGrowthTrend => {
  const previousTested = testedStatus(previous?.status);
  const currentTested = testedStatus(current.status);
  const base = {
    id: current.id,
    name: current.name,
    weight: current.weight,
    previousScore: previousTested ? previous!.score : null,
    currentScore: currentTested ? current.score : null,
    delta: previousTested && currentTested ? current.score - previous!.score : null,
    previousStatus: previous?.status ?? null,
    currentStatus: current.status,
    previousConfidence: previous?.confidence ?? 0,
    currentConfidence: current.confidence,
  };

  if (!previous) {
    return {
      ...base,
      status: "not_comparable",
      explanation: "历史报告未保存该维度，暂时无法建立同维度基线。",
    };
  }
  if (!previousTested && currentTested) {
    return {
      ...base,
      status: "new_evidence",
      explanation: `本次首次完成“${current.name}”考察并形成可复测基线，不计为提升。`,
    };
  }
  if (previousTested && !currentTested) {
    return {
      ...base,
      status: "not_retested",
      explanation: `上次已考察“${current.name}”，本次未复测，不能据此判断保持或退步。`,
    };
  }
  if (!previousTested || !currentTested) {
    return {
      ...base,
      status: "not_comparable",
      explanation: `两次面试均未形成“${current.name}”的可评分证据。`,
    };
  }

  if (Math.min(previous.confidence, current.confidence) < MIN_DIMENSION_CONFIDENCE) {
    return {
      ...base,
      status: "not_comparable",
      explanation: `至少一次“${current.name}”评估的维度置信度不足 ${MIN_DIMENSION_CONFIDENCE}%，暂不判断变化。`,
    };
  }

  const delta = current.score - previous.score;
  if (delta >= SCORE_CHANGE_THRESHOLD) {
    return {
      ...base,
      status: "improved",
      explanation: `同维度证据分提高 ${delta} 分；建议结合两次证据质量确认能力是否稳定提升。`,
    };
  }
  if (delta <= -SCORE_CHANGE_THRESHOLD) {
    return {
      ...base,
      status: "regressed",
      explanation: `同维度证据分下降 ${Math.abs(delta)} 分；可能来自能力波动或本次回答证据不足。`,
    };
  }
  return {
    ...base,
    status: "stable",
    explanation: `同维度证据分变化 ${delta >= 0 ? "+" : ""}${delta} 分，处于稳定区间。`,
  };
};

const evidenceAnswerCount = (stats: InterviewReportEvidenceStats | undefined) => (
  Number.isFinite(stats?.substantiveAnswers) ? stats!.substantiveAnswers : 0
);

export const buildInterviewGrowthComparison = (input: {
  job: Job;
  modelTrack: InterviewCompetencyTrack;
  interviewType: InterviewType;
  reportKind: InterviewReportKind;
  overallScore: number;
  confidenceScore: number;
  coverageScore: number;
  evidenceStats: InterviewReportEvidenceStats;
  dimensions: InterviewDimensionReport[];
  history: InterviewMemoryReference[];
}): InterviewGrowthComparison | null => {
  const baseline = selectBaseline(input);
  if (!baseline) return null;

  const previousDimensions = new Map(baseline.dimensions.map((dimension) => [dimension.id, dimension]));
  const dimensionTrends = input.dimensions.map((dimension) => dimensionTrend(
    dimension,
    previousDimensions.get(dimension.id),
  ));
  const comparable = dimensionTrends.filter((item) => (
    item.status === "improved" || item.status === "stable" || item.status === "regressed"
  ));
  const improvedDimensions = comparable.filter((item) => item.status === "improved").length;
  const stableDimensions = comparable.filter((item) => item.status === "stable").length;
  const regressedDimensions = comparable.filter((item) => item.status === "regressed").length;
  const newEvidenceDimensions = dimensionTrends.filter((item) => item.status === "new_evidence").length;
  const coverageDelta = input.coverageScore - baseline.coverageScore;
  const confidenceDelta = input.confidenceScore - baseline.confidenceScore;
  const overallDelta = input.overallScore - baseline.overallScore;
  const overallComparable = (
    input.reportKind === baseline.reportKind
    && Math.abs(coverageDelta) <= MAX_COVERAGE_GAP
    && input.confidenceScore >= MIN_OVERALL_CONFIDENCE
    && baseline.confidenceScore >= MIN_OVERALL_CONFIDENCE
  );
  const comparisonScope = sameJob(baseline, input.job) ? "same_job" : "same_track";
  const minimumConfidence = Math.min(input.confidenceScore, baseline.confidenceScore);
  const comparisonQuality = comparisonScope === "same_job"
    && overallComparable
    && comparable.length >= 3
    && minimumConfidence >= 55
    ? "high"
    : comparable.length >= 2 && minimumConfidence >= 35
      ? "medium"
      : "low";

  const cautions: string[] = [];
  if (comparisonScope === "same_track") {
    cautions.push("未找到同岗位历史面试，本次使用同胜任力方向的最近面试作为参考，岗位要求差异可能影响分数。");
  }
  if (input.reportKind !== baseline.reportKind) {
    cautions.push("两次报告类型不同（正式报告/阶段报告），综合分不作成长结论。");
  }
  if (Math.abs(coverageDelta) > MAX_COVERAGE_GAP) {
    cautions.push(`两次能力覆盖率相差 ${Math.abs(coverageDelta)} 个百分点，综合分不具备直接可比性。`);
  }
  if (minimumConfidence < MIN_OVERALL_CONFIDENCE) {
    cautions.push("至少一次面试的评估置信度不足 35%，趋势仅作为复测线索。 ");
  }
  const notRetested = dimensionTrends.filter((item) => item.status === "not_retested").length;
  if (notRetested) cautions.push(`有 ${notRetested} 个历史已考察维度本次未复测，不能判断其变化。`);
  if (!comparable.length) cautions.push("本次与历史报告没有共同已考察维度，暂不能形成成长趋势结论。");

  const trendText = comparable.length
    ? `共同复测 ${comparable.length} 个维度：${improvedDimensions} 个证据提升、${stableDimensions} 个稳定、${regressedDimensions} 个证据下降。`
    : "已找到历史基线，但当前没有共同复测的能力维度。";
  const evidenceText = newEvidenceDimensions
    ? `另有 ${newEvidenceDimensions} 个维度本次首次完成考察，已记录为新基线，不计入提升。`
    : "";
  const overallText = overallComparable
    ? `在相近报告口径下，综合分较上次${overallDelta >= 0 ? "提高" : "下降"} ${Math.abs(overallDelta)} 分。`
    : "由于报告口径、覆盖率或置信度差异，综合分仅展示原值，不用于判断成长。";

  return {
    baselineInterviewId: baseline.id,
    baselineDate: baseline.createdAt,
    baselineJobTitle: baseline.jobTitle,
    baselineReportKind: baseline.reportKind,
    comparisonScope,
    comparisonQuality,
    overallComparable,
    previousOverallScore: baseline.overallScore,
    currentOverallScore: input.overallScore,
    overallDelta,
    previousConfidenceScore: baseline.confidenceScore,
    currentConfidenceScore: input.confidenceScore,
    confidenceDelta,
    previousCoverageScore: baseline.coverageScore,
    currentCoverageScore: input.coverageScore,
    coverageDelta,
    previousEffectiveAnswers: evidenceAnswerCount(baseline.evidenceStats),
    currentEffectiveAnswers: evidenceAnswerCount(input.evidenceStats),
    comparableDimensions: comparable.length,
    improvedDimensions,
    stableDimensions,
    regressedDimensions,
    newEvidenceDimensions,
    dimensionTrends,
    summary: [trendText, evidenceText, overallText].filter(Boolean).join(" "),
    cautions,
  };
};
