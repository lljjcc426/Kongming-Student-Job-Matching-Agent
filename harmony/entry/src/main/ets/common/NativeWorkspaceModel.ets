export class NativeGrowthTask {
  id: string;
  title: string;
  description: string;
  evidenceRequirement: string;
  projectedGain: number;
  status: string;
  jobKey: string;
  jobTitle: string;
  focusDimension: string;
  baselineScore: number;
  targetScore: number;
  sourceInterviewId: string;

  constructor(
    id: string,
    title: string,
    description: string,
    evidenceRequirement: string,
    projectedGain: number,
    status: string = 'todo',
    jobKey: string = '',
    jobTitle: string = '',
    focusDimension: string = 'general',
    baselineScore: number = 0,
    targetScore: number = 0,
    sourceInterviewId: string = '',
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.evidenceRequirement = evidenceRequirement;
    this.projectedGain = projectedGain;
    this.status = status;
    this.jobKey = jobKey;
    this.jobTitle = jobTitle;
    this.focusDimension = focusDimension;
    this.baselineScore = baselineScore;
    this.targetScore = targetScore;
    this.sourceInterviewId = sourceInterviewId;
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
  sourceCheckMethod: string;
  jobKey: string;
  jobTitle: string;

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
    sourceCheckMethod: string = 'HEAD',
    jobKey: string = '',
    jobTitle: string = '',
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
    this.sourceCheckMethod = sourceCheckMethod;
    this.jobKey = jobKey;
    this.jobTitle = jobTitle;
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

export class NativeTrackedJobRecord {
  key: string;
  title: string;
  company: string;
  source: string;
  description: string;
  applicationStage: string;
  applicationUpdatedAt: string;
  applicationDeadline: string;
  nextInterviewAt: string;
  applicationEvents: NativeApplicationEvent[];
  applicationResumeVersionId: string;
  createdAt: string;
  updatedAt: string;

  constructor(
    key: string,
    title: string,
    company: string,
    source: string,
    description: string,
    applicationStage: string,
    applicationUpdatedAt: string,
    applicationDeadline: string,
    nextInterviewAt: string,
    applicationEvents: NativeApplicationEvent[],
    applicationResumeVersionId: string,
    createdAt: string,
    updatedAt: string,
  ) {
    this.key = key;
    this.title = title;
    this.company = company;
    this.source = source;
    this.description = description;
    this.applicationStage = applicationStage;
    this.applicationUpdatedAt = applicationUpdatedAt;
    this.applicationDeadline = applicationDeadline;
    this.nextInterviewAt = nextInterviewAt;
    this.applicationEvents = applicationEvents;
    this.applicationResumeVersionId = applicationResumeVersionId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

export class NativeJobFeedbackRecord {
  jobKey: string;
  feedback: string;
  company: string;
  title: string;
  city: string;
  createdAt: string;

  constructor(jobKey: string, feedback: string, company: string, title: string, city: string, createdAt: string) {
    this.jobKey = jobKey;
    this.feedback = feedback;
    this.company = company;
    this.title = title;
    this.city = city;
    this.createdAt = createdAt;
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

export class NativeInterviewCompetencyResult {
  key: string;
  label: string;
  round: number;
  score: number;
  status: string;
  evidenceExcerpt: string;
  gap: string;

  constructor(
    key: string,
    label: string,
    round: number,
    score: number,
    status: string,
    evidenceExcerpt: string,
    gap: string,
  ) {
    this.key = key;
    this.label = label;
    this.round = round;
    this.score = score;
    this.status = status;
    this.evidenceExcerpt = evidenceExcerpt;
    this.gap = gap;
  }
}

export class NativeInterviewSessionRecord {
  id: string;
  jobKey: string;
  jobTitle: string;
  company: string;
  interviewType: string;
  difficulty: string;
  durationMinutes: number;
  elapsedSeconds: number;
  turns: NativeInterviewTurn[];
  feedback: string;
  modelName: string;
  overallScore: number;
  structureScore: number;
  evidenceScore: number;
  relevanceScore: number;
  clarityScore: number;
  strongestLabel: string;
  priorityLabel: string;
  evidenceLabel: string;
  assessmentSource: string;
  assessmentVersion: string;
  evidenceReferences: string[];
  completedAt: string;
  completedAtEpoch: number;
  videoRecorded: boolean;
  videoUri: string;
  videoDurationSeconds: number;
  videoSizeBytes: number;
  trainingFocusDimension: string;
  trainingBaselineScore: number;
  trainingTargetScore: number;
  competencyLabels: string[];
  competencyCoveredCount: number;
  competencyResults: NativeInterviewCompetencyResult[];
  jobDescriptionSnapshot: string;
  resumeVersionId: string;
  resumeVersionName: string;
  requirementFocuses: string[];
  improvedAnswer: string;

  constructor(
    id: string,
    jobKey: string,
    jobTitle: string,
    company: string,
    interviewType: string,
    difficulty: string,
    durationMinutes: number,
    elapsedSeconds: number,
    turns: NativeInterviewTurn[],
    feedback: string,
    modelName: string,
    overallScore: number,
    structureScore: number,
    evidenceScore: number,
    relevanceScore: number,
    clarityScore: number,
    strongestLabel: string,
    priorityLabel: string,
    evidenceLabel: string,
    assessmentSource: string,
    assessmentVersion: string,
    evidenceReferences: string[],
    completedAt: string,
    completedAtEpoch: number,
    videoRecorded: boolean = false,
    videoUri: string = '',
    videoDurationSeconds: number = 0,
    videoSizeBytes: number = 0,
    trainingFocusDimension: string = '',
    trainingBaselineScore: number = 0,
    trainingTargetScore: number = 0,
    competencyLabels: string[] = [],
    competencyCoveredCount: number = 0,
    competencyResults: NativeInterviewCompetencyResult[] = [],
    jobDescriptionSnapshot: string = '',
    resumeVersionId: string = '',
    resumeVersionName: string = '',
    requirementFocuses: string[] = [],
    improvedAnswer: string = '',
  ) {
    this.id = id;
    this.jobKey = jobKey;
    this.jobTitle = jobTitle;
    this.company = company;
    this.interviewType = interviewType;
    this.difficulty = difficulty;
    this.durationMinutes = durationMinutes;
    this.elapsedSeconds = elapsedSeconds;
    this.turns = turns;
    this.feedback = feedback;
    this.modelName = modelName;
    this.overallScore = overallScore;
    this.structureScore = structureScore;
    this.evidenceScore = evidenceScore;
    this.relevanceScore = relevanceScore;
    this.clarityScore = clarityScore;
    this.strongestLabel = strongestLabel;
    this.priorityLabel = priorityLabel;
    this.evidenceLabel = evidenceLabel;
    this.assessmentSource = assessmentSource;
    this.assessmentVersion = assessmentVersion;
    this.evidenceReferences = evidenceReferences;
    this.completedAt = completedAt;
    this.completedAtEpoch = completedAtEpoch;
    this.videoRecorded = videoRecorded;
    this.videoUri = videoUri;
    this.videoDurationSeconds = videoDurationSeconds;
    this.videoSizeBytes = videoSizeBytes;
    this.trainingFocusDimension = trainingFocusDimension;
    this.trainingBaselineScore = trainingBaselineScore;
    this.trainingTargetScore = trainingTargetScore;
    this.competencyLabels = competencyLabels;
    this.competencyCoveredCount = competencyCoveredCount;
    this.competencyResults = competencyResults;
    this.jobDescriptionSnapshot = jobDescriptionSnapshot;
    this.resumeVersionId = resumeVersionId;
    this.resumeVersionName = resumeVersionName;
    this.requirementFocuses = requirementFocuses;
    this.improvedAnswer = improvedAnswer;
  }
}

export class NativeJobStory {
  id: string = '';
  title: string = '';
  requirement: string = '';
  situation: string = '';
  task: string = '';
  action: string = '';
  result: string = '';
  evidence: string = '';
  sourceSessionId: string = '';
  sourceQuestion: string = '';
  sourceAnswer: string = '';
}

export class NativeJobMaterialRecord {
  jobKey: string = '';
  candidateName: string = '';
  contact: string = '';
  resumeContent: string = '';
  baseResumeContent: string = '';
  sourceResumeVersionId: string = '';
  confirmedSignature: string = '';
  confirmedAt: string = '';
  stories: NativeJobStory[] = [];
  updatedAt: string = '';
}

export interface NativeWorkspaceSnapshot {
  resumeName: string;
  targetJob: string;
  trackedJobRecords: NativeTrackedJobRecord[];
  jobCompareKeys: string[];
  jobMaterialRecords: NativeJobMaterialRecord[];
  activeTrackedJobKey: string;
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
  jobPreferredCities: string;
  jobPreferredEmploymentType: string;
  jobGraduationYear: string;
  jobSalaryExpectation: string;
  jobPreferredIndustries: string;
  jobPreferredCompanies: string;
  jobFeedbackRecords: NativeJobFeedbackRecord[];
  interviewType: string;
  interviewStarted: boolean;
  interviewQuestion: string;
  interviewRound: number;
  interviewTurns: NativeInterviewTurn[];
  interviewFeedback: string;
  interviewModelName: string;
  interviewDifficulty: string;
  interviewDurationMinutes: number;
  interviewElapsedSeconds: number;
  interviewSessionPhase: string;
  interviewSessionUpdatedAt: number;
  interviewTimeExpired: boolean;
  interviewSessions: NativeInterviewSessionRecord[];
  currentInterviewSessionId: string;
  currentInterviewVideoUri: string;
  currentInterviewVideoDurationSeconds: number;
  currentInterviewVideoSizeBytes: number;
  evidenceCoverage: number;
  empiricalCoverage: number;
  growthBaselineCoverage: number;
  projectedCoverage: number;
  trackedJobs: number;
  growthTasks: NativeGrowthTask[];
  growthEvidenceRecords: NativeGrowthEvidenceRecord[];
  growthHistory: string[];
  growthHistoryJobKeys: string[];
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
