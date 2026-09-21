import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { calendarManager } from '@kit.CalendarKit';

export class NativeCalendarResult {
  ok: boolean;
  eventId: number;
  message: string;

  constructor(ok: boolean, eventId: number, message: string) {
    this.ok = ok;
    this.eventId = eventId;
    this.message = message;
  }
}

export class NativeCalendarService {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  private parseLocalDateTime(value: string): number {
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) return 0;
    const parts = normalized.split(/\s+/);
    const dateParts = parts[0].split('-');
    const timeParts = parts[1].split(':');
    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const day = Number(dateParts[2]);
    const hour = Number(timeParts[0]);
    const minute = Number(timeParts[1]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
      !Number.isInteger(hour) || !Number.isInteger(minute)) return 0;
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day ||
      parsed.getHours() !== hour || parsed.getMinutes() !== minute) return 0;
    return parsed.getTime();
  }

  async openReminderEditor(
    reminderType: string,
    scheduledAt: string,
    jobTitle: string,
    company: string,
    action: string,
  ): Promise<NativeCalendarResult> {
    const startTime = this.parseLocalDateTime(scheduledAt);
    if (startTime <= Date.now()) {
      return new NativeCalendarResult(false, 0, '请填写未来时间，格式为 YYYY-MM-DD HH:mm。');
    }
    const isInterview = reminderType === 'interview';
    const subject = jobTitle.trim() || '目标岗位';
    const organization = company.trim() ? ` · ${company.trim()}` : '';
    const event: calendarManager.Event = {
      type: calendarManager.EventType.IMPORTANT,
      title: isInterview ? `孔明职配：${subject}${organization} 面试` : `孔明职配：${subject}${organization} 投递截止`,
      startTime,
      endTime: startTime + (isInterview ? 60 : 30) * 60 * 1000,
      reminderTime: isInterview ? [24 * 60, 30] : [24 * 60, 60],
      description: action.trim() || '打开孔明职配继续处理求职行动。',
    };
    try {
      const manager = calendarManager.getCalendarManager(this.context);
      const eventId = await manager.editEvent(event);
      if (eventId > 0) {
        return new NativeCalendarResult(true, eventId, '系统日历已保存提醒。');
      }
      return new NativeCalendarResult(false, 0, '未保存日历事件。');
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Calendar event editor failed: ${businessError.code} ${businessError.message}`);
      if (businessError.code === 801) {
        return new NativeCalendarResult(false, 0, '当前设备不支持 Calendar Kit 事件编辑器。');
      }
      return new NativeCalendarResult(false, 0, '系统日历暂时无法打开，请稍后重试。');
    }
  }
}
