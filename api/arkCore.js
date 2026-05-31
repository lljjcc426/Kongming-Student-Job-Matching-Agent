const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = "doubao-seed-2-0-lite-260215";
const ALLOWED_TASKS = new Set(["match-analysis", "resume-vision", "interview-feedback"]);
const MAX_RESUME_CHARS = 12000;
const MAX_INTERVIEW_CHARS = 4000;
const MAX_IMAGE_DATA_URL_CHARS = 4_500_000;
const MAX_IMAGE_COUNT = 2;
const REQUEST_TIMEOUT_MS = 30000;

const asText = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength);
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
        error: "当前运行环境未配置模型密钥，已保留本地规则分析结果。",
      },
    };
  }

  const baseUrl = process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.ARK_MODEL_TEXT || DEFAULT_MODEL;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(body),
      temperature: 0.25,
    }),
  });

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
