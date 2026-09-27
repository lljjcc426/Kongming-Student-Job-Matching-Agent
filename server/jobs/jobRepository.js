import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sanitizeQuery } from "./utils.js";

const MAX_STORED_JOBS = 5_000;
const records = new Map();
let loaded = false;
let writeQueue = Promise.resolve();

const storePath = () => process.env.JOB_STORE_PATH?.trim() || "";

const isExpired = (job, now = Date.now()) => {
  const validThrough = job.validThrough ? new Date(job.validThrough).getTime() : Number.NaN;
  return job.status === "closed" || (!Number.isNaN(validThrough) && validThrough < now);
};

const load = async () => {
  if (loaded) return;
  loaded = true;
  const path = storePath();
  if (!path) return;
  try {
    const payload = JSON.parse(await readFile(path, "utf8"));
    for (const job of Array.isArray(payload?.jobs) ? payload.jobs : []) {
      if (job?.id) records.set(job.id, job);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("[job-repository] unable to load store", error);
  }
};

const persist = async () => {
  const path = storePath();
  if (!path) return;
  const jobs = [...records.values()]
    .sort((left, right) => String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)))
    .slice(0, MAX_STORED_JOBS);
  const temporaryPath = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), jobs }, null, 2), "utf8");
  await rename(temporaryPath, path);
};

export const upsertJobs = async (jobs) => {
  await load();
  const now = new Date().toISOString();
  for (const job of jobs) {
    if (!job?.id || !job.sourceUrl) continue;
    const previous = records.get(job.id);
    records.set(job.id, {
      ...previous,
      ...job,
      firstSeenAt: previous?.firstSeenAt || job.collectedAt || now,
      lastSeenAt: now,
    });
  }
  if (records.size > MAX_STORED_JOBS) {
    const oldest = [...records.values()]
      .sort((left, right) => String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)))
      .slice(MAX_STORED_JOBS);
    oldest.forEach((job) => records.delete(job.id));
  }
  writeQueue = writeQueue.then(persist).catch((error) => console.warn("[job-repository] unable to persist store", error));
  await writeQueue;
  return jobs;
};

const QUERY_SYNONYMS = new Map([
  ["技术", ["技术", "开发", "工程师", "算法", "software", "engineer", "developer"]],
  ["产品", ["产品", "product", "用户研究", "需求分析"]],
  ["运营", ["运营", "operation", "marketing", "growth", "内容"]],
  ["前端", ["前端", "frontend", "front-end", "react", "vue", "javascript", "typescript"]],
  ["后端", ["后端", "backend", "back-end", "server", "java", "golang", "python"]],
  ["设计", ["设计", "design", "ux", "ui", "视觉", "交互"]],
  ["数据", ["数据", "data", "analytics", "分析"]],
  ["人工智能", ["人工智能", "ai", "machine learning", "算法", "大模型"]],
  ["算法", ["算法", "人工智能", "ai", "machine learning", "机器学习", "深度学习", "大模型"]],
  ["大模型", ["大模型", "llm", "ai", "人工智能", "算法"]],
]);

const CHINA_LOCATION_PATTERN = /中国|china|全国|国内|内地|大陆|北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门|深圳|广州|杭州|成都|武汉|南京|西安|苏州|长沙|厦门|珠海|合肥|青岛|济南|郑州|东莞|佛山|无锡|宁波|沈阳|大连|长春|哈尔滨|福州|泉州|南昌|烟台|潍坊|洛阳|宜昌|襄阳|南宁|海口|三亚|贵阳|昆明|拉萨|兰州|西宁|银川|乌鲁木齐|石家庄|太原|呼和浩特|包头|温州|嘉兴|绍兴|金华|常州|南通|徐州|扬州|镇江|泰州|惠州|中山|江门|湛江|绵阳|hong kong|macau|beijing|shanghai|shenzhen|guangzhou|hangzhou|chengdu|wuhan|nanjing|xian|xi'an|suzhou|changsha|chongqing|tianjin|xiamen|zhuhai|hefei|qingdao|jinan|zhengzhou|dongguan|foshan|wuxi|ningbo/i;
const OVERSEAS_LOCATION_PATTERN = /日本|東京|东京|大阪|京都|横滨|横浜|japan|tokyo|osaka|美国|美國|纽约|紐約|西雅图|洛杉矶|旧金山|波士顿|united states|new york|seattle|los angeles|san francisco|boston|英国|英國|伦敦|倫敦|united kingdom|london|新加坡|singapore|加拿大|canada|多伦多|toronto|温哥华|vancouver|澳大利亚|澳洲|australia|悉尼|sydney|墨尔本|melbourne|印度|india|班加罗尔|bengaluru|德国|germany|柏林|berlin|法国|france|巴黎|paris|荷兰|netherlands|韩国|韓國|首尔|首爾|south korea|seoul|阿联酋|阿聯酋|迪拜|杜拜|united arab emirates|dubai|\buae\b|泰国|泰國|曼谷|thailand|bangkok|马来西亚|馬來西亞|吉隆坡|malaysia|kuala lumpur|印度尼西亚|印度尼西亞|印尼|雅加达|雅加達|indonesia|jakarta|越南|河内|河內|胡志明市|vietnam|hanoi|ho chi minh|菲律宾|菲律賓|马尼拉|馬尼拉|philippines|manila|爱尔兰|愛爾蘭|都柏林|ireland|dublin|瑞士|苏黎世|蘇黎世|switzerland|zurich|西班牙|马德里|馬德里|巴塞罗那|巴塞羅那|spain|madrid|barcelona|意大利|義大利|米兰|米蘭|罗马|羅馬|italy|milan|rome|波兰|波蘭|华沙|華沙|poland|warsaw|以色列|特拉维夫|特拉維夫|israel|tel aviv|沙特|沙特阿拉伯|利雅得|saudi arabia|riyadh|卡塔尔|卡塔爾|多哈|qatar|doha|新西兰|新西蘭|奥克兰|奧克蘭|new zealand|auckland|巴西|圣保罗|聖保羅|brazil|sao paulo|墨西哥|墨西哥城|mexico|mexico city|南非|约翰内斯堡|約翰內斯堡|south africa|johannesburg|俄罗斯|俄羅斯|莫斯科|russia|moscow/i;
const UNKNOWN_LOCATION_PATTERN = /^(?:地点见原岗位页|地点待确认|地点不限|未注明|待确认|暂无)?$/i;
const CHINA_EMPLOYER_PATTERN = /腾讯|字节跳动|阿里巴巴|蚂蚁集团|百度|美团|京东|小米|网易|快手|华为|滴滴|哔哩哔哩|小红书|携程|搜狐|新浪|微博|联想|大疆|OPPO|vivo|完美世界|高途|微步在线/i;

export const isChinaMarketJob = (job) => {
  const market = String(job?.market || "").toLowerCase();
  if (market === "global") return false;
  const locations = [job?.city || "", ...(job?.locations || [])]
    .map((location) => String(location).trim())
    .filter(Boolean);
  const locationText = locations.join(" ");
  if (OVERSEAS_LOCATION_PATTERN.test(locationText)) return false;
  if (CHINA_LOCATION_PATTERN.test(locationText)) return true;
  if (locations.length && !locations.every((location) => UNKNOWN_LOCATION_PATTERN.test(location))) return false;
  return market === "cn" || CHINA_EMPLOYER_PATTERN.test(String(job?.company || ""));
};

const queryTerms = (query) => {
  const tokens = sanitizeQuery(query).toLowerCase().split(/\s+/).filter((item) => item.length >= 2);
  const expanded = tokens.flatMap((token) => {
    const synonyms = [...QUERY_SYNONYMS.entries()]
      .filter(([key]) => token.includes(key))
      .flatMap(([, values]) => values);
    return [token, ...synonyms];
  });
  return [...new Set(expanded)];
};

const queryIntentGroups = (query) => {
  const normalized = sanitizeQuery(query).toLowerCase();
  const groups = [];
  if (/前端|front[- ]?end|frontend/.test(normalized)) groups.push(["前端", "frontend", "front-end", "front end"]);
  if (/后端|back[- ]?end|backend/.test(normalized)) groups.push(["后端", "backend", "back-end", "back end", "server"]);
  if (/实习|\bintern(?:ship)?\b/.test(normalized)) groups.push(["实习", "intern", "internship"]);
  if (/校招|校园|应届|new grad|graduate|campus/.test(normalized)) groups.push(["校招", "校园", "应届", "new grad", "graduate", "campus"]);
  return groups;
};

const intentTermMatches = (text, term) => {
  if (!/^[a-z0-9 .-]+$/.test(term)) return text.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
};

const scoreJob = (job, terms, intentGroups, city) => {
  const title = `${job.title} ${job.department || ""} ${job.level || ""} ${job.employmentType || ""}`.toLowerCase();
  const haystack = `${title} ${job.company} ${job.summary} ${(job.keywords || []).join(" ")}`.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  const titleHits = terms.filter((term) => title.includes(term)).length;
  const intentTitleHits = intentGroups.filter((group) => group.some((term) => intentTermMatches(title, term))).length;
  const freshness = new Date(job.updatedAt || job.publishedAt || job.lastSeenAt || 0).getTime();
  const freshDays = Math.max(0, Math.min(14, (Date.now() - freshness) / 86_400_000));
  return intentTitleHits * 80 + titleHits * 40 + hits * 8 + (city && String(job.city).includes(city) ? 10 : 0)
    + Number(job.confidence || 0) * 10 + Number(job.employerPriority || 0) * 0.45 - freshDays;
};

const decodeCursor = (cursor) => {
  try {
    return Math.max(0, Number(Buffer.from(String(cursor), "base64url").toString("utf8")) || 0);
  } catch {
    return 0;
  }
};

export const queryJobs = async (filters = {}) => {
  await load();
  const query = sanitizeQuery(filters.query || "");
  const city = sanitizeQuery(filters.city || "");
  const market = sanitizeQuery(filters.market || "all").toLowerCase();
  const company = sanitizeQuery(filters.company || "").toLowerCase();
  const employmentType = sanitizeQuery(filters.employmentType || "").toLowerCase();
  const sourceType = sanitizeQuery(filters.sourceType || "").toLowerCase();
  const updatedAfter = filters.updatedAfter ? new Date(filters.updatedAfter).getTime() : Number.NaN;
  const terms = queryTerms(query);
  const intentGroups = queryIntentGroups(query);
  const offset = decodeCursor(filters.cursor);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const deduped = new Map();
  for (const job of records.values()) {
    if (isExpired(job)) continue;
    if (market === "cn" && !isChinaMarketJob(job)) continue;
    if (company && !String(job.company).toLowerCase().includes(company)) continue;
    if (city && !String(job.city).includes(city) && !(job.locations || []).some((item) => String(item).includes(city))) continue;
    if (employmentType && String(job.employmentType).toLowerCase() !== employmentType) continue;
    if (sourceType && String(job.sourceType).toLowerCase() !== sourceType) continue;
    const haystack = `${job.title} ${job.company} ${job.summary} ${(job.keywords || []).join(" ")} ${job.level || ""} ${job.employmentType || ""}`.toLowerCase();
    if (terms.length && !terms.some((term) => haystack.includes(term))) continue;
    if (intentGroups.length && !intentGroups.every((group) =>
      group.some((term) => intentTermMatches(haystack, term)))) continue;
    if (!Number.isNaN(updatedAfter)) {
      const updatedAt = new Date(job.updatedAt || job.lastSeenAt || 0).getTime();
      if (updatedAt < updatedAfter) continue;
    }
    const key = `${String(job.company).toLowerCase()}|${String(job.title).toLowerCase()}|${String(job.city).toLowerCase()}`;
    const previous = deduped.get(key);
    if (!previous || Number(job.confidence) > Number(previous.confidence)) deduped.set(key, job);
  }
  const sorted = [...deduped.values()].sort((left, right) =>
    scoreJob(right, terms, intentGroups, city) - scoreJob(left, terms, intentGroups, city));
  const jobs = sorted.slice(offset, offset + limit);
  const nextOffset = offset + jobs.length;
  return {
    jobs,
    total: sorted.length,
    nextCursor: nextOffset < sorted.length ? Buffer.from(String(nextOffset), "utf8").toString("base64url") : null,
  };
};

export const repositoryStats = async () => {
  await load();
  const jobs = [...records.values()];
  return {
    storedJobs: jobs.length,
    activeJobs: jobs.filter((job) => !isExpired(job)).length,
    companies: new Set(jobs.map((job) => job.company)).size,
    persistent: Boolean(storePath()),
  };
};

export const resetJobRepositoryForTests = () => {
  records.clear();
  loaded = true;
};
