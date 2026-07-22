import type { Job, StudentProfile } from "./data";
import type { MatchResult } from "./matchEngine";
import type { CareerOpsEvaluation } from "./careerOps";
import { formatOptimizedResumeDraft, type OptimizedResumeDraft, type ResumeDraftValidation } from "./resumeOptimizer";

export function buildMatchReport(
  profile: StudentProfile,
  job: Job,
  result: MatchResult,
  resumeText: string,
  optimizedDraft: OptimizedResumeDraft,
  careerOpsEvaluation?: CareerOpsEvaluation,
  draftValidation?: ResumeDraftValidation,
) {
  return `# 孔明职配分析报告

## 目标岗位

- 岗位名称：${job.title}
- 岗位方向：${job.track}
- 城市：${job.city}
- 证据覆盖率：${result.evidenceCoverage}%（不代表企业初筛或录用概率）
- 硬性条件：${result.hardGateResult}
- 风险等级：${result.riskLevel}
- 投递建议：${result.verdict}

## 学生画像摘要

- 学生：${profile.name}
- 年级与专业：${profile.grade}，${profile.major}
- 求职方向：${profile.target}
- 能力标签：${profile.skills.join("、")}

## 匹配优势

${result.strengths.map((item) => `- ${item}`).join("\n")}

## 风险与差距

${result.risks.map((item) => `- ${item}`).join("\n")}

## 关键词覆盖

- 已覆盖：${result.coveredKeywords.join("、") || "暂无"}
- 需补强：${result.missingKeywords.join("、") || "暂无"}

## 简历优化动作

${result.resumeActions.map((item) => `- ${item.title}：${item.detail}`).join("\n")}

## 岗位深度评估

${careerOpsEvaluation?.roleSummary ?? "暂无"}

### 要求匹配表

${careerOpsEvaluation?.requirementMatrix.map((item) => `- ${item.requirement}｜${item.status}：${item.evidence}`).join("\n") ?? "暂无"}

### 定位策略

${careerOpsEvaluation?.positioning ?? "暂无"}

## 事实约束状态

- 当前状态：${draftValidation?.ok ? "已通过，可生成已确认投递稿" : "未通过，不能生成投递稿"}
- 检查说明：${draftValidation?.ok ? `已核对 ${draftValidation.acceptedProposalIds.length} 项修改` : draftValidation?.errors.join("；") || "尚未逐条确认修改"}

## 已确认投递稿

${draftValidation?.ok ? formatOptimizedResumeDraft(optimizedDraft, draftValidation.acceptedProposalIds) : "未生成。待确认、无证据或已失效的修改不会进入本节。"}

## 待确认修改建议（不得直接投递）

### 个人总结

${optimizedDraft.summary}

${optimizedDraft.proposals.map((item) => `- 原文：${item.originalText}\n  - 建议：${item.suggestedText}\n  - 证据：${item.evidenceIds.join("、") || "无"}\n  - 风险：${item.risk}`).join("\n") || "- 暂无"}

### 技能关键词

${optimizedDraft.skillLine}

### 学习与补强建议

${optimizedDraft.learningSuggestions.map((item) => `- ${item}`).join("\n") || "- 暂无"}

## 投递前清单

${(careerOpsEvaluation?.applicationChecklist ?? result.actionPlan).map((item, index) => `${index + 1}. ${item}`).join("\n")}

## 投递运营看板

${careerOpsEvaluation?.pipeline.map((item) => `- ${item.stage}｜${item.status}：${item.action}`).join("\n") ?? "暂无"}

## 当前简历文本

${resumeText.trim()}
`;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
