import type { Job } from "../../data";
import type {
  InterviewAnswerAssessment,
  InterviewDecisionSummary,
  InterviewDimensionReport,
  InterviewCompletionReason,
  InterviewFeedbackReport,
  InterviewGroundingContext,
  InterviewQuestionIntent,
  InterviewReportKind,
  InterviewTurn,
  InterviewType,
} from "../../types/interview";
import { assessCompetencyAnswer } from "./followUpController";
import { getCompetencyModel, type CompetencyDimension } from "./competencyModels";
import { buildInterviewGrowthComparison } from "./growthComparison";
import { analyzeInterviewIntegrity } from "./integrityAnalyzer";
import { evaluateInterviewSession } from "./sessionPlanner";

export type InterviewEvidenceQuality = {
  answerCount: number;
  totalChars: number;
  substantiveAnswers: number;
  quantifiedAnswers: number;
  starSignalAnswers: number;
  genericAnswers: number;
  scoreCap: number;
};

export type InterviewReportNarrative = {
  summary?: string;
  improvements?: string[];
  optimizedAnswer?: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const compactAnswer = (answer: string) => answer.replace(/\s+/g, "").trim();
const GENERIC_ANSWER_PATTERN = /^(用|会用|使用|了解|知道|熟悉|接触过|做过|可以|是|否)?(ai|人工智能|python|java|软件|工具|模型|大模型|没有|不会|不清楚|不知道)?[。.!！]?$/i;
const ACTION_PATTERN = /负责|设计|实现|搭建|分析|调研|优化|解决|协调|推进|开发|测试|部署|验证|使用|通过|采用/;
const RESULT_PATTERN = /结果|最终|提升|降低|完成|交付|获得|达到|因此|使得|产出|上线|落地|准确率|效率|用户/;
const CONTEXT_PATTERN = /背景|当时|项目|实习|任务|目标|需求|问题|场景|团队/;
const NUMBER_PATTERN = /\d+(?:\.\d+)?\s*(?:%|个|人|份|次|天|周|月|小时|万|条|项|分)?/;
const OVERCLAIM_PATTERN = /表现优秀|非常出色|高度匹配|完全胜任|能力突出|综合表现很好/;

export const analyzeInterviewEvidence = (turns: InterviewTurn[]): InterviewEvidenceQuality => {
  const answers = turns.map((turn) => compactAnswer(turn.answer)).filter(Boolean);
  const totalChars = answers.reduce((sum, answer) => sum + answer.length, 0);
  const substantiveAnswers = answers.filter((answer) => answer.length >= 35 && ACTION_PATTERN.test(answer)).length;
  const quantifiedAnswers = answers.filter((answer) => NUMBER_PATTERN.test(answer)).length;
  const starSignalAnswers = answers.filter((answer) => (
    CONTEXT_PATTERN.test(answer) && ACTION_PATTERN.test(answer) && RESULT_PATTERN.test(answer)
  )).length;
  const genericAnswers = answers.filter((answer) => answer.length <= 12 || GENERIC_ANSWER_PATTERN.test(answer)).length;
  let scoreCap = 92;
  if (!answers.length) scoreCap = 0;
  else if (totalChars < 10 || genericAnswers === answers.length) scoreCap = 22;
  else if (totalChars < 30) scoreCap = 38;
  else if (answers.length === 1 && substantiveAnswers === 0) scoreCap = 45;
  else if (answers.length === 1) scoreCap = starSignalAnswers > 0 && quantifiedAnswers > 0 ? 58 : 52;
  else if (answers.length < 3) scoreCap = substantiveAnswers >= 2 ? 68 : 58;
  else if (substantiveAnswers < 2) scoreCap = 64;
  else if (starSignalAnswers === 0) scoreCap = 72;
  else if (quantifiedAnswers === 0) scoreCap = 80;
  return {
    answerCount: answers.length,
    totalChars,
    substantiveAnswers,
    quantifiedAnswers,
    starSignalAnswers,
    genericAnswers,
    scoreCap,
  };
};

const extractJson = (content: string) => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  return start >= 0 && end > start ? source.slice(start, end + 1) : source;
};

export const parseInterviewNarrative = (content: string): InterviewReportNarrative => {
  try {
    const parsed = JSON.parse(extractJson(content)) as InterviewReportNarrative;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 500) : undefined,
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 5)
        : undefined,
      optimizedAnswer: typeof parsed.optimizedAnswer === "string"
        ? parsed.optimizedAnswer.trim().slice(0, 1_200)
        : undefined,
    };
  } catch {
    return {};
  }
};

const resolvedDimensionForTurn = (
  dimensions: CompetencyDimension[],
  turn: InterviewTurn,
  index: number,
) => dimensions.find((item) => item.id === turn.competencyId) ?? dimensions[index % dimensions.length];

const assessmentFor = (
  turn: InterviewTurn,
  dimension: CompetencyDimension,
): InterviewAnswerAssessment => turn.assessment
  ?? assessCompetencyAnswer(turn.answer, dimension, turn.questionIntent);

const anchorLevelOf = (score: number): 1 | 3 | 5 => {
  if (score < 45) return 1;
  if (score < 75) return 3;
  return 5;
};

const excerpt = (value: string, length = 110) => {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
};

const dimensionReportOf = (
  dimension: CompetencyDimension,
  turns: Array<{ turn: InterviewTurn; index: number; assessment: InterviewAnswerAssessment }>,
): InterviewDimensionReport => {
  if (!turns.length) {
    return {
      id: dimension.id,
      name: dimension.name,
      weight: dimension.weight,
      score: 0,
      confidence: 0,
      status: "untested",
      anchorLevel: null,
      anchorText: "本次面试尚未覆盖该维度；未考察不等于能力不足。",
      attempts: 0,
      evidenceCount: 0,
      strongestEvidence: "暂无可用于评分的回答证据。",
      gaps: ["缺少该维度的实际案例与追问验证"],
      recommendation: `补充一段能够体现“${dimension.name}”的真实经历，并说明个人行动、结果和复盘。`,
      evidence: [],
    };
  }

  const scores = turns.map((item) => item.assessment.score);
  const bestScore = Math.max(...scores);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const hasBoundary = turns.some((item) => item.assessment.boundaryReached);
  const score = clamp(hasBoundary ? Math.min(45, bestScore * 0.55 + averageScore * 0.45) : bestScore * 0.55 + averageScore * 0.45);
  const anchorLevel = anchorLevelOf(score);
  const anchor = dimension.anchors.find((item) => item.level === anchorLevel)!;
  const allMissing = [...new Set(turns.flatMap((item) => item.assessment.missingEvidence))].slice(0, 4);
  const allSignals = [...new Set(turns.flatMap((item) => item.assessment.signalHits))];
  const strongest = [...turns].sort((left, right) => right.assessment.score - left.assessment.score)[0];
  const confidence = clamp(
    24
    + Math.min(36, turns.length * 18)
    + Math.min(16, allSignals.length * 4)
    + Math.min(14, strongest.assessment.score * 0.14)
    - (hasBoundary ? 8 : 0),
  );
  const status: InterviewDimensionReport["status"] = hasBoundary
    ? "boundary"
    : score >= 62
      ? "supported"
      : "insufficient";
  const recommendation = hasBoundary
    ? `当前回答已暴露“${dimension.name}”能力边界，建议先完成基础练习，再用小型项目形成可验证证据。`
    : allMissing.length
      ? `下一次回答“${dimension.name}”时重点补充：${allMissing.slice(0, 3).join("、")}。`
      : `继续通过更复杂约束和反事实问题验证“${dimension.name}”的稳定性。`;

  return {
    id: dimension.id,
    name: dimension.name,
    weight: dimension.weight,
    score,
    confidence,
    status,
    anchorLevel,
    anchorText: `${anchor.label}：${anchor.behavior}`,
    attempts: turns.length,
    evidenceCount: turns.filter((item) => item.assessment.score >= 38).length,
    strongestEvidence: excerpt(strongest.turn.answer),
    gaps: allMissing,
    recommendation,
    evidence: turns.map((item) => ({
      turn: item.index + 1,
      question: excerpt(item.turn.question, 90),
      answerExcerpt: excerpt(item.turn.answer),
      score: item.assessment.score,
      level: item.assessment.level,
      signalHits: item.assessment.signalHits,
      missingEvidence: item.assessment.missingEvidence,
    })),
  };
};

const decisionSummaryOf = (turns: InterviewTurn[]): InterviewDecisionSummary => {
  const summary: InterviewDecisionSummary = {
    opening: 0,
    clarify: 0,
    deepen: 0,
    challenge: 0,
    switch: 0,
    boundariesFound: 0,
  };
  turns.forEach((turn) => {
    const intent: InterviewQuestionIntent = turn.questionIntent ?? "opening";
    summary[intent] += 1;
    if (turn.assessment?.boundaryReached) summary.boundariesFound += 1;
  });
  const pendingFollowUpIntent = turns.at(-1)?.followUpIntent;
  if (pendingFollowUpIntent) summary[pendingFollowUpIntent] += 1;
  return summary;
};

const uniqueItems = (items: string[], limit: number) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit);

export const buildInterviewFeedbackReport = (input: {
  job: Job;
  turns: InterviewTurn[];
  interviewType?: InterviewType;
  narrative?: InterviewReportNarrative;
  grounding?: InterviewGroundingContext;
  reportKind?: InterviewReportKind;
  completionReason?: InterviewCompletionReason;
  elapsedSeconds?: number;
  resumeSummary?: string;
}): InterviewFeedbackReport => {
  const model = getCompetencyModel(input.job);
  const interviewType = input.interviewType ?? "综合面";
  const integrityEvaluation = analyzeInterviewIntegrity({
    job: input.job,
    turns: input.turns,
    resumeSummary: input.resumeSummary,
  });
  const sessionEvaluation = evaluateInterviewSession({
    job: input.job,
    interviewType,
    turns: input.turns,
    elapsedSeconds: input.elapsedSeconds,
    resumeSummary: input.resumeSummary,
    integrityEvaluation,
  });
  const reportKind: InterviewReportKind = input.reportKind === "stage" || !sessionEvaluation.canGenerateFormal
    ? "stage"
    : "formal";
  const completionReason: InterviewCompletionReason = input.completionReason
    ?? (sessionEvaluation.readiness === "limit_reached"
      ? "round_limit"
      : sessionEvaluation.readiness === "complete"
        ? "target_reached"
        : reportKind === "formal"
          ? "user_completed"
          : "user_early");
  const quality = analyzeInterviewEvidence(input.turns);
  const unresolvedHighRisk = integrityEvaluation.risks.some((risk) => risk.severity === "high" && risk.status !== "explained");
  const unresolvedMediumRisk = integrityEvaluation.risks.some((risk) => risk.severity === "medium" && risk.status !== "explained");
  const integrityScoreCap = unresolvedHighRisk ? 55 : unresolvedMediumRisk ? 72 : 100;
  const scoreCap = Math.min(quality.scoreCap, integrityScoreCap);
  const evaluated = input.turns.map((turn, index) => {
    const dimension = resolvedDimensionForTurn(model.dimensions, turn, index);
    return { turn, index, dimension, assessment: assessmentFor(turn, dimension) };
  });
  const dimensionReports = model.dimensions.map((dimension) => dimensionReportOf(
    dimension,
    evaluated.filter((item) => item.dimension.id === dimension.id),
  ));
  const tested = dimensionReports.filter((item) => item.status !== "untested");
  const testedWeight = tested.reduce((sum, item) => sum + item.weight, 0);
  const weightedTestedAverage = testedWeight
    ? tested.reduce((sum, item) => sum + item.score * item.weight, 0) / testedWeight
    : 0;
  const coverageFactor = 0.45 + (testedWeight / 100) * 0.55;
  const professionalFit = Math.min(scoreCap, clamp(weightedTestedAverage * coverageFactor));
  const answerCount = Math.max(1, quality.answerCount);
  const substantiveRatio = quality.substantiveAnswers / answerCount;
  const starRatio = quality.starSignalAnswers / answerCount;
  const quantifiedRatio = quality.quantifiedAnswers / answerCount;
  const genericRatio = quality.genericAnswers / answerCount;
  const averageDimensionScore = tested.length
    ? tested.reduce((sum, item) => sum + item.score, 0) / tested.length
    : 0;
  const averageAnswerLength = quality.totalChars / answerCount;
  const expression = quality.answerCount
    ? Math.min(scoreCap, clamp(
      8 + Math.min(22, averageAnswerLength * 0.45) + substantiveRatio * 26 + starRatio * 24 + quantifiedRatio * 12 - genericRatio * 24,
    ))
    : 0;
  const logic = quality.answerCount
    ? Math.min(scoreCap, clamp(averageDimensionScore * 0.42 + starRatio * 30 + quantifiedRatio * 13 + substantiveRatio * 15 - genericRatio * 18))
    : 0;
  const overallScore = Math.min(scoreCap, clamp(professionalFit * 0.65 + expression * 0.15 + logic * 0.2));
  const confidenceScore = quality.answerCount
    ? clamp(
      testedWeight * 0.45
      + Math.min(24, quality.answerCount * 6)
      + Math.min(16, quality.starSignalAnswers * 6)
      + Math.min(8, quality.quantifiedAnswers * 3)
      - genericRatio * 20
      - integrityEvaluation.pendingCount * 10
      - integrityEvaluation.unresolvedCount * 14
      - integrityEvaluation.explainedCount * 2,
    )
    : 0;
  const evidenceStats = {
    answerCount: quality.answerCount,
    substantiveAnswers: quality.substantiveAnswers,
    starEvidence: quality.starSignalAnswers,
    quantifiedEvidence: quality.quantifiedAnswers,
  };
  const growthComparison = buildInterviewGrowthComparison({
    job: input.job,
    modelTrack: model.track,
    interviewType,
    reportKind,
    overallScore,
    confidenceScore,
    coverageScore: testedWeight,
    evidenceStats,
    dimensions: dimensionReports,
    history: input.grounding?.memoryReferences ?? [],
  });

  const rankedTested = [...tested].sort((left, right) => right.score - left.score);
  const strengths = rankedTested
    .filter((item) => item.score >= 62)
    .slice(0, 3)
    .map((item) => `${item.name}（${item.score}分）：${item.strongestEvidence}`);
  const weakCandidates = [...dimensionReports].sort((left, right) => {
    const leftPriority = left.status === "boundary" ? 300 : left.status === "insufficient" ? 200 : left.status === "untested" ? 100 : 0;
    const rightPriority = right.status === "boundary" ? 300 : right.status === "insufficient" ? 200 : right.status === "untested" ? 100 : 0;
    return (rightPriority + right.weight - right.score * 0.1) - (leftPriority + left.weight - left.score * 0.1);
  });
  const weaknesses = weakCandidates
    .filter((item) => item.status !== "supported")
    .slice(0, 3)
    .map((item) => item.status === "untested"
      ? `${item.name}：本次未覆盖，当前不能形成能力认证。`
      : `${item.name}（${item.score}分）：${item.gaps.slice(0, 2).join("、") || "有效证据仍不足"}。`);
  const localImprovements = weakCandidates
    .filter((item) => item.status !== "supported")
    .slice(0, 4)
    .map((item) => item.recommendation);
  const coverageText = `本次覆盖 ${tested.length}/${dimensionReports.length} 个能力维度（权重覆盖 ${testedWeight}%），形成 ${quality.substantiveAnswers} 条实质回答、${quality.starSignalAnswers} 条 STAR 证据和 ${quality.quantifiedAnswers} 条量化证据。`;
  const scoreText = `岗位胜任/匹配度 ${professionalFit} 分，表达 ${expression} 分，逻辑与复盘 ${logic} 分；综合得分 ${overallScore} 分，评估置信度 ${confidenceScore}%。`;
  const integrityText = integrityEvaluation.assessedTurns >= 2 || integrityEvaluation.riskCount > 0
    ? `回答一致性 ${integrityEvaluation.score} 分；${integrityEvaluation.summary}`
    : `回答一致性尚待积累；${integrityEvaluation.summary}`;
  const cautionText = reportKind === "stage"
    ? `当前为阶段性报告，尚未达到正式报告门槛（${sessionEvaluation.statusMessage}），不能替代完整胜任力认证。`
    : "当前已达到正式报告的最低证据门槛，仍建议通过后续复测验证能力稳定性。";
  const narrativeSummary = input.narrative?.summary?.trim();
  const safeNarrativeSummary = narrativeSummary && !(overallScore < 65 && OVERCLAIM_PATTERN.test(narrativeSummary))
    ? narrativeSummary
    : "";
  const fallbackAnswer = weakCandidates[0]
    ? `建议针对“${weakCandidates[0].name}”重新组织回答：先交代具体情境和任务，再说明本人采取的关键行动、选择依据与验证过程，最后给出量化结果、失败边界和复盘。`
    : "建议使用 STAR 结构说明具体情境、个人行动、量化结果和复盘。";

  return {
    reportVersion: 2,
    reportKind,
    completionReason,
    sessionEvaluation,
    integrityEvaluation,
    growthComparison,
    modelTrack: model.track,
    modelName: model.name,
    overallScore,
    expression,
    professionalFit,
    logic,
    coverageScore: testedWeight,
    confidenceScore,
    scoreCap,
    evidenceStats,
    grounding: input.grounding ?? {
      knowledgeStatus: "empty",
      memoryStatus: "empty",
      retrievalQuery: "",
      indexVersion: "",
      retrievalElapsedMs: 0,
      retrievedAt: new Date().toISOString(),
      knowledgeSources: [],
      memoryReferences: [],
      userNotes: [],
      recurringWeaknesses: [],
    },
    dimensionReports,
    strengths: strengths.length ? strengths : ["当前尚无达到“已有支撑”标准的能力维度，需要补充真实案例。"],
    weaknesses: weaknesses.length ? weaknesses : ["暂未发现明显低分维度，建议继续通过压力题验证能力边界。"],
    decisionSummary: decisionSummaryOf(evaluated.map((item) => ({ ...item.turn, assessment: item.assessment }))),
    improvements: uniqueItems([...localImprovements, ...(input.narrative?.improvements ?? [])], 5),
    optimizedAnswer: input.narrative?.optimizedAnswer?.trim() || fallbackAnswer,
    summary: [coverageText, scoreText, integrityText, cautionText, growthComparison?.summary, safeNarrativeSummary].filter(Boolean).join(" "),
  };
};
