import { collectAshbyJobs } from "./jobs/adapters/ashby.js";
import { collectGreenhouseJobs } from "./jobs/adapters/greenhouse.js";
import { collectLeverJobs } from "./jobs/adapters/lever.js";
import { collectMokaJobs } from "./jobs/adapters/moka.js";
import { collectSearchDiscoveryJobs } from "./jobs/adapters/searchDiscovery.js";
import { collectTencentJobs } from "./jobs/adapters/tencent.js";
import { queryJobs, repositoryStats, upsertJobs } from "./jobs/jobRepository.js";
import { getOfficialCareerSources, getStructuredJobSources, listJobSources } from "./jobs/sourceRegistry.js";
import { sanitizeQuery } from "./jobs/utils.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
const SOURCE_CONCURRENCY = 4;
const cache = new Map();
const health = new Map();

const ADAPTERS = {
  ashby: collectAshbyJobs,
  greenhouse: collectGreenhouseJobs,
  lever: collectLeverJobs,
  moka: collectMokaJobs,
  tencent: collectTencentJobs,
};

const errorMessage = (error) => error instanceof Error ? error.message.slice(0, 240) : "未知采集错误";

const runWithConcurrency = async (tasks, concurrency) => {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await tasks[index]() };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
};

const collectOneSource = async (source, context) => {
  const startedAt = Date.now();
  health.set(source.id, {
    ...(health.get(source.id) || {}),
    id: source.id,
    company: source.company,
    adapter: source.adapter,
    sourceType: source.sourceType,
    status: "running",
    lastStartedAt: new Date(startedAt).toISOString(),
  });
  const adapter = ADAPTERS[source.adapter];
  if (!adapter) throw new Error(`Unsupported job adapter: ${source.adapter}`);
  try {
    const jobs = await adapter({ ...context, source });
    health.set(source.id, {
      ...health.get(source.id),
      status: "healthy",
      jobCount: jobs.length,
      durationMs: Date.now() - startedAt,
      lastSuccessAt: new Date().toISOString(),
      error: null,
    });
    return jobs;
  } catch (error) {
    health.set(source.id, {
      ...health.get(source.id),
      status: "failed",
      jobCount: 0,
      durationMs: Date.now() - startedAt,
      lastFailureAt: new Date().toISOString(),
      error: errorMessage(error),
    });
    throw error;
  }
};

const sourceMatches = (source, query, company) => {
  const companyNeedle = sanitizeQuery(company).toLowerCase();
  if (companyNeedle) return source.company.toLowerCase().includes(companyNeedle);
  const queryText = sanitizeQuery(query).toLowerCase();
  const mentioned = getStructuredJobSources().filter((candidate) => queryText.includes(candidate.company.toLowerCase()));
  return !mentioned.length || mentioned.some((candidate) => candidate.id === source.id);
};

const discoveryTargetsFor = (query, company) => {
  const targets = getOfficialCareerSources();
  const needle = sanitizeQuery(company).toLowerCase();
  if (needle) return targets.filter((target) => target.company.toLowerCase().includes(needle));
  const queryText = sanitizeQuery(query).toLowerCase();
  const mentioned = targets.filter((target) => queryText.includes(target.company.toLowerCase()));
  return mentioned.length ? mentioned : targets;
};

export async function collectPublicJobs(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const query = sanitizeQuery(options.query || "产品 技术 运营");
  const city = sanitizeQuery(options.city || "").slice(0, 24);
  const company = sanitizeQuery(options.company || "").slice(0, 80);
  const employmentType = sanitizeQuery(options.employmentType || "").slice(0, 32);
  const sourceType = sanitizeQuery(options.sourceType || "").slice(0, 40);
  const updatedAfter = sanitizeQuery(options.updatedAfter || "").slice(0, 40);
  const cursor = sanitizeQuery(options.cursor || "").slice(0, 120);
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
  const refresh = options.refresh !== false;
  const cacheKey = JSON.stringify({ query, city, company, employmentType, sourceType, updatedAfter, cursor, limit });
  const cached = cache.get(cacheKey);
  if (refresh && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.value;

  let collectedJobs = [];
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  if (refresh) {
    const structuredSources = getStructuredJobSources().filter((source) => sourceMatches(source, query, company));
    const targets = discoveryTargetsFor(query, company);
    const structuredTasks = structuredSources.map((source) => async () => collectOneSource(source, {
      fetchImpl,
      query,
      city,
      limit,
    }));
    const discoverySource = listJobSources().find((source) => source.adapter === "search-discovery");
    const tasks = [...structuredTasks];
    if (targets.length && discoverySource) {
      tasks.push(async () => {
        const startedAt = Date.now();
        health.set(discoverySource.id, {
          id: discoverySource.id,
          company: discoverySource.company,
          adapter: discoverySource.adapter,
          sourceType: discoverySource.sourceType,
          status: "running",
          lastStartedAt: new Date(startedAt).toISOString(),
        });
        try {
          const jobs = await collectSearchDiscoveryJobs({ fetchImpl, source: discoverySource, targets, query, city, limit });
          health.set(discoverySource.id, {
            ...health.get(discoverySource.id),
            status: "healthy",
            jobCount: jobs.length,
            durationMs: Date.now() - startedAt,
            lastSuccessAt: new Date().toISOString(),
            error: null,
          });
          return jobs;
        } catch (error) {
          health.set(discoverySource.id, {
            ...health.get(discoverySource.id),
            status: "failed",
            jobCount: 0,
            durationMs: Date.now() - startedAt,
            lastFailureAt: new Date().toISOString(),
            error: errorMessage(error),
          });
          throw error;
        }
      });
    }

    attempted = tasks.length;
    const settled = await runWithConcurrency(tasks, SOURCE_CONCURRENCY);
    collectedJobs = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    succeeded = settled.filter((result) => result.status === "fulfilled").length;
    failed = settled.length - succeeded;
    await upsertJobs(collectedJobs);
  }

  const result = await queryJobs({
    query,
    city,
    company,
    employmentType,
    sourceType,
    updatedAfter,
    cursor,
    limit,
  });
  const stats = await repositoryStats();
  const value = {
    ok: true,
    live: result.jobs.length > 0,
    stale: refresh && collectedJobs.length === 0 && result.jobs.length > 0,
    query,
    city,
    company,
    collectedAt: new Date().toISOString(),
    sourcePolicy: "仅收集企业官方招聘接口、公开 ATS 与公开招聘页面中的岗位信息；不使用登录 Cookie，不绕过验证码，不采集求职者或招聘人员个人信息。",
    collection: { attempted, succeeded, failed, collected: collectedJobs.length },
    pagination: { total: result.total, nextCursor: result.nextCursor },
    repository: stats,
    jobs: result.jobs,
  };
  if (refresh) cache.set(cacheKey, { createdAt: Date.now(), value });
  return value;
}

export async function getJobSourceStatus() {
  const sources = listJobSources().map((source) => ({
    id: source.id,
    company: source.company,
    adapter: source.adapter,
    sourceType: source.sourceType,
    domains: source.domains,
    ...(health.get(source.id) || { status: "idle", jobCount: 0 }),
  }));
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    sourceCount: sources.length,
    companyCoverage: new Set([
      ...getStructuredJobSources().map((source) => source.company),
      ...getOfficialCareerSources().map((source) => source.company),
    ]).size,
    repository: await repositoryStats(),
    sources,
  };
}

export const resetJobCollectorCacheForTests = () => {
  cache.clear();
  health.clear();
};

export const INTERNET_CAREER_SOURCES = getOfficialCareerSources();
