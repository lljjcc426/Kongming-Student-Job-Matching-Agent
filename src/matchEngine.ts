import type { Job, StudentProfile } from "./data";

export type MatchResult = {
  total: number;
  verdict: "推荐优先投递" | "建议补强后投递" | "暂不优先";
  dimensions: Array<{ name: string; score: number; description: string }>;
  coveredKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  risks: string[];
  resumeActions: Array<{ title: string; detail: string }>;
  actionPlan: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const countHits = (source: string[], target: string[]) => {
  const normalizedSource = source.map((item) => item.toLowerCase());
  return target.filter((item) => normalizedSource.some((sourceItem) => sourceItem.includes(item.toLowerCase()) || item.toLowerCase().includes(sourceItem)));
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
  const keywordScore = clamp((coveredKeywords.length / job.keywords.length) * 100);

  const abilityHits = countHits(profile.skills, job.keywords);
  const abilityScore = clamp(52 + abilityHits.length * 9 + (job.city && profile.cityPreference.includes(job.city) ? 6 : 0));

  const experienceHits = profile.experiences.filter((experience) =>
    experience.tags.some((tag) => job.keywords.includes(tag)),
  );
  const experienceScore = clamp(48 + experienceHits.length * 14 + (resume.length > 120 ? 8 : 0));

  const interestHits = countHits(profile.interests, [job.track, job.title, job.summary]);
  const interestScore = clamp(56 + interestHits.length * 12 + (profile.target.includes(job.track) ? 14 : 0));

  const growthScore = clamp(66 + coveredKeywords.length * 3 - missingKeywords.length * 2);
  const total = clamp(abilityScore * 0.28 + experienceScore * 0.26 + keywordScore * 0.22 + interestScore * 0.14 + growthScore * 0.1);

  const verdict = total >= 82 ? "推荐优先投递" : total >= 68 ? "建议补强后投递" : "暂不优先";

  const strengths = [
    coveredKeywords.length > 0 ? `已覆盖 ${coveredKeywords.slice(0, 4).join("、")} 等岗位关键词。` : "当前简历与岗位关键词重合较少。",
    experienceHits.length > 0 ? `有 ${experienceHits[0].title} 等经历可作为岗位匹配证据。` : "现有经历需要进一步转化为岗位相关证据。",
    profile.cityPreference.includes(job.city) ? `岗位城市 ${job.city} 与求职偏好一致。` : `岗位城市 ${job.city} 不在首选城市列表中，需要确认意愿。`,
  ];

  const risks = [
    missingKeywords.length > 0 ? `简历中对 ${missingKeywords.slice(0, 4).join("、")} 的呈现不足。` : "核心关键词覆盖较完整，但仍需补充量化结果。",
    experienceScore < 76 ? "项目经历与岗位职责之间的因果链表达不足，需要补充任务、行动和结果。" : "经历证据较充分，建议进一步压缩表述并突出结果。",
    keywordScore < 72 ? "初筛系统可能无法稳定识别部分岗位相关能力，需要补齐标准化表达。" : "关键词覆盖较好，下一步重点是提升表达可信度。",
  ];

  const resumeActions = [
    {
      title: "将项目经历改写为 STAR 结构",
      detail: "补充情境、任务、行动和量化结果，例如说明用户访谈样本量、核心指标变化和复盘动作。",
    },
    {
      title: "补齐岗位关键词",
      detail: missingKeywords.length > 0 ? `在技能、项目或经历描述中自然补充 ${missingKeywords.slice(0, 5).join("、")}。` : "保留现有关键词，并增加与业务结果相关的表达。",
    },
    {
      title: "强化岗位动机",
      detail: `在个人总结中明确说明对${job.track}方向的兴趣来源，以及已有经历如何支撑该岗位。`,
    },
  ];

  const actionPlan = [
    "选择一个最相关项目，压缩为 3 行高证据描述。",
    "用岗位关键词检查简历技能栏和项目描述，避免只写泛化能力。",
    "准备 2 个与岗位职责相关的面试故事，覆盖问题分析、协作推进和结果复盘。",
  ];

  return {
    total,
    verdict,
    dimensions: [
      { name: "能力匹配", score: abilityScore, description: "技能标签与岗位关键词的重合程度" },
      { name: "经历匹配", score: experienceScore, description: "项目、实习和竞赛经历对岗位职责的支撑" },
      { name: "关键词覆盖", score: keywordScore, description: "简历中可被初筛识别的岗位关键词覆盖" },
      { name: "兴趣一致", score: interestScore, description: "求职偏好与岗位方向的一致性" },
      { name: "成长潜力", score: growthScore, description: "当前基础经过短期补强后的可提升空间" },
    ],
    coveredKeywords,
    missingKeywords,
    strengths,
    risks,
    resumeActions,
    actionPlan,
  };
}

