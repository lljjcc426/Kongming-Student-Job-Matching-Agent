import { createHash } from "node:crypto";

export const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KongmingJobRadar/2.0";
export const SEARCH_TIMEOUT_MS = 8_000;
export const VERIFY_TIMEOUT_MS = 4_000;

export const decodeEntities = (value) => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

export const stripHtml = (value) => decodeEntities(value)
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/p>|<\/li>|<\/div>/gi, "\n")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/[ \t]+/g, " ")
  .replace(/\n\s*\n+/g, "\n")
  .trim();

export const sanitizeText = (value, maxLength = 240) => stripHtml(value)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
  .slice(0, maxLength)
  .trim();

export const sanitizeQuery = (value) => sanitizeText(value, 80)
  .replace(/["'<>]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    if (!/^https?:$/.test(url.protocol)) return "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm", "from"]
      .forEach((key) => url.searchParams.delete(key));
    if (!url.hash.startsWith("#/job/")) url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
};

export const normalizeDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const chinese = String(value).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const candidate = chinese
    ? `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}T00:00:00+08:00`
    : typeof value === "number" && value < 10_000_000_000 ? value * 1000 : value;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const CITY_NAMES = [
  "北京", "上海", "深圳", "广州", "杭州", "成都", "武汉", "南京", "西安", "苏州", "长沙", "重庆",
  "天津", "厦门", "珠海", "合肥", "青岛", "济南", "郑州", "东莞", "佛山", "无锡", "宁波", "香港",
];

const KEYWORD_DICTIONARY = [
  "JavaScript", "TypeScript", "Java", "Python", "Go", "C++", "SQL", "React", "Vue", "Node.js", "Rust",
  "产品设计", "产品经理", "需求分析", "用户研究", "数据分析", "内容运营", "用户运营", "商业分析", "机器学习",
  "大模型", "人工智能", "算法", "测试", "交互设计", "视觉设计", "项目管理", "市场营销", "供应链", "财务", "游戏策划",
];

export const inferCity = (text, requestedCity = "") => CITY_NAMES.find((city) => String(text).includes(city))
  || sanitizeText(requestedCity, 24)
  || "地点见原岗位页";

export const inferLevel = (text) => {
  if (/实习|\bintern(?:ship)?\b/i.test(String(text))) return "实习";
  if (/校招|校园|应届|graduate|campus|new grad/i.test(String(text))) return "校招";
  return "社招";
};

export const inferEmploymentType = (text) => {
  if (/实习|\bintern(?:ship)?\b/i.test(String(text))) return "intern";
  if (/兼职|part[- ]?time/i.test(String(text))) return "part-time";
  if (/合同|contract/i.test(String(text))) return "contract";
  return "full-time";
};

export const inferKeywords = (text, query = "") => {
  const haystack = String(text).toLowerCase();
  const detected = KEYWORD_DICTIONARY.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  const queryTokens = sanitizeQuery(query)
    .split(/\s+/)
    .filter((item) => item.length >= 2 && haystack.includes(item.toLowerCase()));
  return [...new Set([...detected, ...queryTokens])].slice(0, 12);
};

export const stableId = (...parts) => createHash("sha256")
  .update(parts.filter(Boolean).join("|"))
  .digest("base64url")
  .slice(0, 24);

export const contentHash = (job) => createHash("sha256")
  .update([job.company, job.title, job.city, job.description || job.summary].join("|"))
  .digest("hex")
  .slice(0, 24);

export const fetchWithTimeout = async (fetchImpl, url, options = {}, timeoutMs = SEARCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const hostMatches = (url, domains) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

export const buildNormalizedJob = (source, raw, query = "", requestedCity = "") => {
  const now = new Date().toISOString();
  const description = sanitizeText(raw.description || raw.summary, 5_000);
  const summary = sanitizeText(raw.summary || description, 420) || "请进入企业官方招聘页面查看完整岗位职责与任职要求。";
  const title = sanitizeText(raw.title, 120) || `${source.company}公开招聘岗位`;
  const company = sanitizeText(raw.company || source.company, 80);
  const combined = `${title} ${description} ${raw.department || ""} ${raw.employmentType || ""}`;
  const sourceUrl = normalizeUrl(raw.sourceUrl || raw.applyUrl || source.careersUrl);
  const applyUrl = normalizeUrl(raw.applyUrl || raw.sourceUrl || source.careersUrl);
  const locations = Array.isArray(raw.locations)
    ? raw.locations.map((item) => sanitizeText(item, 80)).filter(Boolean).slice(0, 8)
    : [];
  const city = sanitizeText(raw.city, 80) || inferCity(`${locations.join(" ")} ${combined}`, requestedCity);
  const externalId = sanitizeText(raw.externalId || raw.id, 160);
  const job = {
    id: `${source.id}-${stableId(externalId, sourceUrl, title, city)}`,
    externalId: externalId || null,
    title,
    company,
    city,
    locations: locations.length ? locations : [city],
    level: sanitizeText(raw.level, 32) || inferLevel(combined),
    employmentType: inferEmploymentType(`${raw.employmentType || ""} ${combined}`),
    department: sanitizeText(raw.department, 100) || null,
    education: sanitizeText(raw.education, 60) || null,
    salary: sanitizeText(raw.salary, 80) || null,
    summary,
    description,
    keywords: Array.isArray(raw.keywords) && raw.keywords.length
      ? raw.keywords.map((item) => sanitizeText(item, 40)).filter(Boolean).slice(0, 12)
      : inferKeywords(combined, query),
    sourceId: source.id,
    sourceName: source.company,
    sourceType: source.sourceType,
    sourceUrl,
    applyUrl,
    sourceDomain: sourceUrl ? new URL(sourceUrl).hostname : source.domains?.[0] || "",
    publishedAt: normalizeDate(raw.publishedAt),
    updatedAt: normalizeDate(raw.updatedAt),
    validThrough: normalizeDate(raw.validThrough),
    status: raw.status === "closed" ? "closed" : "open",
    verification: raw.verification || (source.sourceType === "official-api" ? "official-live-api" : "official-ats"),
    confidence: Number(raw.confidence) || (source.sourceType === "search-index" ? 0.65 : 0.95),
    collectedAt: now,
  };
  return { ...job, contentHash: contentHash(job) };
};
