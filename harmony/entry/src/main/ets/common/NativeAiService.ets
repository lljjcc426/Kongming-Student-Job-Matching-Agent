import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { http } from '@kit.NetworkKit';
import { NativeInterviewTurn } from './NativeWorkspaceModel';

interface NativeAiChatMessage {
  role: string;
  content: string;
}

interface NativeAiRequest {
  task: string;
  resumeText: string;
  userMessage: string;
  chatMessages: NativeAiChatMessage[];
}

interface NativeAiResponse {
  ok?: boolean;
  content?: string;
  error?: string;
}

interface NativeAiInterviewFeedbackPayload {
  schemaVersion?: string;
  overallScore?: number;
  structureScore?: number;
  evidenceScore?: number;
  relevanceScore?: number;
  clarityScore?: number;
  strongestLabel?: string;
  priorityLabel?: string;
  evidenceLabel?: string;
  strengths?: string[];
  gaps?: string[];
  actions?: string[];
  evidenceReferences?: string[];
  improvedAnswer?: string;
}

export class NativeAiResult {
  configured: boolean;
  ok: boolean;
  content: string;
  message: string;

  constructor(configured: boolean, ok: boolean, content: string, message: string) {
    this.configured = configured;
    this.ok = ok;
    this.content = content;
    this.message = message;
  }
}

export class NativeInterviewEvaluation {
  schemaVersion: string;
  overallScore: number;
  structureScore: number;
  evidenceScore: number;
  relevanceScore: number;
  clarityScore: number;
  strongestLabel: string;
  priorityLabel: string;
  evidenceLabel: string;
  feedbackText: string;
  evidenceReferences: string[];
  improvedAnswer: string;

  constructor(
    schemaVersion: string,
    overallScore: number,
    structureScore: number,
    evidenceScore: number,
    relevanceScore: number,
    clarityScore: number,
    strongestLabel: string,
    priorityLabel: string,
    evidenceLabel: string,
    feedbackText: string,
    evidenceReferences: string[],
    improvedAnswer: string,
  ) {
    this.schemaVersion = schemaVersion;
    this.overallScore = overallScore;
    this.structureScore = structureScore;
    this.evidenceScore = evidenceScore;
    this.relevanceScore = relevanceScore;
    this.clarityScore = clarityScore;
    this.strongestLabel = strongestLabel;
    this.priorityLabel = priorityLabel;
    this.evidenceLabel = evidenceLabel;
    this.feedbackText = feedbackText;
    this.evidenceReferences = evidenceReferences;
    this.improvedAnswer = improvedAnswer;
  }
}

export class NativeInterviewFeedbackResult extends NativeAiResult {
  evaluation: NativeInterviewEvaluation | undefined;

  constructor(
    configured: boolean,
    ok: boolean,
    content: string,
    message: string,
    evaluation: NativeInterviewEvaluation | undefined = undefined,
  ) {
    super(configured, ok, content, message);
    this.evaluation = evaluation;
  }
}

export class NativeAiService {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  private getEndpoint(): string {
    try {
      return this.context.resourceManager.getStringByNameSync('gateway_service_url').trim();
    } catch (error) {
      console.error(`Native gateway endpoint read failed: ${String(error)}`);
      return '';
    }
  }

  private getOperationEndpoint(operation: string): string {
    const endpoint = this.getEndpoint();
    if (!endpoint) return '';
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}operation=${encodeURIComponent(operation)}`;
  }

  private redactSensitiveText(source: string, maxLength: number): string {
    return source
      .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, '[手机号已隐藏]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱已隐藏]')
      .replace(/\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, '[身份证号已隐藏]')
      .replace(/(?:现居住地|家庭住址|通信地址|地址)\s*[:：]\s*[^\n。；]{4,80}/g, '地址：[详细地址已隐藏]')
      .slice(0, maxLength);
  }

  private historyMessages(turns: NativeInterviewTurn[]): NativeAiChatMessage[] {
    const messages: NativeAiChatMessage[] = [];
    const start = Math.max(0, turns.length - 4);
    for (let index = start; index < turns.length; index += 1) {
      messages.push({ role: 'assistant', content: this.redactSensitiveText(turns[index].question, 600) });
      messages.push({ role: 'user', content: this.redactSensitiveText(turns[index].answer, 1200) });
    }
    return messages;
  }

  private normalizeQuestion(content: string): string {
    const clean = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^#+\s*/gm, '')
      .trim();
    if (!clean || /总体评分|综合评分|面试反馈|改进建议/.test(clean)) return '';
    const lines = clean.split(/\r?\n/);
    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      return text.length > 180 ? `${text.slice(0, 180)}？` : text;
    }
    return '';
  }

  private normalizedScore(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return -1;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private compactList(values: string[] | undefined, fallback: string): string {
    if (!values || values.length === 0) return fallback;
    const output: string[] = [];
    for (const value of values.slice(0, 3)) {
      const clean = value.trim();
      if (clean) output.push(clean);
    }
    return output.length > 0 ? output.join('；') : fallback;
  }

  private parseInterviewEvaluation(content: string): NativeInterviewEvaluation | undefined {
    try {
      const clean = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const payload = JSON.parse(clean) as NativeAiInterviewFeedbackPayload;
      const structureScore = this.normalizedScore(payload.structureScore);
      const evidenceScore = this.normalizedScore(payload.evidenceScore);
      const relevanceScore = this.normalizedScore(payload.relevanceScore);
      const clarityScore = this.normalizedScore(payload.clarityScore);
      if (structureScore < 0 || evidenceScore < 0 || relevanceScore < 0 || clarityScore < 0 ||
        !payload.strongestLabel || !payload.priorityLabel || !payload.evidenceLabel) return undefined;
      const calculatedOverall = Math.round((structureScore + evidenceScore + relevanceScore + clarityScore) / 4);
      const requestedOverall = this.normalizedScore(payload.overallScore);
      const overallScore = requestedOverall >= 0 && Math.abs(requestedOverall - calculatedOverall) <= 5
        ? requestedOverall
        : calculatedOverall;
      const feedbackText = [
        `证据状态：${payload.evidenceLabel.trim()}`,
        `回答亮点：${this.compactList(payload.strengths, payload.strongestLabel.trim())}`,
        `主要缺口：${this.compactList(payload.gaps, payload.priorityLabel.trim())}`,
        `下一轮行动：${this.compactList(payload.actions, payload.priorityLabel.trim())}`,
      ].join('\n');
      const references: string[] = [];
      if (payload.evidenceReferences) {
        for (const reference of payload.evidenceReferences.slice(0, 6)) {
          const cleanReference = reference.trim();
          if (cleanReference) references.push(cleanReference.slice(0, 180));
        }
      }
      return new NativeInterviewEvaluation(
        payload.schemaVersion || 'interview-evaluation-v1',
        overallScore,
        structureScore,
        evidenceScore,
        relevanceScore,
        clarityScore,
        payload.strongestLabel.trim().slice(0, 40),
        payload.priorityLabel.trim().slice(0, 160),
        payload.evidenceLabel.trim().slice(0, 80),
        feedbackText,
        references,
        (payload.improvedAnswer || '').trim().slice(0, 800),
      );
    } catch (error) {
      console.error(`Structured interview feedback parse failed: ${String(error)}`);
      return undefined;
    }
  }

  private async requestModel(payload: NativeAiRequest): Promise<NativeAiResult> {
    const endpoint = this.getOperationEndpoint('model');
    if (!endpoint) {
      return new NativeAiResult(false, false, '', '个性化内容暂时不可用。');
    }
    const request = http.createHttp();
    try {
      const response = await request.request(endpoint, {
        method: http.RequestMethod.POST,
        expectDataType: http.HttpDataType.STRING,
        header: {
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8',
        },
        extraData: JSON.stringify(payload),
        connectTimeout: 10000,
        readTimeout: 45000,
      });
      const responseCode = Number(response.responseCode);
      const responseText = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
      const parsed = JSON.parse(responseText) as NativeAiResponse;
      if (responseCode < 200 || responseCode >= 300 || parsed.ok !== true || !parsed.content) {
        console.error(`Native AI request rejected with status ${responseCode}: ${parsed.error || 'empty response'}`);
        return new NativeAiResult(true, false, '', '个性化内容暂时不可用。');
      }
      return new NativeAiResult(true, true, parsed.content.trim(), '个性化内容已生成。');
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Native AI request failed: ${businessError.code} ${businessError.message}`);
      return new NativeAiResult(true, false, '', '个性化内容暂时不可用。');
    } finally {
      request.destroy();
    }
  }

  async generateInterviewQuestion(
    interviewType: string,
    round: number,
    totalRounds: number,
    resumeText: string,
    jobTitle: string,
    jobDescription: string,
    requirementFocuses: string[],
    competencyLabel: string,
    coveredCompetencies: string[],
    turns: NativeInterviewTurn[],
  ): Promise<NativeAiResult> {
    const questionGoal = turns.length === 0
      ? '这是首轮问题。请结合目标岗位和候选人简历，围绕本轮能力重点选择最值得核验的一项经历发问。'
      : '请围绕本轮能力重点继续提问；可以引用上一轮回答，但必须推进新的核验目标，避免重复已经覆盖的问题。';
    const prompt = [
      '你是一名专业、克制、真实的学生求职模拟面试官。',
      '请只输出下一轮的一个问题，不要输出评价、答案、Markdown 或多段报告。',
      questionGoal,
      '不得编造候选人经历，不得询问与求职能力无关的隐私信息。',
      `面试类型：${interviewType}`,
      `当前轮次：${round}/${totalRounds}`,
      `目标岗位：${jobTitle || '目标岗位待确认'}`,
      `岗位说明：${this.redactSensitiveText(jobDescription, 2200) || '暂无完整岗位说明'}`,
      `岗位核验重点：${requirementFocuses.length > 0 ? requirementFocuses.join('、') : '岗位核心能力'}`,
      `本轮能力重点：${competencyLabel || '岗位核心能力'}`,
      `已覆盖能力：${coveredCompetencies.length > 0 ? coveredCompetencies.join('、') : '暂无'}`,
      '综合面关注岗位适配、经历证据和能力迁移；技术面关注方案、取舍、验证与工程落地；HR 面关注动机、协作、压力和职业规划。',
      '问题长度控制在 1-2 句话。',
    ].join('\n\n');
    const result = await this.requestModel({
      task: 'career-chat',
      resumeText: this.redactSensitiveText(resumeText, 6000),
      userMessage: prompt,
      chatMessages: this.historyMessages(turns),
    });
    if (!result.ok) return result;
    const question = this.normalizeQuestion(result.content);
    return question
      ? new NativeAiResult(true, true, question, result.message)
      : new NativeAiResult(true, false, '', '个性化问题生成不完整。');
  }

  async generateInterviewFeedback(
    interviewType: string,
    resumeText: string,
    jobTitle: string,
    jobDescription: string,
    requirementFocuses: string[],
    competencyLabels: string[],
    turns: NativeInterviewTurn[],
  ): Promise<NativeInterviewFeedbackResult> {
    const prompt = [
      '你是学生求职模拟面试反馈智能体。请基于真实面试记录输出克制、可执行的结构化评估。',
      '不得编造候选人没有说过的经历、技能、数字或结果，不得输出录用概率或企业结论。',
      '只输出一个合法 JSON 对象，不要 Markdown、代码围栏或 JSON 之外的文字。',
      '固定字段：schemaVersion、overallScore、structureScore、evidenceScore、relevanceScore、clarityScore、strongestLabel、priorityLabel、evidenceLabel、strengths、gaps、actions、evidenceReferences、improvedAnswer。',
      '五个分数均为 0-100 整数；overallScore 应接近四个维度的平均值。strengths、gaps、actions 各最多三条。',
      'evidenceReferences 最多六条，只能引用真实回答，格式为“第N轮：回答中的简短原句或事实”，不能补写候选人未表达的内容。',
      'improvedAnswer 是一段不超过 400 字的 STAR 改写示例，只能重组候选人已经说出的事实；缺失信息必须写成“待补充”，不得代填。',
      `面试类型：${interviewType}`,
      `目标岗位：${jobTitle || '目标岗位待确认'}`,
      `岗位说明：${this.redactSensitiveText(jobDescription, 2200) || '暂无完整岗位说明'}`,
      `岗位核验重点：${requirementFocuses.length > 0 ? requirementFocuses.join('、') : '岗位核心能力'}`,
      `本轮能力题谱：${competencyLabels.length > 0 ? competencyLabels.join('、') : '岗位核心能力'}`,
      `面试轮次：${turns.length}`,
    ].join('\n\n');
    const result = await this.requestModel({
      task: 'career-chat',
      resumeText: this.redactSensitiveText(resumeText, 6000),
      userMessage: prompt,
      chatMessages: this.historyMessages(turns),
    });
    if (!result.ok) {
      return new NativeInterviewFeedbackResult(
        result.configured,
        false,
        '',
        result.message,
      );
    }
    const evaluation = this.parseInterviewEvaluation(result.content);
    if (!evaluation) {
      return new NativeInterviewFeedbackResult(
        true,
        true,
        result.content,
        '已生成本轮训练反馈。',
      );
    }
    return new NativeInterviewFeedbackResult(
      true,
      true,
      evaluation.feedbackText,
      '已生成本轮训练反馈。',
      evaluation,
    );
  }
}
