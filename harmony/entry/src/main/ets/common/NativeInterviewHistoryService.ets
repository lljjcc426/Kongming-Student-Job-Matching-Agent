import { NativeInterviewSessionRecord, NativeInterviewTurn } from './NativeWorkspaceModel';

export class NativeInterviewHistoryFilter {
  id: string;
  label: string;

  constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }
}

export class NativeInterviewComparisonSelection {
  ids: string[];
  message: string;

  constructor(ids: string[], message: string = '') {
    this.ids = ids;
    this.message = message;
  }
}

export class NativeInterviewScoreComparison {
  label: string;
  earlier: number;
  later: number;
  delta: string;

  constructor(label: string, earlier: number, later: number, comparable: boolean) {
    this.label = label;
    this.earlier = earlier;
    this.later = later;
    const change = later - earlier;
    this.delta = comparable && earlier >= 0 && later >= 0
      ? (change === 0 ? '持平' : `${change > 0 ? '+' : ''}${Number(change.toFixed(2))}`) : '--';
  }
}

export class NativeInterviewHistoryComparison {
  records: NativeInterviewSessionRecord[] = [];
  reasons: string[] = [];
  metrics: NativeInterviewScoreComparison[] = [];
  chronological: boolean = false;
  comparable: boolean = false;
}

export class NativeInterviewHistoryService {
  records(sessions: NativeInterviewSessionRecord[]): NativeInterviewSessionRecord[] {
    const ids: string[] = [];
    return sessions.filter((session: NativeInterviewSessionRecord) => {
      if (!session.id || ids.includes(session.id)) return false;
      ids.push(session.id);
      return true;
    });
  }

  timestamp(session: NativeInterviewSessionRecord): number {
    return typeof session.completedAtEpoch === 'number' && Number.isFinite(session.completedAtEpoch) &&
      session.completedAtEpoch > 0 && session.completedAtEpoch <= 8640000000000000 ? session.completedAtEpoch : 0;
  }

  score(value: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : -1;
  }

  scoreText(value: number): string {
    return this.score(value) >= 0 ? `${Number(value.toFixed(2))}` : '--';
  }

  dateLabel(session: NativeInterviewSessionRecord): string {
    const timestamp = this.timestamp(session);
    if (timestamp === 0) return session.completedAt || '时间未记录';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ` +
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  jobLabel(session: NativeInterviewSessionRecord): string {
    return session.company ? `${session.company} · ${session.jobTitle || '未命名岗位'}` : (session.jobTitle || '未命名岗位');
  }

  filters(sessions: NativeInterviewSessionRecord[], currentJobKey: string): NativeInterviewHistoryFilter[] {
    const records = this.records(sessions);
    const filters = [
      new NativeInterviewHistoryFilter('current', `当前岗位 (${records.filter((session: NativeInterviewSessionRecord) => session.jobKey === currentJobKey).length})`),
      new NativeInterviewHistoryFilter('all', `全部岗位 (${records.length})`),
    ];
    const keys: string[] = [];
    for (const session of records) {
      if (!session.jobKey || keys.includes(session.jobKey)) continue;
      keys.push(session.jobKey);
      const count = records.filter((record: NativeInterviewSessionRecord) => record.jobKey === session.jobKey).length;
      filters.push(new NativeInterviewHistoryFilter(`job:${session.jobKey}`, `${this.jobLabel(session)} (${count})`));
    }
    return filters;
  }

  query(sessions: NativeInterviewSessionRecord[], currentJobKey: string, scope: string,
    kind: string, search: string): NativeInterviewSessionRecord[] {
    const terms = search.trim().toLowerCase().split(/\s+/).filter((term: string) => term.length > 0);
    return this.records(sessions).filter((session: NativeInterviewSessionRecord) => {
      if (scope === 'current' && session.jobKey !== currentJobKey) return false;
      if (scope.startsWith('job:') && session.jobKey !== scope.slice(4)) return false;
      if (kind !== 'all' && this.normalizedText(session.interviewType) !== this.normalizedText(kind)) return false;
      const turns = (session.turns || []).map((turn: NativeInterviewTurn) => `${turn.question} ${turn.answer}`).join(' ');
      const text = `${session.company || ''} ${session.jobTitle || ''} ${turns} ${session.feedback || ''} ${session.priorityLabel || ''} ${session.improvedAnswer || ''} ${session.jobDescriptionSnapshot || ''}`.toLowerCase();
      return terms.every((term: string) => text.includes(term));
    }).sort((left: NativeInterviewSessionRecord, right: NativeInterviewSessionRecord) => this.timestamp(right) - this.timestamp(left));
  }

  find(sessions: NativeInterviewSessionRecord[], ids: string[]): NativeInterviewSessionRecord[] {
    return this.records(sessions).filter((session: NativeInterviewSessionRecord) => ids.includes(session.id));
  }

  toggleComparison(sessions: NativeInterviewSessionRecord[], ids: string[], id: string): NativeInterviewComparisonSelection {
    const selected = this.find(sessions, ids).slice(0, 2);
    const retainedIds = selected.map((session: NativeInterviewSessionRecord) => session.id);
    if (retainedIds.includes(id)) return new NativeInterviewComparisonSelection(retainedIds.filter((selectedId: string) => selectedId !== id));
    const record = this.find(sessions, [id])[0];
    if (!record) return new NativeInterviewComparisonSelection(retainedIds, '这次记录已不在训练档案中。');
    if (!record.jobKey || (selected.length > 0 && selected[0].jobKey !== record.jobKey)) {
      return new NativeInterviewComparisonSelection(retainedIds, '只能选择同一岗位的两次训练。');
    }
    if (selected.length >= 2) return new NativeInterviewComparisonSelection(retainedIds, '最多选择两次训练，请先取消一个已选记录。');
    return new NativeInterviewComparisonSelection([...retainedIds, id]);
  }

  compare(sessions: NativeInterviewSessionRecord[], ids: string[]): NativeInterviewHistoryComparison {
    const result = new NativeInterviewHistoryComparison();
    result.records = this.find(sessions, ids).sort((left: NativeInterviewSessionRecord, right: NativeInterviewSessionRecord) =>
      this.timestamp(left) - this.timestamp(right));
    if (result.records.length !== 2 || ids.length !== 2) {
      result.reasons = ['请选择两次训练'];
      return result;
    }
    const earlier = result.records[0];
    const later = result.records[1];
    if (!earlier.jobKey || earlier.jobKey !== later.jobKey) {
      result.reasons = ['岗位不同'];
      return result;
    }
    result.chronological = this.timestamp(earlier) > 0 && this.timestamp(later) > this.timestamp(earlier);
    if (!result.chronological) result.reasons.push('完成时间不足以判断先后');
    if (this.normalizedText(earlier.interviewType) !== this.normalizedText(later.interviewType)) result.reasons.push('面试类型不同');
    if (earlier.difficulty !== later.difficulty) result.reasons.push('追问强度不同');
    if (earlier.durationMinutes !== later.durationMinutes) result.reasons.push('训练时长不同');
    if ((earlier.turns || []).length !== (later.turns || []).length) result.reasons.push('作答轮数不同');
    if (!earlier.assessmentSource || !later.assessmentSource || !earlier.assessmentVersion || !later.assessmentVersion) {
      result.reasons.push('部分记录缺少评分信息');
    } else if (earlier.assessmentSource !== later.assessmentSource || earlier.assessmentVersion !== later.assessmentVersion) {
      result.reasons.push('评分规则不同');
    }
    if (this.normalizedText(earlier.jobDescriptionSnapshot) !== this.normalizedText(later.jobDescriptionSnapshot)) result.reasons.push('岗位要求有变化');
    if (!earlier.jobDescriptionSnapshot || !later.jobDescriptionSnapshot) result.reasons.push('未保留完整的岗位要求');
    if (!earlier.resumeVersionId || !later.resumeVersionId) result.reasons.push('未绑定可核对的简历版本');
    if ((earlier.resumeVersionId || '') !== (later.resumeVersionId || '') ||
      this.normalizedText(earlier.resumeVersionName) !== this.normalizedText(later.resumeVersionName)) result.reasons.push('简历版本不同');
    if (JSON.stringify(earlier.competencyLabels || []) !== JSON.stringify(later.competencyLabels || []) ||
      JSON.stringify(earlier.requirementFocuses || []) !== JSON.stringify(later.requirementFocuses || [])) result.reasons.push('考察重点不同');
    if ((earlier.trainingFocusDimension || 'general') !== (later.trainingFocusDimension || 'general')) result.reasons.push('专项训练重点不同');
    result.comparable = result.reasons.length === 0;
    result.metrics = [
      new NativeInterviewScoreComparison('综合', this.score(earlier.overallScore), this.score(later.overallScore), result.comparable),
      new NativeInterviewScoreComparison('结构', this.score(earlier.structureScore), this.score(later.structureScore), result.comparable),
      new NativeInterviewScoreComparison('证据', this.score(earlier.evidenceScore), this.score(later.evidenceScore), result.comparable),
      new NativeInterviewScoreComparison('关联', this.score(earlier.relevanceScore), this.score(later.relevanceScore), result.comparable),
      new NativeInterviewScoreComparison('表达', this.score(earlier.clarityScore), this.score(later.clarityScore), result.comparable),
    ];
    return result;
  }

  private normalizedText(value: string): string {
    return (value || '').replace(/\s+/g, '');
  }
}
