const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const managedKeys = [
  "AI_MODEL_PROVIDER",
  "MODEL_REQUEST_TIMEOUT_MS",
  "IFLYTEK_SPARK_API_PASSWORD",
  "IFLYTEK_SPARK_APP_ID",
  "IFLYTEK_SPARK_API_KEY",
  "IFLYTEK_SPARK_API_SECRET",
  "IFLYTEK_SPARK_BASE_URL",
  "IFLYTEK_SPARK_WS_URL",
  "IFLYTEK_SPARK_MODEL",
  "IFLYTEK_SPARK_VISION_MODEL",
  "IFLYTEK_SPARK_REQUEST_TIMEOUT_MS",
  "ARK_API_KEY",
  "ARK_BASE_URL",
  "ARK_MODEL",
  "ARK_VISION_MODEL",
  "ARK_PACKAGE",
  "ARK_REQUEST_TIMEOUT_MS",
];

const originalEnvironment = new Map(managedKeys.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;

const replaceEnvironment = (values) => {
  for (const key of managedKeys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
};

const restoreEnvironment = () => {
  for (const key of managedKeys) {
    const value = originalEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

async function main() {
  const providerModule = await import(pathToFileURL(path.resolve(__dirname, "../server/modelProvider.js")));
  const sparkWebSocketModule = await import(pathToFileURL(path.resolve(__dirname, "../server/sparkWebSocket.js")));
  const arkModule = await import(pathToFileURL(path.resolve(__dirname, "../server/arkCore.js")));
  const sparkPassword = "spark-test-password";
  const sparkEnvironment = {
    AI_MODEL_PROVIDER: "iflytek-spark",
    IFLYTEK_SPARK_API_PASSWORD: sparkPassword,
    IFLYTEK_SPARK_BASE_URL: "https://spark-api-open.xf-yun.com/v1/",
    IFLYTEK_SPARK_MODEL: "4.0Ultra",
    IFLYTEK_SPARK_REQUEST_TIMEOUT_MS: "70000",
  };

  const provider = providerModule.resolveModelProvider("career-chat", sparkEnvironment);
  assert.equal(provider.id, "iflytek-spark");
  assert.equal(provider.transport, "openai-compatible");
  assert.equal(provider.model, "4.0Ultra");
  assert.equal(provider.requestTimeoutMs, 70000);
  assert.equal(
    providerModule.completionUrlForProvider(provider),
    "https://spark-api-open.xf-yun.com/v1/chat/completions",
  );
  assert.deepEqual(providerModule.getModelServiceStatus(sparkEnvironment), {
    configured: true,
    provider: "iflytek-spark",
    providerLabel: "讯飞星火",
    model: "4.0Ultra",
    visionConfigured: false,
  });

  replaceEnvironment(sparkEnvironment);
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "请继续说明你在项目中的个人决策和验证结果。" } }],
      }),
    };
  };

  const result = await arkModule.runArkCompletion({
    task: "career-chat",
    resumeText: "候选人参与了推荐系统项目。",
    userMessage: "请给出下一轮面试追问。",
    chatMessages: [],
  });
  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.provider, "iflytek-spark");
  assert.equal(result.payload.providerLabel, "讯飞星火");
  assert.equal(result.payload.model, "4.0Ultra");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://spark-api-open.xf-yun.com/v1/chat/completions");
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${sparkPassword}`);
  const requestBody = JSON.parse(requests[0].options.body);
  assert.equal(requestBody.model, "4.0Ultra");
  assert.equal(typeof requestBody.max_tokens, "number");
  assert.equal("thinking" in requestBody, false);
  assert.equal(JSON.stringify(result.payload).includes(sparkPassword), false);

  const requestCountBeforeVision = requests.length;
  const visionResult = await arkModule.runArkCompletion({
    task: "resume-vision",
    imageDataUrl: "data:image/png;base64,AA==",
  });
  assert.equal(visionResult.status, 503);
  assert.match(visionResult.payload.error, /未配置视觉模型/);
  assert.equal(requests.length, requestCountBeforeVision);

  const sparkWebSocketEnvironment = {
    AI_MODEL_PROVIDER: "iflytek-spark",
    IFLYTEK_SPARK_APP_ID: "spark-test-app",
    IFLYTEK_SPARK_API_KEY: "spark-test-key",
    IFLYTEK_SPARK_API_SECRET: "spark-test-secret",
    IFLYTEK_SPARK_MODEL: "4.0Ultra",
    IFLYTEK_SPARK_REQUEST_TIMEOUT_MS: "68000",
  };
  const webSocketProvider = providerModule.resolveModelProvider("career-chat", sparkWebSocketEnvironment);
  assert.equal(webSocketProvider.transport, "spark-websocket");
  assert.equal(webSocketProvider.baseUrl, "wss://spark-api.xf-yun.com/v4.0/chat");
  assert.equal(providerModule.modelProviderConfigurationError(webSocketProvider), "");
  assert.deepEqual(providerModule.getModelServiceStatus(sparkWebSocketEnvironment), {
    configured: true,
    provider: "iflytek-spark",
    providerLabel: "讯飞星火",
    model: "4.0Ultra",
    visionConfigured: false,
  });

  const authorizationUrl = new URL(sparkWebSocketModule.buildSparkWebSocketAuthorizationUrl(
    webSocketProvider,
    new Date("2019-07-10T07:35:43Z"),
  ));
  assert.equal(authorizationUrl.protocol, "wss:");
  assert.equal(authorizationUrl.searchParams.get("host"), "spark-api.xf-yun.com");
  assert.equal(authorizationUrl.searchParams.get("date"), "Wed, 10 Jul 2019 07:35:43 GMT");
  const authorization = Buffer.from(authorizationUrl.searchParams.get("authorization"), "base64").toString("utf8");
  assert.match(authorization, /api_key="spark-test-key"/);
  assert.equal(authorization.includes("spark-test-secret"), false);

  let streamedRequest;
  class FakeSparkWebSocket {
    constructor() {
      this.readyState = 0;
      this.listeners = new Map();
      queueMicrotask(() => {
        this.readyState = 1;
        this.emit("open", {});
      });
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    emit(type, event) {
      for (const listener of this.listeners.get(type) || []) listener(event);
    }

    send(payload) {
      streamedRequest = JSON.parse(payload);
      queueMicrotask(() => {
        this.emit("message", { data: JSON.stringify({
          header: { code: 0 },
          payload: { choices: { status: 1, text: [{ content: "请说明" }] } },
        }) });
        this.emit("message", { data: JSON.stringify({
          header: { code: 0 },
          payload: { choices: { status: 2, text: [{ content: "验证结果。" }] } },
        }) });
      });
    }

    close() {
      this.readyState = 3;
    }
  }

  const streamedResult = await sparkWebSocketModule.runSparkWebSocketCompletion(
    webSocketProvider,
    {
      model: "4.0Ultra",
      messages: [{ role: "user", content: "生成一道面试追问。" }],
      temperature: 0.25,
      max_tokens: 800,
    },
    () => new FakeSparkWebSocket(),
  );
  assert.equal(streamedResult.content, "请说明验证结果。");
  assert.equal(streamedRequest.header.app_id, "spark-test-app");
  assert.equal(streamedRequest.parameter.chat.domain, "4.0Ultra");
  assert.equal(streamedRequest.payload.message.text[0].content, "生成一道面试追问。");

  replaceEnvironment(sparkWebSocketEnvironment);
  const webSocketRequests = [];
  const webSocketResult = await arkModule.runArkCompletion({
    task: "career-chat",
    resumeText: "候选人参与了推荐系统项目。",
    userMessage: "请给出下一轮面试追问。",
    chatMessages: [],
  }, {
    sparkWebSocketCompletion: async (selectedProvider, payload) => {
      webSocketRequests.push({ selectedProvider, payload });
      return { content: "请说明你如何验证推荐效果。" };
    },
  });
  assert.equal(webSocketResult.status, 200);
  assert.equal(webSocketResult.payload.providerLabel, "讯飞星火");
  assert.equal(webSocketResult.payload.content, "请说明你如何验证推荐效果。");
  assert.equal(webSocketRequests.length, 1);
  assert.equal(webSocketRequests[0].selectedProvider.appId, "spark-test-app");
  assert.equal(webSocketRequests[0].payload.model, "4.0Ultra");

  const incompleteProvider = providerModule.resolveModelProvider("career-chat", {
    AI_MODEL_PROVIDER: "iflytek-spark",
    IFLYTEK_SPARK_APP_ID: "spark-test-app",
    IFLYTEK_SPARK_API_KEY: "spark-test-key",
  });
  assert.match(providerModule.modelProviderConfigurationError(incompleteProvider), /凭证不完整/);

  const legacyProvider = providerModule.resolveModelProvider("career-chat", {
    ARK_API_KEY: "legacy-key",
    ARK_BASE_URL: "https://ai.gitee.com/v1",
    ARK_MODEL: "Qwen3-4B",
    ARK_PACKAGE: "1492",
  });
  assert.equal(legacyProvider.id, "ark-compatible");
  assert.equal(legacyProvider.maxTokensField, "max_tokens");
  assert.equal(
    providerModule.buildModelProviderHeaders(legacyProvider, { ARK_PACKAGE: "1492" })["X-Package"],
    "1492",
  );

  console.log(JSON.stringify({
    ok: true,
    provider: result.payload.provider,
    model: result.payload.model,
    webSocketHmacConfigured: true,
    visionConfigured: false,
    secretLeaked: false,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    restoreEnvironment();
  });
