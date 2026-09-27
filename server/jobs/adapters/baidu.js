import {
  buildNormalizedJob,
  fetchWithTimeout,
  jobSearchQueries,
  SEARCH_TIMEOUT_MS,
  USER_AGENT,
} from "../utils.js";

const BASE_URL = "https://talent.baidu.com";
const INITIAL_DATA_MARKER = "window.__INITIAL_DATA__ =";

export const parseBaiduInitialData = (html) => {
  const source = String(html || "");
  const markerIndex = source.indexOf(INITIAL_DATA_MARKER);
  if (markerIndex < 0) throw new Error("Baidu jobs page has no initial data");
  const start = markerIndex + INITIAL_DATA_MARKER.length;
  const scriptEnd = source.indexOf("</script>", start);
  if (scriptEnd < 0) throw new Error("Baidu jobs page initial data is incomplete");
  const assignment = source.slice(start, scriptEnd);
  const boundary = assignment.indexOf("; window.prefix");
  const raw = (boundary >= 0 ? assignment.slice(0, boundary) : assignment)
    .trim()
    .replace(/;$/, "")
    .replace(/:\s*undefined(?=\s*[,}])/g, ":null");
  return JSON.parse(raw);
};

const pageRequests = (source, query) => {
  const modes = source.mode === "student" ? ["GRADUATE", "INTERN"] : ["SOCIAL"];
  return modes.map((recruitType) => {
    const path = recruitType === "SOCIAL" ? "/jobs/social-list" : "/jobs/list";
    const params = new URLSearchParams({ search: query, recruitType });
    return { recruitType, url: `${BASE_URL}${path}?${params}` };
  });
};

const levelFor = (recruitType) => {
  if (recruitType === "INTERN") return "实习";
  if (recruitType === "GRADUATE") return "校招";
  return "社招";
};

const collectPage = async (fetchImpl, request, source, query, city) => {
  let response;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetchWithTimeout(fetchImpl, request.url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      }, SEARCH_TIMEOUT_MS);
      if (response.ok) break;
      lastError = new Error(`Baidu jobs page returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  if (!response?.ok) throw lastError || new Error("Baidu jobs page failed");
  const payload = parseBaiduInitialData(await response.text());
  const jobs = Array.isArray(payload?.listData?.listDetailData) ? payload.listData.listDetailData : [];
  return jobs.filter((job) => job?.postId && job?.name).map((job) => {
    const recruitType = String(payload?.listData?.recruitType || request.recruitType).toUpperCase();
    const detailUrl = `${BASE_URL}/jobs/detail/${encodeURIComponent(recruitType)}/${encodeURIComponent(job.postId)}`;
    return buildNormalizedJob(source, {
      externalId: job.postId || job.jobId,
      title: job.name,
      locations: String(job.workPlace || "").split(/[,，、/]/).map((value) => value.trim()).filter(Boolean),
      level: levelFor(recruitType),
      employmentType: recruitType,
      department: [job.postType, job.bgShortName].filter(Boolean).join(" / "),
      education: job.education,
      description: [
        job.workContent ? `岗位职责\n${job.workContent}` : "",
        job.serviceCondition ? `任职要求\n${job.serviceCondition}` : "",
      ].filter(Boolean).join("\n\n"),
      summary: job.workContent || job.serviceCondition,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      publishedAt: job.publishDate,
      updatedAt: job.updateDate,
      verification: "official-server-rendered",
      confidence: 1,
    }, query, city);
  });
};

export async function collectBaiduJobs({ fetchImpl, source, query, city }) {
  const requests = jobSearchQueries(query).flatMap((searchQuery) => pageRequests(source, searchQuery));
  const settled = await Promise.allSettled(
    requests.map((request) => collectPage(fetchImpl, request, source, query, city)),
  );
  const jobs = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!jobs.length && settled.every((result) => result.status === "rejected")) {
    const reason = settled
      .map((result) => result.status === "rejected" && result.reason instanceof Error ? result.reason.message : "")
      .filter(Boolean)
      .join("; ");
    throw new Error(`All Baidu jobs pages failed${reason ? `: ${reason}` : ""}`);
  }
  return [...new Map(jobs.map((job) => [job.id, job])).values()];
}
