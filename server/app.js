import express from "express";
import { authorizeRequest } from "./requestAuth.js";
import { createAdminRouter } from "./adminHttp.js";
import { monitorApiRequest } from "./operationsCore.js";
import handleMemoryRequest from "./memoryHttp.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveModelConnection } from "./modelProvider.js";
import { runArkCompletion } from "./arkCore.js";
import { runOcrRequest } from "./ocrCore.js";
import { runJobKnowledgeSearch, runJobKnowledgeStatus } from "./jobKnowledgeCore.js";

const DIST_PATH = fileURLToPath(new URL("../dist/", import.meta.url));

export function createApp({ distPath = DIST_PATH } = {}) {
  const app = express();
  const allowLocalJobs = Boolean(process.env.JOB_RAG_DATA_PATH);
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.set("X-Content-Type-Options", "nosniff");
    response.set("Referrer-Policy", "no-referrer");
    next();
  });

  const api = express.Router();
  api.use((_request, response, next) => {
    response.set("Cache-Control", "no-store, private");
    response.set("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  api.use(monitorApiRequest);
  api.all("/memory", express.json({ limit: "2mb" }), handleMemoryRequest);
  api.use(express.json({ limit: "8mb" }));
  api.get("/health", (_request, response) => response.json({ ok: true }));
  api.use((request, response, next) => {
    const account = authorizeRequest(request, response);
    if (!account) return;
    request.account = account;
    response.locals.account = account;
    next();
  });
  api.use("/admin", createAdminRouter());
  api.post("/ark", async (request, response) => {
    const connection = resolveModelConnection(request.body?.task === "resume-vision");
    response.locals.modelName = connection.model;
    response.locals.modelProvider = connection.provider;
    const result = await runArkCompletion(request.body || {});
    response.locals.modelUsage = result.payload.usage;
    response.status(result.status).json(result.payload);
  });
  api.post("/ocr", async (request, response) => {
    const result = await runOcrRequest(request.body || {}, { allowLocal: true });
    response.status(result.status).json(result.payload);
  });
  api.get(["/jobs/search", "/jobs/status"], async (_request, response) => {
    const result = await runJobKnowledgeStatus({ allowLocal: allowLocalJobs });
    response.status(result.status).json(result.payload);
  });
  api.post("/jobs/search", async (request, response) => {
    const result = await runJobKnowledgeSearch(request.body || {}, { allowLocal: allowLocalJobs });
    response.status(result.status).json(result.payload);
  });
  api.all(["/ark", "/ocr", "/jobs/search", "/jobs/status", "/health"], (_request, response) => {
    response.status(405).json({ ok: false, error: "请求方法不支持。" });
  });
  api.use((_request, response) => response.status(404).json({ ok: false, error: "接口不存在。" }));
  app.use("/api", api);

  app.use("/assets", express.static(path.join(distPath, "assets"), { maxAge: "1y", immutable: true }));
  app.use(express.static(distPath, {
    setHeaders(response, filePath) {
      if (filePath.endsWith(".html")) response.set("Cache-Control", "no-cache");
    },
  }));
  app.get("/{*path}", (request, response) => {
    if (path.extname(request.path) || request.path.split("/").some((part) => part.startsWith("."))) {
      response.sendStatus(404);
      return;
    }
    response.set("Cache-Control", "no-cache");
    response.sendFile(path.join(distPath, "index.html"));
  });
  app.use((error, _request, response, _next) => {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    const message = status === 413 ? "请求内容过大。" : status === 400 ? "请求 JSON 格式不正确。" : "服务暂时不可用。";
    if (status === 500) console.error("[http] 请求处理失败");
    response.status(status).json({ ok: false, error: message });
  });
  return app;
}
