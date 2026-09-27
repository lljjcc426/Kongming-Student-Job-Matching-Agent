import { runArkCompletion } from "./arkCore.js";
import { collectPublicJobs } from "./jobCollector.js";
import { getModelServiceStatus } from "./modelProvider.js";

const RATE_LIMITS = {
  jobs: { limit: 30, windowMs: 60_000 },
  status: { limit: 60, windowMs: 60_000 },
  model: { limit: 12, windowMs: 60_000 },
};

const rateBuckets = new Map();

const firstHeaderValue = (value) => String(Array.isArray(value) ? value[0] || "" : value || "")
  .split(",")[0]
  .trim();

const headerValue = (headers, name) => {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return firstHeaderValue(entry?.[1]);
};

const queryValue = (query, name) => {
  const value = query?.[name];
  return Array.isArray(value) ? value[0] : value;
};

const configuredOrigins = (env) => String(env.PUBLIC_APP_ORIGINS || "")
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter((value) => value && value !== "*");

const sameOriginRequest = (origin, headers) => {
  try {
    const parsed = new URL(origin);
    const requestHost = headerValue(headers, "host") || headerValue(headers, "x-forwarded-host");
    if (!requestHost || parsed.host.toLowerCase() !== requestHost.toLowerCase()) return false;
    const forwardedProtocol = headerValue(headers, "x-forwarded-proto").toLowerCase();
    return !forwardedProtocol || parsed.protocol === `${forwardedProtocol}:`;
  } catch {
    return false;
  }
};

const corsDecision = (headers, env) => {
  const origin = headerValue(headers, "origin").replace(/\/$/, "");
  if (!origin) return { allowed: true, origin: "" };
  const allowed = sameOriginRequest(origin, headers) || configuredOrigins(env).includes(origin);
  return { allowed, origin: allowed ? origin : "" };
};

const baseHeaders = (cors) => {
  const headers = {
    "Cache-Control": "no-store, private",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (cors.origin) {
    headers["Access-Control-Allow-Origin"] = cors.origin;
    headers.Vary = "Origin";
  }
  return headers;
};

const clientKey = ({ headers, remoteAddress }) => (
  headerValue(headers, "x-forwarded-for")
  || headerValue(headers, "x-real-ip")
  || String(remoteAddress || "anonymous")
);

const takeRateLimit = (operation, identity, now = Date.now()) => {
  const policy = RATE_LIMITS[operation];
  if (!policy) return { allowed: false, retryAfterSeconds: 60 };
  const key = `${operation}:${identity}`;
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= policy.windowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  current.count += 1;
  if (rateBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= 60_000) rateBuckets.delete(bucketKey);
    }
  }
  return {
    allowed: current.count <= policy.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((policy.windowMs - (now - current.startedAt)) / 1000)),
  };
};

const modelError = (status) => {
  if (status === 400) return "请求内容不符合要求。";
  if (status === 413) return "请求内容过大，请压缩后重试。";
  if (status === 429) return "智能服务请求过于频繁，请稍后重试。";
  if (status === 503) return "智能服务暂未就绪，请稍后重试。";
  if (status === 504) return "智能服务响应超时，请稍后重试。";
  return "智能服务暂不可用，请稍后重试。";
};

export const resetPublicGatewayRateLimitsForTests = () => rateBuckets.clear();

export async function handlePublicGatewayRequest(input, dependencies = {}) {
  const env = dependencies.env || process.env;
  const cors = corsDecision(input.headers, env);
  const headers = baseHeaders(cors);
  if (!cors.allowed) {
    return { status: 403, headers, payload: { ok: false, error: "请求来源未获授权。" } };
  }

  const method = String(input.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Headers": "Accept, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "600",
      },
    };
  }

  const operation = String(queryValue(input.query, "operation") || "").trim().toLowerCase();
  if (!Object.hasOwn(RATE_LIMITS, operation)) {
    return { status: 404, headers, payload: { ok: false, error: "请求的服务不存在。" } };
  }
  const expectedMethod = operation === "model" ? "POST" : "GET";
  if (method !== expectedMethod) {
    headers.Allow = expectedMethod;
    return { status: 405, headers, payload: { ok: false, error: `只支持 ${expectedMethod} 请求。` } };
  }
  if (operation === "model" && !/^application\/json(?:\s*;|$)/i.test(headerValue(input.headers, "content-type"))) {
    return { status: 415, headers, payload: { ok: false, error: "请求内容类型必须为 JSON。" } };
  }

  const rate = takeRateLimit(operation, clientKey(input), dependencies.now?.() ?? Date.now());
  if (!rate.allowed) {
    headers["Retry-After"] = String(rate.retryAfterSeconds);
    return { status: 429, headers, payload: { ok: false, error: "请求过于频繁，请稍后再试。" } };
  }

  if (operation === "status") {
    const status = (dependencies.getModelServiceStatus || getModelServiceStatus)(env);
    return {
      status: 200,
      headers,
      payload: {
        ok: true,
        checkedAt: new Date().toISOString(),
        services: {
          jobs: { configured: true },
          model: {
            configured: status.configured === true,
            visionConfigured: status.visionConfigured === true,
          },
        },
      },
    };
  }

  if (operation === "jobs") {
    try {
      const collect = dependencies.collectPublicJobs || collectPublicJobs;
      const payload = await collect({
        query: queryValue(input.query, "q"),
        city: queryValue(input.query, "city"),
        market: queryValue(input.query, "market"),
        company: queryValue(input.query, "company"),
        employmentType: queryValue(input.query, "employmentType"),
        sourceType: queryValue(input.query, "sourceType"),
        updatedAfter: queryValue(input.query, "updatedAfter"),
        cursor: queryValue(input.query, "cursor"),
        limit: queryValue(input.query, "limit"),
        refresh: queryValue(input.query, "refresh") !== "false",
      });
      headers["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=1200";
      return { status: 200, headers, payload };
    } catch {
      return { status: 502, headers, payload: { ok: false, error: "公开岗位服务暂时不可用。" } };
    }
  }

  try {
    const complete = dependencies.runArkCompletion || runArkCompletion;
    const result = await complete(input.body || {});
    if (result.status < 200 || result.status >= 300 || result.payload?.ok !== true) {
      return {
        status: result.status,
        headers,
        payload: { ok: false, error: modelError(result.status) },
      };
    }
    return {
      status: 200,
      headers,
      payload: {
        ok: true,
        content: result.payload.content,
      },
    };
  } catch {
    return { status: 500, headers, payload: { ok: false, error: "智能服务暂不可用，请稍后重试。" } };
  }
}
