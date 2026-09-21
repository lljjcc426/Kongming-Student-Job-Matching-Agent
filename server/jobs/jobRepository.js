import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sanitizeQuery } from "./utils.js";

const MAX_STORED_JOBS = 5_000;
const records = new Map();
let loaded = false;
let writeQueue = Promise.resolve();

const storePath = () => process.env.JOB_STORE_PATH?.trim() || "";

const isExpired = (job, now = Date.now()) => {
  const validThrough = job.validThrough ? new Date(job.validThrough).getTime() : Number.NaN;
  return job.status === "closed" || (!Number.isNaN(validThrough) && validThrough < now);
};

const load = async () => {
  if (loaded) return;
  loaded = true;
  const path = storePath();
  if (!path) return;
  try {
    const payload = JSON.parse(await readFile(path, "utf8"));
    for (const job of Array.isArray(payload?.jobs) ? payload.jobs : []) {
      if (job?.id) records.set(job.id, job);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("[job-repository] unable to load store", error);
  }
};

const persist = async () => {
  const path = storePath();
  if (!path) return;
  const jobs = [...records.values()]
    .sort((left, right) => String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)))
    .slice(0, MAX_STORED_JOBS);
  const temporaryPath = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), jobs }, null, 2), "utf8");
  await rename(temporaryPath, path);
};

export const upsertJobs = async (jobs) => {
  await load();
  const now = new Date().toISOString();
  for (const job of jobs) {
    if (!job?.id || !job.sourceUrl) continue;
    const previous = records.get(job.id);
    records.set(job.id, {
      ...previous,
      ...job,
      firstSeenAt: previous?.firstSeenAt || job.collectedAt || now,
      lastSeenAt: now,
    });
  }
  if (records.size > MAX_STORED_JOBS) {
    const oldest = [...records.values()]
      .sort((left, right) => String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)))
      .slice(MAX_STORED_JOBS);
    oldest.forEach((job) => records.delete(job.id));
  }
  writeQueue = writeQueue.then(persist).catch((error) => console.warn("[job-repository] unable to persist store", error));
  await writeQueue;
  return jobs;
};

const QUERY_SYNONYMS = new Map([
  ["技术", ["技术", "开发", "工程师", "算法", "software", "engineer", "developer"]],
  ["产品", ["产品", "product", "用户研究", "需求分析"]],
  ["运营", ["运营", "operation", "marketing", "growth", "内容"]],
  ["前端", ["前端", "frontend", "front-end", "react", "vue", "javascript", "typescript"]],
  ["后端", ["后端", "backend", "back-end", "server", "java", "golang", "python"]],
  ["设计", ["设计", "design", "ux", "ui", "视觉", "交互"]],
  ["数据", ["数据", "data", "analytics", "分析"]],
  ["人工智能", ["人工智能", "ai", "machine learning", "算法", "大模型"]],
]);

const queryTerms = (query) => {
  const tokens = sanitizeQuery(query).toLowerCase().split(/\s+/).filter((item) => item.length >= 2);
  const expanded = tokens.flatMap((token) => {
    const synonyms = [...QUERY_SYNONYMS.entries()]
      .filter(([key]) => token.includes(key))
      .flatMap(([, values]) => values);
    return [token, ...synonyms];
  });
  return [...new Set(expanded)];
};

const queryIntentGroups = (query) => {
  const normalized = sanitizeQuery(query).toLowerCase();
  const groups = [];
  if (/前端|front[- ]?end|frontend/.test(normalized)) groups.push(["前端", "frontend", "front-end", "front end"]);
  if (/后端|back[- ]?end|backend/.test(normalized)) groups.push(["后端", "backend", "back-end", "back end", "server"]);
  if (/实习|\bintern(?:ship)?\b/.test(normalized)) groups.push(["实习", "intern", "internship"]);
  if (/校招|校园|应届|new grad|graduate|campus/.test(normalized)) groups.push(["校招", "校园", "应届", "new grad", "graduate", "campus"]);
  return groups;
};

const intentTermMatches = (text, term) => {
  if (!/^[a-z0-9 .-]+$/.test(term)) return text.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
};

const scoreJob = (job, terms, intentGroups, city) => {
  const title = `${job.title} ${job.department || ""} ${job.level || ""} ${job.employmentType || ""}`.toLowerCase();
  const haystack = `${title} ${job.company} ${job.summary} ${(job.keywords || []).join(" ")}`.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  const titleHits = terms.filter((term) => title.includes(term)).length;
  const intentTitleHits = intentGroups.filter((group) => group.some((term) => intentTermMatches(title, term))).length;
  const freshness = new Date(job.updatedAt || job.publishedAt || job.lastSeenAt || 0).getTime();
  const freshDays = Math.max(0, Math.min(14, (Date.now() - freshness) / 86_400_000));
  return intentTitleHits * 80 + titleHits * 40 + hits * 8 + (city && String(job.city).includes(city) ? 10 : 0)
    + Number(job.confidence || 0) * 10 - freshDays;
};

const decodeCursor = (cursor) => {
  try {
    return Math.max(0, Number(Buffer.from(String(cursor), "base64url").toString("utf8")) || 0);
  } catch {
    return 0;
  }
};

export const queryJobs = async (filters = {}) => {
  await load();
  const query = sanitizeQuery(filters.query || "");
  const city = sanitizeQuery(filters.city || "");
  const company = sanitizeQuery(filters.company || "").toLowerCase();
  const employmentType = sanitizeQuery(filters.employmentType || "").toLowerCase();
  const sourceType = sanitizeQuery(filters.sourceType || "").toLowerCase();
  const updatedAfter = filters.updatedAfter ? new Date(filters.updatedAfter).getTime() : Number.NaN;
  const terms = queryTerms(query);
  const intentGroups = queryIntentGroups(query);
  const offset = decodeCursor(filters.cursor);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const deduped = new Map();
  for (const job of records.values()) {
    if (isExpired(job)) continue;
    if (company && !String(job.company).toLowerCase().includes(company)) continue;
    if (city && !String(job.city).includes(city) && !(job.locations || []).some((item) => String(item).includes(city))) continue;
    if (employmentType && String(job.employmentType).toLowerCase() !== employmentType) continue;
    if (sourceType && String(job.sourceType).toLowerCase() !== sourceType) continue;
    const haystack = `${job.title} ${job.company} ${job.summary} ${(job.keywords || []).join(" ")} ${job.level || ""} ${job.employmentType || ""}`.toLowerCase();
    if (terms.length && !terms.some((term) => haystack.includes(term))) continue;
    if (intentGroups.length && !intentGroups.every((group) =>
      group.some((term) => intentTermMatches(haystack, term)))) continue;
    if (!Number.isNaN(updatedAfter)) {
      const updatedAt = new Date(job.updatedAt || job.lastSeenAt || 0).getTime();
      if (updatedAt < updatedAfter) continue;
    }
    const key = `${String(job.company).toLowerCase()}|${String(job.title).toLowerCase()}|${String(job.city).toLowerCase()}`;
    const previous = deduped.get(key);
    if (!previous || Number(job.confidence) > Number(previous.confidence)) deduped.set(key, job);
  }
  const sorted = [...deduped.values()].sort((left, right) =>
    scoreJob(right, terms, intentGroups, city) - scoreJob(left, terms, intentGroups, city));
  const jobs = sorted.slice(offset, offset + limit);
  const nextOffset = offset + jobs.length;
  return {
    jobs,
    total: sorted.length,
    nextCursor: nextOffset < sorted.length ? Buffer.from(String(nextOffset), "utf8").toString("base64url") : null,
  };
};

export const repositoryStats = async () => {
  await load();
  const jobs = [...records.values()];
  return {
    storedJobs: jobs.length,
    activeJobs: jobs.filter((job) => !isExpired(job)).length,
    companies: new Set(jobs.map((job) => job.company)).size,
    persistent: Boolean(storePath()),
  };
};

export const resetJobRepositoryForTests = () => {
  records.clear();
  loaded = true;
};
