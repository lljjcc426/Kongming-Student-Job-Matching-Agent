import type { Job, StudentProfile } from "./data";
import { internetTechDomainAdapter } from "./domain/internetTech";
import type { HardConstraint } from "./domain/careerDomain";

export type RequirementMatchStatus = "supported" | "partially-supported" | "unsupported" | "unknown";
export type HardGateResult = "pass" | "fail" | "uncertain";
export type MatchRiskLevel = "low" | "medium" | "high";
export type MatchRecommendation = "apply-now" | "complete-evidence-first" | "skill-gap-too-large" | "hard-condition-failed";

export type RequirementMatch = {
  requirementId: string;
  requirementText: string;
  type: "hard-constraint" | "skill" | "responsibility";
  importance: "required" | "preferred";
  status: RequirementMatchStatus;
  evidenceIds: string[];
  evidenceText: string[];
  explanation: string;
  missingReason: string;
};

export type MatchResult = {
  evidenceCoverage: number;
  verdict: "建议投递" | "补证据后投递" | "暂缓投递" | "硬性条件不满足";
  hardGateResult: HardGateResult;
  riskLevel: MatchRiskLevel;
  recommendation: MatchRecommendation;
  requirementMatrix: RequirementMatch[];
  coveredKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  risks: string[];
  resumeActions: Array<{ title: string; detail: string; impact: string }>;
  actionPlan: string[];
};

type ResumeEvidence = {
  id: string;
  sourceText: string;
  normalizedSkills: string[];
  confirmedByUser: boolean;
};

const unique = <T,>(items: T[]) => [...new Set(items)];
const percent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const normalized = (value: string) => internetTechDomainAdapter.normalizeSkill(value);

const hasNegatedSkill = (text: string, keyword: string) => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:尚未|未曾|没有|不会|不熟悉|未使用|缺少)[^。；\\n]{0,10}${escaped}`, "i").test(text);
};

const buildEvidence = (profile: StudentProfile): ResumeEvidence[] => {
  const experienceEvidence = profile.experiences.map((experience) => ({
    id: experience.id,
    sourceText: experience.evidence,
    normalizedSkills: unique(experience.tags.map(normalized)),
    confirmedByUser: experience.confirmedByUser,
  }));
  const skillEvidence = profile.skills.map((skill, index) => ({
    id: `resume-skill-${index + 1}`,
    sourceText: skill,
    normalizedSkills: [normalized(skill)],
    confirmedByUser: profile.resumeConfirmed,
  }));
  return [...experienceEvidence, ...skillEvidence];
};

const evidenceForKeyword = (evidence: ResumeEvidence[], keyword: string) => {
  const normalizedKeyword = normalized(keyword);
  return evidence.filter((item) => {
    if (hasNegatedSkill(item.sourceText, keyword)) return false;
    return item.normalizedSkills.includes(normalizedKeyword)
      || internetTechDomainAdapter.validateResumeEvidence(item.sourceText, keyword);
  });
};

const profileValueForConstraint = (profile: StudentProfile, constraint: HardConstraint) => {
  if (constraint.type === "education") return profile.grade;
  if (constraint.type === "major") return profile.major;
  if (constraint.type === "city") return profile.cityPreference.join("、");
  return profile.resumeText;
};

const educationSatisfies = (actual: string, required: string) => {
  const levels = ["专科", "大专", "本科", "硕士", "研究生", "博士"];
  const actualIndex = Math.max(...levels.map((level, index) => actual.includes(level) ? index : -1));
  const requiredIndex = Math.max(...levels.map((level, index) => required.includes(level) ? index : -1));
  return actualIndex >= 0 && requiredIndex >= 0 && actualIndex >= requiredIndex;
};

const evaluateHardConstraint = (profile: StudentProfile, constraint: HardConstraint): RequirementMatch => {
  const actual = profileValueForConstraint(profile, constraint);
  const unknown = !actual || /待确认|待识别/.test(actual);
  let status: RequirementMatchStatus = "unknown";

  if (!unknown) {
    if (constraint.type === "education") {
      const satisfies = educationSatisfies(actual, constraint.requiredValue);
      status = satisfies
        ? (profile.resumeConfirmed ? "supported" : "partially-supported")
        : (profile.resumeConfirmed ? "unsupported" : "unknown");
    } else if (constraint.type === "city") {
      const satisfies = profile.cityPreference.some((city) => constraint.text.includes(city));
      status = satisfies
        ? (profile.resumeConfirmed ? "supported" : "partially-supported")
        : (profile.resumeConfirmed ? "unsupported" : "unknown");
    } else {
      status = internetTechDomainAdapter.validateResumeEvidence(actual, constraint.requiredValue)
        ? (profile.resumeConfirmed ? "supported" : "partially-supported")
        : "unknown";
    }
  }

  return {
    requirementId: constraint.id,
    requirementText: constraint.text,
    type: "hard-constraint",
    importance: "required",
    status,
    evidenceIds: status === "supported" || status === "partially-supported" ? ["resume-profile"] : [],
    evidenceText: status === "supported" || status === "partially-supported" ? [actual] : [],
    explanation: status === "supported"
      ? `已找到满足条件的简历字段：${actual}`
      : status === "partially-supported"
        ? `已找到相关字段但尚未由用户确认：${actual}`
        : status === "unsupported"
          ? `当前简历字段“${actual}”与该硬性条件冲突。`
          : "当前简历没有足够结构化信息判断该硬性条件。",
    missingReason: status === "unknown" ? "需要用户确认或补充对应字段" : status === "unsupported" ? "硬性条件不满足" : "",
  };
};

const evaluateTextRequirement = (
  text: string,
  index: number,
  importance: RequirementMatch["importance"],
  evidence: ResumeEvidence[],
  jobKeywords: string[],
  resumeText: string,
): RequirementMatch => {
  const relevantKeywords = jobKeywords.filter((keyword) => normalized(text).includes(normalized(keyword)));
  const matchedEvidence = unique(relevantKeywords.flatMap((keyword) => evidenceForKeyword(evidence, keyword)));
  const resumeHasNegation = relevantKeywords.some((keyword) => hasNegatedSkill(resumeText, keyword));
  const status: RequirementMatchStatus = resumeHasNegation
    ? "unsupported"
    : matchedEvidence.some((item) => item.confirmedByUser)
      ? "supported"
      : matchedEvidence.length
        ? "partially-supported"
        : "unknown";

  return {
    requirementId: `requirement-${importance}-${index + 1}`,
    requirementText: text,
    type: relevantKeywords.length ? "skill" : "responsibility",
    importance,
    status,
    evidenceIds: matchedEvidence.map((item) => item.id),
    evidenceText: matchedEvidence.map((item) => item.sourceText),
    explanation: status === "supported"
      ? `已关联 ${matchedEvidence.length} 条用户确认的简历证据。`
      : status === "partially-supported"
        ? `找到 ${matchedEvidence.length} 条原文证据，需用户确认后才能作为强证据。`
        : status === "unsupported"
          ? "简历原文包含明确的否定或不具备表述。"
          : relevantKeywords.length
            ? "当前简历未找到可追溯的相关技能证据。"
            : "该要求尚未结构化，需用户人工核对原文。",
    missingReason: status === "unknown" ? "无可引用证据" : status === "unsupported" ? "原文存在明确冲突" : "",
  };
};

export function analyzeMatch(profile: StudentProfile, job: Job, _resumeText: string): MatchResult {
  const jobText = [job.title, job.track, job.summary, ...job.requirements, ...job.responsibilities].join("\n");
  const roleFamily = internetTechDomainAdapter.classifyJob(jobText);
  const evidence = buildEvidence(profile);
  const hardConstraints = internetTechDomainAdapter.extractHardConstraints(job.requirements);
  const hardMatches = hardConstraints.map((constraint) => evaluateHardConstraint(profile, constraint));
  const requirementMatches = job.requirements.slice(0, 8)
    .map((requirement, index) => evaluateTextRequirement(requirement, index, "required", evidence, job.keywords, profile.resumeText));
  const bonusMatches = job.bonus.slice(0, 4)
    .map((requirement, index) => evaluateTextRequirement(requirement, index, "preferred", evidence, job.keywords, profile.resumeText));
  const requirementMatrix = [...hardMatches, ...requirementMatches, ...bonusMatches];

  const hardGateResult: HardGateResult = hardMatches.some((item) => item.status === "unsupported")
    ? "fail"
    : hardMatches.length > 0 && hardMatches.every((item) => item.status === "supported")
      ? "pass"
      : "uncertain";
  const evaluable = requirementMatrix.filter((item) => item.status !== "unknown");
  const supportedWeight = evaluable.reduce((sum, item) => sum + (item.status === "supported" ? 1 : item.status === "partially-supported" ? 0.5 : 0), 0);
  const evidenceCoverage = evaluable.length ? percent((supportedWeight / evaluable.length) * 100) : 0;
  const supportedKeywords = job.keywords.filter((keyword) =>
    !hasNegatedSkill(profile.resumeText, keyword) && evidenceForKeyword(evidence, keyword).length > 0,
  );
  const missingKeywords = job.keywords.filter((keyword) => !supportedKeywords.includes(keyword));
  const unknownCount = requirementMatrix.filter((item) => item.status === "unknown").length;
  const unsupportedCount = requirementMatrix.filter((item) => item.status === "unsupported").length;

  const recommendation: MatchRecommendation = hardGateResult === "fail"
    ? "hard-condition-failed"
    : evidenceCoverage >= 70 && unknownCount <= 2
      ? "apply-now"
      : unsupportedCount >= Math.max(2, Math.ceil(requirementMatrix.length / 2))
        ? "skill-gap-too-large"
        : "complete-evidence-first";
  const verdict = recommendation === "hard-condition-failed"
    ? "硬性条件不满足"
    : recommendation === "apply-now"
      ? "建议投递"
      : recommendation === "skill-gap-too-large"
        ? "暂缓投递"
        : "补证据后投递";
  const riskLevel: MatchRiskLevel = hardGateResult === "fail" || unsupportedCount >= 2
    ? "high"
    : unknownCount > Math.max(2, requirementMatrix.length / 2)
      ? "medium"
      : "low";

  const domainWarning = roleFamily
    ? "当前使用互联网与数字技术领域规则。"
    : "当前 JD 不属于已深度支持的互联网与数字技术岗位，只提供通用证据整理，不给出高可信判断。";
  const strongestEvidence = requirementMatrix.find((item) => item.status === "supported" || item.status === "partially-supported");

  return {
    evidenceCoverage,
    verdict,
    hardGateResult,
    riskLevel: roleFamily ? riskLevel : "high",
    recommendation: roleFamily ? recommendation : "complete-evidence-first",
    requirementMatrix,
    coveredKeywords: supportedKeywords,
    missingKeywords,
    strengths: [
      strongestEvidence
        ? `已找到证据 ${strongestEvidence.evidenceIds.join("、")} 支撑“${strongestEvidence.requirementText}”。`
        : "当前没有找到可追溯到简历原文的岗位证据。",
      profile.resumeConfirmed ? "当前简历结构已由用户确认。" : "当前简历结构尚未由用户确认，相关证据只能视为待确认。",
      domainWarning,
    ],
    risks: [
      hardGateResult === "fail" ? "至少一项硬性条件明确不满足。" : hardGateResult === "uncertain" ? "硬性条件仍有待确认项。" : "已识别的硬性条件未发现冲突。",
      unknownCount > 0 ? `${unknownCount} 项岗位要求尚无可引用证据。` : "所有已结构化岗位要求均可评估。",
      missingKeywords.length > 0 ? `${missingKeywords.slice(0, 4).join("、")} 当前没有原文证据，不能直接写入简历。` : "当前岗位关键词均找到相关原文。",
    ],
    resumeActions: [
      {
        title: "确认简历证据",
        detail: profile.resumeConfirmed ? "已确认当前结构；修改原文后需要重新确认。" : "逐项核对模型提取的教育、技能和经历，确认后再生成最终修改稿。",
        impact: "提高结论可信度",
      },
      {
        title: "补充可验证结果",
        detail: "仅补充真实存在且可说明来源的指标；未知数字保留为待确认占位，不自动生成。",
        impact: "降低事实风险",
      },
      {
        title: "学习与补强",
        detail: missingKeywords.length ? `${missingKeywords.slice(0, 5).join("、")}进入学习清单，不自动加入技能栏。` : "暂无需要从岗位要求迁入的缺失技能。",
        impact: "避免简历造假",
      },
    ],
    actionPlan: [
      "先核对硬性条件，再决定是否投入简历定制时间。",
      "逐条确认要求与 Evidence ID 的对应关系。",
      "只接受有原文和证据引用的简历修改建议。",
    ],
  };
}
