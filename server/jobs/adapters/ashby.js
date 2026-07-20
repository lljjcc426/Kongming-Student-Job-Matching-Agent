import { buildNormalizedJob, fetchWithTimeout, SEARCH_TIMEOUT_MS, USER_AGENT } from "../utils.js";

export async function collectAshbyJobs({ fetchImpl, source, query, city, limit }) {
  const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.boardName)}?includeCompensation=true`;
  const response = await fetchWithTimeout(fetchImpl, endpoint, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Ashby API returned ${response.status}`);
  const payload = await response.json();
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs
    .filter((job) => job?.isListed !== false)
    .map((job) => buildNormalizedJob(source, {
      externalId: job.id,
      title: job.title,
      city: job.location || (job.isRemote ? "远程" : ""),
      locations: [job.location, ...(job.secondaryLocations || []).map((location) => location.location || location.name)]
        .filter(Boolean),
      department: [job.department, job.team].filter(Boolean).join(" / "),
      employmentType: job.employmentType,
      description: job.descriptionPlain || job.descriptionHtml,
      summary: job.descriptionPlain || job.descriptionHtml,
      salary: job.compensation?.compensationTierSummary || job.compensation?.scrapeableCompensationSalarySummary,
      sourceUrl: job.jobUrl,
      applyUrl: job.applyUrl,
      publishedAt: job.publishedAt,
      verification: "official-ats",
      confidence: 0.98,
    }, query, city));
}
