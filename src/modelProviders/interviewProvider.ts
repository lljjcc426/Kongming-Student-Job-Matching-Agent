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
    "请介绍一段最能体现你岗位匹配度的经历，并说明你的具体角色、行动和结果。",
    "你为什么想投递这个方向？请结合你的专业背景、经历和长期职业目标说明。",
    "如果入职后遇到信息不完整、目标不断变化的任务，你会如何推进？请给出一个真实例子。",
  ],
  技术面: [
    "请选一个你最熟悉的技术或项目，说明核心方案、关键难点、你的实现思路和最终结果。",
    "如果你负责把这个项目上线或交付给真实用户，你会重点关注哪些工程质量问题？",
    "请讲一次你定位并解决技术问题的过程，重点说明你如何排查、验证和复盘。",
  ],
  HR面: [
    "请说明你选择这个岗位方向的动机，以及它和你的专业背景、个人优势之间的关系。",
    "请讲一次你在团队合作中遇到分歧或压力的经历，你当时如何沟通和处理？",
    "你对未来一到三年的职业规划是什么？如果岗位内容和预期存在差异，你会如何调整？",
  ],
};

const interviewFocusOf = (type: InterviewType) => {
  if (type === "技术面") {
    return [
      "你现在处于技术面模式，必须显著区别于综合面和 HR 面。",
      "提问优先覆盖：技术基础、项目架构、实现细节、接口/数据/工具链、调试排障、性能或稳定性、工程交付。",
      "追问方式：要求学生解释为什么这样做、还有哪些替代方案、如何验证结果、遇到问题如何定位。",
      "避免：不要把重点放在求职动机、性格优势、泛泛的团队协作或职业规划上，除非这些内容与技术交付直接相关。",
    ].join("\n");
  }

  if (type === "HR面") {
    return [
      "你现在处于 HR 面模式，必须显著区别于综合面和技术面。",
      "提问优先覆盖：求职动机、岗位理解、稳定性、价值观匹配、沟通协作、压力应对、冲突处理、职业规划。",
      "追问方式：要求学生给出真实情境，观察表达是否真诚、逻辑是否一致、目标是否稳定、对岗位是否理解充分。",
      "避免：不要追问过深技术实现细节，不要把面试变成技术方案评审。",
    ].join("\n");
  }

  return [
    "你现在处于综合面模式，必须在岗位匹配和学生经历之间建立联系。",
    "提问优先覆盖：自我介绍、岗位动机、项目/实习/校园经历、能力迁移、学习能力、沟通协作、职业目标。",
    "追问方式：从学生回答中抽取一个最有价值的经历点继续追问，关注经历真实性、贡献度、结果和岗位适配。",
    "避免：不要像技术面一样长时间深挖代码细节，也不要像 HR 面一样只问价值观和稳定性。",
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
      improvements: Array.isArray(data.improvements) ? data.improvements.map(String).filter(Boolean).slice(0, 5) : ["补充更具体的项目背景、行动和结果。"],
      optimizedAnswer: typeof data.optimizedAnswer === "string" ? data.optimizedAnswer : "建议用 STAR 结构重写回答：背景、任务、行动、结果分别说明。",
      summary: typeof data.summary === "string" ? data.summary : "本轮面试回答具备基础信息，但仍需强化结构化表达和岗位相关证据。",
    };
  } catch {
    return {
      overallScore: 76,
      expression: 74,
      professionalFit: 76,
      logic: 75,
      improvements: ["回答中保留真实经历，同时补充任务目标、个人动作和量化结果。", "面向目标岗位补充关键词和岗位职责对应关系。"],
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
          `面试模式规则：\n${interviewFocusOf(input.interviewType)}`,
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
          "反馈必须体现当前面试类型的评价重点：综合面看岗位匹配与经历表达，技术面看技术理解与工程落地，HR 面看动机、稳定性与协作表达。",
          "JSON 结构：",
          '{"overallScore":80,"expression":80,"professionalFit":80,"logic":80,"improvements":[],"optimizedAnswer":"","summary":""}',
          "评分为 0-100；improvements 给 3-5 条具体改进点；optimizedAnswer 给一段可直接参考的优化回答。",
          `目标岗位：${input.jobTarget?.title || "目标岗位待确认"}`,
          `面试类型：${input.interviewType}`,
          `面试模式规则：\n${interviewFocusOf(input.interviewType)}`,
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
