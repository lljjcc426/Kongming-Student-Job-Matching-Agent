const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = "doubao-seed-2-0-lite-260215";
const ALLOWED_TASKS = new Set(["match-analysis", "resume-vision", "resume-structure", "job-recommendations", "interview-feedback"]);
const MAX_RESUME_CHARS = 12000;
const MAX_INTERVIEW_CHARS = 4000;
const MAX_IMAGE_DATA_URL_CHARS = 4_500_000;
const MAX_IMAGE_COUNT = 2;
const REQUEST_TIMEOUT_MS = 60000;

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

  if (body.task === "resume-structure") {
    return [
      "你是简历结构化解析智能体。请只基于用户上传的简历文本提取事实，不要编造。",
      "即使简历文本较短，也必须提取其中明确出现的信息；不要因为内容不完整就返回全空结构。",
      "请输出严格 JSON，不要输出 Markdown，不要解释。",
      "JSON 结构如下：",
      '{"name":"","education":[],"internships":[],"projects":[],"campus":[],"honors":[],"skills":[],"targetRoles":[],"summary":""}',
      "字段要求：",
      "1. name 提取学生姓名；没有明确姓名时填空字符串，不要写候选人。",
      "2. education/internships/projects/campus/honors 每项为字符串数组。",
      "3. targetRoles 优先读取求职意向、目标岗位、应聘方向；没有就根据简历谨慎推断 1-3 个方向。",
      "4. skills 只提取简历中明确出现的能力、工具、语言、证书或方法。",
      "5. 如果文本中出现学校、专业、学历、项目、求职意向等字样，应放入对应字段。",
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
      `简历结构：${JSON.stringify(body.resumeProfile || {}, null, 2)}`,
      `简历文本：${asText(body.resumeText, MAX_RESUME_CHARS)}`,
      `目标 JD：${asText(body.jdText, 5000)}`,
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
    return [
      {
        role: "system",
        content: "你是简历信息识别智能体。请从图片中提取简历信息，并整理成可用于求职匹配的中文纯文本。",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请识别这份简历图片，保留姓名可写为候选人，重点提取教育背景、项目经历、实习经历、技能、求职方向和可量化成果。",
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
        max_completion_tokens: body.task === "job-recommendations" ? Math.max(700, asCount(body.jobCount) * 420) : 1200,
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
      content: data?.choices?.[0]?.message?.content || "",
    },
  };
}
