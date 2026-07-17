const SEARCH_ENDPOINT = "https://cn.bing.com/search";
const TENCENT_SEARCH_ENDPOINT = "https://careers.tencent.com/tencentcareer/api/post/Query";
const SEARCH_TIMEOUT_MS = 7000;
const VERIFY_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 10 * 60 * 1000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KongmingJobRadar/1.0";

const INTERNET_CAREER_SOURCES = [
  { company: "字节跳动", domains: ["jobs.bytedance.com"] },
  { company: "腾讯", domains: ["join.qq.com", "careers.tencent.com"] },
  { company: "阿里巴巴", domains: ["talent.alibaba.com", "campus.alibaba.com"] },
  { company: "百度", domains: ["talent.baidu.com"] },
  { company: "美团", domains: ["zhaopin.meituan.com"] },
  { company: "京东", domains: ["campus.jd.com", "zhaopin.jd.com"] },
  { company: "小米", domains: ["hr.xiaomi.com"] },
  { company: "网易", domains: ["campus.163.com", "hr.163.com"] },
  { company: "快手", domains: ["zhaopin.kuaishou.cn"] },
  { company: "华为", domains: ["career.huawei.com"] },
];

const KEYWORD_DICTIONARY = [
  "JavaScript", "TypeScript", "Java", "Python", "Go", "C++", "SQL", "React", "Vue", "Node.js",
  "产品设计", "需求分析", "用户研究", "数据分析", "内容运营", "用户运营", "商业分析", "机器学习",
  "大模型", "人工智能", "测试", "交互设计", "视觉设计", "项目管理", "市场营销", "供应链", "财务",
];

const CITY_NAMES = ["北京", "上海", "深圳", "广州", "杭州", "成都", "武汉", "南京", "西安", "苏州", "长沙", "重庆", "天津", "厦门", "珠海"];
const cache = new Map();

const decodeEntities = (value) => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const stripHtml = (value) => decodeEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const sanitizeText = (value, maxLength = 120) => stripHtml(value).replace(/[\u0000-\u001f]/g, " ").slice(0, maxLength);

const sanitizeQuery = (value) => sanitizeText(value, 80)
  .replace(/["'<>]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const tagValue = (xml, tag) => {
  const match = String(xml || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
};

const parseRssItems = (xml) => {
  const items = [];
  const pattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = pattern.exec(String(xml || ""))) && items.length < 20) {
    items.push({
      title: stripHtml(tagValue(match[1], "title")),
      url: stripHtml(tagValue(match[1], "link")),
      description: stripHtml(tagValue(match[1], "description")),
      publishedAt: stripHtml(tagValue(match[1], "pubDate")),
    });
  }
  return items;
};

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    ["utm_source", "utm_medium", "utm_campaign", "spm", "from"].forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
};

const hostMatches = (url, domains) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

const inferCity = (text, requestedCity) => CITY_NAMES.find((city) => text.includes(city)) || requestedCity || "地点见原岗位页";

const inferLevel = (text) => {
  if (/实习|intern/i.test(text)) return "实习";
  if (/校招|校园|应届|graduate|campus/i.test(text)) return "校招";
  return "初级/社招";
};

const inferKeywords = (text, query) => {
  const detected = KEYWORD_DICTIONARY.filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  const queryTokens = sanitizeQuery(query).split(/\s+/).filter((item) => item.length >= 2);
  return [...new Set([...detected, ...queryTokens])].slice(0, 8);
};

const parseChineseDate = (value) => {
  const match = String(value || "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const cleanTitle = (title, company) => sanitizeText(title, 100)
  .replace(new RegExp(`[-_|｜].*${company}.*$`, "i"), "")
  .replace(/招聘官网|校园招聘|社会招聘/g, "")
  .trim() || `${company}公开招聘岗位`;

const fetchWithTimeout = async (fetchImpl, url, options, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const collectTencentOfficialJobs = async (fetchImpl, query, city, limit) => {
  const params = new URLSearchParams({
    timestamp: String(Date.now()),
    countryId: "",
    cityId: "",
    bgIds: "",
    productId: "",
    categoryId: "",
    parentCategoryId: "",
    attrId: "",
    keyword: query,
    pageIndex: "1",
    pageSize: String(Math.max(10, Math.min(30, limit))),
    language: "zh-cn",
    area: "cn",
  });
  try {
    const response = await fetchWithTimeout(fetchImpl, `${TENCENT_SEARCH_ENDPOINT}?${params}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Referer: "https://careers.tencent.com/search.html",
      },
    }, SEARCH_TIMEOUT_MS);
    if (!response.ok) return [];
    const payload = await response.json();
    const posts = Array.isArray(payload?.Data?.Posts) ? payload.Data.Posts : [];
    return posts.filter((post) => post?.IsValid !== false && post?.PostId).map((post) => {
      const title = sanitizeText(post.RecruitPostName, 100) || "腾讯公开招聘岗位";
      const summary = sanitizeText(post.Responsibility, 360) || "请进入腾讯招聘官网查看完整岗位职责与任职要求。";
      const combined = `${title} ${summary} ${post.CategoryName || ""} ${post.ProductName || ""}`;
      const sourceUrl = normalizeUrl(post.PostURL || `https://careers.tencent.com/jobdesc.html?postId=${post.PostId}`)
        .replace(/^http:/, "https:");
      return {
        id: `tencent-${post.PostId}`,
        title,
        company: "腾讯",
        city: sanitizeText(post.LocationName, 24) || inferCity(combined, city),
        level: inferLevel(`${combined} ${post.RequireWorkYearsName || ""}`),
        summary,
        keywords: inferKeywords(combined, query),
        sourceUrl,
        sourceDomain: "careers.tencent.com",
        publishedAt: parseChineseDate(post.LastUpdateTime),
        collectedAt: new Date().toISOString(),
        verification: "official-live-api",
      };
    });
  } catch {
    return [];
  }
};

const searchSource = async (fetchImpl, source, query, city) => {
  const siteQuery = source.domains.map((domain) => `site:${domain}`).join(" OR ");
  const searchQuery = `${query || "互联网岗位"} ${city || ""} (实习 OR 校招 OR 应届) (${siteQuery})`;
  const url = `${SEARCH_ENDPOINT}?format=rss&count=12&q=${encodeURIComponent(searchQuery)}`;
  try {
    const response = await fetchWithTimeout(fetchImpl, url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml,text/xml" } }, SEARCH_TIMEOUT_MS);
    if (!response.ok) return [];
    const xml = await response.text();
    return parseRssItems(xml)
      .map((item) => ({ ...item, url: normalizeUrl(item.url) }))
      .filter((item) => item.url && hostMatches(item.url, source.domains))
      .map((item) => {
        const combined = `${item.title} ${item.description}`;
        const parsedDate = item.publishedAt ? new Date(item.publishedAt) : null;
        return {
          id: Buffer.from(item.url).toString("base64url").slice(0, 24),
          title: cleanTitle(item.title, source.company),
          company: source.company,
          city: inferCity(combined, city),
          level: inferLevel(combined),
          summary: sanitizeText(item.description, 240) || "请进入企业官方招聘页面查看完整岗位职责与任职要求。",
          keywords: inferKeywords(combined, query),
          sourceUrl: item.url,
          sourceDomain: new URL(item.url).hostname,
          publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
          collectedAt: new Date().toISOString(),
          verification: "official-indexed",
        };
      });
  } catch {
    return [];
  }
};

const verifyJobUrl = async (fetchImpl, job) => {
  try {
    const response = await fetchWithTimeout(fetchImpl, job.sourceUrl, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Range: "bytes=0-2048" },
    }, VERIFY_TIMEOUT_MS);
    const reachable = response.status >= 200 && response.status < 500 && response.status !== 404 && response.status !== 410;
    return { ...job, verification: reachable ? "official-reachable" : job.verification };
  } catch {
    return job;
  }
};

const relevanceScore = (job, query, city) => {
  const text = `${job.title} ${job.summary} ${job.keywords.join(" ")}`.toLowerCase();
  const tokens = sanitizeQuery(query).toLowerCase().split(/\s+/).filter((item) => item.length >= 2);
  const hits = tokens.filter((token) => text.includes(token)).length;
  return hits * 12 + (city && job.city.includes(city) ? 8 : 0)
    + (job.verification === "official-live-api" ? 10 : 0)
    + (job.verification === "official-reachable" ? 5 : 0);
};

export async function collectPublicJobs(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const query = sanitizeQuery(options.query || "产品 技术 运营");
  const city = sanitizeQuery(options.city || "").slice(0, 12);
  const limit = Math.max(1, Math.min(30, Number(options.limit) || 20));
  const cacheKey = `${query}|${city}|${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.value;

  const preferredSources = INTERNET_CAREER_SOURCES.filter((source) => query.includes(source.company));
  const sources = (preferredSources.length ? preferredSources : INTERNET_CAREER_SOURCES).slice(0, 8);
  const groups = await Promise.all([
    collectTencentOfficialJobs(fetchImpl, query, city, limit),
    ...sources.map((source) => searchSource(fetchImpl, source, query, city)),
  ]);
  const used = new Set();
  const indexedJobs = groups.flat().filter((job) => {
    const key = `${job.company}|${job.title}|${job.sourceUrl}`.toLowerCase();
    if (used.has(key)) return false;
    used.add(key);
    return true;
  });

  const verified = await Promise.all(indexedJobs.slice(0, Math.max(limit, 12)).map((job) => (
    job.verification === "official-live-api" ? job : verifyJobUrl(fetchImpl, job)
  )));
  const jobs = verified
    .sort((a, b) => relevanceScore(b, query, city) - relevanceScore(a, query, city))
    .slice(0, limit);

  const value = {
    ok: true,
    live: jobs.length > 0,
    query,
    city,
    collectedAt: new Date().toISOString(),
    sourcePolicy: "仅收集企业官方招聘接口与公开招聘页面中的岗位信息，不采集求职者或招聘人员个人信息。",
    jobs,
  };
  cache.set(cacheKey, { createdAt: Date.now(), value });
  return value;
}

export { INTERNET_CAREER_SOURCES };
