const DEFAULT_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  ollama: "http://127.0.0.1:11434/v1",
};
const PROVIDERS = new Set(["openai", "anthropic", "openai-compatible", "ollama"]);

export async function runModelCompletion({ messages, vision, maxTokens }) {
  const env = process.env;
  // Existing installations keep their server-side settings until explicitly migrated.
  const legacy = !Object.keys(env).some((name) => name.startsWith("MODEL_"));
  const provider = legacy ? "openai-compatible" : env.MODEL_PROVIDER || "openai";
  const apiKey = legacy ? env.DEEPSEEK_API_KEY : env.MODEL_API_KEY;
  const baseUrl = (legacy ? env.DEEPSEEK_BASE_URL || "https://api.deepseek.com" : env.MODEL_BASE_URL || DEFAULT_BASE_URLS[provider] || "").replace(/\/+$/, "");
  const model = legacy
    ? vision ? env.DEEPSEEK_VISION_MODEL || "deepseek-flash" : env.DEEPSEEK_TEXT_MODEL || env.DEEPSEEK_MODEL || "deepseek-flash"
    : vision ? env.MODEL_VISION_MODEL : env.MODEL_TEXT_MODEL;
  const timeout = Number((legacy ? env.DEEPSEEK_REQUEST_TIMEOUT_MS : env.MODEL_REQUEST_TIMEOUT_MS) || 65000);
  const outputTokens = Number(env.MODEL_MAX_OUTPUT_TOKENS || maxTokens);

  let configurationError = "";
  if (!PROVIDERS.has(provider)) configurationError = "MODEL_PROVIDER 不受支持。";
  else if (!baseUrl) configurationError = "请配置 MODEL_BASE_URL。";
  else if (!model) configurationError = vision ? "请配置支持图片输入的 MODEL_VISION_MODEL，或启用 OCR。" : "请配置 MODEL_TEXT_MODEL。";
  else if (!apiKey && (legacy || provider === "openai" || provider === "anthropic")) configurationError = "模型服务尚未配置，请联系部署者。";
  else if (!Number.isSafeInteger(timeout) || timeout <= 0 || !Number.isSafeInteger(outputTokens) || outputTokens <= 0) configurationError = "模型超时与输出 token 上限必须为正整数。";
  if (configurationError) return { status: 503, payload: { ok: false, error: configurationError } };

  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  let requestBody;
  if (provider === "anthropic") {
    headers["anthropic-version"] = "2026-10-21";
    requestBody = {
      model,
      max_tokens: outputTokens,
      system: messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n"),
      messages: messages.filter((message) => message.role !== "system").map((message) => ({
        ...message,
        content: Array.isArray(message.content) ? message.content.map((part) => {
          if (part.type === "text") return part;
          const [metadata, data] = part.image_url.url.split(",");
          return { type: "image", source: { type: "base64", media_type: metadata.slice(5, -7), data } };
        }) : message.content,
      })),
    };
  } else {
    requestBody = { model, messages, [provider === "openai" ? "max_completion_tokens" : "max_tokens"]: outputTokens };
    if (new URL(baseUrl).hostname === "api.deepseek.com") {
      requestBody.thinking = { type: "disabled" };
      requestBody.temperature = 0.25;
    }
  }

  let response;
  try {
    response = await fetch(`${baseUrl}/${provider === "anthropic" ? "messages" : "chat/completions"}`, {
      method: "POST",
      signal: AbortSignal.timeout(timeout),
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    return {
      status: 504,
      payload: { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "模型接口响应超时，请稍后重试或调整服务端超时。" : "模型接口网络连接失败，请检查网络或服务配置。" },
    };
  }

  if (!response.ok) {
    console.warn("[model-proxy] upstream HTTP status:", response.status);
    return { status: response.status, payload: { ok: false, error: response.status === 429 ? "模型服务繁忙，请稍后重试。" : "模型服务暂不可用，请稍后重试。" } };
  }
  const data = await response.json().catch(() => ({}));
  const content = provider === "anthropic"
    ? (data.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n")
    : data.choices?.[0]?.message?.content;
  if (!content) return { status: 502, payload: { ok: false, error: "模型未返回文本，请检查模型能力与输出 token 上限。" } };
  return { status: 200, payload: { ok: true, model, content } };
}
