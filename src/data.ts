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
    title: string;
    role: string;
    evidence: string;
    tags: string[];
  }>;
  resumeText: string;
};

export type Job = {
  id: string;
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
  jdAnalysis?: {
    conclusion: string;
    strengths: string[];
    risks: string[];
    actions: string[];
  };
  knowledgeBase?: {
    source: string;
    sourceJobId: string;
    lastVerifiedAt: string;
    retrievalScore: number;
    retrievalRankScore: number;
    matchScore?: number;
    rankingScore?: number;
    rerankScore?: number;
    rerankRank?: number;
    matchedTerms: string[];
    matchedSections: string[];
  };
};
