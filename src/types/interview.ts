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

export type InterviewFeedbackReport = {
  overallScore: number;
  expression: number;
  professionalFit: number;
  logic: number;
  improvements: string[];
  optimizedAnswer: string;
  summary: string;
};
