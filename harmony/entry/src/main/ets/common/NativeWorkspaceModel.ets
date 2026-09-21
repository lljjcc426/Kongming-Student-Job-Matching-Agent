export class NativeGrowthTask {
  id: string;
  title: string;
  description: string;
  evidenceRequirement: string;
  projectedGain: number;
  status: string;

  constructor(
    id: string,
    title: string,
    description: string,
    evidenceRequirement: string,
    projectedGain: number,
    status: string = 'todo',
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.evidenceRequirement = evidenceRequirement;
    this.projectedGain = projectedGain;
    this.status = status;
  }
}

export class NativeGrowthEvidenceRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  summary: string;
  sourceUrl: string;
  submittedAt: string;
  fingerprint: string;
  status: string;
  revokedAt: string;
  sourceVerification: string;
  sourceHost: string;
  sourceCheckedAt: string;
  sourceHttpStatus: number;

  constructor(
    id: string,
    taskId: string,
    taskTitle: string,
    summary: string,
    sourceUrl: string,
    submittedAt: string,
    fingerprint: string,
    status: string = 'verified',
    revokedAt: string = '',
    sourceVerification: string = 'not_checked',
    sourceHost: string = '',
    sourceCheckedAt: string = '',
    sourceHttpStatus: number = 0,
  ) {
    this.id = id;
    this.taskId = taskId;
    this.taskTitle = taskTitle;
    this.summary = summary;
    this.sourceUrl = sourceUrl;
    this.submittedAt = submittedAt;
    this.fingerprint = fingerprint;
    this.status = status;
    this.revokedAt = revokedAt;
    this.sourceVerification = sourceVerification;
    this.sourceHost = sourceHost;
    this.sourceCheckedAt = sourceCheckedAt;
    this.sourceHttpStatus = sourceHttpStatus;
  }
}

export class NativeJobEvidence {
  id: string;
  title: string;
  status: string;
  detail: string;
  color: string;
  background: string;

  constructor(
    id: string,
    title: string,
    status: string,
    detail: string,
    color: string,
    background: string,
  ) {
    this.id = id;
    this.title = title;
    this.status = status;
    this.detail = detail;
    this.color = color;
    this.background = background;
  }
}

export class NativeApplicationStageOption {
  id: string;
  label: string;

  constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }
}

export class NativeApplicationEvent {
  stage: string;
  label: string;
  occurredAt: string;

  constructor(stage: string, label: string, occurredAt: string) {
    this.stage = stage;
    this.label = label;
    this.occurredAt = occurredAt;
  }
}

export class NativeResumeVersion {
  id: string;
  name: string;
  jobKey: string;
  jobTitle: string;
  content: string;
  createdAt: string;
  changeSummary: string;

  constructor(
    id: string,
    name: string,
    jobKey: string,
    jobTitle: string,
    content: string,
    createdAt: string,
    changeSummary: string,
  ) {
    this.id = id;
    this.name = name;
    this.jobKey = jobKey;
    this.jobTitle = jobTitle;
    this.content = content;
    this.createdAt = createdAt;
    this.changeSummary = changeSummary;
  }
}

export class NativeInterviewTurn {
  question: string;
  answer: string;
  createdAt: string;

  constructor(question: string, answer: string, createdAt: string) {
    this.question = question;
    this.answer = answer;
    this.createdAt = createdAt;
  }
}

export interface NativeWorkspaceSnapshot {
  resumeName: string;
  targetJob: string;
  trackedJobTitle: string;
  trackedJobCompany: string;
  trackedJobSource: string;
  trackedJobDescription: string;
  applicationJobKey: string;
  applicationStage: string;
  applicationUpdatedAt: string;
  applicationDeadline: string;
  nextInterviewAt: string;
  applicationEvents: NativeApplicationEvent[];
  applicationResumeVersionId: string;
  resumeSummary: string;
  resumeVersions: NativeResumeVersion[];
  interviewType: string;
  interviewStarted: boolean;
  interviewQuestion: string;
  interviewRound: number;
  interviewTurns: NativeInterviewTurn[];
  interviewFeedback: string;
  interviewModelName: string;
  evidenceCoverage: number;
  empiricalCoverage: number;
  growthBaselineCoverage: number;
  projectedCoverage: number;
  trackedJobs: number;
  growthTasks: NativeGrowthTask[];
  growthEvidenceRecords: NativeGrowthEvidenceRecord[];
  growthHistory: string[];
  jobEvidence: NativeJobEvidence[];
}

export function createNativeApplicationStageOptions(): NativeApplicationStageOption[] {
  return [
    new NativeApplicationStageOption('interested', '已收藏'),
    new NativeApplicationStageOption('preparing', '准备中'),
    new NativeApplicationStageOption('applied', '已投递'),
    new NativeApplicationStageOption('interview', '面试中'),
    new NativeApplicationStageOption('offer', 'Offer'),
    new NativeApplicationStageOption('closed', '已结束'),
  ];
}

export function createDefaultNativeJobEvidence(): NativeJobEvidence[] {
  return [
    new NativeJobEvidence(
      'react-project',
      'React 项目经历',
      '待补证据',
      '在简历画像中补充项目产出物、个人贡献和可验证结果。',
      '#B45309',
      '#FEF3C7',
    ),
    new NativeJobEvidence(
      'education',
      '本科及以上',
      '待确认',
      '确认教育背景和可提交的证明材料，避免把推测当作匹配结果。',
      '#B45309',
      '#FEF3C7',
    ),
    new NativeJobEvidence(
      'contribution',
      '清晰说明个人贡献',
      '待补证据',
      '在面试回答中补充个人行动、产出物和结果数据。',
      '#B91C1C',
      '#FEE2E2',
    ),
  ];
}
