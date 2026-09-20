import type { Job } from "./data";
import type { MatchResult } from "./matchEngine";
import type { AgentMemoryPromptContext } from "./features/assistant/agentMemoryClient";

export type ArkTask = "match-analysis" | "resume-vision" | "resume-structure" | "job-recommendations" | "jd-analysis" | "interview-feedback" | "career-chat";

export type ArkRequest = {
  task: ArkTask;
  resumeText?: string;
  selectedJob?: Job;
  matchResult?: MatchResult;
  interviewAnswer?: string;
  imageDataUrl?: string;
  imageDataUrls?: string[];
  resumeProfile?: unknown;
  jdText?: string;
  jobTitle?: string;
  agentFocus?: string;
  jobCount?: number;
  userMessage?: string;
  chatMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  persistentMemory?: AgentMemoryPromptContext;
};

export type ArkResponse = {
  ok: boolean;
  model?: string;
  content?: string;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 75_000;

export async function callArkAgent(payload: ArkRequest, options: { timeoutMs?: number } = {}): Promise<ArkResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  const endpoint = import.meta.env.VITE_ARK_API_URL || "/api/ark";

  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.name === "AbortError" ? "模型请求超时，已跳过该子任务。" : "模型服务暂不可用。",
    };
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as ArkResponse;
  if (!response.ok || !data.ok) {
    return {
      ok: false,
      error: data.error || "模型服务暂不可用。",
    };
  }

  return data;
}
