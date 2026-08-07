const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const PYTHON_PATH = process.env.JOB_RAG_PYTHON_PATH
  || "D:\\conda_envs\\kongming-rag\\python.exe";
const REPORT_PATH = process.env.JOB_RAG_REMOTE_REPORT_PATH
  || "D:\\Kongming-RAG\\jobs-v1\\index\\remote-rag-verification.json";
const SERVICE_PATH = path.resolve("server/job_rag_http_service.py");
const CORE_URL = pathToFileURL(path.resolve("server/jobKnowledgeCore.js")).href;
const SEARCH_API_URL = pathToFileURL(path.resolve("api/jobs/search.js")).href;
const STATUS_API_URL = pathToFileURL(path.resolve("api/jobs/status.js")).href;
const TEST_TOKEN = "remote-rag-test-token";

const ENV_NAMES = [
  "JOB_RAG_BACKEND",
  "JOB_RAG_REMOTE_BASE_URL",
  "JOB_RAG_REMOTE_SEARCH_URL",
  "JOB_RAG_REMOTE_STATUS_URL",
  "JOB_RAG_REMOTE_TOKEN",
  "JOB_RAG_REMOTE_TIMEOUT_MS",
];
const previousEnv = Object.fromEntries(
  ENV_NAMES.map((name) => [name, process.env[name]]),
);

const restoreEnvironment = () => {
  ENV_NAMES.forEach((name) => {
    const value = previousEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  });
};

const availablePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

const waitForService = async (baseUrl, serviceProcess, stderrLines) => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serviceProcess.exitCode !== null) {
      throw new Error(
        `独立 RAG 服务提前退出：${stderrLines.slice(-8).join("\n")}`,
      );
    }
    try {
      const result = await fetchJson(`${baseUrl}/api/jobs/status`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      });
      if (result.status === 200 && result.payload.ready === true) return result;
    } catch {
      // 服务仍在预热。
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`等待独立 RAG 服务超时：${stderrLines.slice(-8).join("\n")}`);
};

const mockResponse = () => {
  const state = { headers: {}, status: 0, payload: null };
  return {
    state,
    setHeader(name, value) {
      state.headers[name.toLowerCase()] = value;
    },
    status(code) {
      state.status = code;
      return this;
    },
    json(payload) {
      state.payload = payload;
      return this;
    },
  };
};

const closeServer = (server) => new Promise((resolve) => server.close(resolve));

async function main() {
  if (!fs.existsSync(PYTHON_PATH)) {
    throw new Error(`RAG Python 环境不存在：${PYTHON_PATH}`);
  }

  const startedAt = Date.now();
  const servicePort = await availablePort();
  const baseUrl = `http://127.0.0.1:${servicePort}`;
  const stderrLines = [];
  const serviceProcess = spawn(PYTHON_PATH, ["-u", SERVICE_PATH], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(servicePort),
      JOB_RAG_SERVICE_HOST: "127.0.0.1",
      JOB_RAG_SERVICE_TOKEN: TEST_TOKEN,
      JOB_RAG_RERANK_ENABLED: "false",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
      TOKENIZERS_PARALLELISM: "false",
    },
  });
  serviceProcess.stderr.on("data", (chunk) => {
    stderrLines.push(...String(chunk).trim().split(/\r?\n/).filter(Boolean));
    if (stderrLines.length > 80) stderrLines.splice(0, stderrLines.length - 80);
  });

  let failureServer;
  try {
    const directStatus = await waitForService(baseUrl, serviceProcess, stderrLines);
    assert.equal(directStatus.payload.database.pointsCount, 1500);

    const health = await fetchJson(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(health.payload, { ok: true, ready: true });

    const unauthorized = await fetchJson(`${baseUrl}/api/jobs/status`);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.payload.code, "UNAUTHORIZED");

    process.env.JOB_RAG_BACKEND = "remote";
    process.env.JOB_RAG_REMOTE_BASE_URL = baseUrl;
    process.env.JOB_RAG_REMOTE_TOKEN = TEST_TOKEN;
    process.env.JOB_RAG_REMOTE_TIMEOUT_MS = "45000";
    delete process.env.JOB_RAG_REMOTE_SEARCH_URL;
    delete process.env.JOB_RAG_REMOTE_STATUS_URL;

    const { runJobKnowledgeSearch, runJobKnowledgeStatus } = await import(
      `${CORE_URL}?verify=${Date.now()}`
    );
    const status = await runJobKnowledgeStatus({
      allowLocal: false,
      allowRemote: true,
    });
    assert.equal(status.status, 200);
    assert.equal(status.payload.ready, true);
    assert.equal(status.payload.database.pointsCount, 1500);
    assert.equal("path" in status.payload.database, false);
    assert.equal(JSON.stringify(status.payload).includes("D:\\"), false);

    const search = await runJobKnowledgeSearch(
      {
        query: "  北京大模型算法实习生  ",
        queries: ["Python RAG AI Agent", "Python RAG AI Agent"],
        topK: 5,
        rerank: false,
        bypassCache: true,
        filters: { cities: ["北京"], studentOnly: true },
      },
      { allowLocal: false, allowRemote: true },
    );
    assert.equal(search.status, 200);
    assert.equal(search.payload.ok, true);
    assert.equal(search.payload.query, "北京大模型算法实习生");
    assert.equal(search.payload.results.length, 5);
    assert.equal(search.payload.retrievalDiagnostics.rerankerEnabled, false);
    assert.equal(search.payload.retrievalDiagnostics.cacheBypassed, true);
    assert.equal(search.payload.retrievalDiagnostics.rerankerSource, null);

    const { default: searchHandler } = await import(
      `${SEARCH_API_URL}?verify=${Date.now()}`
    );
    const searchResponse = mockResponse();
    await searchHandler(
      {
        method: "POST",
        body: { query: "上海前端实习", topK: 3, rerank: false },
      },
      searchResponse,
    );
    assert.equal(searchResponse.state.status, 200);
    assert.equal(searchResponse.state.payload.results.length, 3);
    assert.equal(searchResponse.state.headers["cache-control"], "no-store, private");

    const { default: statusHandler } = await import(
      `${STATUS_API_URL}?verify=${Date.now()}`
    );
    const statusResponse = mockResponse();
    await statusHandler({ method: "GET" }, statusResponse);
    assert.equal(statusResponse.state.status, 200);
    assert.equal(statusResponse.state.payload.ready, true);

    delete process.env.JOB_RAG_REMOTE_TOKEN;
    const missingGatewayToken = await runJobKnowledgeStatus({
      allowLocal: false,
      allowRemote: true,
    });
    assert.equal(missingGatewayToken.status, 503);
    assert.equal(
      missingGatewayToken.payload.error,
      "生产岗位知识库认证尚未配置。",
    );
    process.env.JOB_RAG_REMOTE_TOKEN = TEST_TOKEN;

    const failurePort = await availablePort();
    failureServer = http.createServer((request, response) => {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        ok: false,
        code: "DATABASE_INTERNAL",
        error: "sensitive-database-connection-detail",
      }));
    });
    await new Promise((resolve, reject) => {
      failureServer.once("error", reject);
      failureServer.listen(failurePort, "127.0.0.1", resolve);
    });
    process.env.JOB_RAG_REMOTE_BASE_URL = `http://127.0.0.1:${failurePort}`;
    const failed = await runJobKnowledgeSearch(
      { query: "测试远程错误" },
      { allowLocal: false, allowRemote: true },
    );
    assert.equal(failed.status, 503);
    assert.doesNotMatch(failed.payload.error, /sensitive-database/);

    process.env.JOB_RAG_REMOTE_BASE_URL = "http://example.com";
    const insecure = await runJobKnowledgeStatus({
      allowLocal: false,
      allowRemote: true,
    });
    assert.equal(insecure.status, 503);
    assert.equal(insecure.payload.error, "生产岗位知识库配置无效。");

    const report = {
      checked_at: new Date().toISOString(),
      passed: true,
      service_url: baseUrl,
      database_points: directStatus.payload.database.pointsCount,
      result_count: search.payload.results.length,
      diagnostics: search.payload.retrievalDiagnostics,
      checks: {
        privateServiceAuthentication: true,
        gatewayTokenRequired: true,
        minimalHealthEndpoint: true,
        remoteStatusGateway: true,
        remoteSearchGateway: true,
        requestNormalization: true,
        vercelHandlers: true,
        upstreamErrorSanitization: true,
        httpsEnforcement: true,
      },
      elapsed_ms: Date.now() - startedAt,
    };
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
    console.log(`[远程 RAG] 报告 ${REPORT_PATH}`);
  } finally {
    restoreEnvironment();
    if (failureServer?.listening) await closeServer(failureServer);
    if (serviceProcess.exitCode === null) serviceProcess.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
