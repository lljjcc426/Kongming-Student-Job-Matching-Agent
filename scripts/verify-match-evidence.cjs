const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const runtimeRoot = process.env.KONGMING_TEST_RUNTIME || "D:\\Kongming-RAG\\test-runtime\\match-evidence";
fs.mkdirSync(runtimeRoot, { recursive: true });
const bundlePath = path.join(runtimeRoot, "match-engine.cjs");

buildSync({
  entryPoints: [path.resolve(__dirname, "../src/matchEngine.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});

delete require.cache[require.resolve(bundlePath)];
const { analyzeMatch } = require(bundlePath);

const job = {
  id: "ux-research",
  title: "用户研究实习生",
  track: "用户研究",
  city: "上海",
  level: "实习",
  companyScenario: "互联网产品",
  summary: "执行用户研究并输出洞察。",
  responsibilities: ["执行用户访谈和问卷研究", "使用数据分析输出研究结论", "形成可量化的业务建议"],
  requirements: ["心理学或相关专业", "掌握访谈、SPSS 与数据分析方法"],
  bonus: ["有量化结果或研究报告"],
  keywords: ["SPSS", "访谈", "数据分析", "心理学", "量化结果"],
  priority: "高",
};

const profile = {
  name: "陈雨",
  grade: "本科",
  major: "心理学",
  school: "华东师范大学",
  target: "用户研究实习生",
  cityPreference: ["上海"],
  skills: ["SPSS", "访谈", "数据分析"],
  interests: ["用户研究"],
  experiences: [{
    title: "睡眠质量调查",
    role: "项目负责人",
    evidence: "设计问卷并使用 SPSS 分析 286 份样本，输出用户洞察报告。",
    tags: ["SPSS", "问卷", "数据分析"],
  }],
  resumeText: "心理学本科。目标岗位：用户研究实习生。使用 SPSS 分析 286 份问卷，完成访谈和数据分析。",
};

const structured = {
  basicInfo: ["陈雨"],
  competitions: [],
  certificates: [],
  languages: ["CET-6"],
  socialAccounts: [],
  name: "陈雨",
  education: ["华东师范大学 心理学 本科"],
  internships: [],
  projects: ["设计问卷并使用 SPSS 分析 286 份样本，完成 12 场访谈并输出研究报告。"],
  campus: [],
  honors: [],
  skills: ["SPSS", "访谈", "数据分析"],
  targetRoles: ["用户研究实习生"],
  summary: "心理学背景，关注用户研究方向。",
};

const result = analyzeMatch(profile, job, profile.resumeText, structured);
const calculatedTotal = Math.round(result.dimensions.reduce((sum, item) => sum + item.score * item.weight / 100, 0));
if (result.total !== calculatedTotal) {
  throw new Error(`Total score invariant failed: result=${result.total}, calculated=${calculatedTotal}`);
}

if (result.dimensions.reduce((sum, item) => sum + item.weight, 0) !== 100) {
  throw new Error("Dimension weights must total 100%");
}

for (const dimension of result.dimensions) {
  const factorWeight = Math.round(dimension.factors.reduce((sum, item) => sum + item.weight, 0) * 10) / 10;
  if (factorWeight !== 100) {
    throw new Error(`${dimension.name} factor weights must total 100%, found ${factorWeight}`);
  }
  const calculatedDimension = Math.round(dimension.factors.reduce((sum, item) => sum + item.score * item.weight / 100, 0));
  if (dimension.score !== calculatedDimension) {
    throw new Error(`${dimension.name} invariant failed: result=${dimension.score}, calculated=${calculatedDimension}`);
  }
}

const evidenceIds = new Set(result.evidence.map((item) => item.id));
for (const node of result.abilityGraph.nodes) {
  if (node.status !== "gap" && node.evidenceIds.length === 0) {
    throw new Error(`Supported ability ${node.name} has no citation`);
  }
  if (node.evidenceIds.some((id) => !evidenceIds.has(id))) {
    throw new Error(`Ability ${node.name} references unknown evidence`);
  }
  if (!node.explanation.includes(`${node.score}`)) {
    throw new Error(`Ability ${node.name} does not explain its score`);
  }
}

const emptyProfile = {
  name: "空白用户",
  grade: "",
  major: "",
  school: "",
  target: "",
  cityPreference: ["北京"],
  skills: [],
  interests: [],
  experiences: [],
  resumeText: "",
};
const emptyResult = analyzeMatch(emptyProfile, job, "", null);
if (emptyResult.dimensions.find((item) => item.id === "ability")?.score !== 0) {
  throw new Error("Ability score must be zero when no resume evidence exists");
}
if (emptyResult.abilityGraph.nodes.some((node) => node.status !== "gap" || node.score !== 0)) {
  throw new Error("Ability nodes must remain gaps when no resume evidence exists");
}

const relatedJob = { ...job, keywords: ["用户研究"], requirements: ["具备用户研究能力"] };
const relatedProfile = { ...emptyProfile, skills: ["访谈"], resumeText: "技能：访谈" };
const relatedResult = analyzeMatch(relatedProfile, relatedJob, relatedProfile.resumeText, null);
if (relatedResult.abilityGraph.nodes[0]?.status !== "partial") {
  throw new Error(`Related wording must receive partial support, found ${relatedResult.abilityGraph.nodes[0]?.status}`);
}

if (!result.scoreExplanation.formula.endsWith(`= ${result.total}`) || result.scoreExplanation.usedEvidenceCount < 1) {
  throw new Error("Overall score explanation is incomplete");
}

console.log(JSON.stringify({
  ok: true,
  total: result.total,
  dimensions: result.dimensions.map(({ name, score, weight, contribution }) => ({ name, score, weight, contribution })),
  abilityGraph: {
    matched: result.abilityGraph.matchedCount,
    partial: result.abilityGraph.partialCount,
    gap: result.abilityGraph.gapCount,
    evidenceCoverage: result.abilityGraph.evidenceCoverage,
  },
  emptyAbilityScore: emptyResult.dimensions.find((item) => item.id === "ability")?.score,
  relatedStatus: relatedResult.abilityGraph.nodes[0]?.status,
}, null, 2));
