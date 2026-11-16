const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const envNames = ["MODEL_PROVIDER", "MODEL_BASE_URL", "MODEL_API_KEY", "MODEL_TEXT_MODEL", "MODEL_VISION_MODEL", "MODEL_REQUEST_TIMEOUT_MS", "MODEL_MAX_OUTPUT_TOKENS", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL", "DEEPSEEK_TEXT_MODEL", "DEEPSEEK_VISION_MODEL", "DEEPSEEK_REQUEST_TIMEOUT_MS"];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const warnings = [];
  const requests = [];
  const testKey = "test-only-server-key";
  const image = "data:image/png;base64,dGVzdA==";
  const { runArkCompletion } = await import(pathToFileURL(path.resolve("server/arkCore.js")).href);
  const { default: handler } = await import(pathToFileURL(path.resolve("api/ark.js")).href);
  const configure = (values) => {
    envNames.forEach((name) => delete process.env[name]);
    Object.assign(process.env, values);
  };
  const complete = (body = {}) => runArkCompletion({ task: "resume-structure", resumeText: "测试简历", ...body });

  try {
    configure({});
    assert.equal((await complete()).status, 503);
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, headers: options.headers, body });
      return { ok: true, status: 200, json: async () => url.endsWith("/messages")
        ? { content: [{ type: "thinking", thinking: "hidden" }, { type: "text", text: "first" }, { type: "text", text: "second" }] }
        : { choices: [{ message: { content: "{}" } }] } };
    };

    // Existing server settings remain usable; client input cannot change credentials or destination.
    configure({ DEEPSEEK_API_KEY: testKey });
    assert.equal((await complete({ model: "untrusted", apiKey: "untrusted", baseUrl: "https://untrusted.example" })).status, 200);
    let request = requests.at(-1);
    assert.equal(request.url, "https://api.deepseek.com/chat/completions");
    assert.equal(request.headers.Authorization, `Bearer ${testKey}`);
    assert.equal(request.body.model, "deepseek-flash");
    assert.equal(request.body.thinking.type, "disabled");
    assert.equal(request.body.max_tokens, 2400);
    process.env.DEEPSEEK_TEXT_MODEL = "custom-text";
    await complete({ task: "resume-vision", imageDataUrls: [image, image] });
    assert.equal(requests.at(-1).body.model, "deepseek-flash");

    configure({ MODEL_PROVIDER: "openai", MODEL_API_KEY: testKey, MODEL_TEXT_MODEL: "gpt-4.1-mini", MODEL_VISION_MODEL: "gpt-4.1" });
    await complete();
    request = requests.at(-1);
    assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(request.body.max_completion_tokens, 2400);
    assert.equal(request.body.max_tokens, undefined);
    assert.equal(request.body.thinking, undefined);
    assert.equal(request.body.temperature, undefined);
    await complete({ task: "resume-vision", imageDataUrls: [image] });
    assert.equal(requests.at(-1).body.model, "gpt-4.1");
    assert.equal(requests.at(-1).body.messages[1].content[1].image_url.url, image);

    configure({ MODEL_PROVIDER: "anthropic", MODEL_API_KEY: testKey, MODEL_TEXT_MODEL: "claude-sonnet-4-6", MODEL_VISION_MODEL: "claude-sonnet-4-6" });
    const claude = await complete({ task: "resume-vision", imageDataUrls: [image, image] });
    request = requests.at(-1);
    assert.equal(request.url, "https://api.anthropic.com/v1/messages");
    assert.equal(request.headers.Authorization, `Bearer ${testKey}`);
    assert.equal(request.headers["anthropic-version"], "2026-10-21");
    assert.equal(request.body.messages.some((message) => message.role === "system"), false);
    assert.equal(typeof request.body.system, "string");
    assert.equal(request.body.messages[0].content.filter((part) => part.type === "image").length, 2);
    assert.deepEqual(request.body.messages[0].content[1].source, { type: "base64", media_type: "image/png", data: "dGVzdA==" });
    assert.equal(request.body.max_tokens, 2200);
    assert.equal(claude.payload.content, "first\nsecond");

    configure({ MODEL_PROVIDER: "ollama", MODEL_TEXT_MODEL: "qwen3-vl:8b", MODEL_VISION_MODEL: "qwen3-vl:8b" });
    await complete();
    request = requests.at(-1);
    assert.equal(request.url, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(request.headers.Authorization, undefined);
    assert.equal(request.body.model, "qwen3-vl:8b");
    assert.equal(request.body.thinking, undefined);

    configure({ MODEL_PROVIDER: "openai-compatible", MODEL_BASE_URL: "https://models.example/v1/", MODEL_TEXT_MODEL: "custom-text", MODEL_VISION_MODEL: "custom-vision", MODEL_MAX_OUTPUT_TOKENS: "8000", DEEPSEEK_API_KEY: testKey });
    await complete({ task: "resume-vision", imageDataUrls: [image] });
    request = requests.at(-1);
    assert.equal(request.url, "https://models.example/v1/chat/completions");
    assert.equal(request.headers.Authorization, undefined); // No legacy secret sent to a custom host.
    assert.equal(request.body.model, "custom-vision");
    assert.equal(request.body.max_tokens, 8000);
    assert.equal(request.body.thinking, undefined);
    process.env.MODEL_API_KEY = "custom-server-key";
    await complete();
    assert.equal(requests.at(-1).headers.Authorization, "Bearer custom-server-key");

    delete process.env.MODEL_VISION_MODEL;
    const count = requests.length;
    assert.equal((await complete({ task: "resume-vision", imageDataUrls: [image] })).status, 503);
    assert.equal((await complete({ task: "arbitrary-task" })).status, 400);
    assert.equal((await complete({ task: "resume-vision", imageDataUrls: ["data:image/png;not-base64"] })).status, 400);
    assert.equal(requests.length, count);

    console.warn = (...args) => warnings.push(args);
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: `Invalid key: ${testKey}` } }) });
    configure({ MODEL_PROVIDER: "openai", MODEL_API_KEY: testKey, MODEL_TEXT_MODEL: "gpt-4.1-mini" });
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

    console.log("Provider verification passed: OpenAI, Claude text/images, Ollama, custom endpoints, legacy configuration and credential isolation.");
  } finally {
    envNames.forEach((name) => previousEnv[name] === undefined ? delete process.env[name] : process.env[name] = previousEnv[name]);
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
