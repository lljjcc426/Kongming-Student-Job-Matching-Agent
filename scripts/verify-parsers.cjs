const path = require("node:path");
const { buildSync } = require("esbuild");

const repoRoot = path.resolve(__dirname, "..");
const compiled = buildSync({
  absWorkingDir: repoRoot,
  entryPoints: ["src/modelParsers.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  write: false,
}).outputFiles[0].text;

const moduleExports = {};
const compiledModule = { exports: moduleExports };
new Function("exports", "module", "require", compiled)(moduleExports, compiledModule, require);

const { parseStructuredResume, parseModelJobs } = compiledModule.exports;

const resume = parseStructuredResume('{"name":"林晨","education":["新闻学"],"internships":[],"projects":[],"campus":[],"honors":[],"skills":[],"targetRoles":["记者"],"summary":""} 后面追加说明');
if (resume.name !== "林晨" || resume.education[0] !== "新闻学") {
  throw new Error("Structured resume parser failed on trailing text.");
}

const jobs = parseModelJobs('[{"id":"frontend","title":"前端开发实习生","track":"软件开发","city":"不限","level":"实习","companyScenario":"方向建议","summary":"React 页面开发","responsibilities":["开发页面"],"requirements":["React"],"bonus":["TypeScript"],"keywords":["React,TypeScript"],"priority":"高"}][{"id":"extra"}]');
if (jobs.length !== 1 || jobs[0].keywords.length !== 2 || jobs[0].keywords[1] !== "TypeScript" || jobs[0].jobKind !== "career-direction") {
  throw new Error("Job parser failed on concatenated JSON or keyword cleanup.");
}

console.log(JSON.stringify({ ok: true, parsedResume: resume.name, parsedJobs: jobs.length }, null, 2));
