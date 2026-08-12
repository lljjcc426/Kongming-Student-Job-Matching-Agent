const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

const source = readFileSync("src/modelProviders/interviewProvider.ts", "utf8");
const compiled = transformSync(source, {
  loader: "ts",
  format: "cjs",
  target: "es2022",
}).code;
const moduleExports = {};
const compiledModule = { exports: moduleExports };
const requireStub = () => ({});
new Function("exports", "module", "require", compiled)(moduleExports, compiledModule, requireStub);

const { analyzeInterviewEvidence, parseInterviewFeedback } = compiledModule.exports;
const answer = (text, index = 0) => ({
  question: `问题${index + 1}`,
  answer: text,
  timestamp: Date.now() + index,
  inputMode: "text",
});
const optimisticModelJson = JSON.stringify({
  overallScore: 88,
  expression: 86,
  professionalFit: 90,
  logic: 87,
  improvements: ["继续练习"],
  optimizedAnswer: "优化回答",
  summary: "模型认为表现很好。",
});

const shortTurns = [answer("用AI")];
const shortQuality = analyzeInterviewEvidence(shortTurns);
const shortReport = parseInterviewFeedback(optimisticModelJson, shortTurns);
if (shortQuality.scoreCap !== 22 || shortReport.overallScore > 22 || shortReport.professionalFit > 22) {
  throw new Error(`Short generic answer was not strictly capped: ${JSON.stringify({ shortQuality, shortReport })}`);
}

const oneDetailedTurn = [answer("在用户调研项目中，我负责设计问卷并使用AI辅助整理开放题，人工复核后分析286份样本，最终形成3项校园服务改进建议。")];
const oneDetailedQuality = analyzeInterviewEvidence(oneDetailedTurn);
const oneDetailedReport = parseInterviewFeedback(optimisticModelJson, oneDetailedTurn);
if (oneDetailedQuality.scoreCap !== 58 || oneDetailedReport.overallScore > 58) {
  throw new Error(`Single detailed answer was not capped: ${JSON.stringify({ oneDetailedQuality, oneDetailedReport })}`);
}

const strongTurns = [
  answer("在用户调研项目中，我负责设计问卷和访谈提纲，通过分层抽样回收286份有效问卷，最终识别3个关键问题并推动服务方案调整。", 0),
  answer("项目中团队对指标有分歧，我组织2次评审并用预调研数据验证问题，最终统一5项指标，问卷无效率下降18%。", 1),
  answer("复盘时我发现开放题编码一致性不足，因此设计双人复核流程并抽查30%样本，使一致性从72%提升到91%。", 2),
];
const strongQuality = analyzeInterviewEvidence(strongTurns);
const strongReport = parseInterviewFeedback(optimisticModelJson, strongTurns);
if (strongQuality.scoreCap !== 92 || strongReport.overallScore !== 88) {
  throw new Error(`Strong evidence should retain model score: ${JSON.stringify({ strongQuality, strongReport })}`);
}

const malformedReport = parseInterviewFeedback("not-json", shortTurns);
if (malformedReport.overallScore > 22) {
  throw new Error(`Malformed response fallback was too optimistic: ${JSON.stringify(malformedReport)}`);
}

console.log(JSON.stringify({
  ok: true,
  shortAnswer: { cap: shortQuality.scoreCap, score: shortReport.overallScore },
  oneDetailedAnswer: { cap: oneDetailedQuality.scoreCap, score: oneDetailedReport.overallScore },
  strongInterview: { cap: strongQuality.scoreCap, score: strongReport.overallScore },
  malformedFallbackScore: malformedReport.overallScore,
}, null, 2));
