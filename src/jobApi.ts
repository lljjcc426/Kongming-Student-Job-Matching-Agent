import type { Job } from "./data";

type PublicJobRecord = {
  id: string;
  title: string;
  company: string;
  city: string;
  locations?: string[];
  level: string;
  employmentType: string;
  department?: string | null;
  summary: string;
  description?: string;
  keywords?: string[];
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  applyUrl?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  lastSeenAt?: string;
  verification: string;
  confidence: number;
};

type PublicJobsResponse = {
  ok: boolean;
  stale?: boolean;
  jobs?: PublicJobRecord[];
  pagination?: { total: number; nextCursor: string | null };
  collection?: { attempted: number; succeeded: number; failed: number; collected: number };
  error?: string;
};

export type PublicJobFeed = {
  jobs: Job[];
  total: number;
  stale: boolean;
  message: string;
};

const cleanLines = (value: string | undefined) => String(value || "")
  .split(/\n+/)
  .map((line) => line.replace(/^[-•*\d.、()（）\s]+/, "").trim())
  .filter((line) => line.length >= 8 && line.length <= 220);

const sectionLines = (description: string | undefined, kind: "responsibility" | "requirement") => {
  const lines = cleanLines(description);
  const marker = kind === "responsibility" ? /职责|工作内容|你将|what you.?ll do|role/i : /要求|任职|资格|what we.?re looking|require/i;
  const alternate = kind === "responsibility" ? /要求|任职|资格|require/i : /职责|工作内容|你将|what you.?ll do|role/i;
  const start = lines.findIndex((line) => marker.test(line));
  if (start >= 0) {
    const selected: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (alternate.test(line) && selected.length) break;
      selected.push(line);
      if (selected.length >= 5) break;
    }
    if (selected.length) return selected;
  }
  return kind === "responsibility" ? lines.slice(0, 4) : lines.slice(4, 8);
};

const trackOf = (job: PublicJobRecord) => {
  const text = `${job.title} ${job.department || ""} ${(job.keywords || []).join(" ")}`;
  if (/产品|product/i.test(text)) return "产品";
  if (/运营|市场|销售|operation|marketing|sales/i.test(text)) return "运营与商业";
  if (/设计|交互|视觉|design/i.test(text)) return "设计";
  if (/算法|数据|人工智能|机器学习|AI|data/i.test(text)) return "数据与 AI";
  if (/游戏|策划|game/i.test(text)) return "游戏";
  return "技术与互联网";
};

const mapPublicJob = (job: PublicJobRecord): Job => {
  const responsibilities = sectionLines(job.description, "responsibility");
  const requirements = sectionLines(job.description, "requirement");
  return {
    id: `public-${job.id}`,
    jobKind: "verified-job",
    title: job.title,
    track: trackOf(job),
    city: job.city,
    level: job.level,
    companyScenario: job.company,
    summary: job.summary,
    responsibilities: responsibilities.length ? responsibilities : ["进入企业官方岗位页查看完整岗位职责。"],
    requirements: requirements.length ? requirements : ["进入企业官方岗位页查看完整任职要求。"],
    bonus: job.keywords?.slice(0, 5) || [],
    keywords: job.keywords?.length ? job.keywords : [job.title, job.department || "互联网"].filter(Boolean),
    priority: job.confidence >= 0.9 ? "高" : job.confidence >= 0.75 ? "中" : "低",
    applicationLinks: [{
      company: `${job.company}官方投递`,
      url: job.applyUrl || job.sourceUrl,
      note: job.verification,
    }],
    sourceMetadata: {
      sourceType: "official-career-site",
      sourceName: job.sourceName || job.company,
      sourceUrl: job.applyUrl || job.sourceUrl || null,
      verification: job.verification,
      publishedAt: job.publishedAt || null,
      updatedAt: job.updatedAt || null,
      lastSeenAt: job.lastSeenAt || null,
      verifiedAt: job.lastSeenAt || job.updatedAt || null,
      status: (job.applyUrl || job.sourceUrl) && /^official-/i.test(job.verification) ? "active" : "unknown",
      isDemoData: false,
    },
  };
};

export async function fetchPublicJobs(input: { query?: string; city?: string; limit?: number } = {}): Promise<PublicJobFeed> {
  const configuredEndpoint = import.meta.env.VITE_JOBS_API_URL?.trim();
  const endpoint = configuredEndpoint || (window.location.protocol === "file:" ? "" : "/api/jobs");
  if (!endpoint) {
    throw new Error("当前 HAP 未配置岗位服务地址，请在构建时设置 VITE_JOBS_API_URL。");
  }
  const url = new URL(endpoint, window.location.href);
  if (input.query?.trim()) url.searchParams.set("q", input.query.trim());
  if (input.city?.trim()) url.searchParams.set("city", input.city.trim());
  url.searchParams.set("limit", String(Math.max(1, Math.min(60, input.limit || 30))));
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({})) as PublicJobsResponse;
    if (!response.ok || !payload.ok) throw new Error(payload.error || "岗位服务暂时不可用。");
    const jobs = (payload.jobs || []).map(mapPublicJob);
    const collection = payload.collection;
    const sourceSummary = collection
      ? `${collection.succeeded}/${collection.attempted} 个来源可用，本次收集 ${collection.collected} 条`
      : "已读取岗位缓存";
    return {
      jobs,
      total: payload.pagination?.total || jobs.length,
      stale: Boolean(payload.stale),
      message: `${sourceSummary}，筛选后展示 ${jobs.length} 条官方岗位`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("岗位收集超时，请稍后重试。");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
