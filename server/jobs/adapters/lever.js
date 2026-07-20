import { buildNormalizedJob, fetchWithTimeout, SEARCH_TIMEOUT_MS, USER_AGENT } from "../utils.js";

export async function collectLeverJobs({ fetchImpl, source, query, city, limit }) {
  const params = new URLSearchParams({ mode: "json", limit: "100" });
  const endpoint = `https://api.lever.co/v0/postings/${encodeURIComponent(source.site)}?${params}`;
  const response = await fetchWithTimeout(fetchImpl, endpoint, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Lever API returned ${response.status}`);
  const payload = await response.json();
  const jobs = Array.isArray(payload) ? payload : [];
  return jobs.map((job) => buildNormalizedJob(source, {
    externalId: job.id,
    title: job.text,
    city: job.categories?.location,
    locations: job.categories?.allLocations,
    department: job.categories?.department || job.categories?.team,
    employmentType: job.categories?.commitment,
    description: [job.descriptionPlain, ...(job.lists || []).map((item) => `${item.text}\n${item.content}`)].join("\n"),
    summary: job.descriptionPlain,
    sourceUrl: job.hostedUrl,
    applyUrl: job.applyUrl,
    publishedAt: job.createdAt,
    verification: "official-ats",
    confidence: 0.98,
  }, query, city));
}
