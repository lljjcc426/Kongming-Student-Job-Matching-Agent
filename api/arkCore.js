const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = "doubao-seed-2-0-lite-260215";
const ALLOWED_TASKS = new Set(["match-analysis", "resume-vision", "resume-structure", "job-recommendations", "jd-analysis", "interview-feedback", "career-chat"]);
const MAX_RESUME_CHARS = 12000;
const MAX_INTERVIEW_CHARS = 4000;
const MAX_CHAT_CHARS = 6000;
const MAX_IMAGE_DATA_URL_CHARS = 8_000_000;
const MAX_IMAGE_COUNT = 4;
const REQUEST_TIMEOUT_MS = 60000;
const SEARCH_TIMEOUT_MS = 5000;
const SEARCH_USER_AGENT = "Mozilla/5.0 (compatible; StudentJobMatcher/0.1)";

const asText = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength);
};

const asCount = (value, fallback = 6) => {
  const count = Number(value);
  if (!Number.isFinite(count)) return fallback;
  return Math.max(1, Math.min(6, Math.round(count)));
};

const validateRequest = (body) => {
  if (!body || typeof body !== "object") {
    return "请求内容格式不正确。";
  }

  if (!ALLOWED_TASKS.has(body.task)) {
    return "不支持的模型任务类型。";
  }

  if (body.task === "resume-vision") {
    const images = Array.isArray(body.imageDataUrls) ? body.imageDataUrls : [body.imageDataUrl];
    if (!images.length || images.length > MAX_IMAGE_COUNT) {
      return "图片数量不符合要求。";
    }
    if (images.some((image) => typeof image !== "string" || !image.startsWith("data:image/"))) {
      return "图片简历格式不正确。";
    }
    if (images.join("").length > MAX_IMAGE_DATA_URL_CHARS) {
      return "图片文件过大，请压缩后再上传。";
    }
  }

  return "";
};

const compactJob = (job = {}) => ({
  title: asText(job.title, 80),
  track: asText(job.track, 40),
  city: asText(job.city, 40),
  level: asText(job.level, 40),
  summary: asText(job.summary, 500),
  responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.slice(0, 8).map((item) => asText(item, 180)) : [],
  requirements: Array.isArray(job.requirements) ? job.requirements.slice(0, 8).map((item) => asText(item, 180)) : [],
  bonus: Array.isArray(job.bonus) ? job.bonus.slice(0, 8).map((item) => asText(item, 180)) : [],
  keywords: Array.isArray(job.keywords) ? job.keywords.slice(0, 20).map((item) => asText(item, 40)) : [],
});

const buildTextPrompt = (body) => {
  const job = compactJob(body.selectedJob);
  const match = body.matchResult
    ? {
        total: body.matchResult.total,
        verdict: body.matchResult.verdict,
        strengths: body.matchResult.strengths,
        risks: body.matchResult.risks,
        missingKeywords: body.matchResult.missingKeywords,
      }
    : null;

  if (body.task === "interview-feedback") {
    return [
      "你是一个面向学生求职准备的模拟面试评估智能体。",
      "请基于目标岗位和候选人的回答，输出结构化、克制、可执行的反馈。",
      "输出包含：总体评分、回答亮点、主要风险、下一轮改进建议。",
      `目标岗位：${JSON.stringify(job, null, 2)}`,
      `候选人回答：${asText(body.interviewAnswer, MAX_INTERVIEW_CHARS)}`,
    ].join("\n\n");
  }

  if (body.task === "career-chat") {
    const messages = Array.isArray(body.chatMessages) ? body.chatMessages.slice(-10) : [];
    const safeMessages = messages
      .map((message) => ({
        role: message?.role === "assistant" ? "assistant" : "user",
        content: asText(message?.content, 900),
      }))
      .filter((message) => message.content.trim());
    return [
      "你是学生求职 AI 助手。请直接回答学生的问题，也可以根据对话主动帮助学生澄清目标岗位、拆解准备路径、优化简历表达、准备面试、比较岗位方向或制定行动计划。",
      "不要使用预设问答，不要把学生限制在固定场景；根据学生本轮输入自由判断需要回应的内容。",
      "如果问题信息不足，可以先给出可执行的下一步，并用一两个问题帮助学生补充关键信息。",
      "回答应专业、克制、具体，不承诺录用结果，不编造学校、企业、岗位或政策事实。",
      `当前简历文本：${asText(body.resumeText, MAX_RESUME_CHARS)}`,
      `当前结构化画像：${JSON.stringify(body.resumeProfile || {}, null, 2)}`,
      `当前选中岗位：${JSON.stringify(job, null, 2)}`,
      `当前匹配结果：${JSON.stringify(match, null, 2)}`,
      `历史对话：${JSON.stringify(safeMessages, null, 2)}`,
      `学生本轮输入：${asText(body.userMessage, MAX_CHAT_CHARS)}`,
    ].join("\n\n");
  }

  if (body.task === "resume-structure") {
    return [
      "你是简历结构化解析智能体。请只基于用户上传的简历文本提取事实，不要编造、补全或润色不存在的信息。",
      "即使简历文本较短，也必须提取其中明确出现的信息；不要因为内容不完整就返回全空结构。",
      "如果文本包含“未识别”“看不清”“无法确认”等不确定信息，对应字段保持空数组或空字符串，不要自行猜测。",
      "请输出严格 JSON，不要输出 Markdown，不要解释。",
      "JSON 结构如下：",
      '{"name":"","education":[],"internships":[],"projects":[],"campus":[],"honors":[],"skills":[],"targetRoles":[],"summary":""}',
      "字段要求：",
      "1. name 提取学生姓名；没有明确姓名时填空字符串，不要写候选人。",
      "2. education/internships/projects/campus/honors 每项为字符串数组。",
      "3. targetRoles 只读取简历中明确写出的求职意向、目标岗位、应聘方向；没有明确内容就返回空数组，不要推断。",
      "4. skills 只提取简历中明确出现的能力、工具、语言、证书或方法。",
      "5. summary 只能概括已出现的事实，不要添加评价性或想象性的经历。",
      "6. 如果文本中出现学校、专业、学历、项目、求职意向等字样，应放入对应字段。",
      `简历文本：${asText(body.resumeText, MAX_RESUME_CHARS)}`,
    ].join("\n\n");
  }

  if (body.task === "job-recommendations") {
    const jobCount = asCount(body.jobCount);
    const focus = asText(body.agentFocus, 120) || "综合匹配";
    return [
      `你是学生求职岗位匹配智能体，当前子任务方向：${focus}。请根据简历和学生意愿生成适合投递或准备的岗位方向。`,
      "必须覆盖学生简历中的专业背景、技能、经历和求职意愿；如果简历里写了目标岗位，以学生意愿为最高优先级。",
      "不要套用固定岗位模板，不要局限于互联网通用岗位。心理学、艺术类、新闻传播、法学、财务、医学、教育等专业都要给出相应岗位。",
      "请输出严格 JSON 数组，不要输出 Markdown，不要解释。数组每项结构如下：",
      '{"id":"","title":"","track":"","city":"","level":"","companyScenario":"","summary":"","responsibilities":[],"requirements":[],"bonus":[],"keywords":[],"priority":"高"}',
      "要求：",
      `1. 返回 ${jobCount} 个岗位。`,
      "2. id 使用英文短横线小写。",
      "3. priority 只能是 高、中、低。",
      "4. responsibilities、requirements、bonus、keywords 每项 3-5 条。",
      "5. city 不确定可写 不限。",
      "6. 每个文本字段保持简洁，避免长段解释。",
      "7. keywords 必须是拆开的短关键词数组，不要把多个关键词合并在一个字符串里。",
      "8. 不要返回完全相同的岗位标题；实习岗位和正式岗位可以分别保留。",
      "9. 不要输出企业名单或招聘链接；企业入口由后续搜索智能体根据岗位标题、方向和关键词实时检索。",
      "10. companyScenario 只描述岗位常见组织场景，不要写具体企业名，不要默认推荐单一行业企业。",
      `简历结构：${JSON.stringify(body.resumeProfile || {}, null, 2)}`,
      `简历文本：${asText(body.resumeText, MAX_RESUME_CHARS)}`,
      `目标 JD：${asText(body.jdText, 5000)}`,
    ].join("\n\n");
  }

  if (body.task === "jd-analysis") {
    return [
      "你是目标岗位 JD 分析智能体。请结合学生简历、岗位名称和岗位 JD，评估该岗位对学生的投递优先级，并抽取可用于匹配的结构化岗位信息。",
      "请输出严格 JSON，不要输出 Markdown，不要解释。结构如下：",
      '{"title":"","priority":"中","track":"","city":"","level":"","summary":"","conclusion":"","strengths":[],"risks":[],"actions":[],"keywords":[],"responsibilities":[],"requirements":[],"bonus":[]}',
      "字段要求：",
      "1. priority 只能是 高、中、低，必须结合学生简历和 JD 评估，不要默认高。",
      "2. title 优先使用用户填写的岗位名称；没有填写时从 JD 或岗位描述中识别。",
      "3. keywords 必须是拆开的短关键词数组。",
      "4. strengths、risks、actions 各 2-4 条，具体、可执行。",
      "5. responsibilities、requirements、bonus 各 2-5 条。",
      "6. 不要输出企业名单或招聘链接；企业入口由后续搜索智能体根据岗位标题、方向和关键词实时检索。",
      "7. companyScenario 只描述岗位常见组织场景，不要写具体企业名，不要默认推荐单一行业企业。",
      `岗位名称：${asText(body.jobTitle, 120)}`,
      `岗位 JD：${asText(body.jdText, 5000)}`,
      `简历结构：${JSON.stringify(body.resumeProfile || {}, null, 2)}`,
      `简历文本：${asText(body.resumeText, MAX_RESUME_CHARS)}`,
    ].join("\n\n");
  }

  return [
    "你是一个学生求职匹配智能体中的协作监督智能体。",
    "请基于简历文本、目标岗位和本地规则评分，给出更接近真实投递场景的二次分析。",
    "输出要求：",
    "1. 先给一句明确结论。",
    "2. 列出3条匹配证据。",
    "3. 列出3条简历优化动作。",
    "4. 列出2个模拟面试追问。",
    "5. 不承诺真实筛选结果，不使用夸张或不专业表达。",
    `目标岗位：${JSON.stringify(job, null, 2)}`,
    `本地规则评分：${JSON.stringify(match, null, 2)}`,
    `简历文本：${asText(body.resumeText, MAX_RESUME_CHARS)}`,
  ].join("\n\n");
};

const buildMessages = (body) => {
  if (body.task === "resume-vision") {
    const images = Array.isArray(body.imageDataUrls) ? body.imageDataUrls : [body.imageDataUrl];
    const extractedText = asText(body.resumeText, MAX_RESUME_CHARS);
    return [
      {
        role: "system",
        content: [
          "你是简历信息识别智能体，只负责从用户上传的简历图片/PDF 页面中做事实提取。",
          "禁止补全、推测、润色或编造图片里看不到的信息；看不清或未出现的信息必须写“未识别”。",
          "如果同一信息在图片和已提取文本中冲突，以图片中清晰可见的信息为准，并保留不确定标记。",
          "输出中文纯文本，按姓名、教育背景、实习经历、项目经历、校园经历、荣誉证书、技能、求职方向、其他信息分段。",
          "不要添加简历中不存在的学校、公司、岗位、项目、技能、奖项或时间。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `请逐页识别这份简历。共有 ${images.length} 张页面图片。`,
              "必须尽量完整覆盖每一页，尤其不要漏掉第二页及后续页面的项目、证书、经历和技能。",
              "只提取画面中真实存在的文字和可明确理解的信息；不要根据专业或岗位常识补写不存在内容。",
              "姓名如果清晰出现就提取真实姓名；如果未出现或看不清，写“未识别”，不要写“候选人”。",
              extractedText ? `PDF 文本层初步提取如下，仅作为交叉校验，不可替代图片识别：\n${extractedText}` : "",
            ].filter(Boolean).join("\n\n"),
          },
          ...images.map((imageDataUrl) => ({
            type: "image_url",
            image_url: {
              url: imageDataUrl,
              detail: "high",
              image_pixel_limit: {
                max_pixels: 3014080,
                min_pixels: 3136,
              },
            },
          })),
        ],
      },
    ];
  }

  return [
    {
      role: "system",
      content: "你是专业、审慎的学生求职匹配智能体。所有建议都要具体、可执行，并避免不确定承诺。",
    },
    {
      role: "user",
      content: buildTextPrompt(body),
    },
  ];
};

const extractJsonContent = (content) => {
  const trimmed = String(content || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstArray = trimmed.indexOf("[");
  const firstObject = trimmed.indexOf("{");
  const startsWithArray = firstArray !== -1 && (firstObject === -1 || firstArray < firstObject);
  const start = startsWithArray ? firstArray : firstObject;
  const end = startsWithArray ? trimmed.lastIndexOf("]") : trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
};

const normalizeApplicationLinks = (links) => {
  if (!Array.isArray(links)) return [];
  const used = new Set();
  return links
    .map((item) => ({
      company: typeof item?.company === "string" ? item.company.trim() : "",
      url: typeof item?.url === "string" ? item.url.trim() : "",
      note: typeof item?.note === "string" ? item.note.trim() : "招聘入口",
    }))
    .filter((item) => item.company && /^https?:\/\//i.test(item.url))
    .filter((item) => {
      const key = `${item.company}-${item.url}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 4);
};

const stripHtml = (value) => String(value || "")
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();

const decodeBingUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const redirect = parsed.searchParams.get("u") || parsed.searchParams.get("url");
    if (redirect?.startsWith("http")) return redirect;
  } catch {
    // Keep direct URLs below.
  }
  return value.startsWith("http") ? value : "";
};

const companyNameFromSearchResult = (title, url) => {
  const cleanTitle = stripHtml(title)
    .replace(/[-_丨|].*$/g, "")
    .replace(/招聘.*$/g, "")
    .replace(/校园.*$/g, "")
    .replace(/职位.*$/g, "")
    .replace(/人才.*$/g, "")
    .trim();
  if (cleanTitle && cleanTitle.length <= 18) return cleanTitle;

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] || host;
  } catch {
    return "";
  }
};

const hasRecruitingSignal = (title, url, block) => {
  const text = `${stripHtml(title)} ${url} ${stripHtml(block)}`.toLowerCase();
  return /招聘|职位|岗位|人才|应聘|招考|career|careers|job|jobs|recruit|recruitment|join|campus|zhaopin/.test(text);
};

const buildRecruitingSearchQuery = (job = {}) => {
  const parts = [
    asText(job.title, 40),
    asText(job.track, 30),
    ...(Array.isArray(job.keywords) ? job.keywords.slice(0, 4).map((item) => asText(item, 24)) : []),
    "招聘",
    "实习",
    "应届",
  ];
  return [...new Set(parts.map((item) => item.trim()).filter(Boolean))].join(" ");
};

const searchRecruitingLinks = async (job) => {
  const query = buildRecruitingSearchQuery(job);
  if (!query) return [];

  let html = "";
  try {
    const response = await fetch(`https://cn.bing.com/search?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": SEARCH_USER_AGENT },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    html = await response.text();
  } catch {
    return [];
  }

  const links = [];
  const used = new Set();
  const resultPattern = /<li class="b_algo"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/gi;
  let match;
  while ((match = resultPattern.exec(html)) && links.length < 4) {
    const block = match[0];
    const url = decodeBingUrl(match[1]);
    if (!/^https?:\/\//i.test(url) || used.has(url)) continue;
    if (!hasRecruitingSignal(match[2], url, block)) continue;
    const company = companyNameFromSearchResult(match[2], url);
    if (!company) continue;
    used.add(url);
    links.push({ company, url, note: "公开招聘搜索结果" });
  }

  return links;
};

const isReachableRecruitingUrl = async (url) => {
  const probe = async (method) => {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
      headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
    });
    return response.status >= 200 && response.status < 500 && response.status !== 404 && response.status !== 410;
  };

  try {
    if (await probe("HEAD")) return true;
  } catch {
    // Some recruiting sites block HEAD; retry with a tiny GET request.
  }

  try {
    return await probe("GET");
  } catch {
    return false;
  }
};

const attachRecruitingLinks = async (content, task) => {
  if (task !== "job-recommendations" && task !== "jd-analysis") return content;

  let parsed;
  try {
    parsed = JSON.parse(extractJsonContent(content));
  } catch {
    return content;
  }

  const jobs = Array.isArray(parsed) ? parsed : [parsed];
  const searchedLinks = await Promise.all(jobs.map((job) => searchRecruitingLinks(job)));
  jobs.forEach((job, index) => {
    if (job && typeof job === "object") {
      job.applicationLinks = searchedLinks[index];
    }
  });

  const uniqueUrls = [...new Set(jobs.flatMap((job) => normalizeApplicationLinks(job?.applicationLinks).map((link) => link.url)))];
  const reachablePairs = await Promise.all(uniqueUrls.map(async (url) => [url, await isReachableRecruitingUrl(url)]));
  const reachableUrls = new Set(reachablePairs.filter(([, ok]) => ok).map(([url]) => url));

  jobs.forEach((job) => {
    if (job && typeof job === "object") {
      job.applicationLinks = normalizeApplicationLinks(job.applicationLinks).filter((link) => reachableUrls.has(link.url));
    }
  });

  return JSON.stringify(Array.isArray(parsed) ? jobs : jobs[0], null, 2);
};

export async function runArkCompletion(body) {
  const validationError = validateRequest(body);
  if (validationError) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: validationError,
      },
    };
  }

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return {
      status: 503,
      payload: {
        ok: false,
        error: "当前运行环境未配置 ARK_API_KEY，模型能力不可用。请配置环境变量并重启服务。",
      },
    };
  }

  const baseUrl = process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
  const model = DEFAULT_MODEL;
  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(body),
        temperature: 0.25,
        thinking: {
          type: "disabled",
        },
        max_completion_tokens: body.task === "job-recommendations" ? Math.max(700, asCount(body.jobCount) * 420) : body.task === "jd-analysis" ? 1400 : body.task === "career-chat" ? 1600 : body.task === "resume-vision" ? 2200 : 1200,
      }),
    });
  } catch (error) {
    return {
      status: 504,
      payload: {
        ok: false,
        error: error instanceof Error && error.name === "TimeoutError" ? "模型接口响应超时，请稍后重试或上传更清晰、更小的文件。" : "模型接口网络连接失败，请检查本机网络或服务配置。",
      },
    };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      status: response.status,
      payload: {
        ok: false,
        error: "模型接口调用失败，请稍后重试。",
      },
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      model,
      content: await attachRecruitingLinks(data?.choices?.[0]?.message?.content || "", body.task),
    },
  };
}
