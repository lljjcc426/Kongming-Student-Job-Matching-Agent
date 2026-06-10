import type { Job, StudentProfile } from "./data";
import type { MatchResult } from "./matchEngine";

export type CareerOpsEvaluation = {
  roleSummary: string;
  positioning: string;
  requirementMatrix: Array<{
    requirement: string;
    evidence: string;
    status: "强匹配" | "可补强" | "待验证";
  }>;
  applicationChecklist: string[];
  pipeline: Array<{
    stage: string;
    status: "已完成" | "进行中" | "待处理";
    action: string;
  }>;
};

type RequirementStatus = CareerOpsEvaluation["requirementMatrix"][number]["status"];

const firstAvailable = (items: string[], fallback: string) => items.find((item) => item.trim()) ?? fallback;

export function buildCareerOpsEvaluation(profile: StudentProfile, job: Job, result: MatchResult): CareerOpsEvaluation {
  const strongestDimension = [...result.dimensions].sort((a, b) => b.score - a.score)[0];
  const weakestDimension = [...result.dimensions].sort((a, b) => a.score - b.score)[0];
  const primaryExperience = profile.experiences[0];
  const evidenceFallback = primaryExperience
    ? `${primaryExperience.title}中承担${primaryExperience.role}，可作为核心经历证据。`
    : "当前简历经历证据较少，需要补充课程项目、校园实践或实习任务。";
  const coveredText = result.coveredKeywords.slice(0, 4).join("、") || "岗位相关基础能力";
  const missingText = result.missingKeywords.slice(0, 4).join("、") || "量化成果与业务语境";

  const requirementSeeds = [
    firstAvailable(job.requirements, `${job.track}方向基础能力`),
    firstAvailable(job.responsibilities, `${job.title}核心职责理解`),
    firstAvailable(job.bonus, "可迁移经历与学习潜力"),
  ];

  const requirementMatrix = requirementSeeds.map((requirement, index) => {
    const dimension = result.dimensions[index % result.dimensions.length];
    const score = dimension?.score ?? result.total;
    const status: RequirementStatus = score >= 82 ? "强匹配" : score >= 68 ? "可补强" : "待验证";
    return {
      requirement,
      evidence:
        index === 0
          ? `已覆盖${coveredText}，与${dimension?.name ?? "岗位能力"}相关。`
          : index === 1
            ? evidenceFallback
            : `需围绕${missingText}补充更清晰的成果、方法和复盘。`,
      status,
    };
  });

  return {
    roleSummary: `${job.title}更关注${job.track}方向下的职责理解、证据表达和岗位关键词覆盖。当前匹配度为${result.total}，建议以“${result.verdict}”作为投递节奏判断。`,
    positioning: `定位策略：把${strongestDimension?.name ?? "优势能力"}作为简历首屏卖点，同时用 1-2 个项目故事补齐${weakestDimension?.name ?? "短板维度"}。表述上避免泛泛描述，优先写清任务、方法、协作对象和结果。`,
    requirementMatrix,
    applicationChecklist: [
      `将个人总结改写为面向${job.title}的 2-3 句定位陈述。`,
      `检查简历中是否自然出现${coveredText}等岗位关键词。`,
      `针对${missingText}准备补强素材，优先补充量化结果或作品链接。`,
      "投递前确认招聘入口来源、岗位发布时间和投递材料版本。",
    ],
    pipeline: [
      { stage: "简历解析", status: "已完成", action: "已生成学生画像和经历证据。" },
      { stage: "岗位评估", status: "已完成", action: `已完成${job.title}匹配评分。` },
      { stage: "材料定制", status: "进行中", action: "根据目标岗位生成定制化简历片段并人工确认。" },
      { stage: "投递跟进", status: "待处理", action: "投递后记录渠道、时间、反馈状态和下一步动作。" },
    ],
  };
}
