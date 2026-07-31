import type { Job, StudentProfile } from "../../data";
import { analyzeMatch } from "../../matchEngine";
import type { StructuredResume } from "../../modelParsers";

export const EMPTY_JOB: Job = {
  id: "empty",
  title: "等待模型推荐岗位",
  track: "待识别",
  city: "不限",
  level: "岗位",
  companyScenario: "等待模型输出",
  summary: "",
  responsibilities: [],
  requirements: [],
  bonus: [],
  keywords: [],
  priority: "低",
};

export const buildJobDiscoveryAgents = (resume: StructuredResume) => {
  const targets = resume.targetRoles.slice(0, 3).join("、") || "学生简历中最匹配的岗位";
  const education = resume.education.slice(0, 2).join("、") || "专业背景";
  return [
    { focus: `高相关岗位：优先围绕 ${targets} 和 ${education} 推荐，偏专业核心岗位`, jobCount: 3 },
    { focus: "相邻可迁移岗位：根据项目、校园经历、数据能力和可迁移能力推荐", jobCount: 3 },
    { focus: "成长型岗位：适合学生补强后投递或作为实习起点", jobCount: 3 },
  ];
};

const normalizeRoleText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "")
    .trim();

const normalizeJobLevel = (job: Job) => (/实习|助理/.test(`${job.title} ${job.level}`) ? "intern" : "regular");

const companyKey = (job: Job) =>
  normalizeRoleText(
    job.applicationLinks?.[0]?.company
      || job.companyScenario.split("·")[0]
      || job.id,
  );

const normalizeJobKey = (job: Job) =>
  `${normalizeRoleText(job.title)}-${normalizeJobLevel(job)}-${companyKey(job)}`;

type RecommendationSupervisionOptions = {
  profile?: StudentProfile;
  resumeText?: string;
  limit?: number;
  maxPerCompany?: number;
  maxPerTrack?: number;
};

const priorityFromMatch = (score: number): Job["priority"] =>
  score >= 82 ? "高" : score >= 68 ? "中" : "低";

export const superviseRecommendedJobs = (
  jobs: Job[],
  options: RecommendationSupervisionOptions = {},
) => {
  const {
    profile,
    resumeText = "",
    limit = 6,
    maxPerCompany = 3,
    maxPerTrack = 2,
  } = options;
  const usedKeys = new Set<string>();
  const usedIds = new Set<string>();
  const normalizedJobs = jobs
    .filter((job) => {
      const key = normalizeJobKey(job);
      if (key.length < 2) return false;
      if (usedKeys.has(key)) return false;
      usedKeys.add(key);
      return true;
    })
    .map((job, index) => ({
      ...job,
      id: `${normalizeRoleText(job.id || job.title || "agent-job") || "agent-job"}-${index + 1}`,
      applicationLinks: job.applicationLinks,
      responsibilities: job.responsibilities.slice(0, 5),
      requirements: job.requirements.slice(0, 5),
      bonus: job.bonus.slice(0, 5),
      keywords: job.keywords.slice(0, 8),
    }));

  const rankedJobs = normalizedJobs
    .map((job, index) => {
      if (!profile) {
        return { job, rankingScore: normalizedJobs.length - index };
      }
      const matchScore = analyzeMatch(profile, job, resumeText).total;
      const retrievalScore = job.knowledgeBase?.retrievalScore;
      const rankingScore = retrievalScore === undefined
        ? matchScore
        : matchScore * 0.72 + retrievalScore * 100 * 0.28;
      return {
        job: {
          ...job,
          priority: priorityFromMatch(matchScore),
          knowledgeBase: job.knowledgeBase
            ? {
                ...job.knowledgeBase,
                matchScore,
                rankingScore: Number(rankingScore.toFixed(2)),
              }
            : undefined,
        },
        rankingScore,
      };
    })
    .sort((left, right) => right.rankingScore - left.rankingScore);

  const selected: typeof rankedJobs = [];
  const companyCounts = new Map<string, number>();
  const trackCounts = new Map<string, number>();
  for (const candidate of rankedJobs) {
    const company = companyKey(candidate.job);
    const track = normalizeRoleText(candidate.job.track) || candidate.job.id;
    if ((companyCounts.get(company) ?? 0) >= maxPerCompany) continue;
    if ((trackCounts.get(track) ?? 0) >= maxPerTrack) continue;
    selected.push(candidate);
    companyCounts.set(company, (companyCounts.get(company) ?? 0) + 1);
    trackCounts.set(track, (trackCounts.get(track) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  if (selected.length < limit) {
    for (const candidate of rankedJobs) {
      if (selected.includes(candidate)) continue;
      const company = companyKey(candidate.job);
      if ((companyCounts.get(company) ?? 0) >= maxPerCompany) continue;
      selected.push(candidate);
      companyCounts.set(company, (companyCounts.get(company) ?? 0) + 1);
      if (selected.length >= limit) break;
    }
  }
  if (selected.length < limit) {
    for (const candidate of rankedJobs) {
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
      if (selected.length >= limit) break;
    }
  }

  return selected.map(({ job }, index) => {
    let nextId = job.id;
    while (usedIds.has(nextId)) {
      nextId = `${job.id}-${index + 1}`;
    }
    usedIds.add(nextId);
    return { ...job, id: nextId };
  });
};
