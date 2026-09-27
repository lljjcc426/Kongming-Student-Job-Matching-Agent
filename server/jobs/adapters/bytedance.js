import { randomBytes } from "node:crypto";
import {
  buildNormalizedJob,
  fetchWithTimeout,
  jobSearchQueries,
  SEARCH_TIMEOUT_MS,
} from "../utils.js";

const BASE_URL = "https://jobs.bytedance.com";
const CSRF_ENDPOINT = `${BASE_URL}/api/v1/csrf/token`;
const SEARCH_ENDPOINT = `${BASE_URL}/api/v1/search/job/posts`;
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const sessionCookie = () => [
  "device-id=",
  "locale=zh-CN",
  "channel=office",
  "platform=pc",
  `s_v_web_id=verify_${randomBytes(18).toString("hex")}`,
].join("; ");

const portalTypeFor = (source) => Number(source.portalType) || (source.mode === "campus" ? 3 : 2);
const portalPathFor = (source) => source.mode === "campus" ? "campus" : "experienced";

const requestHeaders = (source, cookie, csrfToken = "undefined") => ({
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN",
  "Content-Type": "application/json",
  Origin: BASE_URL,
  Referer: `${BASE_URL}/${portalPathFor(source)}/position`,
  "portal-channel": "office",
  "portal-platform": "pc",
  "website-path": source.mode === "campus" ? "campus" : "society",
  "x-csrf-token": csrfToken,
  Cookie: cookie,
});

const acquireCsrfToken = async (fetchImpl, source, cookie) => {
  const response = await fetchWithTimeout(fetchImpl, CSRF_ENDPOINT, {
    method: "POST",
    headers: requestHeaders(source, cookie),
    body: JSON.stringify({ portal_type: portalTypeFor(source) }),
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`ByteDance CSRF endpoint returned ${response.status}`);
  const payload = await response.json();
  const token = String(payload?.data?.token || "").trim();
  if (!token) throw new Error("ByteDance CSRF endpoint returned no token");
  return token;
};

const searchBody = (query, limit, portalType) => ({
  keyword: query,
  limit,
  offset: 0,
  job_category_id_list: [],
  tag_id_list: [],
  location_code_list: [],
  subject_id_list: [],
  recruitment_id_list: [],
  portal_type: portalType,
  job_function_id_list: [],
  storefront_id_list: [],
  portal_entrance: 1,
});

const searchUrl = (body) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return `${SEARCH_ENDPOINT}?${params}`;
};

const locationName = (location) => String(location?.i18n_name || location?.name || "").trim();

export async function collectByteDanceJobs({ fetchImpl, source, query, city, limit }) {
  const cookie = sessionCookie();
  const csrfToken = await acquireCsrfToken(fetchImpl, source, cookie);
  const requestLimit = Math.max(16, Math.min(30, city ? Number(limit) * 2 : Number(limit) + 10));
  const portalType = portalTypeFor(source);
  const settled = await Promise.allSettled(jobSearchQueries(query).map(async (searchQuery) => {
    const body = searchBody(searchQuery, requestLimit, portalType);
    const response = await fetchWithTimeout(fetchImpl, searchUrl(body), {
      method: "POST",
      headers: requestHeaders(
        source,
        `${cookie}; atsx-csrf-token=${encodeURIComponent(csrfToken)}`,
        csrfToken,
      ),
      body: JSON.stringify(body),
    }, SEARCH_TIMEOUT_MS);
    if (!response.ok) throw new Error(`ByteDance API returned ${response.status}`);
    const payload = await response.json();
    if (payload?.code !== 0) throw new Error(`ByteDance API returned code ${payload?.code ?? "unknown"}`);
    return Array.isArray(payload?.data?.job_post_list) ? payload.data.job_post_list : [];
  }));
  const posts = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!posts.length && settled.every((result) => result.status === "rejected")) {
    throw new Error("All ByteDance job searches failed");
  }

  const jobs = posts.filter((post) => post?.id && post?.title).map((post) => {
      const locations = (Array.isArray(post.city_list) ? post.city_list : [post.city_info])
        .map(locationName)
        .filter(Boolean);
      const description = [
        post.description,
        post.requirement ? `任职要求\n${post.requirement}` : "",
      ].filter(Boolean).join("\n\n");
      const detailUrl = `${BASE_URL}/${portalPathFor(source)}/position/${post.id}/detail`;
      return buildNormalizedJob(source, {
        externalId: post.id,
        title: post.title,
        locations,
        department: post.job_category?.i18n_name || post.job_category?.name,
        education: post.job_post_info?.education,
        employmentType: post.recruit_type?.i18n_name || post.recruit_type?.name,
        description,
        summary: post.description,
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        publishedAt: post.publish_time,
        verification: "official-live-api",
        confidence: 1,
      }, query, city);
    });
  return [...new Map(jobs.map((job) => [job.id, job])).values()];
}
