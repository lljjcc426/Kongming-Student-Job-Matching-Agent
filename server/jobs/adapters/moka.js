import { buildNormalizedJob, fetchWithTimeout, SEARCH_TIMEOUT_MS, USER_AGENT } from "../utils.js";

const salaryText = (job) => {
  if (job.minSalary === null && job.maxSalary === null) return null;
  const range = [job.minSalary, job.maxSalary].filter((value) => value !== null && value !== undefined).join("-");
  return `${range}${job.payPeriod ? `/${job.payPeriod}` : ""}`;
};

export async function collectMokaJobs({ fetchImpl, source, query, city, limit }) {
  const params = new URLSearchParams({
    mode: source.mode || "social",
    limit: String(Math.max(10, Math.min(50, limit))),
    offset: "0",
  });
  const endpoint = `https://api.mokahr.com/api-platform/v1/jobs/${encodeURIComponent(source.orgId)}?${params}`;
  const response = await fetchWithTimeout(fetchImpl, endpoint, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Moka API returned ${response.status}`);
  const payload = await response.json();
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];

  return jobs
    .filter((job) => job?.id && job?.status !== "closed")
    .map((job) => {
      const locations = Array.isArray(job.locations)
        ? job.locations.map((location) => [location.province, location.area, location.address].filter(Boolean).join(" "))
        : [];
      const detailUrl = `${source.careersUrl}#/job/${job.id}`;
      return buildNormalizedJob(source, {
        externalId: job.id,
        title: job.title,
        locations,
        department: job.department?.name || job.zhineng?.name,
        education: job.education,
        employmentType: job.commitment,
        description: job.description,
        summary: job.description,
        salary: salaryText(job),
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        publishedAt: job.publishedAt || job.openedAt,
        updatedAt: job.updatedAt,
        validThrough: job.finishedAt,
        status: job.status,
        verification: "official-ats",
        confidence: 0.98,
      }, query, city);
    });
}
