const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_REPORT_PATH =
  "D:\\Kongming-RAG\\jobs-v1\\index\\reranker-verification.json";
const CORE_URL = pathToFileURL(
  path.resolve("server/jobKnowledgeCore.js"),
).href;
const WORKER_URL = pathToFileURL(
  path.resolve("server/localJobKnowledgeWorker.js"),
).href;

process.env.JOB_RAG_RERANK_ENABLED =
  process.env.JOB_RAG_RERANK_ENABLED || "true";
process.env.JOB_RAG_RERANK_LOCAL_FILES_ONLY =
  process.env.JOB_RAG_RERANK_LOCAL_FILES_ONLY || "true";

async function main() {
  const { runJobKnowledgeSearch, runJobKnowledgeStatus } =
    await import(CORE_URL);
  const {
    closeLocalJobKnowledgeWorker,
    warmLocalJobKnowledge,
  } = await import(WORKER_URL);
  const errors = [];

  try {
    await warmLocalJobKnowledge(180_000);
    const status = await runJobKnowledgeStatus({ allowLocal: true });
    if (!status.payload?.ready) {
      throw new Error(status.payload?.error || "岗位知识库尚未就绪");
    }
    if (!status.payload?.reranker?.configured) {
      errors.push("重排器环境开关没有传递到本地工作进程");
    }

    const result = await runJobKnowledgeSearch(
      {
        query: "北京大模型算法实习生",
        queries: [
          "Python RAG AI Agent",
          "模型训练与评测项目经历",
        ],
        topK: 5,
        rerank: true,
        bypassCache: true,
        filters: {
          cities: ["北京"],
          studentOnly: true,
        },
      },
      { allowLocal: true },
    );
    if (result.status !== 200 || !result.payload?.ok) {
      throw new Error(result.payload?.error || `检索失败：${result.status}`);
    }

    const diagnostics = result.payload.retrievalDiagnostics || {};
    const jobs = result.payload.results || [];
    const applied = diagnostics.rerankerApplied === true;
    const gracefulFallback =
      diagnostics.rerankerEnabled === true
      && diagnostics.rerankerApplied === false
      && typeof diagnostics.rerankerError === "string"
      && diagnostics.rerankerError.length > 0
      && jobs.length > 0;
    const appliedScoresValid =
      applied
      && diagnostics.rerankCandidates >= jobs.length
      && jobs.every((job) =>
        Number.isFinite(job.retrieval?.rerankScore)
        && Number.isInteger(job.retrieval?.rerankRank));

    if (!appliedScoresValid && !gracefulFallback) {
      errors.push("重排器既未成功应用，也没有安全回退到混合检索");
    }

    const report = {
      checked_at: new Date().toISOString(),
      passed: errors.length === 0,
      mode: applied ? "reranked" : "graceful-fallback",
      model: diagnostics.rerankerModel || null,
      diagnostics,
      result_count: jobs.length,
      errors,
    };
    const reportPath =
      process.env.JOB_RAG_RERANK_REPORT_PATH || DEFAULT_REPORT_PATH;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );

    console.log(`[重排] ${report.passed ? "通过" : "未通过"}`);
    console.log(`[重排] 模式 ${report.mode}`);
    console.log(`[重排] 模型 ${report.model || "未配置"}`);
    console.log(`[重排] 报告 ${reportPath}`);
    if (!report.passed) {
      errors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
    }
  } finally {
    closeLocalJobKnowledgeWorker();
  }
}

main().catch((error) => {
  console.error(`[失败] ${error.stack || error.message}`);
  process.exitCode = 1;
});
