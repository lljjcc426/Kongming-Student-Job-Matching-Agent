import {
  buildNormalizedJob,
  fetchWithTimeout,
  jobSearchQueries,
  sanitizeText,
  SEARCH_TIMEOUT_MS,
  USER_AGENT,
} from "../utils.js";

const ENDPOINT = "https://careers.tencent.com/tencentcareer/api/post/Query";

export async function collectTencentJobs({ fetchImpl, source, query, city, limit }) {
  const pageSize = Math.max(20, Math.min(50, city ? Number(limit) * 2 : Number(limit)));
  const settled = await Promise.allSettled(jobSearchQueries(query).map(async (searchQuery) => {
    const params = new URLSearchParams({
      timestamp: String(Date.now()),
      countryId: "",
      cityId: "",
      bgIds: "",
      productId: "",
      categoryId: "",
      parentCategoryId: "",
      attrId: "",
      keyword: searchQuery,
      pageIndex: "1",
      pageSize: String(pageSize),
      language: "zh-cn",
      area: "cn",
    });
    const response = await fetchWithTimeout(fetchImpl, `${ENDPOINT}?${params}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Referer: "https://careers.tencent.com/search.html",
      },
    }, SEARCH_TIMEOUT_MS);
    if (!response.ok) throw new Error(`Tencent API returned ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload?.Data?.Posts) ? payload.Data.Posts : [];
  }));
  const posts = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!posts.length && settled.every((result) => result.status === "rejected")) {
    throw new Error("All Tencent API requests failed");
  }

  const jobs = posts
    .filter((post) => post?.IsValid !== false && post?.PostId)
    .map((post) => buildNormalizedJob(source, {
      externalId: post.PostId,
      title: post.RecruitPostName,
      city: post.LocationName,
      department: post.CategoryName || post.ProductName,
      description: post.Responsibility,
      summary: post.Responsibility,
      level: `${post.RequireWorkYearsName || ""} ${post.RecruitPostName || ""}`,
      sourceUrl: (sanitizeText(post.PostURL, 500) || `https://careers.tencent.com/jobdesc.html?postId=${post.PostId}`).replace(/^http:/, "https:"),
      applyUrl: (sanitizeText(post.PostURL, 500) || `https://careers.tencent.com/jobdesc.html?postId=${post.PostId}`).replace(/^http:/, "https:"),
      publishedAt: post.LastUpdateTime,
      updatedAt: post.LastUpdateTime,
      verification: "official-live-api",
      confidence: 1,
    }, query, city));
  return [...new Map(jobs.map((job) => [job.id, job])).values()];
}
