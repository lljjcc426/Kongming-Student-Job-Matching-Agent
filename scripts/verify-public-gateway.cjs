const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

const request = (overrides = {}) => ({
  method: "GET",
  headers: {},
  query: { operation: "status" },
  body: {},
  remoteAddress: "127.0.0.1",
  ...overrides,
});

async function main() {
  const gateway = await import("../server/publicGateway.js");
  const modelStatus = () => ({
    configured: true,
    provider: "internal-provider-id",
    providerLabel: "讯飞星火",
    model: "4.0Ultra",
    visionConfigured: false,
  });

  gateway.resetPublicGatewayRateLimitsForTests();
  const nativeStatus = await gateway.handlePublicGatewayRequest(request(), {
    getModelServiceStatus: modelStatus,
    env: {},
  });
  assert.equal(nativeStatus.status, 200);
  assert.equal(nativeStatus.payload.services.model.configured, true);
  assert.equal(JSON.stringify(nativeStatus.payload).includes("internal-provider-id"), false);
  assert.equal(JSON.stringify(nativeStatus.payload).includes("讯飞星火"), false);
  assert.equal(JSON.stringify(nativeStatus.payload).includes("4.0Ultra"), false);
  assert.equal("Access-Control-Allow-Origin" in nativeStatus.headers, false);

  const browserStatus = await gateway.handlePublicGatewayRequest(request({
    headers: { origin: "https://app.example.com", host: "app.example.com" },
  }), { getModelServiceStatus: modelStatus, env: {} });
  assert.equal(browserStatus.status, 200);
  assert.equal(browserStatus.headers["Access-Control-Allow-Origin"], "https://app.example.com");

  const blockedOrigin = await gateway.handlePublicGatewayRequest(request({
    headers: { origin: "https://evil.example", host: "app.example.com" },
  }), { getModelServiceStatus: modelStatus, env: {} });
  assert.equal(blockedOrigin.status, 403);
  assert.equal("Access-Control-Allow-Origin" in blockedOrigin.headers, false);

  const allowlistedOrigin = await gateway.handlePublicGatewayRequest(request({
    headers: { origin: "https://mobile.example", host: "api.example.com" },
  }), {
    getModelServiceStatus: modelStatus,
    env: { PUBLIC_APP_ORIGINS: "https://mobile.example" },
  });
  assert.equal(allowlistedOrigin.status, 200);
  assert.equal(allowlistedOrigin.headers["Access-Control-Allow-Origin"], "https://mobile.example");

  let forwardedJobInput;
  const jobs = await gateway.handlePublicGatewayRequest(request({
    query: { operation: "jobs", q: "前端", city: "深圳", market: "cn", limit: "20" },
    remoteAddress: "jobs-client",
  }), {
    collectPublicJobs: async (input) => {
      forwardedJobInput = input;
      return { ok: true, jobs: [], pagination: { total: 0, nextCursor: null } };
    },
    env: {},
  });
  assert.equal(jobs.status, 200);
  assert.equal(forwardedJobInput.query, "前端");
  assert.equal(forwardedJobInput.city, "深圳");
  assert.equal(forwardedJobInput.market, "cn");

  const modelSuccess = await gateway.handlePublicGatewayRequest(request({
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    query: { operation: "model" },
    body: { task: "career-chat", userMessage: "test" },
    remoteAddress: "model-success-client",
  }), {
    runArkCompletion: async () => ({
      status: 200,
      payload: {
        ok: true,
        provider: "internal-provider-id",
        providerLabel: "讯飞星火",
        model: "4.0Ultra",
        content: "下一道问题",
        upstreamUrl: "wss://secret-upstream.example",
      },
    }),
    env: {},
  });
  assert.deepEqual(modelSuccess.payload, {
    ok: true,
    content: "下一道问题",
  });

  const modelFailure = await gateway.handlePublicGatewayRequest(request({
    method: "POST",
    headers: { "content-type": "application/json" },
    query: { operation: "model" },
    remoteAddress: "model-failure-client",
  }), {
    runArkCompletion: async () => ({
      status: 503,
      payload: { ok: false, error: "IFLYTEK_SPARK_API_SECRET missing at wss://secret-upstream.example" },
    }),
    env: {},
  });
  assert.equal(modelFailure.status, 503);
  assert.equal(modelFailure.payload.error, "智能服务暂未就绪，请稍后重试。");

  const wrongMethod = await gateway.handlePublicGatewayRequest(request({
    method: "GET",
    query: { operation: "model" },
    remoteAddress: "wrong-method-client",
  }), { env: {} });
  assert.equal(wrongMethod.status, 405);

  const unsupportedContentType = await gateway.handlePublicGatewayRequest(request({
    method: "POST",
    headers: { "content-type": "text/plain" },
    query: { operation: "model" },
    remoteAddress: "content-type-client",
  }), { env: {} });
  assert.equal(unsupportedContentType.status, 415);

  gateway.resetPublicGatewayRateLimitsForTests();
  let rateLimited;
  for (let index = 0; index < 13; index += 1) {
    rateLimited = await gateway.handlePublicGatewayRequest(request({
      method: "POST",
      headers: { "content-type": "application/json" },
      query: { operation: "model" },
      remoteAddress: "rate-limit-client",
    }), {
      runArkCompletion: async () => ({ status: 200, payload: { ok: true, content: "ok" } }),
      env: {},
      now: () => 1000,
    });
  }
  assert.equal(rateLimited.status, 429);
  assert.equal(rateLimited.headers["Retry-After"], "60");

  for (const legacyRoute of ["ark.js", "jobs.js", "health.js", "job-sources.js"]) {
    assert.equal(fs.existsSync(path.join(repoRoot, "api", legacyRoute)), false, `${legacyRoute} must not be deployed`);
  }
  const frontendSources = [
    "src/arkClient.ts",
    "src/jobApi.ts",
    "src/gatewayClient.ts",
  ].map((file) => fs.readFileSync(path.join(repoRoot, file), "utf8")).join("\n");
  assert.doesNotMatch(frontendSources, /VITE_(?:ARK|JOBS|HEALTH)_API_URL/);
  assert.doesNotMatch(frontendSources, /\/api\/(?:ark|jobs|health|job-sources)/);
  assert.match(frontendSources, /\/api\/gateway/);

  console.log("public gateway security verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
