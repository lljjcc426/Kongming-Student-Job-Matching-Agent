import type { InterviewFeedbackReport, InterviewTurn, InterviewType } from "../../types/interview";

export type GrowthStageDays = number;
export type GrowthTaskKind = "course" | "project" | "certificate" | "interview" | "resume";
export type GrowthTaskPriority = "high" | "medium" | "normal";
export type GrowthEvidenceStatus = "not_submitted" | "pending" | "verified" | "needs_revision";

export type GrowthEvidenceReview = {
  decision: "verified" | "needs_revision";
  score: number;
  relevance: number;
  completeness: number;
  credibility: number;
  summary: string;
  reasons: string[];
  reviewedAt: string;
  reviewer: "local-evidence-agent-v1";
  linkCheck: "not_provided" | "format_only";
};

export type GrowthResource = {
  title: string;
  provider: string;
  type: "course" | "documentation" | "certificate" | "practice";
  url: string;
  note: string;
};

export type GrowthGap = {
  id: string;
  name: string;
  source: "resume" | "job" | "interview";
  baselineScore: number;
  currentScore: number;
  projectedScore: number;
  targetScore: number;
  reason: string;
};

export type GrowthTask = {
  id: string;
  week: number;
  stageDays: GrowthStageDays;
  title: string;
  description: string;
  kind: GrowthTaskKind;
  priority: GrowthTaskPriority;
  estimatedHours: number;
  gapIds: string[];
  evidenceRequirement: string;
  resources: GrowthResource[];
  scoreGain: number;
  completed: boolean;
  evidenceStatus: GrowthEvidenceStatus;
  evidenceReview: GrowthEvidenceReview | null;
  evidenceText: string;
  evidenceUrl: string;
  submittedAt: string | null;
  completedAt: string | null;
  dueDate: string;
};

export type GrowthStage = {
  days: GrowthStageDays;
  startDay: number;
  startDate: string;
  endDate: string;
  title: string;
  outcome: string;
  goals: string[];
  unlocked: boolean;
};

export type InterviewGrowthSnapshot = {
  interviewType: InterviewType;
  feedback: InterviewFeedbackReport;
  turns: InterviewTurn[];
  completedAt: string;
};

export type GrowthRecommendation = {
  id: string;
  kind: "course" | "project" | "certificate";
  title: string;
  reason: string;
  url?: string;
  provider?: string;
};

export type GrowthAdaptation = {
  id: string;
  createdAt: string;
  message: string;
};

export type GrowthAssessment = {
  id: string;
  createdAt: string;
  trigger: "initial" | "resume_reassessment" | "interview_reassessment" | "manual_reassessment";
  previousMatchScore: number | null;
  matchScore: number;
  interviewScore: number;
  evidenceCoverage: number;
  verifiedTaskCount: number;
  summary: string;
};

export type GrowthPlan = {
  id: string;
  version: 1;
  targetJobId: string;
  targetJobTitle: string;
  targetJobTrack: string;
  targetDate: string;
  scheduleStartDate: string;
  planningDays: number;
  planningWeeks: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
  baseMatchScore: number;
  verifiedMatchScore: number;
  verifiedInterviewScore: number;
  verifiedEvidenceCoverage: number;
  lastReassessedAt: string;
  projectedMatchScore: number;
  gaps: GrowthGap[];
  stages: GrowthStage[];
  tasks: GrowthTask[];
  recommendations: GrowthRecommendation[];
  adaptations: GrowthAdaptation[];
  assessments: GrowthAssessment[];
  interview: InterviewGrowthSnapshot;
};

export type GrowthPlanStatus = "loading" | "ready" | "empty" | "saving" | "error";
