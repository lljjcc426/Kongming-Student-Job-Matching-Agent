import type { Job } from "../../data";
import type { MatchResult, RequirementMatchStatus } from "../../matchEngine";
import type { InterviewFeedbackReport, InterviewTurn, InterviewType } from "../../types/interview";

export type GrowthTaskKind = "project" | "interview" | "resume";
export type GrowthTaskStatus = "todo" | "submitted" | "verified" | "needs_revision";

export type GrowthGap = {
  id: string;
  requirementId: string;
  title: string;
  source: "job" | "interview";
  status: RequirementMatchStatus | "needs-evidence";
  reason: string;
  targetEvidence: string;
};

export type GrowthEvidenceReview = {
  decision: "verified" | "needs_revision";
  score: number;
  summary: string;
  reasons: string[];
  reviewedAt: string;
};

export type GrowthTask = {
  id: string;
  gapId: string;
  title: string;
  description: string;
  kind: GrowthTaskKind;
  priority: "high" | "medium";
  evidenceRequirement: string;
  projectedGain: number;
  status: GrowthTaskStatus;
  evidenceText: string;
  evidenceUrl: string;
  evidenceReview: GrowthEvidenceReview | null;
  submittedAt: string | null;
  verifiedAt: string | null;
};

export type GrowthInterviewSnapshot = {
  interviewType: InterviewType;
  feedback: InterviewFeedbackReport;
  turns: InterviewTurn[];
  completedAt: string;
};

export type GrowthAssessment = {
  id: string;
  trigger: "initial" | "evidence_review" | "interview_retest";
  createdAt: string;
  empiricalCoverage: number;
  projectedCoverage: number;
  verifiedTaskCount: number;
  summary: string;
};

export type GrowthPlan = {
  id: string;
  targetJobId: string;
  targetJobTitle: string;
  createdAt: string;
  updatedAt: string;
  baselineCoverage: number;
  empiricalCoverage: number;
  projectedCoverage: number;
  gaps: GrowthGap[];
  tasks: GrowthTask[];
  interview: GrowthInterviewSnapshot | null;
  assessments: GrowthAssessment[];
};

export type GrowthPlanInput = {
  job: Job;
  matchResult: MatchResult;
  interview: GrowthInterviewSnapshot | null;
  previousPlan?: GrowthPlan | null;
};
