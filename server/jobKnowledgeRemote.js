import { randomUUID } from "node:crypto";
import { readBoundedIntegerEnv } from "./runtimeConfig.js";

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RESPONSE_BYTES = 4_000_000;

const isLoopbackHost = (hostname) => [
  "127.0.0.1",
  "::1",
  "localhost",
].includes(hostname.toLowerCase());

const endpointFromEnvironment = (kind) => {
  const exactName = kind === "search"
    ? "JOB_RAG_REMOTE_SEARCH_URL"
    : "JOB_RAG_REMOTE_STATUS_URL";
  const exactUrl = process.env[exactName]?.trim();
  const baseUrl = process.env.JOB_RAG_REMOTE_BASE_URL?.trim();
  const rawUrl = exactUrl || (
    baseUrl
      ? `${baseUrl.replace(/\/+$/, "")}/api/jobs/${kind}`
      : ""
  );
  if (!rawUrl) return null;

  let endpoint;
  try {
    endpoint = new URL(rawUrl);
  } catch {
    throw new Error(`${exactName} 配置不是有效 URL`);
  }
  if (endpoint.protocol !== "https:" && !isLoopbackHost(endpoint.hostname)) {
    throw new Error("远程岗位知识库必须使用 HTTPS");
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("远程岗位知识库 URL 不能包含认证信息");
  }
  return endpoint;
};

const remoteToken = () => process.env.JOB_RAG_REMOTE_TOKEN?.trim() || "";

const allowUnauthenticatedRemote = () =>
  process.env.JOB_RAG_REMOTE_ALLOW_UNAUTHENTICATED === "true";

const remoteTimeoutMs = () => readBoundedIntegerEnv(
  "JOB_RAG_REMOTE_TIMEOUT_MS",
  DEFAULT_TIMEOUT_MS,
  { minimum: 1_000, maximum: 120_000 },
);

const parseJsonResponse = async (response) => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("REMOTE_RESPONSE_TOO_LARGE");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("REMOTE_RESPONSE_TOO_LARGE");
  }
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("REMOTE_RESPONSE_INVALID_JSON");
  }
};

const safeRemoteError = (status) => {
  if (status === 401 || status === 403) {
    return "远程岗位知识库认证失败，请检查服务端配置。";
  }
  if (status === 429) return "岗位知识库请求过于频繁，请稍后重试。";
  if (status === 504) return "远程岗位知识库响应超时，请稍后重试。";
  return "远程岗位知识库暂时不可用，请稍后重试。";
};

const sanitizeSearchPayload = (payload) => ({
  ...payload,
  retrievalDiagnostics: {
    ...(payload.retrievalDiagnostics || {}),
    rerankerSource: null,
    rerankerError: payload.retrievalDiagnostics?.rerankerError
      ? "RERANKER_UNAVAILABLE"
      : null,
  },
});

const sanitizeStatusPayload = (payload) => ({
  ok: payload.ready === true,
  ready: payload.ready === true,
  loaded: payload.loaded === true,
  stale: payload.stale === true,
  indexVersion: payload.manifest?.version_id || null,
  index: {
    schemaVersion: payload.manifest?.schema_version || null,
    recordCount: Number(payload.manifest?.record_count || 0),
    nodeCount: Number(payload.manifest?.node_count || 0),
    nodesPerRecord: Number(payload.manifest?.nodes_per_record || 0),
    embeddingModel: payload.manifest?.embedding_model || null,
  },
  database: {
    type: payload.database?.type || null,
    backend: payload.database?.backend || null,
    collection: payload.database?.collection || null,
    ready: payload.database?.ready === true,
    pointsCount: Number(payload.database?.pointsCount || 0),
  },
  cache: payload.cache || null,
  reranker: payload.reranker
    ? {
        configured: payload.reranker.configured === true,
        loaded: payload.reranker.loaded === true,
        model: payload.reranker.model || null,
        device: payload.reranker.device || null,
        topN: Number(payload.reranker.topN || 0),
        maxLength: Number(payload.reranker.maxLength || 0),
        error: payload.reranker.error ? "RERANKER_UNAVAILABLE" : null,
      }
    : null,
  loadedAt: payload.loaded_at || null,
});

const requestRemote = async (kind, body) => {
  let endpoint;
  try {
    endpoint = endpointFromEnvironment(kind);
  } catch (error) {
    console.warn("[job-rag-remote] invalid endpoint configuration", error.message);
    return {
      status: 503,
      payload: { ok: false, error: "生产岗位知识库配置无效。" },
    };
  }
  if (!endpoint) {
    return {
      status: 503,
      payload: { ok: false, error: "生产岗位知识库尚未配置。" },
    };
  }

  const token = remoteToken();
  if (!token && !allowUnauthenticatedRemote()) {
    return {
      status: 503,
      payload: { ok: false, error: "生产岗位知识库认证尚未配置。" },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remoteTimeoutMs());
  const requestId = randomUUID();
  try {
    const response = await fetch(endpoint, {
      method: kind === "search" ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        ...(kind === "search"
          ? { "Content-Type": "application/json; charset=utf-8" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Kongming-Request-Id": requestId,
      },
      body: kind === "search" ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: controller.signal,
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      console.warn("[job-rag-remote] upstream request failed", {
        requestId,
        status: response.status,
        code: typeof payload?.code === "string" ? payload.code.slice(0, 80) : "",
      });
      return {
        status: [401, 403, 429, 504].includes(response.status)
          ? response.status
          : 503,
        payload: { ok: false, error: safeRemoteError(response.status) },
      };
    }

    const validPayload = kind === "search"
      ? payload?.ok === true && Array.isArray(payload.results)
      : typeof payload?.ready === "boolean";
    if (!validPayload) throw new Error("REMOTE_RESPONSE_INVALID_SCHEMA");
    return {
      status: 200,
      payload: kind === "search"
        ? sanitizeSearchPayload(payload)
        : sanitizeStatusPayload(payload),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    console.warn("[job-rag-remote] request unavailable", {
      requestId,
      reason: timedOut ? "timeout" : error instanceof Error ? error.message : "unknown",
    });
    return {
      status: timedOut ? 504 : 503,
      payload: {
        ok: false,
        error: timedOut
          ? "远程岗位知识库响应超时，请稍后重试。"
          : "远程岗位知识库暂时不可用，请稍后重试。",
      },
    };
  } finally {
    clearTimeout(timer);
  }
};

export const hasRemoteJobKnowledge = () => Boolean(
  process.env.JOB_RAG_REMOTE_SEARCH_URL?.trim()
  || process.env.JOB_RAG_REMOTE_BASE_URL?.trim(),
);

export const searchRemoteJobKnowledge = (body) =>
  requestRemote("search", body);

export const getRemoteJobKnowledgeStatus = () =>
  requestRemote("status");
