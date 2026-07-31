const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_REPORT_PATH = "D:\\Kongming-RAG\\jobs-v1\\index\\retrieval-evaluation.json";
const CORE_URL = pathToFileURL(path.resolve("server/jobKnowledgeCore.js")).href;
const WORKER_URL = pathToFileURL(path.resolve("server/localJobKnowledgeWorker.js")).href;

const cases = [
  {
    name: "北京大模型实习",
    request: {
      query: "大模型算法实习生",
      queries: ["Python RAG AI Agent", "模型训练与评测项目经历"],
      topK: 5,
      filters: { cities: ["北京"], studentOnly: true },
    },
    relevant: (job) =>
      /大模型|算法|AI/i.test(`${job.title} ${job.job_family}`)
      && /Python|RAG|大语言模型/.test(job.skills.join(" ")),
  },
  {
    name: "前端实习",
    request: {
      query: "前端开发实习生",
      queries: ["React Vue TypeScript", "Web 页面与交互项目经历"],
      topK: 5,
      filters: { studentOnly: true },
    },
    relevant: (job) =>
      /前端/.test(`${job.title} ${job.job_family}`)
      || job.skills.some((skill) => ["React", "Vue", "JavaScript", "TypeScript"].includes(skill)),
  },
  {
    name: "深圳游戏开发",
    request: {
      query: "游戏客户端开发",
      queries: ["C++ 图形渲染", "游戏引擎与客户端项目"],
      topK: 5,
      filters: { cities: ["深圳"] },
    },
    relevant: (job) =>
      /游戏|客户端|引擎|图形|渲染/.test(
        `${job.title} ${job.job_family} ${job.responsibilities.join(" ")}`,
      ),
  },
  {
    name: "数据分析与运营",
    request: {
      query: "数据分析与产品运营",
      queries: ["SQL 用户增长", "用户分析与运营项目经历"],
      topK: 5,
      filters: {},
    },
    relevant: (job) =>
      /数据|运营|增长/.test(`${job.title} ${job.job_family}`)
      || job.skills.some((skill) => ["数据分析", "SQL"].includes(skill)),
  },
  {
    name: "腾讯云销售",
    request: {
      query: "腾讯云销售经理",
      queries: ["云计算 大客户", "客户拓展与商务经验"],
      topK: 5,
      filters: { sources: ["腾讯"] },
    },
    relevant: (job) =>
      /云|销售|客户/.test(`${job.title} ${job.job_family} ${job.responsibilities.join(" ")}`),
  },
  {
    name: "Java 后端实习",
    request: {
      query: "后端开发实习生",
      queries: ["Java Go 分布式系统", "服务端项目与数据库"],
      topK: 5,
      filters: { studentOnly: true },
    },
    relevant: (job) =>
      /后端|服务端|服务器/.test(`${job.title} ${job.job_family}`)
      || job.skills.some((skill) => ["Java", "Go"].includes(skill)),
  },
  {
    name: "产品经理实习",
    request: {
      query: "产品经理实习生",
      queries: ["用户需求 数据分析", "产品设计与项目推进"],
      topK: 5,
      filters: { studentOnly: true },
    },
    relevant: (job) =>
      /产品/.test(`${job.title} ${job.job_family}`),
  },
  {
    name: "测试开发实习",
    request: {
      query: "测试开发实习生",
      queries: ["自动化测试 Python", "质量保障与测试工具"],
      topK: 5,
      filters: { studentOnly: true },
    },
    relevant: (job) =>
      /测试|质量/.test(`${job.title} ${job.job_family}`),
  },
  {
    name: "设计实习",
    request: {
      query: "视觉设计实习生",
      queries: ["UI UX 用户体验", "界面视觉与交互设计"],
      topK: 5,
      filters: { studentOnly: true },
    },
    relevant: (job) =>
      /设计|视觉|UI|UX/i.test(`${job.title} ${job.job_family}`),
  },
  {
    name: "数据开发实习",
    request: {
      query: "数据开发实习生",
      queries: ["SQL Python 大数据", "数据仓库与数据处理项目"],
      topK: 5,
      filters: { studentOnly: true },
    },
    relevant: (job) =>
      /数据|大数据/.test(`${job.title} ${job.job_family}`)
      || job.skills.some((skill) => ["SQL", "Python", "Spark", "Flink"].includes(skill)),
  },
];

async function main() {
  const { runJobKnowledgeSearch, runJobKnowledgeStatus } = await import(CORE_URL);
  const {
    closeLocalJobKnowledgeWorker,
    warmLocalJobKnowledge,
  } = await import(WORKER_URL);
  const startedAt = Date.now();
  const errors = [];
  const evaluations = [];

  try {
    await warmLocalJobKnowledge(180_000);
    const status = await runJobKnowledgeStatus({ allowLocal: true });
    if (!status.payload?.ready) {
      throw new Error(status.payload?.error || "岗位索引尚未就绪");
    }
    if (status.payload?.stale) {
      errors.push("岗位索引与当前数据集哈希不一致");
    }
    if (status.payload?.manifest?.vector_backend !== "qdrant-local") {
      errors.push("岗位向量检索没有使用 Qdrant 本地数据库");
    }
    if (!status.payload?.database?.ready) {
      errors.push(
        status.payload?.database?.error || "Qdrant 岗位数据库未就绪",
      );
    }
    const expectedPoints =
      status.payload?.manifest?.node_count
      ?? status.payload?.manifest?.record_count;
    if (status.payload?.database?.pointsCount !== expectedPoints) {
      errors.push("Qdrant 数据量与索引清单不一致");
    }
    if (status.payload?.manifest?.nodes_per_record !== 3) {
      errors.push("活动索引没有按每个岗位三个语义节点构建");
    }

    for (const evaluationCase of cases) {
      const result = await runJobKnowledgeSearch(evaluationCase.request, {
        allowLocal: true,
      });
      if (result.status !== 200 || !result.payload?.ok) {
        errors.push(
          `${evaluationCase.name} 检索失败：${result.payload?.error || result.status}`,
        );
        continue;
      }

      const jobs = result.payload.results || [];
      const diagnostics = result.payload.retrievalDiagnostics || {};
      const expectedQueryCount = [
        evaluationCase.request.query,
        ...(evaluationCase.request.queries || []),
      ].filter((query, index, all) => all.indexOf(query) === index).slice(0, 3).length;
      const relevantJobs = jobs.filter(evaluationCase.relevant);
      const relevance = jobs.map((job) => evaluationCase.relevant(job));
      const firstRelevantIndex = relevance.findIndex(Boolean);
      const reciprocalRank = firstRelevantIndex >= 0
        ? 1 / (firstRelevantIndex + 1)
        : 0;
      const dcg = relevance.reduce(
        (score, relevant, index) =>
          score + (relevant ? 1 / Math.log2(index + 2) : 0),
        0,
      );
      const idealRelevantCount = Math.min(relevantJobs.length, jobs.length);
      const idealDcg = Array.from(
        { length: idealRelevantCount },
        (_, index) => 1 / Math.log2(index + 2),
      ).reduce((sum, score) => sum + score, 0);
      const ndcgAt5 = idealDcg ? dcg / idealDcg : 0;
      const uniqueIds = new Set(jobs.map((job) => job.id));
      const studentOnlyCompliant =
        !evaluationCase.request.filters?.studentOnly
        || jobs.every((job) =>
          ["实习", "校园招聘"].includes(job.recruitment_type));
      const scoresValid = jobs.every((job) =>
        Number.isFinite(job.retrieval?.score)
        && job.retrieval.score >= 0
        && job.retrieval.score <= 1
        && Number.isFinite(job.retrieval?.confidence)
        && job.retrieval.confidence >= 0
        && job.retrieval.confidence <= 1);
      const diagnosticsValid =
        result.payload.queryCount === expectedQueryCount
        && diagnostics.queryCount === expectedQueryCount
        && diagnostics.denseLimitPerQuery > 0
        && diagnostics.denseCandidatesRetrieved <= result.payload.totalCandidates
        && diagnostics.denseNodesRetrieved >= diagnostics.denseCandidatesRetrieved
        && diagnostics.nodesPerRecord === 3
        && diagnostics.cacheHit === false
        && diagnostics.cacheMaxEntries > 0
        && typeof diagnostics.rerankerEnabled === "boolean"
        && jobs.some((job) =>
          Array.isArray(job.retrieval?.matchedSections)
          && job.retrieval.matchedSections.length > 0);
      const restrictiveFilters = evaluationCase.request.filters
        && (
          evaluationCase.request.filters.studentOnly
          || Object.entries(evaluationCase.request.filters).some(
            ([key, value]) => key !== "studentOnly"
              && Array.isArray(value)
              && value.length > 0,
          )
        );
      const filterPushdownValid =
        !restrictiveFilters
        || result.payload.totalCandidates === 500
        || diagnostics.filterPushdown === true;
      const officialLinksOnly = jobs.every((job) => {
        try {
          return [
            "jobs.bytedance.com",
            "careers.tencent.com",
            "zhaopin.meituan.com",
          ].includes(new URL(job.source_url).hostname);
        } catch {
          return false;
        }
      });
      const passed =
        jobs.length > 0
        && relevantJobs.length > 0
        && uniqueIds.size === jobs.length
        && studentOnlyCompliant
        && scoresValid
        && diagnosticsValid
        && filterPushdownValid
        && officialLinksOnly;
      if (!passed) {
        errors.push(`${evaluationCase.name} 未命中相关岗位或返回结果不合规`);
      }
      evaluations.push({
        name: evaluationCase.name,
        passed,
        elapsed_ms: result.payload.elapsedMs,
        result_count: jobs.length,
        relevant_at_5: relevantJobs.length,
        reciprocal_rank: Number(reciprocalRank.toFixed(4)),
        ndcg_at_5: Number(ndcgAt5.toFixed(4)),
        student_filter_compliant: studentOnlyCompliant,
        query_count: result.payload.queryCount,
        retrieval_diagnostics: diagnostics,
        top_results: jobs.map((job) => ({
          id: job.id,
          title: job.title,
          company: job.company_name,
          city: job.city,
          recruitment_type: job.recruitment_type,
          score: job.retrieval.score,
          confidence: job.retrieval.confidence,
          matched_terms: job.retrieval.matchedTerms,
          matched_sections: job.retrieval.matchedSections,
        })),
      });
    }

    const cachedResult = await runJobKnowledgeSearch(cases[0].request, {
      allowLocal: true,
    });
    const baselineEvaluation = evaluations[0];
    const cachedDiagnostics =
      cachedResult.payload?.retrievalDiagnostics || {};
    const baselineIds =
      baselineEvaluation?.top_results?.map((job) => job.id) || [];
    const cachedIds =
      cachedResult.payload?.results?.map((job) => job.id) || [];
    const cacheVerification = {
      passed:
        cachedResult.status === 200
        && cachedResult.payload?.ok
        && cachedDiagnostics.cacheHit === true
        && JSON.stringify(cachedIds) === JSON.stringify(baselineIds)
        && cachedResult.payload.elapsedMs < baselineEvaluation.elapsed_ms,
      elapsed_ms: cachedResult.payload?.elapsedMs ?? null,
      baseline_elapsed_ms: baselineEvaluation?.elapsed_ms ?? null,
      cache_age_ms: cachedDiagnostics.cacheAgeMs ?? null,
      cache_entries: cachedDiagnostics.cacheEntries ?? null,
      result_ids_match:
        JSON.stringify(cachedIds) === JSON.stringify(baselineIds),
    };
    if (!cacheVerification.passed) {
      errors.push("重复检索没有命中查询缓存，或缓存结果与基线不一致");
    }

    const report = {
      checked_at: new Date().toISOString(),
      passed: errors.length === 0,
      case_count: cases.length,
      passed_cases: evaluations.filter((item) => item.passed).length,
      hit_at_5:
        cases.length
          ? Number(
              (
                evaluations.filter((item) => item.relevant_at_5 > 0).length
                / cases.length
              ).toFixed(4),
            )
          : 0,
      mean_reciprocal_rank: evaluations.length
        ? Number(
            (
              evaluations.reduce(
                (sum, item) => sum + item.reciprocal_rank,
                0,
              ) / evaluations.length
            ).toFixed(4),
          )
        : 0,
      mean_ndcg_at_5: evaluations.length
        ? Number(
            (
              evaluations.reduce(
                (sum, item) => sum + item.ndcg_at_5,
                0,
              ) / evaluations.length
            ).toFixed(4),
          )
        : 0,
      total_elapsed_ms: Date.now() - startedAt,
      cache_verification: cacheVerification,
      errors,
      evaluations,
    };
    const reportPath = process.env.JOB_RAG_EVALUATION_PATH || DEFAULT_REPORT_PATH;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(`[RAG] 用例 ${report.passed_cases}/${report.case_count}`);
    console.log(`[RAG] Hit@5 ${report.hit_at_5}`);
    console.log(`[RAG] MRR ${report.mean_reciprocal_rank}`);
    console.log(`[RAG] nDCG@5 ${report.mean_ndcg_at_5}`);
    console.log(
      `[RAG] 查询缓存 ${report.cache_verification.passed ? "通过" : "未通过"}，`
        + `${report.cache_verification.elapsed_ms}ms`,
    );
    console.log(`[RAG] 结果 ${report.passed ? "通过" : "未通过"}`);
    console.log(`[RAG] 报告 ${reportPath}`);
    for (const evaluation of evaluations) {
      console.log(
        `[RAG] ${evaluation.name}: ${evaluation.passed ? "通过" : "失败"}，`
          + `相关结果 ${evaluation.relevant_at_5}/${evaluation.result_count}，`
          + `${evaluation.elapsed_ms}ms`,
      );
    }
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
