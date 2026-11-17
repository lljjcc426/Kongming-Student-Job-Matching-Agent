import express from "express";
import { auditHistory, listAccounts, manageAccount, operationsOverview, requestHistory } from "./operationsCore.js";

export function createAdminRouter() {
  const router = express.Router();
  router.use((request, response, next) => {
    if (request.account.role !== "admin") return response.status(403).json({ ok: false, error: "当前账号没有控制台访问权限。" });
    next();
  });
  router.get("/overview", (request, response) => {
    const range = request.query.range || "24h";
    if (!["24h", "7d"].includes(range)) return response.status(400).json({ ok: false, error: "统计范围不正确。" });
    response.json({ ok: true, data: operationsOverview(range) });
  });
  router.use((request, response, next) => {
    const page = Number(request.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 100_000) return response.status(400).json({ ok: false, error: "页码不正确。" });
    request.page = page;
    next();
  });
  router.get("/users", (request, response) => {
    const kind = request.query.kind || "user";
    if (!["user", "demo", "all"].includes(kind) || typeof (request.query.search || "") !== "string") return response.status(400).json({ ok: false, error: "筛选条件不正确。" });
    response.json({ ok: true, data: listAccounts({ search: String(request.query.search || "").trim().slice(0, 60), kind, page: request.page }) });
  });
  router.post("/users/:userId/actions", (request, response) => {
    if (!["disable", "enable", "revoke-sessions"].includes(request.body?.action)) return response.status(400).json({ ok: false, error: "不支持的账号操作。" });
    const result = manageAccount(request.account, request.params.userId, request.body.action);
    response.status(result.status).json(result.payload);
  });
  router.get("/requests", (request, response) => response.json({ ok: true, data: requestHistory({ page: request.page, failed: request.query.failed === "true" }) }));
  router.get("/audit", (request, response) => response.json({ ok: true, data: auditHistory(request.page) }));
  return router;
}
