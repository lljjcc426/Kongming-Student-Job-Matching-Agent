export type InterviewStatus = "idle" | "opening" | "asking" | "listening" | "thinking" | "feedback" | "finished" | "error";

export type AvatarSpeechState = "idle" | "speaking" | "listening" | "thinking" | "error";

export type InterviewInputMode = "text" | "voice";

export type InterviewType = "综合面" | "技术面" | "HR面";

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
  timestamp: number;
  inputMode: InterviewInputMode;
};

export type InterviewAssessmentLevel = "strong" | "developing" | "needs-evidence" | "unavailable";

export type InterviewFeedbackReport = {
  feedbackAvailable: boolean;
  overallLevel: InterviewAssessmentLevel;
  expression: InterviewAssessmentLevel;
  professionalEvidence: InterviewAssessmentLevel;
  logic: InterviewAssessmentLevel;
  improvements: string[];
  optimizedAnswer: string;
  summary: string;
};

export type InterviewCompletion = {
  interviewType: InterviewType;
  feedback: InterviewFeedbackReport;
  turns: InterviewTurn[];
  completedAt: string;
};
