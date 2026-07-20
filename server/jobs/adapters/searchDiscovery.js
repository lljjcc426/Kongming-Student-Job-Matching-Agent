import {
  buildNormalizedJob,
  decodeEntities,
  fetchWithTimeout,
  hostMatches,
  normalizeUrl,
  sanitizeText,
  SEARCH_TIMEOUT_MS,
  stripHtml,
  USER_AGENT,
  VERIFY_TIMEOUT_MS,
} from "../utils.js";

const SEARCH_ENDPOINT = "https://cn.bing.com/search";

const tagValue = (xml, tag) => {
  const match = String(xml || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
};

const parseRssItems = (xml) => {
  const items = [];
  const pattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = pattern.exec(String(xml || ""))) && items.length < 30) {
    items.push({
      title: stripHtml(tagValue(match[1], "title")),
      url: normalizeUrl(stripHtml(tagValue(match[1], "link"))),
      description: stripHtml(tagValue(match[1], "description")),
      publishedAt: stripHtml(tagValue(match[1], "pubDate")),
    });
  }
  return items;
};

const chunksOf = (items, size) => Array.from(
  { length: Math.ceil(items.length / size) },
  (_, index) => items.slice(index * size, index * size + size),
);

const findJobPosting = (value) => {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  if (types.some((type) => String(type).toLowerCase() === "jobposting")) return value;
  return findJobPosting(value["@graph"]);
};

const parseJsonLdJob = (html) => {
  const scripts = String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeEntities(script[1]).trim());
      const job = findJobPosting(parsed);
      if (job) return job;
    } catch {
      // A malformed JSON-LD block should not discard the verified official URL.
    }
  }
  return null;
};

const jsonLdLocations = (jobPosting) => {
  const raw = Array.isArray(jobPosting?.jobLocation) ? jobPosting.jobLocation : [jobPosting?.jobLocation];
  return raw.filter(Boolean).map((location) => {
    const address = location.address || location;
    return [address.addressCountry, address.addressRegion, address.addressLocality, address.streetAddress]
      .filter(Boolean)
      .join(" ");
  }).filter(Boolean);
};

const jsonLdSalary = (jobPosting) => {
  const salary = jobPosting?.baseSalary;
  if (!salary) return null;
  const value = salary.value || salary;
  const range = [value.minValue, value.maxValue].filter((item) => item !== undefined && item !== null).join("-")
    || value.value
    || salary.value;
  return range ? `${salary.currency || ""} ${range}${value.unitText ? `/${value.unitText}` : ""}`.trim() : null;
};

const verifyAndEnrich = async (fetchImpl, job, target, query, city) => {
  try {
    const response = await fetchWithTimeout(fetchImpl, job.sourceUrl, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    }, VERIFY_TIMEOUT_MS);
    if (response.status === 404 || response.status === 410 || response.status >= 500) return job;
    const html = await response.text();
    const jobPosting = parseJsonLdJob(html);
    if (!jobPosting) return { ...job, verification: "official-reachable", confidence: 0.75 };
    const jsonLdSource = {
      id: `jsonld-${target.id}`,
      company: sanitizeText(jobPosting.hiringOrganization?.name, 80) || target.company,
      sourceType: "official-jsonld",
      domains: target.domains,
    };
    return buildNormalizedJob(jsonLdSource, {
      externalId: jobPosting.identifier?.value || job.externalId || job.id,
      title: jobPosting.title || job.title,
      company: jobPosting.hiringOrganization?.name || target.company,
      locations: jsonLdLocations(jobPosting),
      employmentType: Array.isArray(jobPosting.employmentType)
        ? jobPosting.employmentType.join(" / ")
        : jobPosting.employmentType,
      description: jobPosting.description || job.description,
      summary: jobPosting.description || job.summary,
      salary: jsonLdSalary(jobPosting),
      sourceUrl: job.sourceUrl,
      applyUrl: job.sourceUrl,
      publishedAt: jobPosting.datePosted || job.publishedAt,
      validThrough: jobPosting.validThrough,
      verification: "official-jsonld",
      confidence: 0.92,
    }, query, city);
  } catch {
    return job;
  }
};

const searchChunk = async (fetchImpl, targets, query, city) => {
  const domains = targets.flatMap((target) => target.domains);
  const siteQuery = domains.map((domain) => `site:${domain}`).join(" OR ");
  const searchQuery = `${query || "互联网岗位"} ${city || ""} (实习 OR 校招 OR 应届 OR 社招) (${siteQuery})`;
  const endpoint = `${SEARCH_ENDPOINT}?format=rss&count=20&q=${encodeURIComponent(searchQuery)}`;
  const response = await fetchWithTimeout(fetchImpl, endpoint, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml,text/xml" },
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Search discovery returned ${response.status}`);
  const items = parseRssItems(await response.text());
  return items.flatMap((item) => {
    const target = targets.find((candidate) => hostMatches(item.url, candidate.domains));
    if (!target) return [];
    const source = {
      id: `search-${target.id}`,
      company: target.company,
      sourceType: "search-index",
      domains: target.domains,
    };
    const title = sanitizeText(item.title, 120)
      .replace(new RegExp(`[-_|｜].*${target.company}.*$`, "i"), "")
      .replace(/招聘官网|校园招聘|社会招聘/g, "")
      .trim();
    return [buildNormalizedJob(source, {
      externalId: item.url,
      title,
      description: item.description,
      summary: item.description,
      sourceUrl: item.url,
      applyUrl: item.url,
      publishedAt: item.publishedAt,
      verification: "official-indexed",
      confidence: 0.65,
    }, query, city)];
  });
};

export async function collectSearchDiscoveryJobs({ fetchImpl, source, targets, query, city, limit }) {
  const chunks = chunksOf(targets, 6);
  const settled = await Promise.allSettled(chunks.map((chunk) => searchChunk(fetchImpl, chunk, query, city)));
  const jobs = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const unique = [...new Map(jobs.map((job) => [job.sourceUrl, job])).values()]
    .slice(0, Math.max(12, Math.min(40, limit * 2)));
  const verified = await Promise.all(unique.map((job) => {
    const target = targets.find((candidate) => hostMatches(job.sourceUrl, candidate.domains));
    return target ? verifyAndEnrich(fetchImpl, job, target, query, city) : job;
  }));
  if (!verified.length && settled.every((result) => result.status === "rejected")) {
    throw new Error("All search discovery requests failed");
  }
  return verified;
}

export { parseJsonLdJob, parseRssItems };
