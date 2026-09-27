const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_ARK_MODEL = "doubao-seed-2-0-lite-260215";
const DEFAULT_SPARK_BASE_URL = "https://spark-api-open.xf-yun.com/v1";
const DEFAULT_SPARK_MODEL = "4.0Ultra";
const DEFAULT_REQUEST_TIMEOUT_MS = 65000;

const clean = (value) => typeof value === "string" ? value.trim() : "";

const boundedTimeout = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.max(10000, Math.min(120000, Math.round(parsed)));
};

const requestedProvider = (env) => clean(env.AI_MODEL_PROVIDER).toLowerCase();

export const sparkWebSocketUrlForModel = (model) => {
  const normalized = clean(model).toLowerCase();
  if (normalized === "max-32k") return "wss://spark-api.xf-yun.com/chat/max-32k";
  if (normalized === "pro-128k") return "wss://spark-api.xf-yun.com/chat/pro-128k";
  if (["generalv3.5", "max"].includes(normalized)) return "wss://spark-api.xf-yun.com/v3.5/chat";
  if (["generalv3", "pro"].includes(normalized)) return "wss://spark-api.xf-yun.com/v3.1/chat";
  if (normalized === "lite") return "wss://spark-api.xf-yun.com/v1.1/chat";
  return "wss://spark-api.xf-yun.com/v4.0/chat";
};

const providerId = (env) => {
  const requested = requestedProvider(env);
  if (["iflytek", "iflytek-spark", "spark", "xfyun"].includes(requested)) return "iflytek-spark";
  if (["ark", "doubao", "gitee", "openai-compatible"].includes(requested)) return "ark-compatible";
  if (requested) return "unsupported";
  if (clean(env.IFLYTEK_SPARK_API_PASSWORD)
    || clean(env.IFLYTEK_SPARK_APP_ID)
    || clean(env.IFLYTEK_SPARK_API_KEY)
    || clean(env.IFLYTEK_SPARK_API_SECRET)) return "iflytek-spark";
  return "ark-compatible";
};

export const resolveModelProvider = (task, env = process.env) => {
  const id = providerId(env);
  if (id === "unsupported") {
    return {
      id,
      label: "未识别模型服务",
      apiKey: "",
      baseUrl: "",
      model: "",
      requestTimeoutMs: boundedTimeout(env.MODEL_REQUEST_TIMEOUT_MS),
      maxTokensField: "max_tokens",
      disableThinking: false,
      taskConfigured: false,
      configurationError: `不支持的 AI_MODEL_PROVIDER：${clean(env.AI_MODEL_PROVIDER)}。`,
    };
  }

  if (id === "iflytek-spark") {
    const visionTask = task === "resume-vision";
    const visionModel = clean(env.IFLYTEK_SPARK_VISION_MODEL);
    const textModel = clean(env.IFLYTEK_SPARK_MODEL) || DEFAULT_SPARK_MODEL;
    const apiPassword = clean(env.IFLYTEK_SPARK_API_PASSWORD);
    const appId = clean(env.IFLYTEK_SPARK_APP_ID);
    const apiKey = clean(env.IFLYTEK_SPARK_API_KEY);
    const apiSecret = clean(env.IFLYTEK_SPARK_API_SECRET);
    const hasWebSocketCredentials = Boolean(appId && apiKey && apiSecret);
    const hasPartialWebSocketCredentials = Boolean(appId || apiKey || apiSecret) && !hasWebSocketCredentials;
    const transport = apiPassword ? "openai-compatible" : "spark-websocket";
    return {
      id,
      label: "讯飞星火",
      transport,
      apiKey: apiPassword || apiKey,
      apiSecret,
      appId,
      credentialsConfigured: Boolean(apiPassword || hasWebSocketCredentials),
      baseUrl: transport === "spark-websocket"
        ? clean(env.IFLYTEK_SPARK_WS_URL) || sparkWebSocketUrlForModel(textModel)
        : clean(env.IFLYTEK_SPARK_BASE_URL) || DEFAULT_SPARK_BASE_URL,
      model: visionTask ? visionModel : textModel,
      requestTimeoutMs: boundedTimeout(
        env.IFLYTEK_SPARK_REQUEST_TIMEOUT_MS || env.MODEL_REQUEST_TIMEOUT_MS || env.ARK_REQUEST_TIMEOUT_MS,
      ),
      maxTokensField: "max_tokens",
      disableThinking: false,
      taskConfigured: !visionTask || (transport === "openai-compatible" && Boolean(visionModel)),
      configurationError: hasPartialWebSocketCredentials
        ? "讯飞星火 WebSocket 凭证不完整，请同时配置 APPID、APIKey 和 APISecret。"
        : "",
    };
  }

  const baseUrl = clean(env.ARK_BASE_URL) || DEFAULT_ARK_BASE_URL;
  const giteeCompatible = /ai\.gitee\.com/i.test(baseUrl);
  return {
    id,
    label: giteeCompatible ? "Gitee AI" : "方舟兼容模型",
    apiKey: clean(env.ARK_API_KEY),
    baseUrl,
    model: task === "resume-vision" && clean(env.ARK_VISION_MODEL)
      ? clean(env.ARK_VISION_MODEL)
      : clean(env.ARK_MODEL) || DEFAULT_ARK_MODEL,
    requestTimeoutMs: boundedTimeout(env.MODEL_REQUEST_TIMEOUT_MS || env.ARK_REQUEST_TIMEOUT_MS),
    maxTokensField: giteeCompatible ? "max_tokens" : "max_completion_tokens",
    disableThinking: !giteeCompatible,
    taskConfigured: true,
    configurationError: "",
  };
};

export const completionUrlForProvider = (provider) => {
  const baseUrl = clean(provider.baseUrl).replace(/\/$/, "");
  return /\/chat\/completions$/i.test(baseUrl) ? baseUrl : `${baseUrl}/chat/completions`;
};

export const buildModelProviderHeaders = (provider, env = process.env) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.id === "ark-compatible" && clean(env.ARK_PACKAGE)) {
    headers["X-Package"] = clean(env.ARK_PACKAGE);
  }
  if (provider.id === "ark-compatible" && clean(env.ARK_FAILOVER_ENABLED)) {
    headers["X-Failover-Enabled"] = clean(env.ARK_FAILOVER_ENABLED);
  }
  return headers;
};

export const modelProviderConfigurationError = (provider) => {
  if (provider.configurationError) return provider.configurationError;
  if (!provider.credentialsConfigured && !provider.apiKey) {
    return provider.id === "iflytek-spark"
      ? "当前运行环境未配置讯飞星火 APIPassword，或完整的 APPID/APIKey/APISecret，模型能力不可用。"
      : "当前运行环境未配置 ARK_API_KEY，模型能力不可用。";
  }
  if (!provider.taskConfigured) {
    return "当前讯飞星火接入未配置视觉模型，图片简历将继续使用本机 OCR 或文字导入。";
  }
  if (!provider.model) {
    return provider.id === "iflytek-spark"
      ? "当前运行环境未配置 IFLYTEK_SPARK_MODEL。"
      : "当前运行环境未配置模型名称。";
  }
  return "";
};

export const getModelServiceStatus = (env = process.env) => {
  const textProvider = resolveModelProvider("career-chat", env);
  const visionProvider = resolveModelProvider("resume-vision", env);
  return {
    configured: !modelProviderConfigurationError(textProvider),
    provider: textProvider.id,
    providerLabel: textProvider.label,
    model: textProvider.model,
    visionConfigured: !modelProviderConfigurationError(visionProvider),
  };
};
