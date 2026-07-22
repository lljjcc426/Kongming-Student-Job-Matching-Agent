import type { Job, StudentProfile } from "./data";
import type { MatchResult, RequirementMatchStatus } from "./matchEngine";

export type CareerOpsEvaluation = {
  roleSummary: string;
  positioning: string;
  requirementMatrix: Array<{
    requirement: string;
    evidence: string;
    evidenceIds: string[];
    status: "满足" | "部分满足" | "无证据" | "待确认" | "硬性不满足";
  }>;
  applicationChecklist: string[];
  pipeline: Array<{
    stage: string;
    status: "已完成" | "进行中" | "待处理";
    action: string;
  }>;
};

const uiStatusOf = (status: RequirementMatchStatus, hard: boolean): CareerOpsEvaluation["requirementMatrix"][number]["status"] => {
  if (status === "supported") return "满足";
  if (status === "partially-supported") return "部分满足";
  if (status === "unsupported") return hard ? "硬性不满足" : "无证据";
  return "待确认";
};

export function buildCareerOpsEvaluation(profile: StudentProfile, job: Job, result: MatchResult): CareerOpsEvaluation {
  const matrix = result.requirementMatrix.map((item) => ({
    requirement: item.requirementText,
    evidence: item.evidenceText.length
      ? item.evidenceText.map((text, index) => `${item.evidenceIds[index] || "Evidence"}：${text}`).join("；")
      : item.explanation,
    evidenceIds: item.evidenceIds,
    status: uiStatusOf(item.status, item.type === "hard-constraint"),
  }));
  const supportedCount = matrix.filter((item) => item.status === "满足").length;
  const pendingCount = matrix.filter((item) => item.status === "待确认" || item.status === "部分满足").length;

  return {
    roleSummary: `${job.title}共拆解 ${matrix.length} 项可检查要求；当前证据覆盖率 ${result.evidenceCoverage}%。该数值只表示可评估要求的证据覆盖，不代表企业初筛或录用概率。`,
    positioning: result.hardGateResult === "fail"
      ? "先处理硬性条件冲突，不建议通过润色简历掩盖资格差距。"
      : `优先保留 ${supportedCount} 项已有证据，并逐项确认 ${pendingCount} 项待确认内容；缺失技能进入学习清单，不写入当前简历。`,
    requirementMatrix: matrix,
    applicationChecklist: [
      "核对岗位来源、最近验证时间与当前招聘状态。",
      "确认所有硬性条件，未知项不要默认视为满足。",
      "逐条检查简历建议是否引用有效 Evidence ID。",
      "仅使用已确认事实生成最终简历版本。",
    ],
    pipeline: [
      { stage: "简历解析", status: profile.resumeConfirmed ? "已完成" : "进行中", action: profile.resumeConfirmed ? "结构化结果已由用户确认。" : "等待用户确认结构化字段和原文证据。" },
      { stage: "岗位评估", status: "已完成", action: `已生成${job.title}的硬性条件与证据矩阵。` },
      { stage: "材料定制", status: "进行中", action: "只处理有原文和 Evidence ID 的修改建议。" },
      { stage: "投递跟进", status: "待处理", action: "可将具体岗位加入本机追踪；职业方向不会自动视为已投递岗位。" },
    ],
  };
}
