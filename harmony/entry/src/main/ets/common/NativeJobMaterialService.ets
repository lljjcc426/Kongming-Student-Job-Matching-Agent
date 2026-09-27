import { NativeInterviewSessionRecord, NativeJobMaterialRecord, NativeJobStory, NativeResumeVersion } from './NativeWorkspaceModel';

export class NativeMaterialCheck {
  id: string;
  label: string;
  detail: string;
  state: string;
  action: string;

  constructor(
    id: string, label: string, detail: string, state: string, action: string = '',
  ) {
    this.id = id;
    this.label = label;
    this.detail = detail;
    this.state = state;
    this.action = action;
  }
}

export class NativeResumeTextChanges {
  added: string[] = [];
  removed: string[] = [];
  changed: boolean = false;
}

export class NativeJobMaterialService {
  cloneStory(story: NativeJobStory): NativeJobStory {
    const copy = new NativeJobStory();
    copy.id = story.id || '';
    copy.title = story.title || '';
    copy.requirement = story.requirement || '';
    copy.situation = story.situation || '';
    copy.task = story.task || '';
    copy.action = story.action || '';
    copy.result = story.result || '';
    copy.evidence = story.evidence || '';
    copy.sourceSessionId = story.sourceSessionId || '';
    copy.sourceQuestion = story.sourceQuestion || '';
    copy.sourceAnswer = story.sourceAnswer || '';
    return copy;
  }

  cloneRecord(record: NativeJobMaterialRecord): NativeJobMaterialRecord {
    const copy = new NativeJobMaterialRecord();
    copy.jobKey = record.jobKey || '';
    copy.candidateName = record.candidateName || '';
    copy.contact = record.contact || '';
    copy.resumeContent = record.resumeContent || '';
    copy.baseResumeContent = record.baseResumeContent || '';
    copy.sourceResumeVersionId = record.sourceResumeVersionId || '';
    copy.confirmedSignature = record.confirmedSignature || '';
    copy.confirmedAt = record.confirmedAt || '';
    copy.updatedAt = record.updatedAt || '';
    const storyIds: string[] = [];
    for (const story of record.stories || []) {
      if (!story.id || storyIds.includes(story.id)) continue;
      copy.stories.push(this.cloneStory(story));
      storyIds.push(story.id);
    }
    return copy;
  }

  storyCompletedFields(story: NativeJobStory): number {
    return [story.situation, story.task, story.action, story.result, story.evidence]
      .filter((value: string) => value.trim().length > 0).length;
  }

  resumeSignature(record: NativeJobMaterialRecord): string {
    return JSON.stringify([record.candidateName.trim(), record.contact.trim(), record.resumeContent.trim()]);
  }

  isResumeConfirmed(record: NativeJobMaterialRecord): boolean {
    return Boolean(record.confirmedAt && record.confirmedSignature === this.resumeSignature(record));
  }

  confirmResume(record: NativeJobMaterialRecord, confirmed: boolean): NativeJobMaterialRecord {
    const draft = this.cloneRecord(record);
    draft.confirmedSignature = confirmed ? this.resumeSignature(draft) : '';
    draft.confirmedAt = confirmed ? new Date().toLocaleString('zh-CN') : '';
    return draft;
  }

  preflight(record: NativeJobMaterialRecord, version: NativeResumeVersion | undefined, dirty: boolean): NativeMaterialCheck[] {
    const content = record.resumeContent.trim();
    const checks: NativeMaterialCheck[] = [];
    checks.push(new NativeMaterialCheck('saved', '材料已保存',
      dirty || !record.updatedAt ? '先保存本次修改。' : `已保存：${record.updatedAt}`,
      dirty || !record.updatedAt ? 'block' : 'pass', 'save'));
    const hasIdentity = Boolean(record.candidateName.trim() && record.candidateName.trim().length <= 64);
    const hasContact = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?86[\s-]?)?1[3-9]\d{9}/i.test(`${record.contact}\n${content}`);
    checks.push(new NativeMaterialCheck('contact', '姓名与联系方式',
      hasIdentity && hasContact ? '已填写姓名，并发现电话或邮箱；请自行核对是否有效。' : '补充姓名，以及可联系的电话或邮箱。',
      hasIdentity && hasContact ? 'pass' : 'block', 'resume'));
    const hasPlaceholders = /待填写|待补充|请填写|\bTODO\b|\[(?:姓名|电话|邮箱|项目名称)\]|\{(?:姓名|电话|邮箱|项目名称)\}/i.test(
      `${record.candidateName}\n${record.contact}\n${content}`);
    const validBody = content.length >= 30 && content.length <= 12000 && !hasPlaceholders;
    const bodyDetail = hasPlaceholders ? '仍有待填写内容或模板占位符。'
      : (content.length < 30 ? '正文至少需要 30 字真实经历。'
        : (content.length > 12000 ? '正文超过 12000 字，请精简后生成简历。' : `${content.length} 字正文，未发现常见占位符。`));
    checks.push(new NativeMaterialCheck('body', '正文可导出', bodyDetail, validBody ? 'pass' : 'block', 'resume'));
    const bound = Boolean(record.jobKey && version && version.jobKey === record.jobKey && version.content.trim() === content);
    checks.push(new NativeMaterialCheck('version', '投递版本与正文一致',
      bound && version ? `使用：${version.name}` : '将当前正文冻结并绑定，避免投递旧版。',
      bound ? 'pass' : 'block', 'freeze'));
    const confirmed = this.isResumeConfirmed(record);
    checks.push(new NativeMaterialCheck('confirmed', '经历与联系方式已核对',
      confirmed ? `本人确认：${record.confirmedAt}；不等同于独立真实性核验。` : '核对本次正文、姓名与联系方式后勾选确认。',
      confirmed ? 'pass' : 'block'));
    const incompleteStories = record.stories.filter((story: NativeJobStory) => this.storyCompletedFields(story) < 5).length;
    if (incompleteStories > 0) checks.push(new NativeMaterialCheck('stories', '项目案例仍有未填项',
      `${incompleteStories} 个案例未填完整，不影响简历导出。`, 'warn', 'stories'));
    if (content.length >= 30 && content.length < 100) checks.push(new NativeMaterialCheck('short', '正文较简短',
      '建议复核教育背景、个人职责和实际成果是否齐全。', 'warn', 'resume'));
    return checks;
  }

  canExportResume(record: NativeJobMaterialRecord, version: NativeResumeVersion | undefined, dirty: boolean): boolean {
    return !this.preflight(record, version, dirty).some((check: NativeMaterialCheck) => check.state === 'block');
  }

  resumeChanges(base: string, content: string): NativeResumeTextChanges {
    const changes = new NativeResumeTextChanges();
    changes.changed = base.trim() !== content.trim();
    const baseLines = base.split(/\r?\n/).map((line: string) => line.trim()).filter((line: string) => line.length > 0);
    const currentLines = content.split(/\r?\n/).map((line: string) => line.trim()).filter((line: string) => line.length > 0);
    const unmatchedBase = [...baseLines];
    for (const line of currentLines) {
      const matchedIndex = unmatchedBase.indexOf(line);
      if (matchedIndex >= 0) unmatchedBase.splice(matchedIndex, 1);
      else changes.added.push(line);
    }
    changes.removed = unmatchedBase;
    return changes;
  }

  storyFromSession(session: NativeInterviewSessionRecord, turnIndex: number): NativeJobStory | undefined {
    const turn = session.turns[turnIndex];
    if (!turn || !turn.answer.trim() || !session.feedback) return undefined;
    const story = new NativeJobStory();
    story.id = `story-${session.id}-${turnIndex}`;
    story.title = `面试案例 ${turnIndex + 1}`;
    story.requirement = (session.requirementFocuses || [])[0] || '责任边界与成果证据';
    story.sourceSessionId = session.id;
    story.sourceQuestion = turn.question;
    story.sourceAnswer = turn.answer;
    return story;
  }

  exportText(record: NativeJobMaterialRecord, jobTitle: string, company: string, boundVersionName: string): string {
    const sections: string[] = [
      `${company ? `${company} · ` : ''}${jobTitle} · 投递材料`,
      `保存时间：${record.updatedAt || '尚未保存'}`,
      `绑定投递版本：${boundVersionName || '未绑定'}`,
      '',
      '【投递简历草稿】',
      record.resumeContent || '尚未填写',
      '',
      '【项目与面试故事】',
    ];
    if (record.stories.length === 0) sections.push('尚未整理案例');
    for (const story of record.stories) {
      sections.push('', story.title || '未命名案例', `对应要求：${story.requirement || '未关联'}`,
        `背景：${story.situation || '待补充'}`, `任务：${story.task || '待补充'}`,
        `行动：${story.action || '待补充'}`, `结果：${story.result || '待补充'}`,
        `证据：${story.evidence || '待补充'}`);
      if (story.sourceAnswer) sections.push(`面试原问题：${story.sourceQuestion}`, `面试原回答：${story.sourceAnswer}`);
    }
    return sections.join('\n');
  }
}
