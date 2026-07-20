import { buildNormalizedJob, fetchWithTimeout, SEARCH_TIMEOUT_MS, USER_AGENT } from "../utils.js";

export async function collectGreenhouseJobs({ fetchImpl, source, query, city, limit }) {
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.boardToken)}/jobs?content=true`;
  const response = await fetchWithTimeout(fetchImpl, endpoint, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Greenhouse API returned ${response.status}`);
  const payload = await response.json();
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs.map((job) => buildNormalizedJob(source, {
    externalId: job.id,
    title: job.title,
    company: job.company_name || source.company,
    city: job.location?.name,
    locations: Array.isArray(job.offices) ? job.offices.map((office) => office.name) : [],
    department: Array.isArray(job.departments) ? job.departments.map((department) => department.name).join(" / ") : null,
    description: job.content,
    summary: job.content,
    sourceUrl: job.absolute_url,
    applyUrl: job.absolute_url,
    publishedAt: job.first_published,
    updatedAt: job.updated_at,
    validThrough: job.application_deadline,
    verification: "official-ats",
    confidence: 0.98,
  }, query, city));
}
