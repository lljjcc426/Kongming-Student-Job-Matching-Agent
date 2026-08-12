import type { Job, StudentProfile } from "./data";
import type { MatchResult } from "./matchEngine";
import type { CareerOpsEvaluation } from "./careerOps";
import type { OptimizedResumeDraft } from "./resumeOptimizer";

export function buildMatchReport(
  profile: StudentProfile,
  job: Job,
  result: MatchResult,
  resumeText: string,
  optimizedDraft: OptimizedResumeDraft,
  careerOpsEvaluation?: CareerOpsEvaluation,
) {
  const evidenceById = new Map(result.evidence.map((item) => [item.id, item]));
  const dimensionDetails = result.dimensions.map((dimension) => {
    const factors = dimension.factors
      .map((factor) => `  - ${factor.label}：${factor.score} × ${factor.weight}% = ${factor.contribution}；${factor.explanation}`)
      .join("\n");
    const citations = dimension.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter(Boolean)
      .slice(0, 4)
      .map((item) => `  - [${item!.label}] ${item!.text}`)
      .join("\n") || "  - 暂无可引用的简历原文证据";
    return `### ${dimension.name}：${dimension.score} 分

- 总分权重：${dimension.weight}%
- 总分贡献：${dimension.contribution} 分
- 证据置信度：${dimension.confidence}
- 计算式：${dimension.formula} = ${dimension.score}

评分因子：

${factors}

引用证据：

${citations}`;
  }).join("\n\n");
  const abilityDetails = result.abilityGraph.nodes.map((node) => {
    const citations = node.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => `${item!.label}“${item!.text}”`)
      .join("；") || "无简历证据";
    const status = node.status === "matched" ? "已证实" : node.status === "partial" ? "部分支撑" : "待补证";
    return `- ${node.name}｜${node.importance}｜${status}｜${node.score}/${node.targetScore}：${node.explanation} 证据：${citations}`;
  }).join("\n");

  return `# 孔明职配分析报告

## 目标岗位

- 岗位名称：${job.title}
- 岗位方向：${job.track}
- 城市：${job.city}
- 匹配评分：${result.total}
- 投递建议：${result.verdict}
- 评分方法：${result.scoreExplanation.methodVersion}
- 加权计算：${result.scoreExplanation.formula}
- 能力证据覆盖：${result.scoreExplanation.evidenceCoverage}%
- 引用证据数量：${result.scoreExplanation.usedEvidenceCount}

> ${result.scoreExplanation.note}

## 学生画像摘要

- 学生：${profile.name}
- 年级与专业：${profile.grade}，${profile.major}
- 求职方向：${profile.target}
- 能力标签：${profile.skills.join("、")}

## 职业能力图谱

${result.abilityGraph.summary}

${abilityDetails || "岗位暂未提供可计算的能力关键词。"}

## 五维评分与解释证据

${dimensionDetails}

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

## 优化后简历片段

### 个人总结

${optimizedDraft.summary}

### 项目经历改写

${optimizedDraft.projectBullets.map((item) => `- ${item}`).join("\n")}

### 技能关键词

${optimizedDraft.skillLine}

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
