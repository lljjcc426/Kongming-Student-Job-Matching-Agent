import {
  getLocalJobKnowledgeStatus,
  searchLocalJobKnowledge,
} from "./localJobKnowledgeWorker.js";

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

const normalizeSearchBody = (body) => {
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

export async function runJobKnowledgeSearch(body, { allowLocal = true } = {}) {
  const validationError = validateSearchBody(body);
  if (validationError) {
    return {
      status: 400,
      payload: { ok: false, error: validationError },
    };
  }
  if (!allowLocal) {
    return {
      status: 503,
      payload: {
        ok: false,
        error: "当前部署环境未连接岗位向量数据库，请使用本地服务或配置生产向量库。",
      },
    };
  }

  try {
    const result = await searchLocalJobKnowledge(normalizeSearchBody(body));
    return {
      status: 200,
      payload: { ok: true, ...result },
    };
  } catch (error) {
    return {
      status: 503,
      payload: {
        ok: false,
        error: error instanceof Error ? error.message : "岗位知识库暂不可用。",
      },
    };
  }
}

export async function runJobKnowledgeStatus({ allowLocal = true } = {}) {
  if (!allowLocal) {
    return {
      status: 503,
      payload: {
        ok: false,
        ready: false,
        error: "当前部署环境未连接岗位向量数据库。",
      },
    };
  }
  try {
    const result = await getLocalJobKnowledgeStatus();
    return {
      status: result.ready ? 200 : 503,
      payload: { ok: result.ready, ...result },
    };
  } catch (error) {
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
