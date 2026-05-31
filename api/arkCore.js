const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = "doubao-seed-2-0-lite-260215";

const compactJob = (job = {}) => ({
  title: job.title,
  track: job.track,
  city: job.city,
  level: job.level,
  summary: job.summary,
  responsibilities: job.responsibilities,
  requirements: job.requirements,
  bonus: job.bonus,
  keywords: job.keywords,
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
      `候选人回答：${body.interviewAnswer || ""}`,
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
    `简历文本：${body.resumeText || ""}`,
  ].join("\n\n");
};

const buildMessages = (body) => {
  if (body.task === "resume-vision") {
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
          {
            type: "image_url",
            image_url: {
              url: body.imageDataUrl,
            },
          },
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
  const model = body.model || process.env.ARK_MODEL_TEXT || DEFAULT_MODEL;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
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
        error: data?.error?.message || data?.message || "模型接口调用失败。",
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
