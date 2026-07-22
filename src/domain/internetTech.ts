import type { CareerDomainAdapter, HardConstraint, HardConstraintType, RoleFamilyId } from "./careerDomain";

const rolePatterns: Array<[RoleFamilyId, RegExp]> = [
  ["ai-algorithm", /算法|机器学习|深度学习|大模型|人工智能|\bAI\b|LLM|NLP|computer vision/i],
  ["data", /数据分析|数据工程|商业分析|数据仓库|数据开发|\bSQL\b|BI\b/i],
  ["product", /产品经理|产品运营|AI\s*产品|需求分析|用户研究|产品设计/i],
  ["software-development", /前端|后端|客户端|移动端|测试开发|软件开发|研发工程师|React|Vue|Java|Go\b|TypeScript/i],
];

const skillAliases: Record<string, string[]> = {
  javascript: ["javascript", "js", "ecmascript"],
  typescript: ["typescript", "ts"],
  react: ["react", "react.js", "reactjs"],
  vue: ["vue", "vue.js", "vuejs"],
  nodejs: ["node", "node.js", "nodejs"],
  python: ["python", "py"],
  java: ["java"],
  golang: ["go", "golang"],
  cpp: ["c++", "cpp"],
  sql: ["sql", "mysql", "postgresql", "postgres"],
  machinelearning: ["机器学习", "machine learning", "ml"],
  llm: ["大模型", "llm", "large language model"],
  dataanalysis: ["数据分析", "data analysis", "analytics"],
  productdesign: ["产品设计", "product design"],
  requirementanalysis: ["需求分析", "需求拆解", "requirement analysis"],
  userresearch: ["用户研究", "用户调研", "user research"],
};

const compact = (value: string) => value.toLowerCase().replace(/[\s._+\-/]/g, "").trim();

const aliasIndex = new Map<string, string>();
Object.entries(skillAliases).forEach(([canonical, aliases]) => {
  aliases.forEach((alias) => aliasIndex.set(compact(alias), canonical));
});

const constraintPatterns: Array<[HardConstraintType, RegExp]> = [
  ["education", /(本科及以上|硕士及以上|博士|本科|大专|专科)/i],
  ["graduation-year", /(20\d{2}\s*届|毕业时间[^，。；\n]{0,12})/i],
  ["internship-duration", /(实习[^，。；\n]{0,10}(?:个月|天|周)|每周[^，。；\n]{0,8}天)/i],
  ["language", /(英语[^，。；\n]{0,16}(?:四级|六级|CET[- ]?[46]|雅思|托福)|CET[- ]?[46]|IELTS|TOEFL)/i],
  ["certificate", /(资格证|认证|证书|PMP|CPA|软考)[^，。；\n]{0,20}/i],
  ["availability", /(可连续实习|到岗时间|每周到岗)[^，。；\n]{0,20}/i],
];

const stableConstraintId = (type: HardConstraintType, text: string, index: number) =>
  `constraint-${type}-${index}-${compact(text).slice(0, 16)}`;

const isNegated = (sourceText: string, skill: string) => {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:尚未|未曾|没有|不会|不熟悉|未使用|缺少)[^。；\\n]{0,10}${escaped}`, "i").test(sourceText);
};

export const internetTechDomainAdapter: CareerDomainAdapter = {
  id: "internet-tech",
  displayName: "互联网与数字技术",
  supportedRoleFamilies: ["software-development", "ai-algorithm", "data", "product"],
  normalizeSkill(value) {
    const normalized = compact(value);
    return aliasIndex.get(normalized) || normalized;
  },
  classifyJob(text) {
    return rolePatterns.find(([, pattern]) => pattern.test(text))?.[0] || null;
  },
  extractHardConstraints(lines) {
    const constraints: HardConstraint[] = [];
    lines.forEach((line, lineIndex) => {
      constraintPatterns.forEach(([type, pattern]) => {
        const match = line.match(pattern);
        if (!match) return;
        constraints.push({
          id: stableConstraintId(type, line, lineIndex),
          type,
          text: line,
          requiredValue: match[1] || match[0],
        });
      });
    });
    return constraints;
  },
  buildInterviewTopics(roleFamily) {
    if (roleFamily === "software-development") return ["技术选型", "调试排障", "工程质量", "性能与稳定性"];
    if (roleFamily === "ai-algorithm") return ["数据与评测", "模型选择", "误差分析", "工程部署"];
    if (roleFamily === "data") return ["指标定义", "SQL 与数据质量", "分析结论", "业务影响"];
    if (roleFamily === "product") return ["问题定义", "需求优先级", "协作推进", "上线验证"];
    return ["岗位理解", "真实经历", "能力迁移", "风险与补强"];
  },
  validateResumeEvidence(sourceText, skill) {
    if (!sourceText.trim() || !skill.trim() || isNegated(sourceText, skill)) return false;
    const canonical = this.normalizeSkill(skill);
    const tokens = sourceText
      .split(/[\s，,。；;、/|()（）:：]+/)
      .map((token) => this.normalizeSkill(token))
      .filter(Boolean);
    return tokens.includes(canonical) || this.normalizeSkill(sourceText).includes(canonical);
  },
};

export const roleFamilyLabel: Record<RoleFamilyId, string> = {
  "software-development": "软件开发",
  "ai-algorithm": "AI 与算法",
  data: "数据方向",
  product: "产品方向",
};
