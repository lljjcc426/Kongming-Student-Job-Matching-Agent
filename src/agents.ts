import type { Job, StudentProfile } from "./data";
import type { MatchResult } from "./matchEngine";

export type AgentTeamResult = {
  resumeAgent: {
    summary: string;
    signals: string[];
    missingInfo: string[];
  };
  jobSearchAgent: {
    searchQueries: string[];
    sourcePlan: string[];
    candidates: Array<{ title: string; score: number; reason: string }>;
  };
  advisorAgent: {
    decision: string;
    reasons: string[];
    nextActions: string[];
  };
  interviewAgent: {
    questions: string[];
    focus: string;
  };
};

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const buildSearchUrl = (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

export function runAgentTeam(profile: StudentProfile, jobs: Job[], selectedJob: Job, result: MatchResult, resumeText: string): AgentTeamResult {
  const sortedCandidates = jobs
    .map((job) => ({
      job,
      score: job.id === selectedJob.id ? result.total : Math.max(45, result.total - Math.abs(job.keywords.length - selectedJob.keywords.length) * 5),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const signals = unique([
    ...profile.skills.slice(0, 5),
    ...profile.experiences.flatMap((item) => item.tags).slice(0, 6),
    ...result.coveredKeywords.slice(0, 5),
  ]);

  const searchQueries = unique([
    `${selectedJob.title} ${selectedJob.city} 实习`,
    `${selectedJob.track} 实习 ${result.coveredKeywords.slice(0, 2).join(" ")}`,
    `${profile.major} ${selectedJob.track} 学生岗位`,
  ]);

  return {
    resumeAgent: {
      summary: `已识别 ${profile.experiences.length} 段经历、${signals.length} 个能力信号和 ${resumeText.length} 字简历文本。`,
      signals,
      missingInfo: [
        "建议补充每段经历的时间、团队规模和个人职责边界。",
        "建议补充至少 1 个量化结果，便于证明贡献。",
        result.missingKeywords.length > 0 ? `建议补充 ${result.missingKeywords.slice(0, 3).join("、")} 等岗位关键词。` : "当前关键词覆盖较完整，建议继续强化结果表达。",
      ],
    },
    jobSearchAgent: {
      searchQueries,
      sourcePlan: ["企业招聘官网", "高校就业信息平台", "公开实习岗位平台", "行业社区与公开岗位集合"],
      candidates: sortedCandidates.map(({ job, score }) => ({
        title: job.title,
        score,
        reason: `${job.track}方向与当前画像存在交集，关键词覆盖 ${job.keywords.filter((keyword) => result.coveredKeywords.includes(keyword)).length}/${job.keywords.length}。`,
      })),
    },
    advisorAgent: {
      decision: result.verdict,
      reasons: result.strengths,
      nextActions: [
        "优先处理关键词缺口，再改写项目经历。",
        "将最相关项目放到简历靠前位置。",
        "投递前准备与岗位职责对应的面试故事。",
      ],
    },
    interviewAgent: {
      questions: [
        `请用 2 分钟介绍一段最能证明你适合${selectedJob.title}的经历。`,
        `你如何判断一个${selectedJob.track}需求是否值得优先推进？`,
        result.risks[0],
      ],
      focus: "重点考察经历真实性、问题拆解能力、岗位动机和结果复盘能力。",
    },
  };
}

export function evaluateInterviewAnswer(answer: string, job: Job, result: MatchResult) {
  const trimmed = answer.trim();
  if (!trimmed) {
    return {
      score: 0,
      summary: "等待回答。建议按背景、任务、行动、结果四段组织。",
      suggestions: ["说明项目背景", "讲清个人动作", "补充量化结果"],
    };
  }

  const keywordHits = result.coveredKeywords.filter((keyword) => trimmed.includes(keyword)).length;
  const structureScore = ["背景", "任务", "行动", "结果", "复盘"].filter((word) => trimmed.includes(word)).length * 8;
  const lengthScore = Math.min(35, Math.round(trimmed.length / 8));
  const score = Math.min(100, 35 + keywordHits * 8 + structureScore + lengthScore);

  return {
    score,
    summary: `回答与${job.track}方向有一定关联，已命中 ${keywordHits} 个岗位关键词。`,
    suggestions: [
      score < 75 ? "建议补充更明确的量化结果。" : "结构较完整，可进一步压缩表达。",
      "建议明确自己在团队中的职责边界。",
      "结尾补充复盘收获，连接到目标岗位要求。",
    ],
  };
}

export function getSearchLinks(queries: string[]) {
  return queries.map((query) => ({ query, url: buildSearchUrl(query) }));
}

