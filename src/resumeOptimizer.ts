import type { Job, StudentProfile } from "./data";
import type { MatchResult } from "./matchEngine";

export type OptimizedResumeDraft = {
  summary: string;
  projectBullets: string[];
  skillLine: string;
};

const pick = (items: string[], count: number) => items.slice(0, count).filter(Boolean);

export function buildOptimizedResumeDraft(profile: StudentProfile, job: Job, result: MatchResult): OptimizedResumeDraft {
  const primaryExperience = profile.experiences[0];
  const covered = pick(result.coveredKeywords, 4);
  const missing = pick(result.missingKeywords, 3);
  const keywordFocus = [...covered, ...missing].slice(0, 6);

  return {
    summary: `${profile.major}${profile.grade}学生，目标方向为${job.track}。具备${covered.join("、") || profile.skills.slice(0, 3).join("、")}等基础能力，曾在${primaryExperience.title}中承担${primaryExperience.role}，能够结合用户需求、项目推进和数据复盘支持岗位工作。`,
    projectBullets: [
      `围绕${primaryExperience.title}，负责${primaryExperience.role}工作，完成需求梳理、方案设计与上线复盘，沉淀可复用的项目推进方法。`,
      `结合${job.title}对${job.keywords.slice(0, 3).join("、")}的要求，补充项目中的任务分工、关键动作、协作对象和量化结果。`,
      missing.length > 0
        ? `在简历表述中自然加入${missing.join("、")}等关键词，避免只描述经历本身而缺少岗位相关能力证据。`
        : "保留已有关键词覆盖优势，进一步突出业务指标、结果变化和复盘结论。",
    ],
    skillLine: `技能关键词：${keywordFocus.join("、") || profile.skills.join("、")}`,
  };
}

export function formatOptimizedResumeDraft(draft: OptimizedResumeDraft) {
  return [
    "【个人总结】",
    draft.summary,
    "",
    "【项目经历改写】",
    ...draft.projectBullets.map((item) => `- ${item}`),
    "",
    "【技能关键词】",
    draft.skillLine,
  ].join("\n");
}

