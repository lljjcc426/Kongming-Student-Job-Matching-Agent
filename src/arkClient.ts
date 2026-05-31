import type { Job } from "./data";
import type { MatchResult } from "./matchEngine";

export type ArkTask = "match-analysis" | "resume-vision" | "resume-structure" | "job-recommendations" | "interview-feedback";

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
  agentFocus?: string;
  jobCount?: number;
};

export type ArkResponse = {
  ok: boolean;
  model?: string;
  content?: string;
  error?: string;
};

export async function callArkAgent(payload: ArkRequest, options: { timeoutMs?: number } = {}): Promise<ArkResponse> {
  const controller = new AbortController();
  const timeoutId = options.timeoutMs ? window.setTimeout(() => controller.abort(), options.timeoutMs) : 0;
  let response: Response;

  try {
    response = await fetch("/api/ark", {
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
