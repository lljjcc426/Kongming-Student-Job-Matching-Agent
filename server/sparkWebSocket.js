import { createHmac } from "node:crypto";
import WebSocket from "ws";

export class SparkWebSocketError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "SparkWebSocketError";
    this.code = options.code;
    this.timeout = Boolean(options.timeout);
  }
}

export const buildSparkWebSocketAuthorizationUrl = (provider, now = new Date()) => {
  const target = new URL(provider.baseUrl);
  const date = now.toUTCString();
  const requestLine = `GET ${target.pathname} HTTP/1.1`;
  const signatureOrigin = `host: ${target.host}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac("sha256", provider.apiSecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = [
    `api_key="${provider.apiKey}"`,
    'algorithm="hmac-sha256"',
    'headers="host date request-line"',
    `signature="${signature}"`,
  ].join(", ");

  target.searchParams.set("authorization", Buffer.from(authorizationOrigin).toString("base64"));
  target.searchParams.set("date", date);
  target.searchParams.set("host", target.host);
  return target.toString();
};

export const buildSparkWebSocketRequest = (provider, completionPayload) => ({
  header: {
    app_id: provider.appId,
    uid: "kongming-job-matching-agent",
  },
  parameter: {
    chat: {
      domain: provider.model,
      temperature: completionPayload.temperature,
      max_tokens: completionPayload.max_tokens || completionPayload.max_completion_tokens,
    },
  },
  payload: {
    message: {
      text: completionPayload.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    },
  },
});

const messageText = (data) => {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return String(data);
};

export const runSparkWebSocketCompletion = (
  provider,
  completionPayload,
  createWebSocket = (url) => new WebSocket(url),
) => new Promise((resolve, reject) => {
  let socket;
  let settled = false;
  let content = "";

  const finish = (callback, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) socket.close();
    callback(value);
  };

  const timeout = setTimeout(() => {
    finish(reject, new SparkWebSocketError("讯飞星火响应超时。", { timeout: true }));
  }, provider.requestTimeoutMs);

  try {
    socket = createWebSocket(buildSparkWebSocketAuthorizationUrl(provider));
  } catch (error) {
    finish(reject, error);
    return;
  }

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify(buildSparkWebSocketRequest(provider, completionPayload)));
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(messageText(event.data));
    } catch {
      finish(reject, new SparkWebSocketError("讯飞星火返回了无法解析的响应。"));
      return;
    }

    const code = Number(message?.header?.code || 0);
    if (code !== 0) {
      finish(reject, new SparkWebSocketError("讯飞星火服务拒绝了本次调用。", { code }));
      return;
    }

    const chunks = Array.isArray(message?.payload?.choices?.text) ? message.payload.choices.text : [];
    content += chunks.map((chunk) => typeof chunk?.content === "string" ? chunk.content : "").join("");
    if (Number(message?.payload?.choices?.status) === 2) finish(resolve, { content });
  });

  socket.addEventListener("error", () => {
    finish(reject, new SparkWebSocketError("讯飞星火 WebSocket 连接失败。"));
  });

  socket.addEventListener("close", () => {
    if (!settled) finish(reject, new SparkWebSocketError("讯飞星火连接在响应完成前关闭。"));
  });
});
