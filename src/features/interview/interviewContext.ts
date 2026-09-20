import type { Job } from "../../data";
import { searchJobKnowledge, type JobKnowledgeResult } from "../../jobKnowledgeClient";
import {
  buildAgentMemoryPrompt,
  createEmptyAgentMemory,
  loadAgentMemory,
  type AgentMemory,
} from "../assistant/agentMemoryClient";
import { loadGrowthPlan } from "../growth/growthPlanClient";
import type { GrowthPlan, InterviewGrowthSnapshot } from "../growth/types";
import type {
  InterviewDimensionReport,
  InterviewGroundingContext,
  InterviewKnowledgeSource,
  InterviewMemoryReference,
} from "../../types/interview";
import { getCompetencyModel } from "./competencyModels";

const unique = (values: string[]) => [...new Set(values.map((item) => item.trim()).filter(Boolean))];
const compact = (value: string, limit = 220) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
};

const knowledgeSourceOf = (result: JobKnowledgeResult): InterviewKnowledgeSource => ({
  id: result.id,
  title: result.title,
  company: result.company_name,
  sourceName: result.source_name,
  sourceUrl: result.source_url,
  confidence: Math.round(result.retrieval.confidence * 100),
  matchedTerms: result.retrieval.matchedTerms.slice(0, 8),
  matchedSections: result.retrieval.matchedSections.slice(0, 5),
  responsibilities: result.responsibilities.slice(0, 4).map((item) => compact(item)),
  requirements: result.requirements.slice(0, 4).map((item) => compact(item)),
});

const jobFallbackSource = (job: Job): InterviewKnowledgeSource | null => {
  if (!job.knowledgeBase && !job.requirements.length && !job.responsibilities.length) return null;
  return {
    id: job.knowledgeBase?.sourceJobId || job.id,
    title: job.title,
    company: job.applicationLinks?.[0]?.company || job.companyScenario.split("·")[0]?.trim() || "目标企业",
    sourceName: job.knowledgeBase?.source || "当前岗位JD",
    sourceUrl: job.applicationLinks?.[0]?.url || "",
    confidence: Math.round((job.knowledgeBase?.retrievalScore ?? 1) * 100),
    matchedTerms: job.knowledgeBase?.matchedTerms.slice(0, 8) ?? job.keywords.slice(0, 8),
    matchedSections: job.knowledgeBase?.matchedSections.slice(0, 5) ?? ["requirements", "responsibilities"],
    responsibilities: job.responsibilities.slice(0, 4).map((item) => compact(item)),
    requirements: job.requirements.slice(0, 4).map((item) => compact(item)),
  };
};

const weakDimensionsOf = (dimensions: InterviewDimensionReport[] = []) => dimensions
  .filter((item) => item.status !== "supported")
  .sort((left, right) => {
    const leftPriority = left.status === "boundary" ? 200 : left.status === "insufficient" ? 100 : 0;
    const rightPriority = right.status === "boundary" ? 200 : right.status === "insufficient" ? 100 : 0;
    return (rightPriority + right.weight - right.score) - (leftPriority + left.weight - left.score);
  })
  .slice(0, 4)
  .map(({ id, name, score, status }) => ({ id, name, score, status }));

const growthInterviewReference = (plan: GrowthPlan | null, fallbackTrack: InterviewMemoryReference["modelTrack"]): InterviewMemoryReference | null => {
  const interview: InterviewGrowthSnapshot | undefined = plan?.interview;
  if (!plan || !interview?.feedback) return null;
  return {
    id: `growth-${plan.id}-${interview.completedAt}`,
    jobId: plan.targetJobId,
    jobTitle: plan.targetJobTitle,
    modelTrack: interview.feedback.modelTrack || fallbackTrack,
    interviewType: interview.interviewType,
    reportKind: interview.feedback.reportKind === "formal" ? "formal" : "stage",
    overallScore: interview.feedback.overallScore,
    confidenceScore: Number.isFinite(interview.feedback.confidenceScore) ? interview.feedback.confidenceScore : 0,
    coverageScore: Number.isFinite(interview.feedback.coverageScore) ? interview.feedback.coverageScore : 0,
    integrityScore: Number.isFinite(interview.feedback.integrityEvaluation?.score)
      ? interview.feedback.integrityEvaluation.score
      : 0,
    evidenceStats: interview.feedback.evidenceStats ?? {
      answerCount: 0,
      substantiveAnswers: 0,
      starEvidence: 0,
      quantifiedEvidence: 0,
    },
    summary: compact(interview.feedback.summary, 500),
    dimensions: (interview.feedback.dimensionReports ?? []).map((dimension) => ({
      id: dimension.id,
      name: dimension.name,
      weight: dimension.weight,
      score: dimension.score,
      confidence: dimension.confidence,
      status: dimension.status,
      attempts: dimension.attempts,
      evidenceCount: dimension.evidenceCount,
    })),
    weakDimensions: weakDimensionsOf(interview.feedback.dimensionReports),
    createdAt: interview.completedAt,
  };
};

const relevanceScore = (reference: InterviewMemoryReference, job: Job, modelTrack: string) => {
  let score = 0;
  if (reference.jobId === job.id) score += 8;
  if (reference.jobTitle === job.title) score += 6;
  if (reference.modelTrack === modelTrack) score += 4;
  if (reference.jobTitle.includes(job.title) || job.title.includes(reference.jobTitle)) score += 2;
  return score;
};

const relevantMemoryReferences = (
  memory: AgentMemory,
  plan: GrowthPlan | null,
  job: Job,
  modelTrack: string,
) => {
  const growthReference = growthInterviewReference(plan, modelTrack as InterviewMemoryReference["modelTrack"]);
  const references = [...memory.interviews, ...(growthReference ? [growthReference] : [])];
  const used = new Set<string>();
  return references
    .map((reference) => ({ reference, score: relevanceScore(reference, job, modelTrack) }))
    .filter((item) => item.score >= 4)
    .sort((left, right) => right.score - left.score || right.reference.createdAt.localeCompare(left.reference.createdAt))
    .filter((item) => {
      const key = `${item.reference.jobId}-${item.reference.createdAt}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 6)
    .map((item) => item.reference);
};

const recurringWeaknessesOf = (references: InterviewMemoryReference[]) => {
  const counts = new Map<string, { name: string; count: number; lowest: number }>();
  references.forEach((reference) => reference.weakDimensions.forEach((dimension) => {
    const current = counts.get(dimension.id) ?? { name: dimension.name, count: 0, lowest: 100 };
    counts.set(dimension.id, {
      name: dimension.name,
      count: current.count + 1,
      lowest: Math.min(current.lowest, dimension.score),
    });
  }));
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.lowest - right.lowest)
    .slice(0, 4)
    .map((item) => `${item.name}（历史${item.count}次，最低${item.lowest}分）`);
};

const emptyGrounding = (): InterviewGroundingContext => ({
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
});

export const createEmptyInterviewGrounding = emptyGrounding;

export const prepareInterviewGrounding = async (input: {
  job: Job;
  resumeSummary: string;
}): Promise<InterviewGroundingContext> => {
  const model = getCompetencyModel(input.job);
  const primaryQuery = [
    `目标岗位：${input.job.title}`,
    `岗位方向：${input.job.track}`,
    `核心职责：${input.job.responsibilities.slice(0, 4).join("；")}`,
    `任职要求：${input.job.requirements.slice(0, 4).join("；")}`,
  ].filter(Boolean).join("\n").slice(0, 1_800);
  const competencyQuery = `岗位胜任力：${model.dimensions.map((item) => `${item.name}（${item.positiveSignals.slice(0, 5).join("、")}）`).join("；")}`.slice(0, 1_800);
  const candidateQuery = `学生画像与岗位证据：${compact(input.resumeSummary, 1_400)}`;

  const [knowledgeResult, memoryResult, growthResult] = await Promise.allSettled([
    searchJobKnowledge(primaryQuery, {
      queries: [competencyQuery, candidateQuery],
      topK: 6,
      filters: { studentOnly: true },
      rerank: false,
      timeoutMs: 15_000,
    }),
    loadAgentMemory(),
    loadGrowthPlan(),
  ]);

  const fallbackSource = jobFallbackSource(input.job);
  const knowledgeResponse = knowledgeResult.status === "fulfilled" ? knowledgeResult.value : null;
  const retrievedSources = knowledgeResponse?.ok
    ? knowledgeResponse.results.slice(0, 5).map(knowledgeSourceOf)
    : [];
  const knowledgeSources = unique([
    ...(fallbackSource ? [fallbackSource.id] : []),
    ...retrievedSources.map((item) => item.id),
  ]).map((id) => (fallbackSource?.id === id ? fallbackSource : retrievedSources.find((item) => item.id === id)!)).filter(Boolean).slice(0, 5);

  const memory = memoryResult.status === "fulfilled" ? memoryResult.value : createEmptyAgentMemory();
  const growthPlan = growthResult.status === "fulfilled" ? growthResult.value : null;
  const memoryReferences = relevantMemoryReferences(memory, growthPlan, input.job, model.track);
  const memoryQuery = `${input.job.title} ${model.name} ${model.dimensions.map((item) => item.name).join(" ")}`;
  const memoryPrompt = buildAgentMemoryPrompt(memory, memoryQuery, { targetJob: input.job });
  const userNotes = unique([
    ...memoryPrompt.relevantMessages.filter((message) => message.role === "user").map((message) => compact(message.content, 180)),
    ...memoryPrompt.feedback.filter((item) => item.rating === "negative" && item.correction).map((item) => compact(item.correction, 180)),
  ]).slice(0, 5);

  return {
    knowledgeStatus: knowledgeSources.length ? "ready" : knowledgeResult.status === "rejected" || (knowledgeResponse && !knowledgeResponse.ok) ? "error" : "empty",
    memoryStatus: memoryReferences.length || userNotes.length ? "ready" : memoryResult.status === "rejected" ? "error" : "empty",
    retrievalQuery: primaryQuery,
    indexVersion: knowledgeResponse?.ok ? knowledgeResponse.indexVersion : "",
    retrievalElapsedMs: knowledgeResponse?.ok ? knowledgeResponse.elapsedMs : 0,
    retrievedAt: new Date().toISOString(),
    knowledgeSources,
    memoryReferences,
    userNotes,
    recurringWeaknesses: recurringWeaknessesOf(memoryReferences),
  };
};

export const selectInterviewKnowledge = (
  grounding: InterviewGroundingContext,
  targetTerms: string[],
  limit = 3,
) => {
  const normalizedTerms = unique(targetTerms).map((item) => item.toLowerCase());
  return [...grounding.knowledgeSources]
    .map((source) => {
      const text = [
        source.title,
        ...source.matchedTerms,
        ...source.responsibilities,
        ...source.requirements,
      ].join(" ").toLowerCase();
      const hits = normalizedTerms.filter((term) => text.includes(term)).length;
      return { source, score: hits * 10 + source.confidence };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.source);
};
