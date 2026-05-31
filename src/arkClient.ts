import type { Job } from "./data";
import type { MatchResult } from "./matchEngine";

export type ArkTask = "match-analysis" | "resume-vision" | "interview-feedback";

export type ArkRequest = {
  task: ArkTask;
  resumeText?: string;
  selectedJob?: Job;
  matchResult?: MatchResult;
  interviewAnswer?: string;
  imageDataUrl?: string;
};

export type ArkResponse = {
  ok: boolean;
  model?: string;
  content?: string;
  error?: string;
};

export async function callArkAgent(payload: ArkRequest): Promise<ArkResponse> {
  const response = await fetch("/api/ark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as ArkResponse;
  if (!response.ok || !data.ok) {
    return {
      ok: false,
      error: data.error || "模型服务暂不可用。",
    };
  }

  return data;
}
