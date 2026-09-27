import type { Job } from "./data";
import type { MatchResult } from "./matchEngine";
import { defaultPrivacyPreferences, redactUnknownPayload, type PrivacyPreferences } from "./core/privacy/redaction";
import { publicGatewayUrl } from "./gatewayClient";

export type ArkTask = "match-analysis" | "resume-vision" | "resume-structure" | "resume-rewrite" | "job-recommendations" | "jd-analysis" | "interview-feedback" | "career-chat";

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
};

export type ArkResponse = {
  ok: boolean;
  content?: string;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 75_000;

type ArkPrivacyPolicy = {
  externalModelConsent: boolean;
  preferences: PrivacyPreferences;
};

let privacyPolicy: ArkPrivacyPolicy = {
  externalModelConsent: false,
  preferences: defaultPrivacyPreferences,
};

export const configureArkPrivacy = (policy: ArkPrivacyPolicy) => {
  privacyPolicy = {
    externalModelConsent: policy.externalModelConsent,
    preferences: { ...policy.preferences },
  };
};

const includesSensitiveInput = (payload: ArkRequest) => Boolean(
  payload.resumeText
  || payload.resumeProfile
  || payload.imageDataUrl
  || payload.imageDataUrls?.length
  || payload.interviewAnswer
  || payload.userMessage
  || payload.chatMessages?.length,
);

export async function callArkAgent(payload: ArkRequest, options: { timeoutMs?: number } = {}): Promise<ArkResponse> {
  if (includesSensitiveInput(payload) && !privacyPolicy.externalModelConsent) {
    return {
      ok: false,
      error: "请先确认本次处理授权，再继续分析。",
    };
  }
  const securedPayload = redactUnknownPayload(payload, privacyPolicy.preferences) as ArkRequest;
  const endpoint = publicGatewayUrl("model");
  if (!endpoint) {
    return {
      ok: false,
      error: "个性化分析暂时不可用，你仍可继续编辑本地内容。",
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(endpoint.toString(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(securedPayload),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.name === "AbortError" ? "处理时间较长，本次未完成，请稍后重试。" : "个性化分析暂时不可用，请稍后重试。",
    };
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as ArkResponse;
  if (!response.ok || !data.ok) {
    return {
      ok: false,
      error: "个性化分析暂时不可用，请稍后重试。",
    };
  }

  return data;
}
