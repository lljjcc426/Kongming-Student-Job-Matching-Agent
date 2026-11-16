const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const envNames = ["DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL", "DEEPSEEK_TEXT_MODEL", "DEEPSEEK_VISION_MODEL"];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const requests = [];
  const warnings = [];
  const testKey = "test-only-deepseek-key";
  const { runArkCompletion } = await import(pathToFileURL(path.resolve("server/arkCore.js")).href);
  const { default: handler } = await import(pathToFileURL(path.resolve("api/ark.js")).href);

  try {
    envNames.forEach((name) => delete process.env[name]);
    assert.equal((await runArkCompletion({ task: "career-chat" })).status, 503);
    process.env.DEEPSEEK_API_KEY = testKey;
    global.fetch = async (url, options) => {
      requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) };
    };

    const text = await runArkCompletion({ task: "resume-structure", resumeText: "测试简历", model: "untrusted-model", apiKey: "untrusted-key", baseUrl: "https://untrusted.example" });
    assert.equal(text.status, 200);
    assert.equal(requests[0].url, "https://api.deepseek.com/chat/completions");
    assert.equal(requests[0].headers.Authorization, `Bearer ${testKey}`);
    assert.equal(requests[0].body.model, "deepseek-flash");
    assert.equal(requests[0].body.max_tokens, 2400);
    assert.equal(requests[0].body.thinking.type, "disabled");
    assert.equal(requests[0].body.max_completion_tokens, undefined);
    assert.equal(JSON.stringify(requests[0].body).includes(testKey), false);

    process.env.DEEPSEEK_TEXT_MODEL = "deepseek-v4-pro";
    await runArkCompletion({ task: "career-chat", userMessage: "面试如何准备？" });
    assert.equal(requests[1].body.model, "deepseek-v4-pro");

    const image = "data:image/png;base64,dGVzdA==";
    await runArkCompletion({ task: "resume-vision", imageDataUrls: [image, image] });
    assert.equal(requests[2].body.model, "deepseek-flash");
    const parts = requests[2].body.messages.flatMap((message) => Array.isArray(message.content) ? message.content : []);
    assert.equal(parts.filter((part) => part.type === "image_url").length, 2);
    assert.equal(parts.find((part) => part.type === "image_url").image_url.url, image);
    assert.equal(parts.find((part) => part.type === "image_url").image_url.image_pixel_limit, undefined);

    process.env.DEEPSEEK_BASE_URL = "http://127.0.0.1:11434/v1/";
    process.env.DEEPSEEK_TEXT_MODEL = "local-model";
    await runArkCompletion({ task: "career-chat", userMessage: "测试兼容接口" });
    assert.equal(requests[3].url, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(requests[3].body.model, "local-model");

    const count = requests.length;
    assert.equal((await runArkCompletion({ task: "arbitrary-task" })).status, 400);
    assert.equal(requests.length, count);

    console.warn = (...args) => warnings.push(args);
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: `Invalid key: ${testKey}`, code: testKey } }) });
    const headers = {};
    let payload;
    const response = {
      setHeader: (name, value) => { headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { payload = value; },
    };
    await handler({ method: "POST", body: { task: "career-chat", userMessage: "测试" } }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(headers["Cache-Control"], "no-store, private");
    assert.equal(JSON.stringify({ payload, headers, warnings }).includes(testKey), false);
    assert.equal(payload.ok, false);

    console.log("Provider verification passed: server-only credentials, text/vision routing, compatible endpoint, request limits and error redaction.");
  } finally {
    envNames.forEach((name) => previousEnv[name] === undefined ? delete process.env[name] : process.env[name] = previousEnv[name]);
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
