import type { Job, StudentProfile } from "./data";

export type MatchResult = {
  total: number;
  verdict: "优先投递" | "补强后投递" | "暂不优先";
  dimensions: Array<{ name: string; score: number; description: string }>;
  coveredKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  risks: string[];
  resumeActions: Array<{ title: string; detail: string; impact: string }>;
  actionPlan: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const countHits = (source: string[], target: string[]) => {
  const normalizedSource = source.map((item) => item.toLowerCase());
  return target.filter((item) =>
    normalizedSource.some((sourceItem) => sourceItem.includes(item.toLowerCase()) || item.toLowerCase().includes(sourceItem)),
  );
};

export function analyzeMatch(profile: StudentProfile, job: Job, resumeText: string): MatchResult {
  const resume = resumeText.toLowerCase();
  const profileSignals = [
    ...profile.skills,
    ...profile.interests,
    ...profile.experiences.flatMap((item) => item.tags),
    profile.major,
    profile.target,
  ];

  const coveredKeywords = job.keywords.filter((keyword) => resume.includes(keyword.toLowerCase()) || countHits(profileSignals, [keyword]).length > 0);
  const missingKeywords = job.keywords.filter((keyword) => !coveredKeywords.includes(keyword));
  const keywordScore = job.keywords.length
    ? clamp((coveredKeywords.length / job.keywords.length) * 100)
    : 0;

  const abilityHits = countHits(profile.skills, job.keywords);
  const abilityScore = clamp(52 + abilityHits.length * 9 + (profile.cityPreference.includes(job.city) ? 6 : 0));

  const experienceHits = profile.experiences.filter((experience) =>
    experience.tags.some((tag) => job.keywords.includes(tag)),
  );
  const experienceScore = clamp(48 + experienceHits.length * 14 + (resumeText.length > 120 ? 8 : 0));

  const interestHits = countHits(profile.interests, [job.track, job.title, job.summary]);
  const interestScore = clamp(56 + interestHits.length * 12 + (profile.target.includes(job.track) ? 14 : 0));

  const growthScore = clamp(66 + coveredKeywords.length * 3 - missingKeywords.length * 2);
  const total = clamp(abilityScore * 0.28 + experienceScore * 0.26 + keywordScore * 0.22 + interestScore * 0.14 + growthScore * 0.1);
  const verdict = total >= 82 ? "优先投递" : total >= 68 ? "补强后投递" : "暂不优先";

  return {
    total,
    verdict,
    dimensions: [
      { name: "能力匹配", score: abilityScore, description: "技能标签与岗位关键词的重合程度" },
      { name: "经历匹配", score: experienceScore, description: "项目、实习和竞赛经历对岗位职责的支撑" },
      { name: "关键词覆盖", score: keywordScore, description: "简历中可被初筛识别的岗位关键词覆盖" },
      { name: "兴趣一致", score: interestScore, description: "求职偏好与岗位方向的一致性" },
      { name: "成长潜力", score: growthScore, description: "当前基础经过短期补强后的提升空间" },
    ],
    coveredKeywords,
    missingKeywords,
    strengths: [
      coveredKeywords.length > 0 ? `已覆盖 ${coveredKeywords.slice(0, 4).join("、")} 等岗位关键词。` : "当前简历与岗位关键词重合较少。",
      experienceHits.length > 0 ? `${experienceHits[0].title} 可作为核心匹配证据。` : "现有经历需要进一步转化为岗位相关证据。",
      profile.cityPreference.includes(job.city) ? `岗位城市 ${job.city} 与求职偏好一致。` : `岗位城市 ${job.city} 不在首选列表中，需要确认投递意愿。`,
    ],
    risks: [
      missingKeywords.length > 0 ? `简历中对 ${missingKeywords.slice(0, 4).join("、")} 的呈现不足。` : "核心关键词覆盖较完整，建议继续补充量化结果。",
      experienceScore < 76 ? "项目经历与岗位职责之间的因果链表达不足，需要补充任务、行动和结果。" : "经历证据较充分，下一步应突出结果和方法论。",
      keywordScore < 72 ? "初筛系统可能无法稳定识别部分岗位相关能力，需要补齐标准化表达。" : "关键词覆盖较好，重点是提升表达可信度。",
    ],
    resumeActions: [
      {
        title: "项目经历 STAR 化",
        detail: "补充情境、任务、行动和量化结果，例如访谈样本量、核心指标变化和复盘动作。",
        impact: "提升经历可信度",
      },
      {
        title: "补齐岗位关键词",
        detail: missingKeywords.length > 0 ? `在技能、项目或经历描述中自然补充 ${missingKeywords.slice(0, 5).join("、")}。` : "保留现有关键词，并增加与业务结果相关的表达。",
        impact: "提升初筛识别率",
      },
      {
        title: "强化岗位动机",
        detail: `在个人总结中说明对${job.track}方向的兴趣来源，以及已有经历如何支撑该岗位。`,
        impact: "提升人岗一致性",
      },
    ],
    actionPlan: [
      "选择一个最相关项目，压缩为 3 行高证据描述。",
      "用岗位关键词检查技能栏和项目描述，避免只写泛化能力。",
      "准备 2 个与岗位职责相关的面试故事，覆盖问题分析、协作推进和结果复盘。",
    ],
  };
}
