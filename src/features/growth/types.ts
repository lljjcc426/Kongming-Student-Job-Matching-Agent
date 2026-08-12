import type { InterviewFeedbackReport, InterviewTurn, InterviewType } from "../../types/interview";

export type GrowthStageDays = 30 | 60 | 90;
export type GrowthTaskKind = "course" | "project" | "certificate" | "interview" | "resume";
export type GrowthTaskPriority = "high" | "medium" | "normal";

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
  evidenceText: string;
  evidenceUrl: string;
  completedAt: string | null;
};

export type GrowthStage = {
  days: GrowthStageDays;
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

export type GrowthPlan = {
  id: string;
  version: 1;
  targetJobId: string;
  targetJobTitle: string;
  targetJobTrack: string;
  targetDate: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  baseMatchScore: number;
  projectedMatchScore: number;
  gaps: GrowthGap[];
  stages: GrowthStage[];
  tasks: GrowthTask[];
  recommendations: GrowthRecommendation[];
  adaptations: GrowthAdaptation[];
  interview: InterviewGrowthSnapshot;
};

export type GrowthPlanStatus = "loading" | "ready" | "empty" | "saving" | "error";
