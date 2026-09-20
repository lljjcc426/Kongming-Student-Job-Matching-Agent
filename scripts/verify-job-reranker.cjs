const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_MODEL_PATH =
  "D:\\ai_models\\kongming-rerankers\\bge-reranker-v2-m3";
const DEFAULT_REPORT_PATH =
  "D:\\Kongming-RAG\\jobs-v1\\index\\reranker-verification.json";
const CORE_URL = pathToFileURL(
  path.resolve("server/jobKnowledgeCore.js"),
).href;
const WORKER_URL = pathToFileURL(
  path.resolve("server/localJobKnowledgeWorker.js"),
).href;

process.env.JOB_RAG_RERANK_ENABLED = "true";
process.env.JOB_RAG_RERANK_LOCAL_FILES_ONLY = "true";
process.env.JOB_RAG_RERANK_STRICT = "true";
process.env.JOB_RAG_RERANK_MODEL_PATH =
  process.env.JOB_RAG_RERANK_MODEL_PATH || DEFAULT_MODEL_PATH;

const writeReport = (report) => {
  const reportPath =
    process.env.JOB_RAG_RERANK_REPORT_PATH || DEFAULT_REPORT_PATH;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  return reportPath;
};

async function main() {
  const startedAt = Date.now();
  const { runJobKnowledgeSearch, runJobKnowledgeStatus } =
    await import(CORE_URL);
  const {
    closeLocalJobKnowledgeWorker,
    warmLocalJobKnowledge,
  } = await import(WORKER_URL);
  const errors = [];
  let diagnostics = {};
  let jobs = [];
  let model = process.env.JOB_RAG_RERANK_MODEL || "BAAI/bge-reranker-v2-m3";
  let source = process.env.JOB_RAG_RERANK_MODEL_PATH;

  try {
    if (!fs.existsSync(source)) {
      errors.push(
        `本地重排模型不存在：${source}。请先运行 npm run setup:job-reranker`,
      );
    } else {
      await warmLocalJobKnowledge(180_000);
      const status = await runJobKnowledgeStatus({ allowLocal: true });
      if (!status.payload?.ready) {
        errors.push(status.payload?.error || "岗位知识库尚未就绪");
      }
      const rerankerStatus = status.payload?.reranker || {};
      model = rerankerStatus.model || model;
      source = rerankerStatus.source || source;
      if (!rerankerStatus.configured) {
        errors.push("重排器环境开关没有传递到本地工作进程");
      }
      if (!rerankerStatus.localModelAvailable) {
        errors.push(`工作进程无法识别本地重排模型：${source}`);
      }

      if (errors.length === 0) {
        const result = await runJobKnowledgeSearch(
          {
            query: "北京大模型算法实习生",
            queries: [
              "Python RAG AI Agent",
              "模型训练与评测项目经验",
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
          errors.push(
            result.payload?.error || `岗位检索失败：${result.status}`,
          );
        } else {
          diagnostics = result.payload.retrievalDiagnostics || {};
          jobs = result.payload.results || [];
          source = diagnostics.rerankerSource || source;

          if (diagnostics.rerankerEnabled !== true) {
            errors.push("检索诊断显示重排器未启用");
          }
          if (diagnostics.rerankerApplied !== true) {
            errors.push(
              diagnostics.rerankerError
                ? `真实重排未执行：${diagnostics.rerankerError}`
                : "真实重排未执行，不能以降级检索作为验证成功",
            );
          }
          if (jobs.length === 0) {
            errors.push("严格重排验证没有返回岗位");
          }
          if (diagnostics.rerankCandidates < jobs.length) {
            errors.push("参与重排的候选数量少于最终结果数量");
          }
          if (diagnostics.cacheBypassed !== true) {
            errors.push("严格重排验证没有按请求绕过查询缓存");
          }
          if (
            !jobs.every(
              (job) =>
                Number.isFinite(job.retrieval?.rerankScore)
                && Number.isInteger(job.retrieval?.rerankRank),
            )
          ) {
            errors.push("部分岗位缺少有效的重排分数或重排名次");
          }
        }
      }
    }
  } catch (error) {
    errors.push(error.message || String(error));
  } finally {
    closeLocalJobKnowledgeWorker();
  }

  const report = {
    checked_at: new Date().toISOString(),
    passed: errors.length === 0,
    mode: errors.length === 0 ? "reranked" : "failed",
    model,
    source,
    local_model_available: fs.existsSync(
      process.env.JOB_RAG_RERANK_MODEL_PATH,
    ),
    diagnostics,
    result_count: jobs.length,
    elapsed_ms: Date.now() - startedAt,
    errors,
  };
  const reportPath = writeReport(report);

  console.log(`[重排] ${report.passed ? "通过" : "未通过"}`);
  console.log(`[重排] 模式 ${report.mode}`);
  console.log(`[重排] 模型 ${report.model}`);
  console.log(`[重排] 来源 ${report.source}`);
  console.log(`[重排] 报告 ${reportPath}`);
  if (!report.passed) {
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[失败] ${error.stack || error.message}`);
  process.exitCode = 1;
});
