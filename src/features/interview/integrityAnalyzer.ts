import type { Job } from "../../data";
import type {
  InterviewIntegrityEvaluation,
  InterviewIntegrityRisk,
  InterviewIntegrityRiskKind,
  InterviewIntegrityRiskSeverity,
  InterviewTurn,
} from "../../types/interview";
import { getCompetencyModel, type CompetencyDimension } from "./competencyModels";

const OWNERSHIP_PATTERN = /我(?:独立|主导|全权|主要)?(?:负责|完成|设计|实现|搭建|推进|开发)|由我(?:独立)?(?:负责|完成)/;
const OWNERSHIP_DENIAL_PATTERN = /不是我负责|我没参与|我没有参与|交给了?(?:同学|其他人|队友)|由(?:同学|其他人|队友).{0,8}负责|我只(?:是)?(?:参与|协助)/;
const PROJECT_PATTERN = /([\u4e00-\u9fffA-Za-z0-9+#.-]{2,18})(?:项目|系统|平台)/g;
const GENERIC_PROJECT_NAMES = new Set(["课程", "这个", "一次", "实习", "比赛", "毕业", "科研", "实践", "个人", "团队", "学校"]);
const GENERIC_TOOL_TERMS = new Set(["模型", "算法", "数据", "指标", "测试", "验证", "实验", "分析", "项目", "用户", "需求", "接口", "服务", "部署", "性能", "框架", "工具"]);
const VERIFICATION_DETAIL_PATTERN = /负责|完成|产出|证据|仓库|文档|截图|记录|统计|口径|时间|团队|因为|具体|分别|实际/;
const VERIFICATION_BOUNDARY_PATTERN = /不知道|不清楚|记不清|无法说明|不方便提供|没有证据|没法证明|跳过|未作答/;

const compact = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const excerpt = (value: string, length = 68) => {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
};
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

type EvaluatedTurn = {
  turn: InterviewTurn;
  index: number;
  dimension: CompetencyDimension;
};

const riskId = (
  kind: InterviewIntegrityRiskKind,
  competencyId: string,
  sourceTurns: number[],
  discriminator: string,
) => `integrity-${kind}-${stableHash(`${competencyId}:${sourceTurns.join("-")}:${discriminator}`)}`;

const baseRisk = (input: {
  kind: InterviewIntegrityRiskKind;
  severity: InterviewIntegrityRiskSeverity;
  dimension: CompetencyDimension;
  sourceTurns: number[];
  discriminator: string;
  title: string;
  claim: string;
  conflictingClaim?: string;
  rationale: string;
  verificationQuestion: string;
}): InterviewIntegrityRisk => ({
  id: riskId(input.kind, input.dimension.id, input.sourceTurns, input.discriminator),
  kind: input.kind,
  severity: input.severity,
  status: "pending",
  competencyId: input.dimension.id,
  competencyName: input.dimension.name,
  sourceTurns: input.sourceTurns,
  title: input.title,
  claim: input.claim,
  conflictingClaim: input.conflictingClaim ?? "",
  rationale: input.rationale,
  verificationQuestion: input.verificationQuestion,
});

const ownershipRisks = (turns: EvaluatedTurn[]) => {
  const risks: InterviewIntegrityRisk[] = [];
  const dimensions = new Set(turns.map((item) => item.dimension.id));
  dimensions.forEach((dimensionId) => {
    const relevant = turns.filter((item) => item.dimension.id === dimensionId);
    const ownership = relevant.find((item) => OWNERSHIP_PATTERN.test(item.turn.answer) && !OWNERSHIP_DENIAL_PATTERN.test(item.turn.answer));
    const denial = relevant.find((item) => OWNERSHIP_DENIAL_PATTERN.test(item.turn.answer));
    if (!ownership || !denial || ownership.index === denial.index) return;
    const sourceTurns = [ownership.index + 1, denial.index + 1].sort((left, right) => left - right);
    risks.push(baseRisk({
      kind: "ownership_conflict",
      severity: "high",
      dimension: ownership.dimension,
      sourceTurns,
      discriminator: "ownership",
      title: "个人贡献口径需要核验",
      claim: excerpt(ownership.turn.answer),
      conflictingClaim: excerpt(denial.turn.answer),
      rationale: "同一能力维度中，对本人负责范围出现了不同表述；在确认职责边界前，不应把团队成果全部计入个人能力证据。",
      verificationQuestion: `你前面对于“${ownership.dimension.name}”中的个人职责有两种不同表述。请明确哪些工作由你独立完成、哪些由团队成员完成，并给出你能直接举证的产出。`,
    }));
  });
  return risks;
};

type StableFact = { key: string; label: string; value: string; display: string };

const stableFactsOf = (answer: string): StableFact[] => {
  const facts: StableFact[] = [];
  const sample = answer.match(/(\d{2,6})\s*(份|名|位|个)(?:有效)?\s*(问卷|用户|受访者|样本)/);
  if (sample) {
    const target = sample[3];
    const key = target === "问卷" ? "questionnaire-count" : target === "样本" ? "sample-count" : "participant-count";
    facts.push({ key, label: target === "问卷" ? "问卷数量" : target === "样本" ? "样本数量" : "参与用户数量", value: sample[1], display: sample[0] });
  }
  const team = answer.match(/(?:团队|小组)(?:共|有|规模为|规模是)?\s*(\d{1,2})\s*人|(\d{1,2})\s*人(?:团队|小组)/);
  if (team) {
    const value = team[1] || team[2];
    facts.push({ key: "team-size", label: "团队人数", value, display: team[0] });
  }
  const duration = answer.match(/(?:历时|耗时|用了|周期(?:为|是)?)\s*(\d{1,3})\s*(天|周|月)/);
  if (duration) {
    const multiplier = duration[2] === "月" ? 30 : duration[2] === "周" ? 7 : 1;
    facts.push({ key: "duration", label: "项目周期", value: String(Number(duration[1]) * multiplier), display: duration[0] });
  }
  return facts;
};

const factRisks = (turns: EvaluatedTurn[]) => {
  const risks: InterviewIntegrityRisk[] = [];
  const grouped = new Map<string, Array<{ evaluated: EvaluatedTurn; fact: StableFact }>>();
  turns.forEach((evaluated) => {
    stableFactsOf(evaluated.turn.answer).forEach((fact) => {
      const key = `${evaluated.dimension.id}:${fact.key}`;
      grouped.set(key, [...(grouped.get(key) ?? []), { evaluated, fact }]);
    });
  });
  grouped.forEach((items) => {
    const first = items[0];
    const conflict = items.find((item) => item.fact.value !== first.fact.value);
    if (!conflict) return;
    const sourceTurns = [first.evaluated.index + 1, conflict.evaluated.index + 1].sort((left, right) => left - right);
    risks.push(baseRisk({
      kind: "fact_inconsistency",
      severity: "medium",
      dimension: first.evaluated.dimension,
      sourceTurns,
      discriminator: first.fact.key,
      title: `${first.fact.label}口径不一致`,
      claim: `第 ${first.evaluated.index + 1} 轮：${first.fact.display}`,
      conflictingClaim: `第 ${conflict.evaluated.index + 1} 轮：${conflict.fact.display}`,
      rationale: "同一考察维度中的稳定事实出现不同数值，也可能是候选人切换了案例但没有说明；需要先统一案例和统计口径。",
      verificationQuestion: `你关于${first.fact.label}先后提到“${first.fact.display}”和“${conflict.fact.display}”。请确认是否为同一个案例，并说明最终采用的统计口径和可核验依据。`,
    }));
  });
  return risks;
};

const toolClaimRisks = (turns: EvaluatedTurn[]) => {
  const risks: InterviewIntegrityRisk[] = [];
  const dimensions = new Set(turns.map((item) => item.dimension.id));
  dimensions.forEach((dimensionId) => {
    const relevant = turns.filter((item) => item.dimension.id === dimensionId);
    const dimension = relevant[0]?.dimension;
    if (!dimension) return;
    const terms = dimension.positiveSignals
      .filter((term) => term.length >= 2 && !GENERIC_TOOL_TERMS.has(term))
      .slice(0, 18);
    for (const term of terms) {
      const escaped = escapeRegExp(term);
      const deniedPattern = new RegExp(`(?:没用|没有使用|未使用|不是用|并未采用|不用).{0,4}${escaped}|${escaped}.{0,4}(?:没用|未使用|不是我用)` , "i");
      const denied = relevant.find((item) => deniedPattern.test(item.turn.answer));
      const affirmed = relevant.find((item) => compact(item.turn.answer).includes(compact(term)) && !deniedPattern.test(item.turn.answer));
      if (!denied || !affirmed || denied.index === affirmed.index) continue;
      const sourceTurns = [affirmed.index + 1, denied.index + 1].sort((left, right) => left - right);
      risks.push(baseRisk({
        kind: "tool_claim_conflict",
        severity: "medium",
        dimension,
        sourceTurns,
        discriminator: term,
        title: `${term}使用经历需要核验`,
        claim: excerpt(affirmed.turn.answer),
        conflictingClaim: excerpt(denied.turn.answer),
        rationale: "对同一工具或方法是否由本人实际使用出现不同表述，需要区分了解、团队使用与本人实操。",
        verificationQuestion: `请明确你在该案例中是否亲自使用过“${term}”：如果使用过，请说明具体操作和产出；如果没有，请说明你实际负责的部分。`,
      }));
      break;
    }
  });
  return risks;
};

const projectNameOf = (answer: string) => {
  const matches = [...answer.matchAll(PROJECT_PATTERN)];
  for (const match of matches) {
    const name = match[1].replace(/^(?:在|这个|该|一次|一个|我的)/, "").trim();
    if (name.length >= 3 && !GENERIC_PROJECT_NAMES.has(name)) return name;
  }
  return "";
};

const resumeRisks = (turns: EvaluatedTurn[], resumeSummary: string) => {
  if (!resumeSummary.trim()) return [];
  const resume = compact(resumeSummary);
  const risks: InterviewIntegrityRisk[] = [];
  const seenDimensions = new Set<string>();
  turns.forEach((item) => {
    if (seenDimensions.has(item.dimension.id) || !OWNERSHIP_PATTERN.test(item.turn.answer)) return;
    const projectName = projectNameOf(item.turn.answer);
    if (!projectName || resume.includes(compact(projectName))) return;
    seenDimensions.add(item.dimension.id);
    risks.push(baseRisk({
      kind: "resume_unverified_claim",
      severity: "low",
      dimension: item.dimension,
      sourceTurns: [item.index + 1],
      discriminator: projectName,
      title: "简历外新增项目主张",
      claim: excerpt(item.turn.answer),
      rationale: `回答中提到主导“${projectName}”，但当前简历摘要中未找到同名项目。这不表示陈述不真实，只表示需要补充可核验细节。`,
      verificationQuestion: `你提到主导过“${projectName}”，但当前简历摘要中没有同名项目。请补充项目时间、团队背景、你的直接产出，以及可以核验该经历的材料类型。`,
    }));
  });
  return risks;
};

const applyVerificationResponses = (
  risks: InterviewIntegrityRisk[],
  turns: InterviewTurn[],
) => risks.map((risk) => {
  const responseIndex = turns.findIndex((turn) => turn.integrityRiskId === risk.id);
  if (responseIndex < 0) return risk;
  const response = turns[responseIndex];
  const answer = compact(response.answer);
  const explained = answer.length >= 24
    && VERIFICATION_DETAIL_PATTERN.test(response.answer)
    && !VERIFICATION_BOUNDARY_PATTERN.test(response.answer);
  return {
    ...risk,
    status: explained ? "explained" as const : "unresolved" as const,
    responseTurn: responseIndex + 1,
    responseExcerpt: excerpt(response.answer, 100),
  };
});

const severityRank: Record<InterviewIntegrityRiskSeverity, number> = { high: 3, medium: 2, low: 1 };
const riskPenalty = (risk: InterviewIntegrityRisk) => {
  const base = risk.severity === "high" ? 22 : risk.severity === "medium" ? 14 : 7;
  if (risk.status === "explained") return Math.max(2, Math.round(base * 0.28));
  if (risk.status === "unresolved") return Math.max(5, Math.round(base * 0.86));
  return base;
};

export const analyzeInterviewIntegrity = (input: {
  job: Job;
  turns: InterviewTurn[];
  resumeSummary?: string;
}): InterviewIntegrityEvaluation => {
  const model = getCompetencyModel(input.job);
  const evaluated = input.turns
    .map((turn, index) => ({
      turn,
      index,
      dimension: model.dimensions.find((item) => item.id === turn.competencyId)
        ?? model.dimensions[index % model.dimensions.length],
    }))
    .filter((item) => !item.turn.integrityRiskId);
  const candidates = [
    ...ownershipRisks(evaluated),
    ...factRisks(evaluated),
    ...toolClaimRisks(evaluated),
    ...resumeRisks(evaluated, input.resumeSummary ?? ""),
  ];
  const unique = [...new Map(candidates.map((risk) => [risk.id, risk])).values()];
  const risks = applyVerificationResponses(unique, input.turns)
    .sort((left, right) => (
      (right.status === "pending" ? 100 : 0) - (left.status === "pending" ? 100 : 0)
      || severityRank[right.severity] - severityRank[left.severity]
      || left.sourceTurns[0] - right.sourceTurns[0]
    ));
  const pendingCount = risks.filter((risk) => risk.status === "pending").length;
  const explainedCount = risks.filter((risk) => risk.status === "explained").length;
  const unresolvedCount = risks.filter((risk) => risk.status === "unresolved").length;
  const score = Math.max(0, 100 - risks.reduce((sum, risk) => sum + riskPenalty(risk), 0));
  const summary = risks.length === 0
    ? evaluated.length < 2
      ? `当前仅有 ${evaluated.length} 轮可比较回答，尚不足以进行跨轮一致性判断；未发现冲突不等于已证明真实。`
      : "本次回答尚未发现可规则化识别的前后矛盾；该结论仅代表当前证据范围。"
    : pendingCount > 0
      ? `识别到 ${risks.length} 个需核验的一致性信号，其中 ${pendingCount} 个尚未完成追问。`
      : unresolvedCount > 0
        ? `已完成 ${risks.length} 个一致性信号的追问，其中 ${unresolvedCount} 个仍缺少充分解释。`
        : `已对 ${risks.length} 个一致性信号完成补充说明，报告保留原始主张与核验回答。`;
  return {
    score,
    assessedTurns: evaluated.length,
    riskCount: risks.length,
    pendingCount,
    explainedCount,
    unresolvedCount,
    risks,
    summary,
  };
};

export const nextInterviewIntegrityRisk = (evaluation: InterviewIntegrityEvaluation) => (
  evaluation.risks.find((risk) => risk.status === "pending") ?? null
);
