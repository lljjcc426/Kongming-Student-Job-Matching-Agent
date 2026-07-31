const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const SCHEMA_VERSION = "1.0";
const DEFAULT_OUTPUT_DIR = "D:\\Kongming-RAG\\jobs-v1";
const DEFAULT_TARGET = 500;
const DEFAULT_QUOTAS = {
  bytedance: 200,
  tencent: 150,
  meituan: 150,
};

const SOURCE_NAMES = {
  bytedance: "字节跳动",
  tencent: "腾讯",
  meituan: "美团",
};

const OFFICIAL_HOSTS = {
  bytedance: "jobs.bytedance.com",
  tencent: "careers.tencent.com",
  meituan: "zhaopin.meituan.com",
};

const SKILL_PATTERNS = [
  ["大语言模型", /(?:大语言模型|大模型|LLM)/i],
  ["RAG", /\bRAG\b/i],
  ["机器学习", /机器学习/i],
  ["深度学习", /深度学习/i],
  ["自然语言处理", /(?:自然语言处理|NLP)/i],
  ["计算机视觉", /(?:计算机视觉|CV算法|视觉算法)/i],
  ["推荐系统", /推荐(?:系统|算法)/i],
  ["数据分析", /数据分析/i],
  ["数据挖掘", /数据挖掘/i],
  ["Python", /\bPython\b/i],
  ["Java", /\bJava\b/i],
  ["C++", /C\+\+/i],
  ["Go", /(?:\bGolang\b|\bGo语言\b)/i],
  ["JavaScript", /\bJavaScript\b/i],
  ["TypeScript", /\bTypeScript\b/i],
  ["React", /\bReact\b/i],
  ["Vue", /\bVue(?:\.js)?\b/i],
  ["SQL", /\bSQL\b/i],
  ["Spark", /\bSpark\b/i],
  ["Flink", /\bFlink\b/i],
  ["Hadoop", /\bHadoop\b/i],
  ["PyTorch", /\bPyTorch\b/i],
  ["TensorFlow", /\bTensorFlow\b/i],
  ["Linux", /\bLinux\b/i],
  ["Docker", /\bDocker\b/i],
  ["Kubernetes", /(?:\bKubernetes\b|\bK8s\b)/i],
  ["云计算", /云计算/i],
  ["产品设计", /产品设计/i],
  ["用户研究", /用户研究/i],
  ["项目管理", /项目管理/i],
  ["英语", /(?:英语|英文)/i],
];

const POPULAR_ROLE_PATTERN =
  /(?:大模型|人工智能|AI|算法|数据|软件|开发|后端|前端|客户端|测试|产品|运营|设计|安全|云计算|研究)/i;

function parseArguments(argv) {
  const options = {
    outputDir: process.env.KONGMING_RAG_DATA_DIR || DEFAULT_OUTPUT_DIR,
    target: DEFAULT_TARGET,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output-dir") {
      options.outputDir = argv[index + 1];
      index += 1;
    } else if (argument === "--target") {
      options.target = Number(argv[index + 1]);
      index += 1;
    } else if (argument === "--headed") {
      options.headed = true;
    } else if (argument === "--help") {
      console.log(
        [
          "用法: node scripts/collect-official-jobs.cjs [选项]",
          "",
          "选项:",
          `  --output-dir <目录>  输出目录，默认 ${DEFAULT_OUTPUT_DIR}`,
          `  --target <数量>      目标岗位数，默认 ${DEFAULT_TARGET}`,
          "  --headed             使用有界面浏览器调试",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  if (!Number.isInteger(options.target) || options.target < 1) {
    throw new Error("--target 必须是正整数");
  }

  options.outputDir = path.resolve(options.outputDir);
  if (!/^D:\\/i.test(options.outputDir)) {
    throw new Error(`数据输出目录必须位于 D 盘，当前为 ${options.outputDir}`);
  }

  return options;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactValue(value) {
  if (Array.isArray(value)) {
    return value.map(compactValue).filter(Boolean).join("、");
  }
  if (value && typeof value === "object") {
    return cleanText(value.name || value.label || value.title || value.value || "");
  }
  return cleanText(value);
}

function splitStatements(value) {
  const text = cleanText(value);
  if (!text) {
    return [];
  }

  const normalized = text
    .replace(/([。；;])(?=\s*(?:\d+[.、）)]|[（(]?\d+[）)]))/g, "$1\n")
    .replace(/(?<!^)(?=\s*(?:\d+[.、）)]|[（(]\d+[）)]))/g, "\n")
    .replace(/[•●▪◦]\s*/g, "\n");

  const lines = normalized
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-—–*]|[（(]?\d+[）).、]|[一二三四五六七八九十]+[、.])\s*/, "")
        .trim(),
    )
    .filter(Boolean);

  return [...new Set(lines)];
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  let parsed;
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
    const timestamp = Number(value);
    parsed = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
  } else {
    const normalized = String(value)
      .trim()
      .replace(/年/g, "-")
      .replace(/月/g, "-")
      .replace(/日/g, "")
      .replace(/\./g, "-")
      .replace(/\//g, "-")
      .replace(" ", "T");
    parsed = new Date(normalized);
  }

  if (Number.isNaN(parsed.getTime())) {
    return cleanText(value);
  }

  return parsed.toISOString();
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function extractSkills(text) {
  return SKILL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function extractRequirementLine(statements, pattern) {
  return statements.find((statement) => pattern.test(statement)) || "";
}

function inferRecruitmentType(...values) {
  const text = values.map(compactValue).join(" ");
  if (/实习|intern/i.test(text)) {
    return "实习";
  }
  if (/校园|校招|应届|毕业生|graduate/i.test(text)) {
    return "校园招聘";
  }
  return "社会招聘";
}

function calculateSelection(job, raw) {
  let score = 0;
  const reasons = [];
  const allText = `${job.title} ${job.job_family} ${job.requirements.join(" ")}`;

  if (POPULAR_ROLE_PATTERN.test(allText)) {
    score += 20;
    reasons.push("热门职类");
  }
  if (job.recruitment_type === "校园招聘" || job.recruitment_type === "实习") {
    score += 18;
    reasons.push("学生友好");
  }
  if (
    raw.job_hot_flag ||
    raw.hotFlag ||
    raw.highLight ||
    /急招|热门|重点/i.test(compactValue(raw.tags || raw.tag_list || raw.highLight))
  ) {
    score += 15;
    reasons.push("官方热招标记");
  }
  if (job.published_at || job.refreshed_at) {
    const date = new Date(job.refreshed_at || job.published_at);
    if (!Number.isNaN(date.getTime())) {
      const ageDays = Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
      score += Math.max(0, Math.round(20 - ageDays / 15));
      reasons.push("近期发布或刷新");
    }
  }
  if (job.city) {
    score += 3;
  }
  if (job.requirements.length > 1 && job.responsibilities.length > 1) {
    score += 5;
    reasons.push("岗位信息完整");
  }

  return {
    score,
    reasons: [...new Set(reasons)],
  };
}

function buildRetrievalText(job) {
  const sections = [
    `岗位名称：${job.title}`,
    `公司：${job.company_name}`,
    job.recruitment_type ? `招聘类型：${job.recruitment_type}` : "",
    job.city ? `工作地点：${job.city}` : "",
    job.department ? `部门：${job.department}` : "",
    job.job_family ? `岗位类别：${job.job_family}` : "",
    job.education_requirement ? `学历要求：${job.education_requirement}` : "",
    job.experience_requirement ? `经验要求：${job.experience_requirement}` : "",
    job.skills.length ? `技能关键词：${job.skills.join("、")}` : "",
    job.responsibilities.length
      ? `岗位职责：\n${job.responsibilities.map((item, index) => `${index + 1}. ${item}`).join("\n")}`
      : "",
    job.requirements.length
      ? `任职要求：\n${job.requirements.map((item, index) => `${index + 1}. ${item}`).join("\n")}`
      : "",
    job.preferred_qualifications.length
      ? `加分项：\n${job.preferred_qualifications
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")}`
      : "",
  ];

  return sections.filter(Boolean).join("\n");
}

function finalizeJob(job, raw, collectedAt) {
  const allStatements = [...job.responsibilities, ...job.requirements];
  const allText = allStatements.join("\n");
  const normalized = {
    schema_version: SCHEMA_VERSION,
    id: `${job.source}-${job.source_job_id}`,
    source: job.source,
    source_name: SOURCE_NAMES[job.source],
    source_job_id: String(job.source_job_id),
    source_url: job.source_url,
    company_name: SOURCE_NAMES[job.source],
    industry: "互联网与科技",
    title: cleanText(job.title),
    recruitment_type: job.recruitment_type,
    employment_type: job.employment_type || "全职",
    city: cleanText(job.city),
    department: cleanText(job.department),
    job_family: cleanText(job.job_family),
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    preferred_qualifications: job.preferred_qualifications || [],
    skills: extractSkills(allText),
    education_requirement: extractRequirementLine(
      job.requirements,
      /(?:学历|本科|硕士|博士|大专|学士)/i,
    ),
    experience_requirement:
      job.experience_requirement ||
      extractRequirementLine(job.requirements, /(?:经验|年工作|工作年限|年以上)/i),
    published_at: normalizeDate(job.published_at),
    refreshed_at: normalizeDate(job.refreshed_at),
    expires_at: normalizeDate(job.expires_at),
    collected_at: collectedAt,
    last_verified_at: collectedAt,
    status: "active",
    source_payload_hash: hashPayload(raw),
    selection_score: 0,
    selection_reasons: [],
    retrieval_text: "",
  };

  const selection = calculateSelection(normalized, raw);
  normalized.selection_score = selection.score;
  normalized.selection_reasons = selection.reasons;
  normalized.retrieval_text = buildRetrievalText(normalized);
  return normalized;
}

function normalizeByteDance(raw, collectedAt) {
  const id = raw.id || raw.job_post_id || raw.job_id;
  const title = compactValue(raw.title || raw.name);
  const responsibilities = splitStatements(raw.description || raw.job_description);
  const requirements = splitStatements(raw.requirement || raw.job_requirement);
  const city =
    compactValue(raw.city_info) ||
    compactValue(raw.city_list) ||
    compactValue(raw.location_list) ||
    compactValue(raw.location);
  const jobFamily =
    compactValue(raw.job_category) ||
    compactValue(raw.job_function) ||
    compactValue(raw.category);
  const recruitmentLabel =
    compactValue(raw.recruit_type) ||
    compactValue(raw.job_subject) ||
    compactValue(raw.recruitment);

  return finalizeJob(
    {
      source: "bytedance",
      source_job_id: id,
      source_url:
        compactValue(raw.job_url || raw.detail_url || raw.url) ||
        `https://jobs.bytedance.com/campus/position/${id}/detail`,
      title,
      recruitment_type: inferRecruitmentType(recruitmentLabel, title),
      employment_type: /实习|intern/i.test(`${recruitmentLabel} ${title}`) ? "实习" : "全职",
      city,
      department: compactValue(raw.department || raw.organization),
      job_family: jobFamily,
      responsibilities,
      requirements,
      preferred_qualifications: splitStatements(
        raw.preferred_requirement || raw.preferred_qualifications,
      ),
      experience_requirement: "",
      published_at: raw.publish_time || raw.create_time,
      refreshed_at: raw.update_time,
      expires_at: raw.expire_time,
    },
    raw,
    collectedAt,
  );
}

function normalizeTencent(raw, collectedAt) {
  const id = raw.PostId || raw.PostID || raw.id;
  const title = compactValue(raw.RecruitPostName || raw.PostName || raw.title);
  const responsibilities = splitStatements(raw.Responsibility || raw.Duty);
  const requirements = splitStatements(raw.Requirement || raw.JobRequirement || raw.Qualification);
  const sourceUrl = compactValue(raw.PostURL || raw.ShareUrl || raw.url).replace(
    /^http:\/\//i,
    "https://",
  );

  return finalizeJob(
    {
      source: "tencent",
      source_job_id: id,
      source_url:
        sourceUrl || `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(id)}`,
      title,
      recruitment_type: inferRecruitmentType(
        raw.RecruitPostName,
        raw.AttrName,
        raw.RequireWorkYearsName,
      ),
      employment_type: /实习|intern/i.test(title) ? "实习" : "全职",
      city: compactValue(raw.LocationName || raw.CountryName),
      department: compactValue(raw.BGName || raw.ProductName),
      job_family: compactValue(raw.CategoryName || raw.ParentCategoryName),
      responsibilities,
      requirements,
      preferred_qualifications: splitStatements(raw.PreferredQualification),
      experience_requirement: compactValue(raw.RequireWorkYearsName),
      published_at: raw.PublishTime,
      refreshed_at: raw.LastUpdateTime,
      expires_at: raw.EndDate,
    },
    raw,
    collectedAt,
  );
}

function normalizeMeituan(raw, collectedAt) {
  const id = raw.jobUnionId || raw.jobId || raw.id;
  const title = compactValue(raw.name || raw.jobName || raw.title);
  const responsibilities = splitStatements(raw.jobDuty || raw.duty);
  const requirements = splitStatements(raw.jobRequirement || raw.requirement);
  const highlightType = inferRecruitmentType(raw.jobType, raw.jobSpecialCode, title);
  const detailType =
    highlightType === "实习" || highlightType === "校园招聘" ? "campus" : "social";

  return finalizeJob(
    {
      source: "meituan",
      source_job_id: id,
      source_url: `https://zhaopin.meituan.com/web/position/detail?highlightType=${detailType}&jobUnionId=${encodeURIComponent(id)}`,
      title,
      recruitment_type: highlightType,
      employment_type: highlightType === "实习" ? "实习" : "全职",
      city: compactValue(raw.cityList || raw.city),
      department: compactValue(raw.department),
      job_family: compactValue(raw.jobFamily || raw.jobFamilyGroup || raw.jobType),
      responsibilities,
      requirements,
      preferred_qualifications: splitStatements(raw.highLight),
      experience_requirement: compactValue(raw.workYear),
      published_at: raw.publishTime || raw.createTime,
      refreshed_at: raw.refreshTime || raw.updateTime,
      expires_at: raw.expiredTime,
    },
    raw,
    collectedAt,
  );
}

function isUsableJob(job) {
  if (!job.source_job_id || !job.title || !job.source_url) {
    return false;
  }
  if (!job.responsibilities.length || !job.requirements.length) {
    return false;
  }

  try {
    const host = new URL(job.source_url).hostname;
    return host === OFFICIAL_HOSTS[job.source];
  } catch {
    return false;
  }
}

function sanitizeRequestHeaders(headers) {
  const sanitized = Object.fromEntries(
    Object.entries(headers).filter(([name]) => !name.startsWith(":")),
  );
  for (const name of [
    "content-length",
    "host",
    "connection",
    "accept-encoding",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
  ]) {
    delete sanitized[name];
  }
  return sanitized;
}

async function capturePostRequest(page, pageUrl, apiFragment, responseSelector) {
  let detach;
  const captured = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      detach?.();
      reject(new Error(`等待官方接口超时: ${apiFragment}`));
    }, 60_000);

    const listener = async (response) => {
      if (!response.url().includes(apiFragment) || response.status() !== 200) {
        return;
      }
      try {
        const payload = await response.json();
        if (!responseSelector(payload).length) {
          return;
        }
        const request = response.request();
        clearTimeout(timeout);
        detach?.();
        resolve({
          url: request.url(),
          headers: sanitizeRequestHeaders(await request.allHeaders()),
          body: request.postDataJSON(),
          payload,
        });
      } catch {
        // 页面初始化时可能先返回非 JSON 响应，继续等待成功请求。
      }
    };

    detach = () => page.off("response", listener);
    page.on("response", listener);
  });

  await page.goto(pageUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  return captured;
}

async function requestJson(requestContext, request, body) {
  const response = await requestContext.post(request.url, {
    headers: request.headers,
    data: body,
    timeout: 45_000,
  });
  if (!response.ok()) {
    throw new Error(`官方接口请求失败: ${response.status()} ${request.url}`);
  }
  return response.json();
}

async function collectByteDance(browser, desiredCount) {
  console.log(`[采集] 字节跳动：目标候选 ${desiredCount} 条`);
  const context = await browser.newContext({
    locale: "zh-CN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const request = await capturePostRequest(
      page,
      "https://jobs.bytedance.com/campus/position",
      "/api/v1/search/job/posts",
      (payload) => payload?.data?.job_post_list || [],
    );
    const records = [];
    const seen = new Set();
    const pageSize = 50;

    for (let offset = 0; records.length < desiredCount; offset += pageSize) {
      const body = {
        ...request.body,
        limit: pageSize,
        offset,
        portal_type: request.body?.portal_type ?? 3,
        portal_entrance: request.body?.portal_entrance ?? 1,
      };
      const payload = await requestJson(context.request, request, body);
      const list = payload?.data?.job_post_list || [];
      if (!list.length) {
        break;
      }
      for (const record of list) {
        const id = String(record.id || record.job_post_id || "");
        if (id && !seen.has(id)) {
          seen.add(id);
          records.push(record);
        }
      }
      console.log(`[采集] 字节跳动：${records.length} 条候选`);
      if (list.length < pageSize) {
        break;
      }
      await page.waitForTimeout(250);
    }

    return records;
  } finally {
    await context.close();
  }
}

async function collectMeituan(browser, desiredCount) {
  console.log(`[采集] 美团：目标候选 ${desiredCount} 条`);
  const context = await browser.newContext({
    locale: "zh-CN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const request = await capturePostRequest(
      page,
      "https://zhaopin.meituan.com/web/position",
      "/api/official/job/getJobList",
      (payload) => payload?.data?.list || [],
    );
    const records = [];
    const seen = new Set();
    const pageSize = 50;

    for (let pageNo = 1; records.length < desiredCount; pageNo += 1) {
      const body = {
        ...request.body,
        page: {
          ...(request.body?.page || {}),
          pageNo,
          pageSize,
        },
      };
      const payload = await requestJson(context.request, request, body);
      const list = payload?.data?.list || [];
      if (!list.length) {
        break;
      }
      for (const record of list) {
        const id = String(record.jobUnionId || record.jobId || "");
        const isActive =
          record.jobStatus === undefined ||
          record.jobStatus === null ||
          ["000", "0", "active", "OPEN"].includes(String(record.jobStatus));
        if (id && isActive && !seen.has(id)) {
          seen.add(id);
          records.push(record);
        }
      }
      console.log(`[采集] 美团：${records.length} 条候选`);
      if (list.length < pageSize) {
        break;
      }
      await page.waitForTimeout(250);
    }

    return records;
  } finally {
    await context.close();
  }
}

async function collectTencent(desiredCount) {
  console.log(`[采集] 腾讯：目标候选 ${desiredCount} 条`);
  const records = [];
  const seen = new Set();
  const pageSize = 100;

  for (let pageIndex = 1; records.length < desiredCount; pageIndex += 1) {
    const parameters = new URLSearchParams({
      timestamp: String(Date.now()),
      countryId: "",
      cityId: "",
      bgIds: "",
      productId: "",
      categoryId: "",
      parentCategoryId: "",
      attrId: "1",
      keyword: "",
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      language: "zh-cn",
      area: "cn",
    });
    const url = `https://careers.tencent.com/tencentcareer/api/post/Query?${parameters}`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json, text/plain, */*",
        referer: "https://careers.tencent.com/zh-cn/jobopportunity.html",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      throw new Error(`腾讯官方接口请求失败: ${response.status} ${url}`);
    }
    const payload = await response.json();
    const list = payload?.Data?.Posts || payload?.data?.posts || [];
    if (!list.length) {
      break;
    }

    for (const record of list) {
      const id = String(record.PostId || record.PostID || "");
      const isValid =
        record.IsValid === undefined || record.IsValid === null || record.IsValid === true;
      const isChina =
        !record.CountryName || /中国|China/i.test(String(record.CountryName));
      if (id && isValid && isChina && !seen.has(id)) {
        seen.add(id);
        records.push(record);
      }
    }
    console.log(`[采集] 腾讯：${records.length} 条候选`);
    if (list.length < pageSize) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const candidates = records.slice(0, desiredCount);
  const detailedRecords = [];
  const batchSize = 10;
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    const details = await Promise.all(
      batch.map(async (record) => {
        const parameters = new URLSearchParams({
          timestamp: String(Date.now()),
          postId: String(record.PostId),
          language: "zh-cn",
        });
        const url = `https://careers.tencent.com/tencentcareer/api/post/ByPostId?${parameters}`;
        const response = await fetch(url, {
          headers: {
            accept: "application/json, text/plain, */*",
            referer: `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(record.PostId)}`,
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
          },
        });
        if (!response.ok) {
          return record;
        }
        const payload = await response.json();
        return {
          ...record,
          ...(payload?.Data || {}),
        };
      }),
    );
    detailedRecords.push(...details);
    console.log(`[采集] 腾讯详情：${detailedRecords.length}/${candidates.length}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return detailedRecords;
}

function deduplicateAndRank(jobs) {
  const byId = new Map();
  for (const job of jobs) {
    if (!isUsableJob(job)) {
      continue;
    }
    const existing = byId.get(job.id);
    if (!existing || job.selection_score > existing.selection_score) {
      byId.set(job.id, job);
    }
  }

  return [...byId.values()].sort(
    (left, right) =>
      right.selection_score - left.selection_score ||
      String(right.refreshed_at || right.published_at).localeCompare(
        String(left.refreshed_at || left.published_at),
      ) ||
      left.id.localeCompare(right.id),
  );
}

function scaleQuotas(target) {
  const baseline = Object.values(DEFAULT_QUOTAS).reduce((sum, value) => sum + value, 0);
  const sources = Object.keys(DEFAULT_QUOTAS);
  const quotas = {};
  let assigned = 0;
  for (const source of sources) {
    quotas[source] = Math.floor((DEFAULT_QUOTAS[source] / baseline) * target);
    assigned += quotas[source];
  }
  for (let index = 0; assigned < target; index = (index + 1) % sources.length) {
    quotas[sources[index]] += 1;
    assigned += 1;
  }
  return quotas;
}

function selectByQuota(pools, target) {
  const quotas = scaleQuotas(target);
  const selected = [];
  const selectedIds = new Set();

  for (const [source, quota] of Object.entries(quotas)) {
    for (const job of pools[source].slice(0, quota)) {
      selected.push(job);
      selectedIds.add(job.id);
    }
  }

  if (selected.length < target) {
    const overflow = Object.values(pools)
      .flat()
      .filter((job) => !selectedIds.has(job.id))
      .sort(
        (left, right) =>
          right.selection_score - left.selection_score || left.id.localeCompare(right.id),
      );
    for (const job of overflow) {
      if (selected.length >= target) {
        break;
      }
      selected.push(job);
      selectedIds.add(job.id);
    }
  }

  if (selected.length < target) {
    const availability = Object.fromEntries(
      Object.entries(pools).map(([source, jobs]) => [source, jobs.length]),
    );
    throw new Error(
      `可用岗位不足：目标 ${target}，实际 ${selected.length}，来源候选 ${JSON.stringify(availability)}`,
    );
  }

  return selected
    .slice(0, target)
    .sort((left, right) => left.source.localeCompare(right.source) || left.id.localeCompare(right.id));
}

function escapeCsv(value) {
  const text =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, " \\n ")}"`;
}

function buildCsv(jobs) {
  const columns = [
    "id",
    "source",
    "source_name",
    "source_job_id",
    "source_url",
    "company_name",
    "title",
    "recruitment_type",
    "employment_type",
    "city",
    "department",
    "job_family",
    "responsibilities",
    "requirements",
    "preferred_qualifications",
    "skills",
    "education_requirement",
    "experience_requirement",
    "published_at",
    "refreshed_at",
    "expires_at",
    "collected_at",
    "last_verified_at",
    "status",
    "selection_score",
    "selection_reasons",
    "source_payload_hash",
    "retrieval_text",
  ];
  return [
    columns.join(","),
    ...jobs.map((job) => columns.map((column) => escapeCsv(job[column])).join(",")),
  ].join("\r\n");
}

function countBy(jobs, selector) {
  const counts = {};
  for (const job of jobs) {
    const key = selector(job) || "未标注";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}

function deterministicReviewSample(jobs, size = 30) {
  const bySource = {};
  for (const job of jobs) {
    bySource[job.source] ||= [];
    bySource[job.source].push(job);
  }
  const sourceNames = Object.keys(bySource);
  const perSource = Math.floor(size / sourceNames.length);
  const sample = [];

  for (const source of sourceNames) {
    const sourceJobs = bySource[source];
    const stride = Math.max(1, Math.floor(sourceJobs.length / perSource));
    for (let index = 0; index < sourceJobs.length && sample.length < size; index += stride) {
      if (sample.filter((job) => job.source === source).length >= perSource) {
        break;
      }
      sample.push(sourceJobs[index]);
    }
  }

  for (const job of jobs) {
    if (sample.length >= size) {
      break;
    }
    if (!sample.some((item) => item.id === job.id)) {
      sample.push(job);
    }
  }
  return sample;
}

function writeOutputs(outputDir, selected, rawBySource, collectedAt) {
  const rawDir = path.join(outputDir, "raw");
  fs.mkdirSync(rawDir, { recursive: true });

  const jsonl = selected.map((job) => JSON.stringify(job)).join("\n");
  fs.writeFileSync(path.join(outputDir, "jobs-500.jsonl"), `${jsonl}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "jobs-500.csv"), `\ufeff${buildCsv(selected)}`, "utf8");

  for (const [source, records] of Object.entries(rawBySource)) {
    fs.writeFileSync(
      path.join(rawDir, `${source}.json`),
      `${JSON.stringify(records, null, 2)}\n`,
      "utf8",
    );
  }

  const reviewSample = deterministicReviewSample(selected);
  const reviewColumns = [
    "id",
    "source_name",
    "title",
    "city",
    "source_url",
    "manual_review_status",
    "manual_review_note",
  ];
  const reviewRows = reviewSample.map((job) => ({
    ...job,
    manual_review_status: "待人工复核",
    manual_review_note: "",
  }));
  const reviewCsv = [
    reviewColumns.join(","),
    ...reviewRows.map((row) => reviewColumns.map((column) => escapeCsv(row[column])).join(",")),
  ].join("\r\n");
  fs.writeFileSync(
    path.join(outputDir, "manual-review-sample-30.csv"),
    `\ufeff${reviewCsv}`,
    "utf8",
  );

  const summary = {
    schema_version: SCHEMA_VERSION,
    dataset_name: "孔明职配官方岗位种子库 v1",
    total: selected.length,
    collected_at: collectedAt,
    sources: countBy(selected, (job) => job.source_name),
    recruitment_types: countBy(selected, (job) => job.recruitment_type),
    top_cities: Object.fromEntries(
      Object.entries(countBy(selected, (job) => job.city)).slice(0, 20),
    ),
    top_job_families: Object.fromEntries(
      Object.entries(countBy(selected, (job) => job.job_family)).slice(0, 20),
    ),
    official_hosts: OFFICIAL_HOSTS,
    usage_note:
      "仅用于孔明职配原型和内部检索验证。岗位版权归原招聘主体所有；上线前应定期重新核验状态，并遵守各招聘网站条款。",
  };
  fs.writeFileSync(
    path.join(outputDir, "jobs-500-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  const datasetCard = [
    "# 孔明职配官方岗位种子库 v1",
    "",
    `- 数据量：${selected.length} 条`,
    `- 采集时间：${collectedAt}`,
    `- 来源：${Object.entries(summary.sources)
      .map(([name, count]) => `${name} ${count} 条`)
      .join("、")}`,
    "- 来源范围：字节跳动、腾讯、美团官方招聘页面及其公开接口",
    "- 数据格式：JSONL（RAG 主格式）与 CSV（人工审阅格式）",
    "",
    "## 文件",
    "",
    "- `jobs-500.jsonl`：统一结构化岗位数据，每行一条记录。",
    "- `jobs-500.csv`：适合使用 Excel 或表格工具抽查。",
    "- `jobs-500-summary.json`：来源、城市、招聘类型和职类统计。",
    "- `manual-review-sample-30.csv`：30 条分层抽样人工复核清单。",
    "- `raw/`：本次选源阶段抓取的官方接口原始响应记录。",
    "",
    "## 质量边界",
    "",
    "本数据集保留官方岗位 ID、原始链接、采集/核验时间和原始内容哈希。",
    "学历、经验和技能字段仅从官方岗位文本中进行确定性提取；无法确认的字段保持为空。",
    "岗位具有时效性，进入生产环境前应增加定时刷新、失效检测和增量索引流程。",
    "",
    "## 使用范围",
    "",
    "仅用于孔明职配原型和内部 RAG 检索验证。岗位内容版权归原招聘主体所有，",
    "对外发布或商业使用前需要复核招聘网站条款、数据授权和内容更新机制。",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outputDir, "README.md"), datasetCard, "utf8");

  return summary;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const collectedAt = new Date().toISOString();
  const quotas = scaleQuotas(options.target);
  const candidateTargets = Object.fromEntries(
    Object.entries(quotas).map(([source, quota]) => [source, quota + Math.max(50, Math.ceil(quota * 0.25))]),
  );

  console.log(`[输出] ${options.outputDir}`);
  console.log(`[目标] ${options.target} 条岗位`);

  const browser = await chromium.launch({
    channel: "msedge",
    headless: !options.headed,
  });

  let byteDanceRaw;
  let meituanRaw;
  try {
    byteDanceRaw = await collectByteDance(browser, candidateTargets.bytedance);
    meituanRaw = await collectMeituan(browser, candidateTargets.meituan);
  } finally {
    await browser.close();
  }
  const tencentRaw = await collectTencent(candidateTargets.tencent);

  const pools = {
    bytedance: deduplicateAndRank(
      byteDanceRaw.map((record) => normalizeByteDance(record, collectedAt)),
    ),
    tencent: deduplicateAndRank(
      tencentRaw.map((record) => normalizeTencent(record, collectedAt)),
    ),
    meituan: deduplicateAndRank(
      meituanRaw.map((record) => normalizeMeituan(record, collectedAt)),
    ),
  };

  console.log(
    `[清洗] 可用候选：${Object.entries(pools)
      .map(([source, jobs]) => `${SOURCE_NAMES[source]} ${jobs.length}`)
      .join("、")}`,
  );

  const selected = selectByQuota(pools, options.target);
  const summary = writeOutputs(
    options.outputDir,
    selected,
    {
      bytedance: byteDanceRaw,
      tencent: tencentRaw,
      meituan: meituanRaw,
    },
    collectedAt,
  );

  console.log(`[完成] 已写入 ${summary.total} 条岗位`);
  console.log(`[来源] ${JSON.stringify(summary.sources)}`);
  console.log(`[主文件] ${path.join(options.outputDir, "jobs-500.jsonl")}`);
}

main().catch((error) => {
  console.error(`[失败] ${error.stack || error.message}`);
  process.exitCode = 1;
});
