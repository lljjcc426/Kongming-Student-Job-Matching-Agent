import type { Job, StudentProfile } from "./data";
import type { StructuredResume } from "./modelParsers";

export type MatchEvidence = {
  id: string;
  source: "resume" | "profile";
  section: string;
  label: string;
  text: string;
};

export type MatchFactor = {
  label: string;
  score: number;
  weight: number;
  contribution: number;
  explanation: string;
  evidenceIds: string[];
};

export type MatchDimension = {
  id: "ability" | "experience" | "keyword" | "interest" | "growth";
  name: string;
  score: number;
  weight: number;
  contribution: number;
  description: string;
  formula: string;
  confidence: "高" | "中" | "低";
  evidenceIds: string[];
  factors: MatchFactor[];
};

export type AbilityNode = {
  id: string;
  name: string;
  category: "技术能力" | "研究分析" | "业务能力" | "通用能力";
  importance: "核心" | "重要" | "加分";
  status: "matched" | "partial" | "gap";
  score: number;
  targetScore: number;
  explanation: string;
  evidenceIds: string[];
  requirementSources: string[];
};

export type AbilityEdge = {
  source: string;
  target: string;
  relation: "岗位要求";
  strength: number;
};

export type AbilityGraph = {
  targetNode: { id: "target-job"; name: string };
  nodes: AbilityNode[];
  edges: AbilityEdge[];
  matchedCount: number;
  partialCount: number;
  gapCount: number;
  evidenceCoverage: number;
  summary: string;
};

export type MatchResult = {
  total: number;
  verdict: "优先投递" | "补强后投递" | "暂不优先";
  dimensions: MatchDimension[];
  evidence: MatchEvidence[];
  abilityGraph: AbilityGraph;
  scoreExplanation: {
    methodVersion: "evidence-v1";
    formula: string;
    evidenceCoverage: number;
    usedEvidenceCount: number;
    note: string;
  };
  coveredKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  risks: string[];
  resumeActions: Array<{ title: string; detail: string; impact: string }>;
  actionPlan: string[];
};

type EvidenceMatch = {
  evidence: MatchEvidence;
  kind: "exact" | "related";
  score: number;
};

const DIMENSION_WEIGHTS = {
  ability: 28,
  experience: 26,
  keyword: 22,
  interest: 14,
  growth: 10,
} as const;

const RELATED_TERM_GROUPS = [
  ["AI", "人工智能", "机器学习", "深度学习", "大模型", "LLM"],
  ["数据分析", "数据处理", "统计分析", "数据洞察", "SPSS", "Excel", "SQL", "Python"],
  ["用户研究", "用户调研", "用户洞察", "访谈", "问卷", "可用性测试"],
  ["产品", "产品设计", "产品策划", "需求分析", "原型", "Axure"],
  ["运营", "用户运营", "内容运营", "活动运营", "增长运营"],
  ["沟通", "表达", "汇报", "演讲", "跨部门协作"],
  ["团队协作", "团队合作", "协同", "项目协作"],
  ["英语", "英文", "CET-4", "CET-6", "雅思", "托福"],
  ["JavaScript", "TypeScript", "React", "Vue", "前端"],
  ["Java", "Spring", "Spring Boot", "后端"],
  ["算法", "数据结构", "算法设计", "LeetCode"],
];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const round1 = (value: number) => Math.round(value * 10) / 10;
const unique = <T,>(items: T[]) => [...new Set(items)];

const normalizeText = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

const containsTerm = (text: string, term: string) => {
  const trimmed = term.trim();
  if (!trimmed) return false;
  if (/^[a-z\d+#.-]{1,3}$/i.test(trimmed)) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  }
  return normalizeText(text).includes(normalizeText(trimmed));
};

const relatedTerms = (keyword: string) => {
  const group = RELATED_TERM_GROUPS.find((items) => items.some((item) => containsTerm(keyword, item) || containsTerm(item, keyword)));
  return unique([keyword, ...(group ?? [])]);
};

const excerpt = (text: string, maxLength = 96) => {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
};

const sectionBaseScore = (section: string) => {
  if (section === "专业技能") return 96;
  if (["实习经历", "项目经历", "竞赛经历", "校园经历"].includes(section)) return 90;
  if (["教育经历", "证书荣誉", "语言能力"].includes(section)) return 84;
  if (["求职目标", "个人总结"].includes(section)) return 78;
  return 70;
};

function buildEvidenceBank(profile: StudentProfile, resumeText: string, structured?: StructuredResume | null) {
  const evidence: MatchEvidence[] = [];
  const seen = new Set<string>();

  const add = (source: MatchEvidence["source"], section: string, label: string, value: string) => {
    const text = excerpt(value);
    const key = normalizeText(text);
    if (!key || key.length < 2 || seen.has(key)) return;
    seen.add(key);
    evidence.push({ id: `evidence-${evidence.length + 1}`, source, section, label, text });
  };

  if (structured) {
    structured.skills.forEach((item) => add("resume", "专业技能", "简历·专业技能", item));
    structured.internships.forEach((item) => add("resume", "实习经历", "简历·实习经历", item));
    structured.projects.forEach((item) => add("resume", "项目经历", "简历·项目经历", item));
    structured.competitions.forEach((item) => add("resume", "竞赛经历", "简历·竞赛", item));
    structured.campus.forEach((item) => add("resume", "校园经历", "简历·校园经历", item));
    structured.education.forEach((item) => add("resume", "教育经历", "简历·教育经历", item));
    [...structured.certificates, ...structured.honors].forEach((item) => add("resume", "证书荣誉", "简历·证书与荣誉", item));
    structured.languages.forEach((item) => add("resume", "语言能力", "简历·语言能力", item));
    structured.targetRoles.forEach((item) => add("resume", "求职目标", "简历·求职目标", item));
    add("resume", "个人总结", "简历·个人总结", structured.summary);
  }

  profile.skills.forEach((item) => add("profile", "专业技能", "画像·技能标签", item));
  profile.experiences.forEach((item) => add("profile", "项目经历", `画像·${item.title}`, item.evidence));
  profile.interests.forEach((item) => add("profile", "求职目标", "画像·兴趣方向", item));
  add("profile", "教育经历", "画像·专业背景", profile.major);
  add("profile", "求职目标", "画像·求职方向", profile.target);

  resumeText
    .split(/[\r\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4)
    .slice(0, 36)
    .forEach((item) => add("resume", "简历原文", "简历·原文片段", item));

  return evidence;
}

function matchEvidence(keyword: string, evidence: MatchEvidence[]) {
  const terms = relatedTerms(keyword);
  return evidence
    .map<EvidenceMatch | null>((item) => {
      const exact = containsTerm(item.text, keyword);
      const related = !exact && terms.some((term) => term !== keyword && containsTerm(item.text, term));
      if (!exact && !related) return null;
      const score = Math.max(0, sectionBaseScore(item.section) - (related ? 22 : 0));
      return { evidence: item, kind: exact ? "exact" : "related", score };
    })
    .filter((item): item is EvidenceMatch => Boolean(item))
    .sort((left, right) => right.score - left.score);
}

const classifyAbility = (name: string): AbilityNode["category"] => {
  if (/(代码|开发|算法|工程|前端|后端|Java|Python|SQL|AI|模型|计算机|软件|数据库)/i.test(name)) return "技术能力";
  if (/(研究|调研|访谈|问卷|统计|分析|洞察|SPSS|实验|心理)/i.test(name)) return "研究分析";
  if (/(产品|运营|市场|销售|商业|策划|增长|内容)/i.test(name)) return "业务能力";
  return "通用能力";
};

const statementMatchesAbility = (statement: string, ability: string) =>
  relatedTerms(ability).some((term) => containsTerm(statement, term));

function buildAbilityGraph(job: Job, evidence: MatchEvidence[]): AbilityGraph {
  const keywords = unique(job.keywords.map((item) => item.trim()).filter(Boolean)).slice(0, 12);
  const nodes = keywords.map<AbilityNode>((name, index) => {
    const requirementSources = unique([
      ...job.requirements.filter((item) => statementMatchesAbility(item, name)),
      ...job.responsibilities.filter((item) => statementMatchesAbility(item, name)),
      ...job.bonus.filter((item) => statementMatchesAbility(item, name)),
    ]).slice(0, 3);
    const inRequirement = job.requirements.some((item) => statementMatchesAbility(item, name));
    const inResponsibility = job.responsibilities.some((item) => statementMatchesAbility(item, name));
    const importance: AbilityNode["importance"] = inRequirement || index < Math.max(2, Math.ceil(keywords.length * 0.35))
      ? "核心"
      : inResponsibility
        ? "重要"
        : "加分";
    const matches = matchEvidence(name, evidence);
    const best = matches[0]?.score ?? 0;
    const supportingBonus = Math.min(8, Math.max(0, matches.length - 1) * 2);
    const score = clamp(best + supportingBonus);
    const targetScore = importance === "核心" ? 85 : importance === "重要" ? 75 : 65;
    const status: AbilityNode["status"] = score >= targetScore - 5 ? "matched" : score >= 48 ? "partial" : "gap";

    return {
      id: `ability-${index + 1}`,
      name,
      category: classifyAbility(name),
      importance,
      status,
      score,
      targetScore,
      explanation: matches.length
        ? `最强证据来自${matches[0].evidence.label}，${matches[0].kind === "exact" ? "直接命中" : "相关表达"}计 ${best} 分；另有 ${Math.max(0, matches.length - 1)} 条补充证据加 ${supportingBonus} 分，得到 ${score} 分。`
        : `简历中未找到“${name}”或相关表达，因此证据分为 0。`,
      evidenceIds: matches.slice(0, 4).map((item) => item.evidence.id),
      requirementSources: requirementSources.length ? requirementSources : [`岗位关键词：${name}`],
    };
  });
  const matchedCount = nodes.filter((item) => item.status === "matched").length;
  const partialCount = nodes.filter((item) => item.status === "partial").length;
  const gapCount = nodes.filter((item) => item.status === "gap").length;
  const evidenceCoverage = nodes.length
    ? clamp((nodes.reduce((sum, item) => sum + (item.status === "matched" ? 1 : item.status === "partial" ? 0.55 : 0), 0) / nodes.length) * 100)
    : 0;

  return {
    targetNode: { id: "target-job", name: job.title },
    nodes,
    edges: nodes.map((node) => ({
      source: "target-job",
      target: node.id,
      relation: "岗位要求",
      strength: node.importance === "核心" ? 3 : node.importance === "重要" ? 2 : 1,
    })),
    matchedCount,
    partialCount,
    gapCount,
    evidenceCoverage,
    summary: `岗位能力共 ${nodes.length} 项：已证实 ${matchedCount} 项、部分支撑 ${partialCount} 项、待补证 ${gapCount} 项。`,
  };
}

function factor(
  label: string,
  score: number,
  weight: number,
  explanation: string,
  evidenceIds: string[] = [],
): MatchFactor {
  return {
    label,
    score: clamp(score),
    weight,
    contribution: round1(clamp(score) * weight / 100),
    explanation,
    evidenceIds: unique(evidenceIds),
  };
}

function factorScore(factors: MatchFactor[]) {
  const totalWeight = factors.reduce((sum, item) => sum + item.weight, 0) || 100;
  return clamp(factors.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
}

function dimension(
  id: MatchDimension["id"],
  name: string,
  description: string,
  factors: MatchFactor[],
): MatchDimension {
  const score = factorScore(factors);
  const evidenceIds = unique(factors.flatMap((item) => item.evidenceIds));
  const confidence: MatchDimension["confidence"] = evidenceIds.length >= 4 ? "高" : evidenceIds.length >= 1 ? "中" : "低";
  const weight = DIMENSION_WEIGHTS[id];
  return {
    id,
    name,
    score,
    weight,
    contribution: round1(score * weight / 100),
    description,
    formula: factors.map((item) => `${item.label} ${item.score}×${item.weight}%`).join(" + "),
    confidence,
    evidenceIds,
    factors,
  };
}

const importanceWeight = (importance: AbilityNode["importance"]) => importance === "核心" ? 3 : importance === "重要" ? 2 : 1;

function abilityFactors(nodes: AbilityNode[]) {
  const groups: AbilityNode["importance"][] = ["核心", "重要", "加分"];
  const totalWeight = nodes.reduce((sum, item) => sum + importanceWeight(item.importance), 0) || 1;
  const factors = groups.flatMap((importance) => {
    const group = nodes.filter((item) => item.importance === importance);
    if (!group.length) return [];
    const rawWeight = group.reduce((sum, item) => sum + importanceWeight(item.importance), 0);
    const weight = round1(rawWeight / totalWeight * 100);
    const score = group.reduce((sum, item) => sum + item.score * importanceWeight(item.importance), 0) / rawWeight;
    const supported = group.filter((item) => item.status !== "gap").length;
    return [factor(
      `${importance}能力`,
      score,
      weight,
      `${supported}/${group.length} 项有简历证据；${importance}能力按节点证据强度加权。`,
      group.flatMap((item) => item.evidenceIds),
    )];
  });
  const weightDelta = round1(100 - factors.reduce((sum, item) => sum + item.weight, 0));
  if (factors.length && weightDelta !== 0) {
    factors[0] = factor(
      factors[0].label,
      factors[0].score,
      round1(factors[0].weight + weightDelta),
      factors[0].explanation,
      factors[0].evidenceIds,
    );
  }
  return factors.length ? factors : [factor("岗位能力", 0, 100, "岗位尚未提供可计算的能力关键词。")];
}

const evidenceHasOutcome = (text: string) => /\d|%|百分|提升|降低|增长|完成|覆盖|产出|获得|排名|获奖|落地/.test(text);

export function analyzeMatch(
  profile: StudentProfile,
  job: Job,
  resumeText: string,
  structured?: StructuredResume | null,
): MatchResult {
  const evidence = buildEvidenceBank(profile, resumeText, structured);
  const abilityGraph = buildAbilityGraph(job, evidence);
  const coveredNodes = abilityGraph.nodes.filter((item) => item.status !== "gap");
  const coveredKeywords = coveredNodes.map((item) => item.name);
  const missingKeywords = abilityGraph.nodes.filter((item) => item.status === "gap").map((item) => item.name);

  const abilityDimension = dimension(
    "ability",
    "能力匹配",
    "按岗位能力节点的重要度与简历证据强度计算。",
    abilityFactors(abilityGraph.nodes),
  );

  const experienceSections = new Set(["实习经历", "项目经历", "竞赛经历", "校园经历"]);
  const experienceEvidence = evidence.filter((item) => experienceSections.has(item.section));
  const relevantExperience = experienceEvidence.filter((item) =>
    abilityGraph.nodes.some((node) => relatedTerms(node.name).some((term) => containsTerm(item.text, term))),
  );
  const responsibilityCoverage = job.responsibilities.length
    ? job.responsibilities.filter((statement) =>
        abilityGraph.nodes.some((node) => node.status !== "gap" && statementMatchesAbility(statement, node.name)),
      ).length / job.responsibilities.length
    : 0;
  const expectedExperienceCount = Math.max(1, Math.min(3, job.responsibilities.length || 2));
  const outcomeEvidence = relevantExperience.filter((item) => evidenceHasOutcome(item.text));
  const experienceDimension = dimension(
    "experience",
    "经历匹配",
    "衡量相关经历数量、岗位职责覆盖和成果证据质量。",
    [
      factor(
        "相关经历",
        Math.min(100, relevantExperience.length / expectedExperienceCount * 100),
        45,
        `识别 ${relevantExperience.length} 条岗位相关经历，目标证据量为 ${expectedExperienceCount} 条。`,
        relevantExperience.map((item) => item.id),
      ),
      factor(
        "职责覆盖",
        responsibilityCoverage * 100,
        35,
        `${job.responsibilities.filter((statement) => abilityGraph.nodes.some((node) => node.status !== "gap" && statementMatchesAbility(statement, node.name))).length}/${job.responsibilities.length || 0} 条岗位职责可由能力证据支撑。`,
        coveredNodes.flatMap((item) => item.evidenceIds),
      ),
      factor(
        "成果质量",
        relevantExperience.length ? outcomeEvidence.length / relevantExperience.length * 100 : 0,
        20,
        `${outcomeEvidence.length}/${relevantExperience.length} 条相关经历包含数量、比例、排名或成果动词。`,
        outcomeEvidence.map((item) => item.id),
      ),
    ],
  );

  const keywordWeightedCoverage = abilityGraph.nodes.length
    ? abilityGraph.nodes.reduce((sum, item) => sum + (item.status === "matched" ? 1 : item.status === "partial" ? 0.55 : 0), 0) / abilityGraph.nodes.length * 100
    : 0;
  const keywordDimension = dimension(
    "keyword",
    "关键词覆盖",
    "完全证实计 100%，相关表达计 55%，无证据计 0%。",
    [factor(
      "岗位词覆盖",
      keywordWeightedCoverage,
      100,
      `${abilityGraph.matchedCount} 项完全证实，${abilityGraph.partialCount} 项相关表达，${abilityGraph.gapCount} 项无证据。`,
      coveredNodes.flatMap((item) => item.evidenceIds),
    )],
  );

  const targetSignals = unique([profile.target, ...profile.interests, ...(structured?.targetRoles ?? [])].filter(Boolean));
  const roleEvidence = evidence.filter((item) => item.section === "求职目标" && (containsTerm(item.text, job.title) || containsTerm(job.title, item.text)));
  const roleAligned = targetSignals.some((item) => containsTerm(item, job.title) || containsTerm(job.title, item));
  const trackEvidence = evidence.filter((item) => item.section === "求职目标" && (containsTerm(item.text, job.track) || containsTerm(job.track, item.text)));
  const trackAligned = targetSignals.some((item) => containsTerm(item, job.track) || containsTerm(job.track, item));
  const cityUnrestricted = profile.cityPreference.some((item) => /不限|全国|均可/.test(item));
  const cityAligned = cityUnrestricted || job.city === "不限" || profile.cityPreference.some((item) => containsTerm(item, job.city));
  const interestDimension = dimension(
    "interest",
    "意向一致",
    "只使用明确的岗位方向、赛道偏好和城市选择，不把城市计入专业能力。",
    [
      factor("目标岗位", roleAligned ? 100 : 0, 55, roleAligned ? `求职目标明确指向“${job.title}”。` : `求职目标中未明确出现“${job.title}”。`, roleEvidence.map((item) => item.id)),
      factor("方向赛道", trackAligned ? 100 : 0, 30, trackAligned ? `求职方向与“${job.track}”一致。` : `尚未找到对“${job.track}”的明确偏好。`, trackEvidence.map((item) => item.id)),
      factor("城市偏好", cityAligned ? 100 : 0, 15, cityAligned ? `城市偏好接受“${job.city}”。` : `岗位城市“${job.city}”不在当前偏好中。`),
    ],
  );

  const learningEvidence = evidence.filter((item) => ["教育经历", "证书荣誉", "竞赛经历", "语言能力"].includes(item.section));
  const unresolvedNodes = abilityGraph.nodes.filter((item) => item.status !== "matched");
  const partialAmongUnresolved = unresolvedNodes.length
    ? unresolvedNodes.filter((item) => item.status === "partial").length / unresolvedNodes.length * 100
    : 100;
  const growthDimension = dimension(
    "growth",
    "成长潜力",
    "由已有基础、可迁移经历、学习资产及差距可补强性共同计算。",
    [
      factor("已有基础", keywordDimension.score, 40, `岗位能力证据覆盖度为 ${keywordDimension.score} 分。`, keywordDimension.evidenceIds),
      factor("可迁移经历", experienceDimension.score, 30, `相关经历的综合证据质量为 ${experienceDimension.score} 分。`, experienceDimension.evidenceIds),
      factor("学习资产", Math.min(100, learningEvidence.length / 3 * 100), 20, `识别 ${learningEvidence.length} 条教育、竞赛、证书或语言学习资产。`, learningEvidence.map((item) => item.id)),
      factor("差距可补强性", partialAmongUnresolved, 10, unresolvedNodes.length ? `${unresolvedNodes.filter((item) => item.status === "partial").length}/${unresolvedNodes.length} 项未达标能力已有部分证据。` : "当前能力节点均达到目标。", unresolvedNodes.flatMap((item) => item.evidenceIds)),
    ],
  );

  const dimensions = [abilityDimension, experienceDimension, keywordDimension, interestDimension, growthDimension];
  const total = clamp(dimensions.reduce((sum, item) => sum + item.score * item.weight / 100, 0));
  const verdict = total >= 82 ? "优先投递" : total >= 68 ? "补强后投递" : "暂不优先";
  const usedEvidenceIds = unique(dimensions.flatMap((item) => item.evidenceIds));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const topMatchedNodes = abilityGraph.nodes
    .filter((item) => item.status === "matched")
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
  const strongestEvidence = topMatchedNodes.map((node) => {
    const source = evidenceById.get(node.evidenceIds[0]);
    return source ? `${node.name}：${source.label}“${source.text}”。` : `${node.name}已有直接证据。`;
  });
  const firstRelevantExperience = relevantExperience[0];

  return {
    total,
    verdict,
    dimensions,
    evidence,
    abilityGraph,
    scoreExplanation: {
      methodVersion: "evidence-v1",
      formula: `${dimensions.map((item) => `${item.name} ${item.score}×${item.weight}%`).join(" + ")} = ${total}`,
      evidenceCoverage: abilityGraph.evidenceCoverage,
      usedEvidenceCount: usedEvidenceIds.length,
      note: "分数来自当前简历与岗位文本的可追溯证据；相关表达只计部分分，无证据不使用固定基础分。",
    },
    coveredKeywords,
    missingKeywords,
    strengths: [
      ...(strongestEvidence.length ? strongestEvidence : ["尚未识别到达到岗位目标线的能力证据。"]),
      firstRelevantExperience
        ? `${firstRelevantExperience.label}可作为经历支撑：“${firstRelevantExperience.text}”。`
        : "未找到可直接支撑岗位职责的实习、项目、竞赛或校园经历。",
    ],
    risks: [
      missingKeywords.length > 0 ? `${missingKeywords.slice(0, 4).join("、")} 暂无可引用的简历证据。` : "核心能力均有证据，仍需在面试中核验真实性与熟练度。",
      experienceDimension.score < 68 ? `经历匹配仅 ${experienceDimension.score} 分：${experienceDimension.factors.map((item) => item.explanation).join("；")}` : "经历证据较充分，下一步应核验个人贡献和成果归因。",
      abilityGraph.evidenceCoverage < 70 ? `能力证据覆盖度 ${abilityGraph.evidenceCoverage}%，存在初筛漏识别或能力缺口风险。` : `能力证据覆盖度 ${abilityGraph.evidenceCoverage}%，重点提升证据的量化质量。`,
    ],
    resumeActions: [
      {
        title: "项目经历 STAR 化",
        detail: "补充情境、任务、个人行动和量化结果，确保每项核心能力至少有一条可核验经历。",
        impact: "提升经历证据分",
      },
      {
        title: "补齐能力缺口",
        detail: missingKeywords.length > 0 ? `优先围绕 ${missingKeywords.slice(0, 5).join("、")} 补充真实项目、课程或证书证据；不要只堆砌关键词。` : "核心能力已覆盖，可继续增加成果数据和作品链接。",
        impact: "提升能力覆盖分",
      },
      {
        title: "明确岗位意向",
        detail: `在个人总结中明确目标岗位“${job.title}”、方向“${job.track}”及对应经历依据。`,
        impact: "提升意向一致分",
      },
    ],
    actionPlan: [
      "优先处理能力图谱中标记为“待补证”的核心节点。",
      "为每项核心能力准备一条简历原文、一项量化成果和一个面试故事。",
      "修改后重新计算匹配度，并检查新增分数是否引用了真实证据。",
    ],
  };
}
