const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ENV_NAMES = [
  "ARK_API_KEY",
  "ARK_BASE_URL",
  "ARK_PACKAGE",
  "ARK_FAILOVER_ENABLED",
  "ARK_MODEL",
  "ARK_TEXT_MODEL",
  "ARK_VISION_MODEL",
  "ARK_REQUEST_TIMEOUT_MS",
];

const previousEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
const originalFetch = global.fetch;
const originalWarn = console.warn;

const restoreEnvironment = () => {
  ENV_NAMES.forEach((name) => {
    const value = previousEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  });
  global.fetch = originalFetch;
  console.warn = originalWarn;
};

const successfulResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: "{}" } }] }),
});

async function main() {
  const arkCoreUrl = `${pathToFileURL(path.resolve("server/arkCore.js")).href}?verify=${Date.now()}`;
  const runtimeConfigUrl = `${pathToFileURL(path.resolve("server/runtimeConfig.js")).href}?verify=${Date.now()}`;
  const [{ runArkCompletion }, { readBoundedIntegerEnv }] = await Promise.all([
    import(arkCoreUrl),
    import(runtimeConfigUrl),
  ]);

  process.env.ARK_REQUEST_TIMEOUT_MS = "91000";
  assert.equal(readBoundedIntegerEnv("ARK_REQUEST_TIMEOUT_MS", 65_000), 91_000);
  process.env.ARK_REQUEST_TIMEOUT_MS = "9999999";
  assert.equal(readBoundedIntegerEnv("ARK_REQUEST_TIMEOUT_MS", 65_000), 300_000);
  process.env.ARK_REQUEST_TIMEOUT_MS = "invalid";
  assert.equal(readBoundedIntegerEnv("ARK_REQUEST_TIMEOUT_MS", 65_000), 65_000);

  process.env.ARK_API_KEY = "test-only-key";
  process.env.ARK_BASE_URL = "https://ai.gitee.com/v1";
  process.env.ARK_PACKAGE = "1492";
  process.env.ARK_FAILOVER_ENABLED = "true";
  process.env.ARK_MODEL = "Qwen3-4B";
  process.env.ARK_VISION_MODEL = "Qwen3-VL-8B-Instruct";

  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    return successfulResponse();
  };

  await runArkCompletion({ task: "resume-structure", resumeText: "test resume" });
  await runArkCompletion({ task: "resume-vision", imageDataUrl: "data:image/png;base64,AA==" });

  assert.equal(calls[0].url, "https://ai.gitee.com/v1/chat/completions");
  assert.equal(calls[0].headers["X-Package"], "1492");
  assert.equal(calls[0].headers["X-Failover-Enabled"], "true");
  assert.equal(calls[0].body.model, "Qwen3-4B");
  assert.equal(calls[1].body.model, "Qwen3-VL-8B-Instruct");
  assert.equal(typeof calls[0].body.max_tokens, "number");
  assert.equal("thinking" in calls[0].body, false);
  assert.equal("max_completion_tokens" in calls[0].body, false);

  process.env.ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
  process.env.ARK_MODEL = "ark-endpoint-id";
  calls.length = 0;
  await runArkCompletion({ task: "resume-structure", resumeText: "test resume" });
  assert.equal(calls[0].headers["X-Package"], undefined);
  assert.equal(calls[0].headers["X-Failover-Enabled"], undefined);
  assert.equal(calls[0].body.model, "ark-endpoint-id");
  assert.equal(typeof calls[0].body.max_completion_tokens, "number");
  assert.deepEqual(calls[0].body.thinking, { type: "disabled" });
  assert.equal("max_tokens" in calls[0].body, false);

  process.env.ARK_BASE_URL = "https://ai.gitee.com/v1";
  global.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({
      error: {
        code: "invalid auth!!",
        message: "sensitive-upstream-detail",
      },
    }),
  });
  console.warn = () => {};
  const failed = await runArkCompletion({ task: "resume-structure", resumeText: "test resume" });
  assert.equal(failed.status, 401);
  assert.match(failed.payload.error, /invalidauth/);
  assert.doesNotMatch(failed.payload.error, /sensitive-upstream-detail/);

  console.log(JSON.stringify({
    ok: true,
    checks: {
      boundedRuntimeTimeout: true,
      giteeHeadersAndPayload: true,
      providerSpecificHeaders: true,
      textAndVisionModelRouting: true,
      upstreamErrorSanitization: true,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(restoreEnvironment);
