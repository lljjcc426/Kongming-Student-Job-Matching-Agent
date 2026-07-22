import type { Job } from "../../data";

export const APPLICATION_STORAGE_KEY = "kongming.application-tracker.v1";

export type ApplicationStage =
  | "interested"
  | "preparing"
  | "applied"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ApplicationEvent = {
  stage: ApplicationStage;
  occurredAt: string;
};

export type ApplicationRecord = {
  id: string;
  jobId: string;
  jobKind: "verified-job" | "imported-jd";
  title: string;
  company: string;
  sourceUrl: string | null;
  stage: ApplicationStage;
  createdAt: string;
  updatedAt: string;
  events: ApplicationEvent[];
};

export type DailyApplicationAction = {
  applicationId: string;
  title: string;
  action: string;
  priority: "high" | "medium" | "low";
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const applicationStageOptions: Array<{ value: ApplicationStage; label: string }> = [
  { value: "interested", label: "已收藏" },
  { value: "preparing", label: "材料准备" },
  { value: "applied", label: "已投递" },
  { value: "assessment", label: "笔试/测评" },
  { value: "interview", label: "面试中" },
  { value: "offer", label: "已获 Offer" },
  { value: "rejected", label: "未通过" },
  { value: "withdrawn", label: "已终止" },
];

const validStages = new Set<ApplicationStage>(applicationStageOptions.map((item) => item.value));

const isRecord = (value: unknown): value is ApplicationRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ApplicationRecord>;
  return typeof record.id === "string"
    && typeof record.jobId === "string"
    && (record.jobKind === "verified-job" || record.jobKind === "imported-jd")
    && typeof record.title === "string"
    && typeof record.company === "string"
    && validStages.has(record.stage as ApplicationStage)
    && typeof record.createdAt === "string"
    && typeof record.updatedAt === "string"
    && Array.isArray(record.events);
};

export function loadApplicationRecords(storage: StorageLike): ApplicationRecord[] {
  try {
    const raw = storage.getItem(APPLICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function saveApplicationRecords(storage: StorageLike, records: ApplicationRecord[]): void {
  try {
    storage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Tracking is an optional local enhancement; storage failures must not block analysis.
  }
}

export function createApplicationRecord(job: Job, now = new Date()): ApplicationRecord | null {
  if (job.jobKind === "career-direction") return null;
  const timestamp = now.toISOString();
  return {
    id: `application-${job.id}`,
    jobId: job.id,
    jobKind: job.jobKind,
    title: job.title,
    company: job.companyScenario,
    sourceUrl: job.sourceMetadata?.sourceUrl ?? job.applicationLinks?.[0]?.url ?? null,
    stage: "interested",
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [{ stage: "interested", occurredAt: timestamp }],
  };
}

export function upsertApplication(records: ApplicationRecord[], job: Job, now = new Date()): ApplicationRecord[] {
  const existing = records.find((record) => record.jobId === job.id);
  if (existing) return records;
  const created = createApplicationRecord(job, now);
  return created ? [created, ...records] : records;
}

export function updateApplicationStage(
  records: ApplicationRecord[],
  applicationId: string,
  stage: ApplicationStage,
  now = new Date(),
): ApplicationRecord[] {
  const timestamp = now.toISOString();
  return records.map((record) => {
    if (record.id !== applicationId || record.stage === stage) return record;
    return {
      ...record,
      stage,
      updatedAt: timestamp,
      events: [...record.events, { stage, occurredAt: timestamp }],
    };
  });
}

export function buildDailyApplicationActions(records: ApplicationRecord[], now = new Date()): DailyApplicationAction[] {
  const current = now.getTime();
  return records
    .filter((record) => record.stage !== "offer" && record.stage !== "rejected" && record.stage !== "withdrawn")
    .map((record) => {
      const ageDays = Math.max(0, Math.floor((current - new Date(record.updatedAt).getTime()) / 86_400_000));
      if (record.stage === "interview") {
        return { applicationId: record.id, title: record.title, action: "按岗位证据矩阵准备面试故事并核对时间安排。", priority: "high" as const };
      }
      if (record.stage === "assessment") {
        return { applicationId: record.id, title: record.title, action: "确认笔试或测评截止时间，完成针对性练习。", priority: "high" as const };
      }
      if (record.stage === "applied" && ageDays >= 3) {
        return { applicationId: record.id, title: record.title, action: "已投递超过 3 天，可核对招聘状态或进行一次礼貌跟进。", priority: "medium" as const };
      }
      if (record.stage === "applied") {
        return { applicationId: record.id, title: record.title, action: "保存投递凭证并等待企业反馈。", priority: "low" as const };
      }
      if (record.stage === "preparing") {
        return { applicationId: record.id, title: record.title, action: "完成事实核验、简历定制与投递前检查。", priority: "medium" as const };
      }
      return { applicationId: record.id, title: record.title, action: "确认岗位仍在招聘，再进入材料准备。", priority: "medium" as const };
    })
    .sort((left, right) => ({ high: 0, medium: 1, low: 2 })[left.priority] - ({ high: 0, medium: 1, low: 2 })[right.priority]);
}
