import type { Job } from "../data";
import { callArkAgent } from "../arkClient";
import { planNextInterviewQuestion } from "../features/interview/followUpController";
import { selectInterviewKnowledge } from "../features/interview/interviewContext";
import { getCompetencyModel } from "../features/interview/competencyModels";
import {
  analyzeInterviewEvidence,
  buildInterviewFeedbackReport,
  parseInterviewNarrative,
} from "../features/interview/reportEngine";
import type { InterviewCompletionReason, InterviewFeedbackReport, InterviewGroundingContext, InterviewMessage, InterviewReply, InterviewReportKind, InterviewTurn, InterviewType } from "../types/interview";

export { analyzeInterviewEvidence } from "../features/interview/reportEngine";

export type InterviewModelInput = {
  messages: InterviewMessage[];
  turns: InterviewTurn[];
  jobTarget: Job;
  interviewType: InterviewType;
  resumeSummary?: string;
  currentRound: number;
  grounding?: InterviewGroundingContext;
  reportKind?: InterviewReportKind;
  completionReason?: InterviewCompletionReason;
  elapsedSeconds?: number;
};

export interface InterviewModelProvider {
  generateInterviewReply(input: InterviewModelInput): Promise<InterviewReply>;
  generateFeedback(input: InterviewModelInput): Promise<InterviewFeedbackReport>;
}

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

const groundedQuestionSeed = (
  seed: string,
  dimensionName: string,
  sources: InterviewGroundingContext["knowledgeSources"],
  grounding?: InterviewGroundingContext,
) => {
  const priorWeakness = grounding?.memoryReferences
    .flatMap((reference) => reference.weakDimensions)
    .find((dimension) => dimension.name === dimensionName);
  const requirement = sources.flatMap((source) => source.requirements)[0];
  const context = [
    priorWeakness ? `你上次在“${dimensionName}”维度的有效证据仍不充分，本轮请换一个更具体的案例重新验证。` : "",
    requirement ? `同类岗位样本强调“${requirement}”。` : "",
  ].filter(Boolean).join("");
  return `${context}${seed}`;
};

const normalizeInterviewReply = (content: string, input: InterviewModelInput, fallback: string) => {
  const clean = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();

  if (!clean) return fallback;

  const looksLikeFeedback = /本次.*(面试)?(结束|完成)|总体评分|综合评分|评分[:：]|改进建议|面试反馈|总结如下|overallScore/i.test(clean);
  if (looksLikeFeedback) {
    return fallback;
  }

  const firstLine = clean.split(/\n+/).map((line) => line.trim()).find(Boolean) || clean;
  return firstLine.length > 180 ? `${firstLine.slice(0, 180)}？` : firstLine;
};

export const parseInterviewFeedback = (
  content: string,
  turns: InterviewTurn[],
  job: Job,
  interviewType: InterviewType = "综合面",
  grounding?: InterviewGroundingContext,
  reportKind?: InterviewReportKind,
  completionReason?: InterviewCompletionReason,
  elapsedSeconds?: number,
  resumeSummary?: string,
): InterviewFeedbackReport => buildInterviewFeedbackReport({
  job,
  turns,
  interviewType,
  narrative: parseInterviewNarrative(content),
  grounding,
  reportKind,
  completionReason,
  elapsedSeconds,
  resumeSummary,
});

export class DoubaoInterviewProvider implements InterviewModelProvider {
  async generateInterviewReply(input: InterviewModelInput) {
    const baseDecision = planNextInterviewQuestion({
      job: input.jobTarget,
      turns: input.turns,
      interviewType: input.interviewType,
      resumeSummary: input.resumeSummary,
    });
    const model = getCompetencyModel(input.jobTarget);
    const targetDimension = model.dimensions.find((item) => item.id === baseDecision.targetCompetencyId);
    const selectedSources = input.grounding && targetDimension
      ? selectInterviewKnowledge(
        input.grounding,
        [targetDimension.name, ...targetDimension.positiveSignals, ...input.jobTarget.keywords],
        3,
      )
      : [];
    const memoryReferences = input.grounding?.memoryReferences.slice(0, 2) ?? [];
    const decision = {
      ...baseDecision,
      groundingTrace: {
        knowledgeSourceIds: selectedSources.map((item) => item.id),
        memoryReferenceIds: memoryReferences.map((item) => item.id),
        userNoteCount: input.grounding?.userNotes.length ?? 0,
      },
    };
    const fallbackQuestion = groundedQuestionSeed(
      decision.questionSeed,
      decision.targetCompetencyName,
      selectedSources,
      input.grounding,
    );
    const latestStudent = [...input.messages].reverse().find((message) => message.role === "student")?.content;
    if (decision.integrityRisk) {
      return { question: fallbackQuestion, decision };
    }
    if (!latestStudent && input.currentRound <= 1 && !selectedSources.length && !memoryReferences.length) {
      return { question: fallbackQuestion, decision };
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
          `岗位胜任力模型：${decision.modelName}`,
          `本轮考察维度：${decision.targetCompetencyName}`,
          `追问策略：${decision.strategy}`,
          `决策理由：${decision.rationale}`,
          `必须保持的问题核心：${decision.questionSeed}`,
          `上一回答结构化评估：${JSON.stringify(decision.previousAssessment, null, 2)}`,
          `一致性核验信号：${JSON.stringify(decision.integrityRisk, null, 2)}`,
          "如存在一致性核验信号，必须围绕该信号核对事实口径；使用中性措辞，不得直接指责候选人撒谎。",
          `六维考察进度：${JSON.stringify(decision.progress, null, 2)}`,
          `本轮RAG岗位依据（只能基于这些内容，不得编造）：${JSON.stringify(selectedSources, null, 2)}`,
          `相关历史面试记忆（用于复测短板，不得当作候选人本轮已证明的能力）：${JSON.stringify(memoryReferences, null, 2)}`,
          `用户长期偏好与纠正（只用于尊重偏好，不得直接计分）：${JSON.stringify(input.grounding?.userNotes ?? [], null, 2)}`,
          "接地规则：问题要体现岗位依据或历史复测目标，但不要向候选人朗读检索分数、内部记忆ID和数据库字段；历史结论必须通过本轮回答重新验证。",
          `当前轮次：${input.currentRound}`,
          `简历摘要：${input.resumeSummary || "暂无结构化摘要，请围绕通用项目经历和职业动机提问。"}`,
          `历史对话：${JSON.stringify(input.messages.slice(-10), null, 2)}`,
          "输出要求：用自然、尊重而专业的口吻承接上一回答；不要泄露分数或内部策略；不要使用 Markdown，不要输出多段报告，不要一次问多个问题；问题长度控制在 1-2 句话。",
        ].join("\n\n"),
        chatMessages: input.messages.map((message) => ({
          role: message.role === "student" ? "user" : "assistant",
          content: message.content,
        })),
      },
      { timeoutMs: 45000 },
    );

    if (!response.ok || !response.content) {
      return { question: fallbackQuestion, decision };
    }
    return {
      question: normalizeInterviewReply(response.content, input, fallbackQuestion),
      decision,
    };
  }

  async generateFeedback(input: InterviewModelInput) {
    const evidenceQuality = analyzeInterviewEvidence(input.turns);
    const evidenceReport = buildInterviewFeedbackReport({
      job: input.jobTarget,
      turns: input.turns,
      interviewType: input.interviewType,
      grounding: input.grounding,
      reportKind: input.reportKind,
      completionReason: input.completionReason,
      elapsedSeconds: input.elapsedSeconds,
      resumeSummary: input.resumeSummary,
    });
    if (evidenceQuality.scoreCap <= 22) return evidenceReport;

    const response = await callArkAgent(
      {
        task: "career-chat",
        userMessage: [
          "你是模拟面试报告的叙事分析智能体。系统已完成确定性证据评分，你只负责根据证据生成总结和改进建议，不得修改或虚构任何分数。请输出严格 JSON，不要输出 Markdown。",
          "反馈必须体现当前面试类型：综合面评价岗位适配、经历证据和能力迁移；技术面评价技术理解、方案表达和工程落地；HR 面评价动机稳定性、协作沟通、压力应对和职业规划。",
          "JSON 结构：",
          '{"summary":"","improvements":[],"optimizedAnswer":""}',
          "summary 必须引用回答中的具体事实，并明确哪些结论已被证据支持、哪些只是因为未考察而无法判断。",
          "improvements 给 3-5 条可执行建议，必须对应低分或未覆盖维度；optimizedAnswer 给一段可直接参考的 STAR 优化回答。",
          "禁止输出评分、禁止把未考察写成能力不足、禁止因为提到技术名词就判断候选人优秀、禁止编造回答中不存在的项目或数据。",
          `确定性评分摘要：${evidenceReport.summary}`,
          `报告类型：${evidenceReport.reportKind === "formal" ? "正式评估报告" : "阶段性诊断报告"}`,
          `会话完整度：${JSON.stringify(evidenceReport.sessionEvaluation, null, 2)}`,
          `一致性核验结果：${JSON.stringify(evidenceReport.integrityEvaluation, null, 2)}`,
          "一致性风险只表示需要核验，不等于候选人不诚实；叙事总结必须区分待核验、已说明和未充分解释。",
          `跨次成长比较（确定性结果，不得自行重算）：${JSON.stringify(evidenceReport.growthComparison, null, 2)}`,
          "只有 comparison.overallComparable 为 true 时才可描述综合分提升；new_evidence 是首次形成基线，不得写成能力提升；低可比结果必须带上口径限制。",
          `六维证据报告：${JSON.stringify(evidenceReport.dimensionReports.map((item) => ({
            id: item.id,
            name: item.name,
            score: item.score,
            status: item.status,
            evidence: item.strongestEvidence,
            gaps: item.gaps,
          })), null, 2)}`,
          `岗位RAG来源：${JSON.stringify(input.grounding?.knowledgeSources ?? [], null, 2)}`,
          `相关历史面试记忆：${JSON.stringify(input.grounding?.memoryReferences ?? [], null, 2)}`,
          "如存在历史面试，只能描述本次相对历史短板是否获得新证据；不得在缺少同维度证据时声称能力提升。",
          `目标岗位：${input.jobTarget?.title || "目标岗位待确认"}`,
          `面试类型：${input.interviewType}`,
          `面试模式规则：\n${interviewRulesOf(input.interviewType)}`,
          `简历摘要：${input.resumeSummary || "暂无"}`,
          `面试记录：${JSON.stringify(input.turns, null, 2)}`,
        ].join("\n\n"),
      },
      { timeoutMs: 45000 },
    );

    return parseInterviewFeedback(
      response.content || response.error || "",
      input.turns,
      input.jobTarget,
      input.interviewType,
      input.grounding,
      input.reportKind,
      input.completionReason,
      input.elapsedSeconds,
      input.resumeSummary,
    );
  }
}

export const getInterviewModelProvider = (): InterviewModelProvider => new DoubaoInterviewProvider();
