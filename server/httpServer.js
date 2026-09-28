import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { handlePublicGatewayRequest } from "./publicGateway.js";

const MAX_BODY_BYTES = 8_000_000;
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const readJsonBody = (request, maxBytes) => new Promise((accept, reject) => {
  let chunks = [];
  let size = 0;
  let rejected = false;
  const rejectBody = (error) => {
    rejected = true;
    chunks = [];
    reject(error);
  };
  if (Number(request.headers["content-length"]) > maxBytes) {
    request.resume();
    rejectBody(new RequestError(413, "请求内容过大。"));
    return;
  }
  request.on("data", (chunk) => {
    if (rejected) return;
    size += chunk.length;
    if (size > maxBytes) {
      rejectBody(new RequestError(413, "请求内容过大。"));
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    if (rejected) return;
    try {
      const text = Buffer.concat(chunks).toString("utf8");
      const body = text ? JSON.parse(text) : {};
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new Error("INVALID_JSON_OBJECT");
      }
      accept(body);
    } catch {
      rejectBody(new RequestError(400, "请求内容必须是有效 JSON 对象。"));
    }
  });
  request.on("error", () => rejectBody(new RequestError(400, "请求读取失败。")));
  request.on("aborted", () => rejectBody(new RequestError(400, "请求已取消。")));
});

const requestHeaders = (request, trustProxy) => {
  const headers = { ...request.headers };
  const localPeer = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress);
  for (const name of ["x-forwarded-for", "x-real-ip", "x-forwarded-host", "x-forwarded-proto"]) {
    delete headers[name];
  }
  if (trustProxy && localPeer) {
    if (request.headers["x-real-ip"]) headers["x-real-ip"] = request.headers["x-real-ip"];
    if (request.headers["x-forwarded-proto"]) headers["x-forwarded-proto"] = request.headers["x-forwarded-proto"];
  }
  return headers;
};

export const createGatewayServer = (options = {}) => {
  const handleRequest = options.handleRequest || handlePublicGatewayRequest;
  const maxBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BODY_BYTES) {
    throw new Error("Invalid gateway request size limit.");
  }
  const server = createServer(async (request, response) => {
    const send = (status, payload, headers = {}) => {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(status, { ...JSON_HEADERS, ...headers });
      response.end(payload === undefined ? undefined : JSON.stringify(payload));
    };
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname !== "/api/gateway") {
        request.resume();
        send(404, { ok: false, error: "请求的服务不存在。" });
        return;
      }
      const jsonRequest = /^application\/json(?:\s*;|$)/i.test(String(request.headers["content-type"] || ""));
      const body = request.method === "POST" && jsonRequest ? await readJsonBody(request, maxBytes) : {};
      if (request.method !== "POST" || !jsonRequest) request.resume();
      const result = await handleRequest({
        method: request.method,
        headers: requestHeaders(request, options.trustProxy === true),
        query: Object.fromEntries(url.searchParams.entries()),
        body,
        remoteAddress: request.socket.remoteAddress,
      });
      send(result.status, result.payload, result.headers);
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500;
      send(status, { ok: false, error: status === 500 ? "业务服务暂时不可用。" : error.message });
      if (status === 500) console.error("[gateway] request failed");
    }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.timeout = 75_000;
  server.keepAliveTimeout = 5_000;
  return server;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.GATEWAY_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("GATEWAY_PORT must be an integer between 1 and 65535.");
  }
  const server = createGatewayServer({ trustProxy: process.env.GATEWAY_TRUST_PROXY === "1" });
  server.on("error", () => {
    console.error("[gateway] unable to start");
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => console.log("Gateway listening on 127.0.0.1:" + port));
  const stop = () => {
    const timer = setTimeout(() => server.closeAllConnections(), 20_000);
    timer.unref();
    server.close(() => clearTimeout(timer));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
