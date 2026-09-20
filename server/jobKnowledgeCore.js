import {
  getRemoteJobKnowledgeStatus,
  hasRemoteJobKnowledge,
  searchRemoteJobKnowledge,
} from "./jobKnowledgeRemote.js";

const MAX_QUERY_CHARS = 2000;
const MAX_QUERY_VARIANTS = 3;
const MAX_FILTER_ITEMS = 20;

const asStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_FILTER_ITEMS)
    .map((item) => String(item || "").trim().slice(0, 80))
    .filter(Boolean);
};

const normalizeFilters = (value) => {
  const filters = value && typeof value === "object" ? value : {};
  return {
    sources: asStringArray(filters.sources),
    cities: asStringArray(filters.cities),
    recruitmentTypes: asStringArray(filters.recruitmentTypes),
    jobFamilies: asStringArray(filters.jobFamilies),
    skills: asStringArray(filters.skills),
    studentOnly: filters.studentOnly === true,
  };
};

export const normalizeSearchBody = (body) => {
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const queries = Array.isArray(body?.queries)
    ? [...new Set(
        body.queries
          .map((item) => String(item || "").trim())
          .filter((item) => item.length >= 2 && item !== query),
      )].slice(0, MAX_QUERY_VARIANTS - 1)
    : [];
  const rawTopK = Number(body?.topK);
  return {
    query,
    queries,
    topK: Number.isFinite(rawTopK)
      ? Math.max(1, Math.min(30, Math.round(rawTopK)))
      : 10,
    filters: normalizeFilters(body?.filters),
    ...(typeof body?.rerank === "boolean" ? { rerank: body.rerank } : {}),
    bypassCache: body?.bypassCache === true,
  };
};

const validateSearchBody = (body) => {
  if (!body || typeof body !== "object") return "岗位检索请求格式不正确。";
  if (typeof body.query !== "string" || body.query.trim().length < 2) {
    return "请输入至少 2 个字符的岗位检索条件。";
  }
  if (body.query.length > MAX_QUERY_CHARS) {
    return `岗位检索条件不能超过 ${MAX_QUERY_CHARS} 个字符。`;
  }
  if (
    Array.isArray(body.queries)
    && body.queries.some(
      (item) => typeof item === "string" && item.length > MAX_QUERY_CHARS,
    )
  ) {
    return `单条岗位检索条件不能超过 ${MAX_QUERY_CHARS} 个字符。`;
  }
  return "";
};

const backendMode = () => {
  const mode = process.env.JOB_RAG_BACKEND?.trim().toLowerCase();
  return ["auto", "local", "remote"].includes(mode) ? mode : "auto";
};

const localSearch = async (body) => {
  const { searchLocalJobKnowledge } = await import("./localJobKnowledgeWorker.js");
  const result = await searchLocalJobKnowledge(body);
  return { status: 200, payload: { ok: true, ...result } };
};

const localStatus = async () => {
  const { getLocalJobKnowledgeStatus } = await import("./localJobKnowledgeWorker.js");
  const result = await getLocalJobKnowledgeStatus();
  return {
    status: result.ready ? 200 : 503,
    payload: { ok: result.ready, ...result },
  };
};

export async function runJobKnowledgeSearch(
  body,
  { allowLocal = true, allowRemote = true } = {},
) {
  const validationError = validateSearchBody(body);
  if (validationError) {
    return { status: 400, payload: { ok: false, error: validationError } };
  }

  const normalizedBody = normalizeSearchBody(body);
  const mode = backendMode();
  if (mode === "remote" || (!allowLocal && mode !== "local")) {
    return allowRemote
      ? searchRemoteJobKnowledge(normalizedBody)
      : { status: 503, payload: { ok: false, error: "远程岗位知识库未启用。" } };
  }
  if (mode === "local" && !allowLocal) {
    return {
      status: 503,
      payload: { ok: false, error: "当前部署环境不能使用本地岗位知识库。" },
    };
  }

  if (allowLocal) {
    try {
      return await localSearch(normalizedBody);
    } catch (error) {
      if (mode === "auto" && allowRemote && hasRemoteJobKnowledge()) {
        console.warn("[job-rag] local search unavailable; using remote backend");
        return searchRemoteJobKnowledge(normalizedBody);
      }
      return {
        status: 503,
        payload: {
          ok: false,
          error: error instanceof Error ? error.message : "岗位知识库暂时不可用。",
        },
      };
    }
  }

  return {
    status: 503,
    payload: { ok: false, error: "岗位知识库后端尚未配置。" },
  };
}

export async function runJobKnowledgeStatus(
  { allowLocal = true, allowRemote = true } = {},
) {
  const mode = backendMode();
  if (mode === "remote" || (!allowLocal && mode !== "local")) {
    return allowRemote
      ? getRemoteJobKnowledgeStatus()
      : {
          status: 503,
          payload: { ok: false, ready: false, error: "远程岗位知识库未启用。" },
        };
  }
  if (mode === "local" && !allowLocal) {
    return {
      status: 503,
      payload: { ok: false, ready: false, error: "当前部署环境不能使用本地岗位知识库。" },
    };
  }

  if (allowLocal) {
    try {
      return await localStatus();
    } catch (error) {
      if (mode === "auto" && allowRemote && hasRemoteJobKnowledge()) {
        console.warn("[job-rag] local status unavailable; using remote backend");
        return getRemoteJobKnowledgeStatus();
      }
      return {
        status: 503,
        payload: {
          ok: false,
          ready: false,
          error: error instanceof Error ? error.message : "岗位知识库状态检查失败。",
        },
      };
    }
  }

  return {
    status: 503,
    payload: { ok: false, ready: false, error: "岗位知识库后端尚未配置。" },
  };
}
