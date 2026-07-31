const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_REPORT_PATH =
  "D:\\Kongming-RAG\\jobs-v1\\database\\database-verification.json";
const WORKER_URL = pathToFileURL(
  path.resolve("server/localJobKnowledgeWorker.js"),
).href;

async function main() {
  const {
    closeLocalJobKnowledgeWorker,
    getLocalJobKnowledgeStatus,
  } = await import(WORKER_URL);
  const errors = [];

  try {
    const status = await getLocalJobKnowledgeStatus(30_000);
    const manifest = status.manifest || {};
    const database = status.database || {};
    const expectedPoints = manifest.node_count ?? manifest.record_count;

    if (!status.ready) errors.push(status.error || "岗位数据库尚未就绪");
    if (status.stale) errors.push("岗位数据库与当前数据集哈希不一致");
    if (manifest.vector_backend !== "qdrant-local") {
      errors.push(`向量后端不是 qdrant-local：${manifest.vector_backend || "未设置"}`);
    }
    if (!database.ready) {
      errors.push(database.error || "Qdrant 数据库不可用");
    }
    if (database.pointsCount !== expectedPoints) {
      errors.push(
        `Qdrant 数据量不一致：${database.pointsCount ?? "未知"} / `
          + `${expectedPoints ?? "未知"}`,
      );
    }
    if (
      process.platform === "win32"
      && !String(database.path || "").toUpperCase().startsWith("D:\\")
    ) {
      errors.push(`Qdrant 数据库没有存放在 D 盘：${database.path || "未设置"}`);
    }
    if (!database.storesFullJobPayload) {
      errors.push("Qdrant 未声明保存完整岗位 JSON 元数据");
    }

    const report = {
      checked_at: new Date().toISOString(),
      passed: errors.length === 0,
      errors,
      index_version: manifest.version_id || null,
      dataset_sha256: manifest.dataset_sha256 || null,
      expected_records: manifest.record_count ?? null,
      expected_nodes: expectedPoints ?? null,
      nodes_per_record: manifest.nodes_per_record ?? 1,
      database,
    };
    const reportPath = process.env.JOB_RAG_DATABASE_REPORT_PATH
      || DEFAULT_REPORT_PATH;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(`[岗位数据库] ${report.passed ? "通过" : "未通过"}`);
    console.log(
      `[岗位数据库] ${database.type || "未知"} / `
        + `${database.pointsCount ?? "未知"} 个向量节点 / `
        + `${manifest.record_count ?? "未知"} 个岗位 / `
        + `${database.collection || "未知集合"}`,
    );
    console.log(`[岗位数据库] ${database.path || "未知路径"}`);
    console.log(`[岗位数据库] 报告 ${reportPath}`);
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
