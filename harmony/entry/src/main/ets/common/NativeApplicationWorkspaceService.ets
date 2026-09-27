import { createNativeApplicationStageOptions, NativeTrackedJobRecord } from './NativeWorkspaceModel';

export class NativeApplicationListItem {
  record: NativeTrackedJobRecord;
  readiness: number;
  nextAction: string;

  constructor(record: NativeTrackedJobRecord, readiness: number, nextAction: string) {
    this.record = record;
    this.readiness = readiness;
    this.nextAction = nextAction;
  }
}

export class NativeApplicationSchedule {
  timestamp: number = 0;
  label: string = '';
  overdue: boolean = false;
  priority: number = 3;
}

export class NativeApplicationFilter {
  id: string;
  label: string;

  constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }
}

export class NativeApplicationWorkspaceService {
  stageLabel(stageId: string): string {
    for (const stage of createNativeApplicationStageOptions()) {
      if (stage.id === stageId) return stage.label;
    }
    return '已收藏';
  }

  isActive(record: NativeTrackedJobRecord): boolean {
    return record.applicationStage !== 'offer' && record.applicationStage !== 'closed';
  }

  parseLocalTime(value: string): number {
    const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return 0;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || '0');
    const date = new Date(year, month - 1, day, hour, minute, second, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
      date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) return 0;
    return date.getTime();
  }

  schedule(record: NativeTrackedJobRecord, now: number): NativeApplicationSchedule {
    const result = new NativeApplicationSchedule();
    if (!this.isActive(record)) {
      result.priority = 4;
      return result;
    }
    const interview = this.parseLocalTime(record.nextInterviewAt);
    const deadline = record.applicationStage === 'interested' || record.applicationStage === 'preparing'
      ? this.parseLocalTime(record.applicationDeadline) : 0;
    const hasFutureInterview = interview > 0 && interview >= now;
    const hasFutureDeadline = deadline > 0 && deadline >= now;
    let label = '';
    if (hasFutureInterview && (!hasFutureDeadline || interview <= deadline)) {
      result.timestamp = interview;
      label = '面试';
    } else if (hasFutureDeadline) {
      result.timestamp = deadline;
      label = '投递截止';
    } else if (interview > 0 || deadline > 0) {
      result.timestamp = Math.max(interview, deadline);
      label = interview >= deadline ? '面试时间已过' : '投递截止已过';
      result.overdue = true;
    }
    if (result.timestamp > 0) {
      const date = new Date(result.timestamp);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      result.label = `${label} · ${month}-${day} ${hour}:${minute}`;
      result.priority = result.overdue ? 0 : (result.timestamp - now <= 7 * 86400000 ? 1 : 2);
    }
    return result;
  }

  count(items: NativeApplicationListItem[], stage: string): number {
    return items.filter((item: NativeApplicationListItem) => this.matchesStage(item.record, stage)).length;
  }

  filters(items: NativeApplicationListItem[]): NativeApplicationFilter[] {
    const filters: NativeApplicationFilter[] = [
      new NativeApplicationFilter('all', '全部阶段'),
      new NativeApplicationFilter('active', '进行中'),
      new NativeApplicationFilter('interested', '已收藏'),
      new NativeApplicationFilter('preparing', '准备中'),
      new NativeApplicationFilter('applied', '已投递'),
      new NativeApplicationFilter('interview', '面试中'),
      new NativeApplicationFilter('offer', 'Offer'),
      new NativeApplicationFilter('closed', '已结束'),
    ];
    return filters.map((filter: NativeApplicationFilter) =>
      new NativeApplicationFilter(filter.id, `${filter.label} (${this.count(items, filter.id)})`));
  }

  private matchesStage(record: NativeTrackedJobRecord, stage: string): boolean {
    if (stage === 'all') return true;
    if (stage === 'active') return this.isActive(record);
    return record.applicationStage === stage;
  }

  query(items: NativeApplicationListItem[], search: string, stage: string, sort: string,
    now: number): NativeApplicationListItem[] {
    const terms = search.trim().toLowerCase().split(/\s+/).filter((term: string) => term.length > 0);
    const result = items.filter((item: NativeApplicationListItem) => {
      const record = item.record;
      const text = `${record.company} ${record.title} ${record.description}`.toLowerCase();
      return this.matchesStage(record, stage) && terms.every((term: string) => text.includes(term));
    });
    return result.sort((left: NativeApplicationListItem, right: NativeApplicationListItem) => {
      if (sort === 'company') {
        const companyOrder = left.record.company.localeCompare(right.record.company, 'zh-CN');
        if (companyOrder !== 0) return companyOrder;
      } else if (sort === 'schedule') {
        const leftSchedule = this.schedule(left.record, now);
        const rightSchedule = this.schedule(right.record, now);
        if (leftSchedule.priority !== rightSchedule.priority) return leftSchedule.priority - rightSchedule.priority;
        if (leftSchedule.timestamp !== rightSchedule.timestamp) return leftSchedule.timestamp - rightSchedule.timestamp;
      }
      const updatedOrder = this.parseLocalTime(right.record.updatedAt) - this.parseLocalTime(left.record.updatedAt);
      if (updatedOrder !== 0) return updatedOrder;
      return left.record.key.localeCompare(right.record.key);
    });
  }
}
