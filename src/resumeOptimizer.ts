import type { Job, StudentProfile } from "./data";
import type { MatchResult } from "./matchEngine";

export type ResumeChangeProposalStatus = "pending" | "accepted" | "rejected" | "edited";

export type ResumeChangeProposal = {
  id: string;
  section: string;
  originalText: string;
  suggestedText: string;
  targetRequirement: string;
  evidenceIds: string[];
  changeReason: string;
  risk: string;
  requiresUserConfirmation: boolean;
  status: ResumeChangeProposalStatus;
};

export type OptimizedResumeDraft = {
  summary: string;
  projectBullets: string[];
  skillLine: string;
  proposals: ResumeChangeProposal[];
  learningSuggestions: string[];
  isFactSafe: boolean;
};

const evidenceScore = (evidence: string, keywords: string[]) => keywords
  .filter((keyword) => evidence.toLowerCase().includes(keyword.toLowerCase())).length;

const safeSuggestion = (originalText: string) => {
  const clean = originalText.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return `${clean}${/[。！？.!?]$/.test(clean) ? "" : "。"} [待确认：如有真实数据，请补充任务规模、结果变化或节省时间]`;
};

export function buildOptimizedResumeDraft(profile: StudentProfile, job: Job, result: MatchResult): OptimizedResumeDraft {
  const relevantExperiences = [...profile.experiences]
    .sort((left, right) => evidenceScore(right.evidence, job.keywords) - evidenceScore(left.evidence, job.keywords))
    .slice(0, 3);
  const proposals = relevantExperiences.map((experience, index): ResumeChangeProposal => {
    const matchedRequirement = result.requirementMatrix.find((item) => item.evidenceIds.includes(experience.id));
    return {
      id: `proposal-${experience.id}-${index + 1}`,
      section: experience.sourceSection === "project" ? "项目经历" : experience.sourceSection === "internship" ? "实习经历" : "相关经历",
      originalText: experience.evidence,
      suggestedText: safeSuggestion(experience.evidence),
      targetRequirement: matchedRequirement?.requirementText || "等待用户选择对应岗位要求",
      evidenceIds: [experience.id],
      changeReason: "保留原始事实，仅整理句式并提示用户补充可核验结果。",
      risk: experience.confirmedByUser ? "低：原文已确认，但新增指标仍需用户填写。" : "中：原文尚未由用户确认，不能直接进入最终稿。",
      requiresUserConfirmation: true,
      status: "pending",
    };
  });
  const confirmedSkills = result.coveredKeywords.filter((keyword) =>
    profile.skills.some((skill) => skill.toLowerCase() === keyword.toLowerCase())
      || profile.experiences.some((experience) => experience.confirmedByUser && experience.tags.some((tag) => tag.toLowerCase() === keyword.toLowerCase())),
  );
  const profileSummary = [profile.major, profile.grade, profile.target]
    .filter((item) => item && !/待确认|待识别/.test(item))
    .join("，");

  return {
    summary: profileSummary
      ? `${profileSummary}。当前仅使用简历原文中可追溯的信息，任何新增成果数字均需本人确认。`
      : "当前结构化信息不足，暂不生成可能引入虚构事实的个人总结。",
    projectBullets: proposals.map((proposal) => proposal.suggestedText),
    skillLine: confirmedSkills.length
      ? `已确认技能证据：${confirmedSkills.join("、")}`
      : "暂无同时满足“简历原文出现且已确认”的技能证据。",
    proposals,
    learningSuggestions: result.missingKeywords.map((keyword) => `${keyword}：岗位要求中出现，但当前无简历证据；如确实不会，应进入学习计划而不是技能栏。`),
    isFactSafe: proposals.every((proposal) => proposal.originalText && proposal.evidenceIds.length > 0),
  };
}

export function formatOptimizedResumeDraft(draft: OptimizedResumeDraft, acceptedProposalIds?: string[]) {
  const accepted = acceptedProposalIds
    ? draft.proposals.filter((proposal) => acceptedProposalIds.includes(proposal.id))
    : [];
  return [
    "【事实约束简历修改稿】",
    accepted.length ? "以下内容已由用户逐条接受。" : "尚无已接受修改；以下仅为待确认建议，不应直接投递。",
    "",
    "【个人总结】",
    draft.summary,
    "",
    "【已接受修改】",
    ...(accepted.length ? accepted.map((item) => `- ${item.suggestedText}（证据：${item.evidenceIds.join("、")}）`) : ["- 暂无"]),
    "",
    "【技能证据】",
    draft.skillLine,
    "",
    "【学习与补强建议】",
    ...(draft.learningSuggestions.length ? draft.learningSuggestions.map((item) => `- ${item}`) : ["- 暂无"]),
  ].join("\n");
}
