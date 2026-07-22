export type StudentProfile = {
  name: string;
  grade: string;
  major: string;
  school: string;
  target: string;
  cityPreference: string[];
  skills: string[];
  interests: string[];
  experiences: Array<{
    id: string;
    title: string;
    role: string;
    evidence: string;
    tags: string[];
    sourceSection: "internship" | "project" | "campus" | "other";
    confirmedByUser: boolean;
  }>;
  resumeText: string;
  resumeConfirmed: boolean;
};

export type JobKind = "verified-job" | "imported-jd" | "career-direction";
export type JobStatus = "active" | "expired" | "unknown";
export type JobSourceType = "official-career-site" | "user-imported" | "demo-fixture" | "model-generated";

export type Job = {
  id: string;
  jobKind: JobKind;
  title: string;
  track: string;
  city: string;
  level: string;
  companyScenario: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  bonus: string[];
  keywords: string[];
  priority: "高" | "中" | "低";
  applicationLinks?: Array<{
    company: string;
    url: string;
    note: string;
  }>;
  sourceMetadata?: {
    sourceType: JobSourceType;
    sourceName: string;
    sourceUrl: string | null;
    verification: string;
    publishedAt: string | null;
    updatedAt: string | null;
    lastSeenAt: string | null;
    verifiedAt: string | null;
    status: JobStatus;
    isDemoData: boolean;
  };
  jdAnalysis?: {
    conclusion: string;
    strengths: string[];
    risks: string[];
    actions: string[];
  };
};
