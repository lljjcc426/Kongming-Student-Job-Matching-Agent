const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_OUTPUT_DIR = "D:\\Kongming-RAG\\jobs-v1";
const REQUIRED_FIELDS = [
  "schema_version",
  "id",
  "source",
  "source_name",
  "source_job_id",
  "source_url",
  "company_name",
  "title",
  "recruitment_type",
  "responsibilities",
  "requirements",
  "collected_at",
  "last_verified_at",
  "status",
  "source_payload_hash",
  "retrieval_text",
];

const OFFICIAL_HOSTS = {
  bytedance: "jobs.bytedance.com",
  tencent: "careers.tencent.com",
  meituan: "zhaopin.meituan.com",
};

function parseArguments(argv) {
  const options = {
    outputDir: process.env.KONGMING_RAG_DATA_DIR || DEFAULT_OUTPUT_DIR,
    target: 500,
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output-dir") {
      options.outputDir = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--target") {
      options.target = Number(argv[index + 1]);
      index += 1;
    }
  }
  options.outputDir = path.resolve(options.outputDir);
  if (!Number.isInteger(options.target) || options.target < 1) {
    throw new Error("--target 必须是正整数");
  }
  return options;
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`JSONL 第 ${index + 1} 行解析失败: ${error.message}`);
      }
    });
}

function countBy(records, selector) {
  const counts = {};
  for (const record of records) {
    const key = selector(record) || "未标注";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}

function validate(records, target) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const sourceKeys = new Set();

  if (records.length !== target) {
    errors.push(`数据量应为 ${target}，实际为 ${records.length}`);
  }

  for (const [index, record] of records.entries()) {
    const label = `第 ${index + 1} 条 (${record.id || "无 ID"})`;
    for (const field of REQUIRED_FIELDS) {
      const value = record[field];
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        errors.push(`${label} 缺少必填字段 ${field}`);
      }
    }

    if (ids.has(record.id)) {
      errors.push(`${label} ID 重复: ${record.id}`);
    }
    ids.add(record.id);

    const sourceKey = `${record.source}:${record.source_job_id}`;
    if (sourceKeys.has(sourceKey)) {
      errors.push(`${label} 来源岗位键重复: ${sourceKey}`);
    }
    sourceKeys.add(sourceKey);

    try {
      const url = new URL(record.source_url);
      if (url.protocol !== "https:") {
        errors.push(`${label} 原始链接不是 HTTPS`);
      }
      if (url.hostname !== OFFICIAL_HOSTS[record.source]) {
        errors.push(
          `${label} 原始链接域名错误: ${url.hostname}，期望 ${OFFICIAL_HOSTS[record.source]}`,
        );
      }
    } catch {
      errors.push(`${label} 原始链接无效: ${record.source_url}`);
    }

    if (record.status !== "active") {
      errors.push(`${label} 状态不是 active`);
    }
    if (!Array.isArray(record.responsibilities) || !Array.isArray(record.requirements)) {
      errors.push(`${label} 职责或要求不是数组`);
    }
    if (!/^[a-f0-9]{64}$/.test(record.source_payload_hash || "")) {
      errors.push(`${label} 原始内容哈希格式无效`);
    }
    if ((record.retrieval_text || "").length < 100) {
      warnings.push(`${label} RAG 检索文本少于 100 字符`);
    }
    if (!record.city) {
      warnings.push(`${label} 未标注工作城市`);
    }
    if (!record.job_family) {
      warnings.push(`${label} 未标注岗位类别`);
    }
  }

  return { errors, warnings };
}

function writeReports(outputDir, records, result) {
  const report = {
    checked_at: new Date().toISOString(),
    passed: result.errors.length === 0,
    total: records.length,
    error_count: result.errors.length,
    warning_count: result.warnings.length,
    sources: countBy(records, (record) => record.source_name),
    recruitment_types: countBy(records, (record) => record.recruitment_type),
    top_cities: Object.fromEntries(
      Object.entries(countBy(records, (record) => record.city)).slice(0, 20),
    ),
    top_job_families: Object.fromEntries(
      Object.entries(countBy(records, (record) => record.job_family)).slice(0, 20),
    ),
    errors: result.errors,
    warnings: result.warnings,
  };
  fs.writeFileSync(
    path.join(outputDir, "quality-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  const markdown = [
    "# 岗位种子库质量报告",
    "",
    `- 检查时间：${report.checked_at}`,
    `- 结论：${report.passed ? "通过" : "未通过"}`,
    `- 数据量：${report.total}`,
    `- 错误：${report.error_count}`,
    `- 警告：${report.warning_count}`,
    `- 来源分布：${Object.entries(report.sources)
      .map(([name, count]) => `${name} ${count} 条`)
      .join("、")}`,
    "",
    "## 校验范围",
    "",
    "- JSONL 可解析性与目标数量。",
    "- 必填字段、职责与要求数组、检索文本。",
    "- 岗位 ID 与来源岗位键唯一性。",
    "- 官方 HTTPS 域名白名单。",
    "- 活跃状态、采集时间、核验时间和原始内容 SHA-256。",
    "",
    "## 错误",
    "",
    ...(report.errors.length ? report.errors.map((item) => `- ${item}`) : ["- 无"]),
    "",
    "## 警告",
    "",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- 无"]),
    "",
    "## 尚未覆盖",
    "",
    "- 该报告不替代逐条人工语义复核。",
    "- 岗位会随招聘方更新或下线，生产使用需要定期增量核验。",
    "- 对外发布前仍需复核数据授权、招聘网站条款与内容使用边界。",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outputDir, "quality-report.md"), markdown, "utf8");
  return report;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const inputPath = path.join(options.outputDir, "jobs-500.jsonl");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`找不到数据文件: ${inputPath}`);
  }
  const records = readJsonl(inputPath);
  const result = validate(records, options.target);
  const report = writeReports(options.outputDir, records, result);

  console.log(`[校验] ${inputPath}`);
  console.log(`[数量] ${report.total}`);
  console.log(`[来源] ${JSON.stringify(report.sources)}`);
  console.log(`[结果] ${report.passed ? "通过" : "未通过"}`);
  console.log(`[错误] ${report.error_count}，[警告] ${report.warning_count}`);

  if (!report.passed) {
    for (const error of report.errors.slice(0, 20)) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`[失败] ${error.stack || error.message}`);
  process.exitCode = 1;
}
