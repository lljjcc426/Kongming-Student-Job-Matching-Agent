const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

const source = readFileSync("src/modelParsers.ts", "utf8");
const compiled = transformSync(source, {
  loader: "ts",
  format: "cjs",
  target: "es2022",
}).code;

const moduleExports = {};
const compiledModule = { exports: moduleExports };
const requireStub = () => ({});
new Function("exports", "module", "require", compiled)(moduleExports, compiledModule, requireStub);

const { parseStructuredResume, parseModelJobs } = compiledModule.exports;

const resume = parseStructuredResume('{"name":"林晨","education":["新闻学"],"internships":[],"projects":[],"campus":[],"honors":[],"skills":[],"targetRoles":["记者"],"summary":""} 后面追加说明');
if (resume.name !== "林晨" || resume.education[0] !== "新闻学") {
  throw new Error("Structured resume parser failed on trailing text.");
}

const jobs = parseModelJobs('[{"id":"editor","title":"新媒体编辑","track":"内容","city":"不限","level":"实习","companyScenario":"媒体","summary":"","responsibilities":["写稿"],"requirements":["新闻学"],"bonus":["作品"],"keywords":["新闻学,编辑"],"priority":"高"}][{"id":"extra"}]');
if (jobs.length !== 1 || jobs[0].keywords.length !== 2 || jobs[0].keywords[1] !== "编辑") {
  throw new Error("Job parser failed on concatenated JSON or keyword cleanup.");
}

console.log(JSON.stringify({ ok: true, parsedResume: resume.name, parsedJobs: jobs.length }, null, 2));
