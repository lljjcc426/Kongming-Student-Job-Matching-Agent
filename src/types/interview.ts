export type InterviewStatus = "idle" | "opening" | "asking" | "listening" | "thinking" | "feedback" | "finished" | "error";

export type AvatarSpeechState = "idle" | "speaking" | "listening" | "thinking" | "error";

export type InterviewInputMode = "text" | "voice";

export type InterviewType = "综合面" | "技术面" | "HR面";

export type InterviewReportKind = "formal" | "stage";

export type InterviewCompletionReason = "target_reached" | "round_limit" | "user_completed" | "user_early";

export type InterviewCompetencyTrack = "ai_algorithm" | "frontend" | "backend" | "product" | "fullstack";

export type InterviewQuestionIntent = "opening" | "clarify" | "deepen" | "challenge" | "switch";

export type InterviewEvidenceLevel = "insufficient" | "basic" | "supported" | "strong";

export type InterviewIntegrityRiskKind = "ownership_conflict" | "fact_inconsistency" | "tool_claim_conflict" | "resume_unverified_claim";

export type InterviewIntegrityRiskSeverity = "low" | "medium" | "high";

export type InterviewIntegrityRiskStatus = "pending" | "explained" | "unresolved";

export type InterviewIntegrityRisk = {
  id: string;
  kind: InterviewIntegrityRiskKind;
  severity: InterviewIntegrityRiskSeverity;
  status: InterviewIntegrityRiskStatus;
  competencyId: string;
  competencyName: string;
  sourceTurns: number[];
  title: string;
  claim: string;
  conflictingClaim: string;
  rationale: string;
  verificationQuestion: string;
  responseTurn?: number;
  responseExcerpt?: string;
};

export type InterviewIntegrityEvaluation = {
  score: number;
  assessedTurns: number;
  riskCount: number;
  pendingCount: number;
  explainedCount: number;
  unresolvedCount: number;
  risks: InterviewIntegrityRisk[];
  summary: string;
};

export type InterviewAnswerAssessment = {
  score: number;
  level: InterviewEvidenceLevel;
  signalHits: string[];
  missingEvidence: string[];
  boundaryReached: boolean;
  summary: string;
};

export type InterviewCompetencyProgress = {
  id: string;
  name: string;
  weight: number;
  attempts: number;
  bestScore: number;
  status: "untested" | "exploring" | "supported" | "boundary";
};

export type InterviewFollowUpDecision = {
  track: InterviewCompetencyTrack;
  modelName: string;
  targetCompetencyId: string;
  targetCompetencyName: string;
  strategy: InterviewQuestionIntent;
  rationale: string;
  questionSeed: string;
  previousAssessment: InterviewAnswerAssessment | null;
  progress: InterviewCompetencyProgress[];
  integrityRisk?: InterviewIntegrityRisk | null;
  integrityTrace?: {
    score: number;
    riskCount: number;
    pendingCount: number;
  };
  groundingTrace?: {
    knowledgeSourceIds: string[];
    memoryReferenceIds: string[];
    userNoteCount: number;
  };
};

export type InterviewReply = {
  question: string;
  decision: InterviewFollowUpDecision;
};

export type InterviewKnowledgeSource = {
  id: string;
  title: string;
  company: string;
  sourceName: string;
  sourceUrl: string;
  confidence: number;
  matchedTerms: string[];
  matchedSections: string[];
  responsibilities: string[];
  requirements: string[];
};

export type InterviewMemoryReference = {
  id: string;
  jobId: string;
  jobTitle: string;
  modelTrack: InterviewCompetencyTrack;
  interviewType: InterviewType;
  reportKind: InterviewReportKind;
  overallScore: number;
  confidenceScore: number;
  coverageScore: number;
  integrityScore: number;
  evidenceStats: InterviewReportEvidenceStats;
  summary: string;
  dimensions: InterviewMemoryDimensionSnapshot[];
  weakDimensions: Array<{ id: string; name: string; score: number; status: InterviewDimensionReport["status"] }>;
  createdAt: string;
};

export type InterviewMemoryDimensionSnapshot = {
  id: string;
  name: string;
  weight: number;
  score: number;
  confidence: number;
  status: InterviewDimensionReport["status"];
  attempts: number;
  evidenceCount: number;
};

export type InterviewGroundingContext = {
  knowledgeStatus: "ready" | "empty" | "error";
  memoryStatus: "ready" | "empty" | "error";
  retrievalQuery: string;
  indexVersion: string;
  retrievalElapsedMs: number;
  retrievedAt: string;
  knowledgeSources: InterviewKnowledgeSource[];
  memoryReferences: InterviewMemoryReference[];
  userNotes: string[];
  recurringWeaknesses: string[];
};

export type InterviewMessage = {
  id: string;
  role: "interviewer" | "student" | "system";
  content: string;
  timestamp: number;
  inputMode?: InterviewInputMode;
};

export type InterviewTurn = {
  question: string;
  answer: string;
  followUp?: string;
  followUpIntent?: InterviewQuestionIntent;
  competencyId?: string;
  competencyName?: string;
  questionIntent?: InterviewQuestionIntent;
  assessment?: InterviewAnswerAssessment;
  integrityRiskId?: string;
  timestamp: number;
  inputMode: InterviewInputMode;
};

export type InterviewDimensionEvidence = {
  turn: number;
  question: string;
  answerExcerpt: string;
  score: number;
  level: InterviewEvidenceLevel;
  signalHits: string[];
  missingEvidence: string[];
};

export type InterviewDimensionReport = {
  id: string;
  name: string;
  weight: number;
  score: number;
  confidence: number;
  status: "untested" | "insufficient" | "supported" | "boundary";
  anchorLevel: 1 | 3 | 5 | null;
  anchorText: string;
  attempts: number;
  evidenceCount: number;
  strongestEvidence: string;
  gaps: string[];
  recommendation: string;
  evidence: InterviewDimensionEvidence[];
};

export type InterviewDecisionSummary = {
  opening: number;
  clarify: number;
  deepen: number;
  challenge: number;
  switch: number;
  boundariesFound: number;
};

export type InterviewReportEvidenceStats = {
  answerCount: number;
  substantiveAnswers: number;
  starEvidence: number;
  quantifiedEvidence: number;
};

export type InterviewDimensionTrendStatus = "improved" | "stable" | "regressed" | "new_evidence" | "not_retested" | "not_comparable";

export type InterviewDimensionGrowthTrend = {
  id: string;
  name: string;
  weight: number;
  previousScore: number | null;
  currentScore: number | null;
  delta: number | null;
  previousStatus: InterviewDimensionReport["status"] | null;
  currentStatus: InterviewDimensionReport["status"];
  previousConfidence: number;
  currentConfidence: number;
  status: InterviewDimensionTrendStatus;
  explanation: string;
};

export type InterviewGrowthComparison = {
  baselineInterviewId: string;
  baselineDate: string;
  baselineJobTitle: string;
  baselineReportKind: InterviewReportKind;
  comparisonScope: "same_job" | "same_track";
  comparisonQuality: "high" | "medium" | "low";
  overallComparable: boolean;
  previousOverallScore: number;
  currentOverallScore: number;
  overallDelta: number;
  previousConfidenceScore: number;
  currentConfidenceScore: number;
  confidenceDelta: number;
  previousCoverageScore: number;
  currentCoverageScore: number;
  coverageDelta: number;
  previousEffectiveAnswers: number;
  currentEffectiveAnswers: number;
  comparableDimensions: number;
  improvedDimensions: number;
  stableDimensions: number;
  regressedDimensions: number;
  newEvidenceDimensions: number;
  dimensionTrends: InterviewDimensionGrowthTrend[];
  summary: string;
  cautions: string[];
};

export type InterviewSessionPolicy = {
  targetDimensions: number;
  minimumEffectiveAnswers: number;
  targetEffectiveAnswers: number;
  maximumRounds: number;
  targetMinutes: number;
  maximumProbesPerDimension: number;
};

export type InterviewSessionReadiness = "not_ready" | "stage_ready" | "formal_ready" | "complete" | "limit_reached";

export type InterviewSessionEvaluation = {
  policy: InterviewSessionPolicy;
  eligibleDimensionIds: string[];
  attemptedDimensionIds: string[];
  evidenceDimensionIds: string[];
  attemptedDimensions: number;
  evidenceDimensions: number;
  effectiveAnswers: number;
  totalRounds: number;
  elapsedSeconds: number;
  coveragePercent: number;
  evidenceCoveragePercent: number;
  estimatedConfidence: number;
  integrityScore: number;
  integrityReady: boolean;
  integrityPendingCount: number;
  integrityUnresolvedCount: number;
  readiness: InterviewSessionReadiness;
  canGenerateFormal: boolean;
  shouldAutoFinish: boolean;
  missingRequirements: string[];
  statusMessage: string;
};

export type InterviewFeedbackReport = {
  reportVersion: 2;
  reportKind: InterviewReportKind;
  completionReason: InterviewCompletionReason;
  sessionEvaluation: InterviewSessionEvaluation;
  integrityEvaluation: InterviewIntegrityEvaluation;
  growthComparison: InterviewGrowthComparison | null;
  modelTrack: InterviewCompetencyTrack;
  modelName: string;
  overallScore: number;
  expression: number;
  professionalFit: number;
  logic: number;
  coverageScore: number;
  confidenceScore: number;
  scoreCap: number;
  evidenceStats: InterviewReportEvidenceStats;
  grounding: InterviewGroundingContext;
  dimensionReports: InterviewDimensionReport[];
  strengths: string[];
  weaknesses: string[];
  decisionSummary: InterviewDecisionSummary;
  improvements: string[];
  optimizedAnswer: string;
  summary: string;
};
