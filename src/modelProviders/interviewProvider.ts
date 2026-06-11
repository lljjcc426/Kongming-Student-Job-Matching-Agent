import type { Job } from "../data";
import { callArkAgent } from "../arkClient";
import type { InterviewFeedbackReport, InterviewMessage, InterviewTurn, InterviewType } from "../types/interview";

export type InterviewModelInput = {
  messages: InterviewMessage[];
  turns: InterviewTurn[];
  jobTarget?: Job;
  interviewType: InterviewType;
  resumeSummary?: string;
  currentRound: number;
};

export interface InterviewModelProvider {
  generateInterviewReply(input: InterviewModelInput): Promise<string>;
  generateFeedback(input: InterviewModelInput): Promise<InterviewFeedbackReport>;
}

const fallbackQuestionsByType: Record<InterviewType, string[]> = {
  综合面: [
    "请从你的简历中选择一段最能支撑目标岗位匹配度的经历，说明背景、你的职责、关键行动和结果。",
    "你认为自己和这个岗位最匹配的三点是什么？请分别用简历中的事实来证明。",
    "如果入职后需要快速熟悉一个陌生业务并交付结果，你会如何安排前两周？",
  ],
  技术面: [
    "请选一个你最熟悉的技术或项目，说明核心方案、关键难点、你的实现思路和最终结果。",
    "如果你负责把这个项目上线或交付给真实用户，你会重点关注哪些工程质量问题？",
    "请讲一次你定位并解决技术问题的过程，重点说明你如何排查、验证和复盘。",
  ],
  HR面: [
    "你为什么选择这个岗位方向？请结合个人动机、长期规划和你对岗位的理解回答。",
    "请讲一次你在团队协作中遇到分歧、压力或不确定性的经历，你当时如何处理？",
    "如果实际工作内容和你入职前的预期存在差异，你会如何判断、沟通和调整？",
  ],
};

const interviewRulesOf = (type: InterviewType) => {
  if (type === "技术面") {
    return [
      "当前模式：技术面。必须明显区别于综合面和 HR 面。",
      "核心目标：验证学生是否真的理解技术/专业内容，是否具备工程落地、问题定位和方案表达能力。",
      "优先追问：技术选型依据、方案结构、数据/接口/工具链、调试排障、性能或稳定性、边界条件、上线交付、复盘改进。",
      "追问风格：要求学生讲清楚“为什么这样做、还有什么替代方案、如何验证有效、遇到异常如何定位”。",
      "禁止偏移：不要长时间问求职动机、价值观、稳定性、泛泛团队协作；除非学生回答与技术交付直接相关。",
    ].join("\n");
  }

  if (type === "HR面") {
    return [
      "当前模式：HR 面。必须明显区别于综合面，不能只问岗位匹配和经历贡献。",
      "核心目标：判断学生的求职动机是否真实、岗位认知是否充分、职业目标是否稳定、沟通协作和压力应对是否成熟。",
      "优先追问：为什么选择该岗位/行业、为什么选择当前城市或组织类型、职业规划、稳定性、价值观匹配、冲突处理、压力应对、失败复盘、团队协作、期望管理。",
      "追问风格：围绕真实情境观察一致性和成熟度；可以追问“当时怎么沟通、你怎么看待对方立场、如果重来会怎么做”。",
      "禁止偏移：不要深挖代码实现、技术细节或项目架构；不要把 HR 面变成技术评审，也不要只重复综合面的岗位匹配问题。",
    ].join("\n");
  }

  return [
    "当前模式：综合面。必须明显区别于 HR 面：不是单纯考察性格、价值观和稳定性，而是围绕目标岗位做整体适配判断。",
    "核心目标：验证学生的简历经历是否真实、能力能否迁移到目标岗位、岗位动机是否与经历形成闭环。",
    "优先追问：自我介绍、目标岗位理解、简历中的项目/实习/校园经历、个人贡献、结果证据、能力迁移、学习能力、岗位适配短板。",
    "追问风格：从学生回答中抽取一个经历证据继续追问，要求说明“做了什么、为什么做、结果如何、和岗位有什么关系”。",
    "禁止偏移：不要像技术面一样连续深挖底层实现；也不要像 HR 面一样集中问稳定性、价值观、压力承受或薪酬期待。",
  ].join("\n");
};

const extractJson = (content: string) => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  return start >= 0 && end > start ? source.slice(start, end + 1) : source;
};

const clampScore = (value: unknown, fallback: number) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const parseFeedback = (content: string): InterviewFeedbackReport => {
  try {
    const data = JSON.parse(extractJson(content)) as Partial<InterviewFeedbackReport>;
    return {
      overallScore: clampScore(data.overallScore, 78),
      expression: clampScore(data.expression, 76),
      professionalFit: clampScore(data.professionalFit, 78),
      logic: clampScore(data.logic, 75),
      improvements: Array.isArray(data.improvements) ? data.improvements.map(String).filter(Boolean).slice(0, 5) : ["补充更具体的背景、行动和结果。"],
      optimizedAnswer: typeof data.optimizedAnswer === "string" ? data.optimizedAnswer : "建议用 STAR 结构重写回答：背景、任务、行动、结果分别说明。",
      summary: typeof data.summary === "string" ? data.summary : "回答具备基础信息，但仍需强化结构化表达和岗位相关证据。",
    };
  } catch {
    return {
      overallScore: 76,
      expression: 74,
      professionalFit: 76,
      logic: 75,
      improvements: ["保留真实经历，同时补充任务目标、个人动作和量化结果。", "面向目标岗位补充关键词和岗位职责对应关系。"],
      optimizedAnswer: "建议用“我负责什么、怎么推进、结果如何、复盘学到什么”的结构重新组织回答。",
      summary: content || "已生成反馈，但结构化解析不完整。",
    };
  }
};

export class DoubaoInterviewProvider implements InterviewModelProvider {
  async generateInterviewReply(input: InterviewModelInput) {
    const latestStudent = [...input.messages].reverse().find((message) => message.role === "student")?.content;
    if (!latestStudent && input.currentRound <= 1) {
      return fallbackQuestionsByType[input.interviewType][0];
    }

    const response = await callArkAgent(
      {
        task: "career-chat",
        userMessage: [
          "你是一名专业、克制、真实的 AI 面试官。请只输出面试官下一句话。",
          "每次只问一个问题；学生回答后优先基于回答内容追问，不要生硬跳题。",
          "如果回答过短，要求学生举例说明；如果回答有漏洞，温和指出并追问。",
          "三种面试模式必须有明显差异，不能用同一套通用问题套用所有模式。",
          `目标岗位：${input.jobTarget?.title || "目标岗位待确认"}`,
          `岗位方向：${input.jobTarget?.track || "综合能力"}`,
          `面试类型：${input.interviewType}`,
          `面试模式规则：\n${interviewRulesOf(input.interviewType)}`,
          `当前轮次：${input.currentRound}`,
          `简历摘要：${input.resumeSummary || "暂无结构化摘要，请围绕通用项目经历和职业动机提问。"}`,
          `历史对话：${JSON.stringify(input.messages.slice(-10), null, 2)}`,
          "输出要求：不要使用 Markdown，不要输出多段报告，不要一次问多个问题；问题长度控制在 1-2 句话。",
        ].join("\n\n"),
        chatMessages: input.messages.map((message) => ({
          role: message.role === "student" ? "user" : "assistant",
          content: message.content,
        })),
      },
      { timeoutMs: 45000 },
    );

    if (!response.ok || !response.content) {
      const fallbacks = fallbackQuestionsByType[input.interviewType];
      return fallbacks[Math.min(input.currentRound - 1, fallbacks.length - 1)];
    }
    return response.content.trim();
  }

  async generateFeedback(input: InterviewModelInput) {
    const response = await callArkAgent(
      {
        task: "career-chat",
        userMessage: [
          "你是模拟面试反馈智能体。请基于面试对话生成严格 JSON，不要输出 Markdown。",
          "反馈必须体现当前面试类型：综合面评价岗位适配、经历证据和能力迁移；技术面评价技术理解、方案表达和工程落地；HR 面评价动机稳定性、协作沟通、压力应对和职业规划。",
          "JSON 结构：",
          '{"overallScore":80,"expression":80,"professionalFit":80,"logic":80,"improvements":[],"optimizedAnswer":"","summary":""}',
          "评分为 0-100；improvements 给 3-5 条具体改进点；optimizedAnswer 给一段可直接参考的优化回答。",
          `目标岗位：${input.jobTarget?.title || "目标岗位待确认"}`,
          `面试类型：${input.interviewType}`,
          `面试模式规则：\n${interviewRulesOf(input.interviewType)}`,
          `简历摘要：${input.resumeSummary || "暂无"}`,
          `面试记录：${JSON.stringify(input.turns, null, 2)}`,
        ].join("\n\n"),
      },
      { timeoutMs: 45000 },
    );

    return parseFeedback(response.content || response.error || "");
  }
}

export const getInterviewModelProvider = (): InterviewModelProvider => new DoubaoInterviewProvider();
