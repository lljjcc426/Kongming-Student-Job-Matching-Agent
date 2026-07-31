export type ActivePage = "home" | "resume-editor" | "resume" | "jobs" | "interview" | "assistant";

export type PipelineStep = "idle" | "intake" | "structure" | "jobs" | "analysis" | "done" | "error";

export type JdPipelineStep = "idle" | "parse" | "evaluate" | "links" | "done" | "error";

export type AsyncStatus = "idle" | "loading" | "ready" | "error";

export type ChatStatus = AsyncStatus | "listening";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
