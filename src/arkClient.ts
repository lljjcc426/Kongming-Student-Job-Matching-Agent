import type { Job } from "./data";
import type { MatchResult } from "./matchEngine";
import { defaultPrivacyPreferences, redactUnknownPayload, type PrivacyPreferences } from "./core/privacy/redaction";

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
  model?: string;
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
      error: "请先阅读隐私说明并同意将本次内容发送到外部模型服务。",
    };
  }
  const securedPayload = redactUnknownPayload(payload, privacyPolicy.preferences) as ArkRequest;
  const configuredEndpoint = import.meta.env.VITE_ARK_API_URL?.trim();
  const endpoint = configuredEndpoint || (window.location.protocol === "file:" ? "" : "/api/ark");
  if (!endpoint) {
    return {
      ok: false,
      error: "当前安装包尚未配置模型服务地址。请在构建 HAP 时设置 VITE_ARK_API_URL，模型密钥只保存在服务端。",
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(endpoint, {
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
