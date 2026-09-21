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
  model?: string;
  content?: string;
  error?: string;
}

export class NativeAiResult {
  configured: boolean;
  ok: boolean;
  content: string;
  message: string;
  model: string;

  constructor(configured: boolean, ok: boolean, content: string, message: string, model: string = '') {
    this.configured = configured;
    this.ok = ok;
    this.content = content;
    this.message = message;
    this.model = model;
  }
}

export class NativeAiService {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  private getEndpoint(): string {
    try {
      return this.context.resourceManager.getStringByNameSync('ark_service_url').trim();
    } catch (error) {
      console.error(`Native AI endpoint read failed: ${String(error)}`);
      return '';
    }
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

  private async requestModel(payload: NativeAiRequest): Promise<NativeAiResult> {
    const endpoint = this.getEndpoint();
    if (!endpoint) {
      return new NativeAiResult(false, false, '', '当前 HAP 未配置模型服务，已使用本机规则。');
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
        return new NativeAiResult(true, false, '', parsed.error || `模型服务返回状态 ${responseCode}。`);
      }
      return new NativeAiResult(true, true, parsed.content.trim(), '模型服务调用成功。', parsed.model || '外部模型');
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Native AI request failed: ${businessError.code} ${businessError.message}`);
      return new NativeAiResult(true, false, '', '模型服务暂时不可用，已切换为本机规则。');
    } finally {
      request.destroy();
    }
  }

  async generateInterviewQuestion(
    interviewType: string,
    round: number,
    resumeText: string,
    jobTitle: string,
    jobDescription: string,
    turns: NativeInterviewTurn[],
  ): Promise<NativeAiResult> {
    const prompt = [
      '你是一名专业、克制、真实的学生求职模拟面试官。',
      '请只输出下一轮的一个问题，不要输出评价、答案、Markdown 或多段报告。',
      '必须基于候选人上一轮回答继续追问证据、个人行动、技术取舍或复盘，不得编造候选人经历。',
      `面试类型：${interviewType}`,
      `当前轮次：${round}`,
      `目标岗位：${jobTitle || '目标岗位待确认'}`,
      `岗位说明：${this.redactSensitiveText(jobDescription, 2200) || '暂无完整岗位说明'}`,
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
      ? new NativeAiResult(true, true, question, result.message, result.model)
      : new NativeAiResult(true, false, '', '模型返回内容不符合单问题格式，已使用本机规则。');
  }

  async generateInterviewFeedback(
    interviewType: string,
    resumeText: string,
    jobTitle: string,
    jobDescription: string,
    turns: NativeInterviewTurn[],
  ): Promise<NativeAiResult> {
    const prompt = [
      '你是学生求职模拟面试反馈智能体。请基于真实面试记录输出克制、可执行的中文反馈。',
      '不得编造候选人没有说过的经历、技能、数字或结果，不得输出录用概率或企业结论。',
      '按四段输出：证据状态、回答亮点、主要缺口、下一轮行动。每段不超过三条。',
      `面试类型：${interviewType}`,
      `目标岗位：${jobTitle || '目标岗位待确认'}`,
      `岗位说明：${this.redactSensitiveText(jobDescription, 2200) || '暂无完整岗位说明'}`,
      `面试轮次：${turns.length}`,
    ].join('\n\n');
    return this.requestModel({
      task: 'career-chat',
      resumeText: this.redactSensitiveText(resumeText, 6000),
      userMessage: prompt,
      chatMessages: this.historyMessages(turns),
    });
  }
}
