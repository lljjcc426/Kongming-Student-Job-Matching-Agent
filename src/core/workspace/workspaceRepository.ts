import type { Job, JobKind } from "../../data";
import type { StructuredResume } from "../../modelParsers";
import { defaultPrivacyPreferences, type PrivacyPreferences } from "../privacy/redaction";

export type ProposalDecision = "accepted" | "rejected";

export type ResumeVersion = {
  id: string;
  name: string;
  jobId: string;
  jobTitle: string;
  content: string;
  acceptedProposalIds: string[];
  proposalEdits: Record<string, string>;
  evidenceCoverage: number;
  sourceFingerprint: string;
  changeSummary: string;
  createdAt: string;
};

export type CareerWorkspace = {
  resumeText: string;
  structuredResume: StructuredResume | null;
  resumeConfirmed: boolean;
  resumeSource: string;
  customTitle: string;
  customJdText: string;
  customJobs: Job[];
  publicJobs: Job[];
  modelJobs: Job[];
  selectedJobId: string;
  activeJobTab: JobKind;
  proposalContextKey: string;
  proposalDecisions: Record<string, ProposalDecision>;
  proposalEdits: Record<string, string>;
  resumeVersions: ResumeVersion[];
  privacyPreferences: PrivacyPreferences;
  savedAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "kongming.career-workspace.v1";
const WORKSPACE_VERSION = 1;
const MAX_RESUME_TEXT_LENGTH = 200_000;
const MAX_JD_TEXT_LENGTH = 100_000;
const MAX_JOB_COUNT_PER_SOURCE = 80;
const MAX_RESUME_VERSION_COUNT = 30;
const MAX_VERSION_CONTENT_LENGTH = 240_000;

const emptyWorkspace = (): CareerWorkspace => ({
  resumeText: "",
  structuredResume: null,
  resumeConfirmed: false,
  resumeSource: "等待上传",
  customTitle: "",
  customJdText: "",
  customJobs: [],
  publicJobs: [],
  modelJobs: [],
  selectedJobId: "",
  activeJobTab: "verified-job",
  proposalContextKey: "",
  proposalDecisions: {},
  proposalEdits: {},
  resumeVersions: [],
  privacyPreferences: { ...defaultPrivacyPreferences },
  savedAt: "",
});

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const asString = (value: unknown, maxLength = 10_000) =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

const asStringArray = (value: unknown, maxItems = 100, maxItemLength = 2_000) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, maxItems).map((item) => item.slice(0, maxItemLength))
    : [];

const asJobKind = (value: unknown): JobKind =>
  value === "imported-jd" || value === "career-direction" ? value : "verified-job";

const sanitizeStructuredResume = (value: unknown): StructuredResume | null => {
  const source = asObject(value);
  if (!source) return null;
  return {
    name: asString(source.name, 100),
    education: asStringArray(source.education),
    internships: asStringArray(source.internships),
    projects: asStringArray(source.projects),
    campus: asStringArray(source.campus),
    honors: asStringArray(source.honors),
    skills: asStringArray(source.skills, 200, 200),
    targetRoles: asStringArray(source.targetRoles, 30, 200),
    summary: asString(source.summary, 5_000),
  };
};

const sanitizeJob = (value: unknown): Job | null => {
  const source = asObject(value);
  const id = asString(source?.id, 300).trim();
  const title = asString(source?.title, 300).trim();
  if (!source || !id || !title) return null;
  const priority = source.priority === "高" || source.priority === "低" ? source.priority : "中";
  const sourceMetadata = asObject(source.sourceMetadata);
  const applicationLinks = Array.isArray(source.applicationLinks)
    ? source.applicationLinks.map(asObject).filter((item): item is Record<string, unknown> => Boolean(item)).map((item) => ({
      company: asString(item.company, 300),
      url: asString(item.url, 2_000),
      note: asString(item.note, 500),
    })).filter((item) => item.company && /^https?:\/\//i.test(item.url)).slice(0, 12)
    : undefined;

  return {
    id,
    jobKind: asJobKind(source.jobKind),
    title,
    track: asString(source.track, 300),
    city: asString(source.city, 200),
    level: asString(source.level, 200),
    companyScenario: asString(source.companyScenario, 500),
    summary: asString(source.summary, 5_000),
    responsibilities: asStringArray(source.responsibilities),
    requirements: asStringArray(source.requirements),
    bonus: asStringArray(source.bonus),
    keywords: asStringArray(source.keywords, 200, 200),
    priority,
    applicationLinks,
    sourceMetadata: sourceMetadata ? {
      sourceType: sourceMetadata.sourceType === "official-career-site"
        || sourceMetadata.sourceType === "user-imported"
        || sourceMetadata.sourceType === "demo-fixture"
        ? sourceMetadata.sourceType
        : "model-generated",
      sourceName: asString(sourceMetadata.sourceName, 500),
      sourceUrl: typeof sourceMetadata.sourceUrl === "string" ? asString(sourceMetadata.sourceUrl, 2_000) : null,
      verification: asString(sourceMetadata.verification, 2_000),
      publishedAt: typeof sourceMetadata.publishedAt === "string" ? asString(sourceMetadata.publishedAt, 100) : null,
      updatedAt: typeof sourceMetadata.updatedAt === "string" ? asString(sourceMetadata.updatedAt, 100) : null,
      lastSeenAt: typeof sourceMetadata.lastSeenAt === "string" ? asString(sourceMetadata.lastSeenAt, 100) : null,
      verifiedAt: typeof sourceMetadata.verifiedAt === "string" ? asString(sourceMetadata.verifiedAt, 100) : null,
      status: sourceMetadata.status === "active" || sourceMetadata.status === "expired" ? sourceMetadata.status : "unknown",
      isDemoData: sourceMetadata.isDemoData === true,
    } : undefined,
  };
};

const sanitizeJobs = (value: unknown) =>
  Array.isArray(value) ? value.map(sanitizeJob).filter((job): job is Job => Boolean(job)).slice(0, MAX_JOB_COUNT_PER_SOURCE) : [];

const sanitizeProposalDecisions = (value: unknown): Record<string, ProposalDecision> => {
  const source = asObject(value);
  if (!source) return {};
  return Object.fromEntries(Object.entries(source)
    .filter(([, decision]) => decision === "accepted" || decision === "rejected")
    .slice(0, 200)) as Record<string, ProposalDecision>;
};

const sanitizeProposalEdits = (value: unknown): Record<string, string> => {
  const source = asObject(value);
  if (!source) return {};
  return Object.fromEntries(Object.entries(source)
    .filter(([, text]) => typeof text === "string")
    .slice(0, 200)
    .map(([id, text]) => [id, asString(text, 10_000)]));
};

const sanitizePrivacyPreferences = (value: unknown): PrivacyPreferences => {
  const source = asObject(value);
  if (!source) return { ...defaultPrivacyPreferences };
  return Object.fromEntries(Object.entries(defaultPrivacyPreferences).map(([key, fallback]) => [
    key,
    typeof source[key] === "boolean" ? source[key] : fallback,
  ])) as PrivacyPreferences;
};

const sanitizeResumeVersions = (value: unknown): ResumeVersion[] => {
  if (!Array.isArray(value)) return [];
  return value.map(asObject).filter((item): item is Record<string, unknown> => Boolean(item)).map((item) => ({
    id: asString(item.id, 300),
    name: asString(item.name, 300) || asString(item.jobTitle, 300) || "历史投递版本",
    jobId: asString(item.jobId, 300),
    jobTitle: asString(item.jobTitle, 300),
    content: asString(item.content, MAX_VERSION_CONTENT_LENGTH),
    acceptedProposalIds: asStringArray(item.acceptedProposalIds, 200, 300),
    proposalEdits: sanitizeProposalEdits(item.proposalEdits),
    evidenceCoverage: Math.max(0, Math.min(100, Number(item.evidenceCoverage) || 0)),
    sourceFingerprint: asString(item.sourceFingerprint, 100),
    changeSummary: asString(item.changeSummary, 1_000) || "历史版本未记录差异摘要",
    createdAt: asString(item.createdAt, 100),
  })).filter((item) => item.id && item.jobId && item.content && item.createdAt).slice(0, MAX_RESUME_VERSION_COUNT);
};

export function loadCareerWorkspace(storage: StorageLike): CareerWorkspace {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    const parsed = asObject(JSON.parse(raw));
    if (!parsed || parsed.version !== WORKSPACE_VERSION) return emptyWorkspace();
    return {
      resumeText: asString(parsed.resumeText, MAX_RESUME_TEXT_LENGTH),
      structuredResume: sanitizeStructuredResume(parsed.structuredResume),
      resumeConfirmed: parsed.resumeConfirmed === true,
      resumeSource: asString(parsed.resumeSource, 300) || "已恢复本地工作区",
      customTitle: asString(parsed.customTitle, 500),
      customJdText: asString(parsed.customJdText, MAX_JD_TEXT_LENGTH),
      customJobs: sanitizeJobs(parsed.customJobs),
      publicJobs: sanitizeJobs(parsed.publicJobs),
      modelJobs: sanitizeJobs(parsed.modelJobs),
      selectedJobId: asString(parsed.selectedJobId, 300),
      activeJobTab: asJobKind(parsed.activeJobTab),
      proposalContextKey: asString(parsed.proposalContextKey, 500),
      proposalDecisions: sanitizeProposalDecisions(parsed.proposalDecisions),
      proposalEdits: sanitizeProposalEdits(parsed.proposalEdits),
      resumeVersions: sanitizeResumeVersions(parsed.resumeVersions),
      privacyPreferences: sanitizePrivacyPreferences(parsed.privacyPreferences),
      savedAt: asString(parsed.savedAt, 100),
    };
  } catch {
    return emptyWorkspace();
  }
}

export function saveCareerWorkspace(storage: StorageLike, workspace: CareerWorkspace): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: WORKSPACE_VERSION,
      ...workspace,
      resumeVersions: workspace.resumeVersions.slice(0, MAX_RESUME_VERSION_COUNT),
      savedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearCareerWorkspace(storage: StorageLike) {
  storage.removeItem(STORAGE_KEY);
}

export function fingerprintText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildProposalContextKey(jobId: string, resumeText: string) {
  return jobId && resumeText.trim() ? `${jobId}:${fingerprintText(resumeText)}` : "";
}

export function createResumeVersion(input: Omit<ResumeVersion, "id" | "createdAt">): ResumeVersion {
  const createdAt = new Date().toISOString();
  return {
    ...input,
    id: `resume-${Date.now()}-${fingerprintText(`${input.jobId}:${input.content}`).slice(0, 6)}`,
    createdAt,
  };
}

export function summarizeResumeVersionChanges(currentContent: string, previousContent?: string): string {
  if (!previousContent) return "首个面向该岗位的投递版本";
  if (currentContent === previousContent) return "内容与上一版本一致，仅重新完成事实确认";
  const previousLines = new Set(previousContent.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const currentLines = new Set(currentContent.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const added = [...currentLines].filter((line) => !previousLines.has(line)).length;
  const removed = [...previousLines].filter((line) => !currentLines.has(line)).length;
  return `相较上一版本新增 ${added} 行、移除 ${removed} 行`;
}
