import { resolveModelConnection } from "./modelProvider.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initializeAgentMemoryStore, resolveAgentMemoryPath } from "./agentMemoryCore.js";

let inFlight = 0;
const startedAt = new Date().toISOString();
const knownTasks = new Set(["match-analysis", "resume-vision", "resume-structure", "job-recommendations", "jd-analysis", "career-chat", "auth-status", "login", "register", "login-demo", "logout", "recover-account", "load", "save", "clear", "save-feedback", "save-interview", "load-growth", "save-growth"]);

export function monitorApiRequest(request, response, next) {
  if (request.path === "/health" || request.path.startsWith("/admin")) return next();
  const route = ["/ark", "/ocr", "/memory", "/jobs/search", "/jobs/status"].includes(request.path) ? `/api${request.path}` : "/api/other";
  const start = performance.now();
  inFlight += 1;
  response.once("close", () => {
    inFlight -= 1;
    const rawTask = request.body?.task || request.body?.action;
    const usage = response.locals.modelUsage;
    try {
      initializeAgentMemoryStore().prepare(`
        INSERT INTO service_requests (occurred_at, route, method, task, status, duration_ms, user_id, provider, model, input_tokens, output_tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(new Date().toISOString(), route, request.method, knownTasks.has(rawTask) ? rawTask : "", response.writableFinished ? response.statusCode : 499,
        Math.round((performance.now() - start) * 10) / 10, response.locals.account?.userId || null,
        response.locals.modelProvider || null, response.locals.modelName || null, usage?.inputTokens ?? null, usage?.outputTokens ?? null);
    } catch {
      console.warn("[metrics] 无法保存请求指标");
    }
  });
  next();
}

export function appendAudit(actorId, action, targetId, detail = "") {
  initializeAgentMemoryStore().prepare("INSERT INTO admin_audit_events (occurred_at, actor_id, action, target_id, detail) VALUES (?, ?, ?, ?, ?)")
    .run(new Date().toISOString(), actorId, action, targetId, detail);
}

export function setAccountRole(nickname, role) {
  if (!["admin", "user"].includes(role)) throw new Error("角色只能为 admin 或 user。");
  const db = initializeAgentMemoryStore();
  const account = db.prepare("SELECT user_id AS userId, account_kind AS kind FROM agent_accounts WHERE nickname = ? COLLATE NOCASE").get(nickname);
  if (!account || account.kind !== "user") throw new Error("请先注册对应的正式账号，再进行授权。");
  db.prepare("UPDATE agent_accounts SET role = ?, updated_at = ? WHERE user_id = ?").run(role, new Date().toISOString(), account.userId);
  appendAudit(null, "account.role", account.userId, role);
}

export function listAccounts({ search = "", kind = "user", page = 1 } = {}) {
  const db = initializeAgentMemoryStore();
  const where = "WHERE (? = 'all' OR account_kind = ?) AND nickname LIKE ?";
  const args = [kind, kind, `%${search}%`];
  const total = db.prepare(`SELECT COUNT(*) AS count FROM agent_accounts ${where}`).get(...args).count;
  const rows = db.prepare(`SELECT user_id AS userId, CASE WHEN account_kind = 'demo' THEN '访客' ELSE nickname END AS nickname,
      role, status, account_kind AS accountKind, created_at AS createdAt, last_login_at AS lastLoginAt,
      (SELECT COUNT(*) FROM agent_sessions s WHERE s.user_id = agent_accounts.user_id AND s.expires_at > ?) AS activeSessions,
      (SELECT COUNT(*) FROM service_requests r WHERE r.user_id = agent_accounts.user_id AND r.route = '/api/ark') AS modelCalls
    FROM agent_accounts ${where} ORDER BY created_at DESC LIMIT 20 OFFSET ?`).all(new Date().toISOString(), ...args, (page - 1) * 20);
  return { rows, total, page, pageSize: 20 };
}

export function manageAccount(actor, userId, action) {
  const db = initializeAgentMemoryStore();
  const target = db.prepare("SELECT role FROM agent_accounts WHERE user_id = ?").get(userId);
  if (!target) return { status: 404, payload: { ok: false, error: "账号不存在。" } };
  if (target.role === "admin" || actor.userId === userId) return { status: 403, payload: { ok: false, error: "管理员账号仅通过服务器命令维护。" } };
  if (action === "revoke-sessions") db.prepare("DELETE FROM agent_sessions WHERE user_id = ?").run(userId);
  else {
    const status = action === "disable" ? "disabled" : "active";
    db.prepare("UPDATE agent_accounts SET status = ?, updated_at = ? WHERE user_id = ?").run(status, new Date().toISOString(), userId);
    if (status === "disabled") db.prepare("DELETE FROM agent_sessions WHERE user_id = ?").run(userId);
  }
  appendAudit(actor.userId, `account.${action}`, userId);
  return { status: 200, payload: { ok: true } };
}

export function requestHistory({ page = 1, failed = false } = {}) {
  const db = initializeAgentMemoryStore();
  const where = failed ? "WHERE status >= 400" : "";
  const total = db.prepare(`SELECT COUNT(*) AS count FROM service_requests ${where}`).get().count;
  const rows = db.prepare(`SELECT id, occurred_at AS occurredAt, route, method, task, status, duration_ms AS durationMs,
    provider, model, input_tokens AS inputTokens, output_tokens AS outputTokens FROM service_requests ${where} ORDER BY id DESC LIMIT 25 OFFSET ?`).all((page - 1) * 25);
  return { rows, total, page, pageSize: 25 };
}

export function auditHistory(page = 1) {
  const db = initializeAgentMemoryStore();
  const total = db.prepare("SELECT COUNT(*) AS count FROM admin_audit_events").get().count;
  const rows = db.prepare(`SELECT e.id, e.occurred_at AS occurredAt, e.action, e.detail,
    COALESCE(a.nickname, '服务器命令') AS actor, COALESCE(t.nickname, '已移除账号') AS target
    FROM admin_audit_events e LEFT JOIN agent_accounts a ON a.user_id = e.actor_id
    LEFT JOIN agent_accounts t ON t.user_id = e.target_id ORDER BY e.id DESC LIMIT 25 OFFSET ?`).all((page - 1) * 25);
  return { rows, total, page, pageSize: 25 };
}

export function operationsOverview(range = "24h") {
  const db = initializeAgentMemoryStore();
  const hours = range === "7d" ? 168 : 24;
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const totals = db.prepare(`SELECT COUNT(*) AS requests, COALESCE(SUM(status < 400), 0) AS successful,
    COALESCE(SUM(status >= 500), 0) AS serverErrors, COALESCE(SUM(status BETWEEN 400 AND 499), 0) AS clientErrors,
    COALESCE(SUM(route = '/api/ark'), 0) AS modelCalls,
    COALESCE(SUM(input_tokens), 0) AS inputTokens, COALESCE(SUM(output_tokens), 0) AS outputTokens,
    COUNT(input_tokens) AS meteredCalls, COALESCE(AVG(duration_ms), 0) AS averageMs
    FROM service_requests WHERE occurred_at >= ?`).get(since);
  const p95 = db.prepare("SELECT duration_ms AS value FROM service_requests WHERE occurred_at >= ? ORDER BY duration_ms LIMIT 1 OFFSET ?")
    .get(since, Math.max(0, Math.ceil(totals.requests * 0.95) - 1))?.value ?? 0;
  const bucket = range === "7d" ? "%Y-%m-%dT00:00:00Z" : "%Y-%m-%dT%H:00:00Z";
  const rows = db.prepare(`SELECT strftime(?, occurred_at) AS time, COUNT(*) AS requests, SUM(status >= 400) AS errors,
    COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens FROM service_requests WHERE occurred_at >= ? GROUP BY time ORDER BY time`).all(bucket, since);
  const step = range === "7d" ? 86_400_000 : 3_600_000;
  const end = Math.floor(Date.now() / step) * step;
  const first = Math.floor(new Date(since).getTime() / step) * step;
  const trend = Array.from({ length: Math.round((end - first) / step) + 1 }, (_, index) => {
    const time = new Date(first + index * step).toISOString().replace(".000Z", "Z");
    return rows.find((row) => row.time === time) || { time, requests: 0, errors: 0, tokens: 0 };
  });
  const endpoints = db.prepare(`SELECT route, COUNT(*) AS requests, SUM(status >= 400) AS errors,
    ROUND(AVG(duration_ms), 1) AS averageMs FROM service_requests WHERE occurred_at >= ? GROUP BY route ORDER BY requests DESC`).all(since);
  const accounts = db.prepare("SELECT COUNT(*) AS total, SUM(account_kind = 'user') AS registered, SUM(account_kind = 'demo') AS guests, SUM(role = 'admin') AS admins, SUM(status = 'disabled') AS disabled FROM agent_accounts").get();
  const storage = {};
  for (const [name, table] of Object.entries({ messages: "agent_memory_messages", interviews: "agent_interview_memories", growthPlans: "career_growth_plans", requests: "service_requests" })) {
    storage[name] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  }
  const dbPath = resolveAgentMemoryPath();
  const backupDir = process.env.AGENT_MEMORY_BACKUP_DIR || path.join(path.dirname(dbPath), "backups");
  const backups = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter((name) => /^agent-memory-\d{8}T\d{9}Z\.sqlite3$/.test(name))
    .map((name) => { const stat = fs.statSync(path.join(backupDir, name)); return { createdAt: stat.mtime.toISOString(), bytes: stat.size }; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const disk = fs.statfsSync(path.dirname(dbPath));
  const { provider, model, baseUrl, apiKey, legacy } = resolveModelConnection();
  const modelReady = Boolean(model && baseUrl && (apiKey || !legacy && ["ollama", "openai-compatible"].includes(provider)));
  const remoteJobs = Boolean(process.env.JOB_RAG_REMOTE_BASE_URL || process.env.JOB_RAG_REMOTE_SEARCH_URL);
  const jobsConfigured = process.env.JOB_RAG_BACKEND === "local" ? Boolean(process.env.JOB_RAG_DATA_PATH)
    : process.env.JOB_RAG_BACKEND === "remote" ? remoteJobs : Boolean(process.env.JOB_RAG_DATA_PATH || remoteJobs);
  return {
    observedAt: new Date().toISOString(), startedAt, range,
    summary: { ...totals, p95Ms: p95, inFlight, totalTokens: totals.inputTokens + totals.outputTokens }, trend, endpoints,
    accounts, storage,
    services: [
      { id: "application", name: "应用服务", state: "healthy", detail: `Node.js ${process.versions.node}` },
      { id: "database", name: "账号数据库", state: "healthy", detail: "SQLite · WAL" },
      { id: "model", name: "文本模型", state: modelReady ? "configured" : "missing", detail: [provider, model].filter(Boolean).join(" · ") },
      { id: "ocr", name: "文档 OCR", state: process.env.OCR_PROVIDER ? "configured" : "missing", detail: process.env.OCR_PROVIDER || "未配置" },
      { id: "jobs", name: "岗位知识库", state: jobsConfigured ? "configured" : "missing", detail: remoteJobs && process.env.JOB_RAG_BACKEND !== "local" ? "远程检索服务" : process.env.JOB_RAG_DATA_PATH ? "本地检索服务" : "未配置岗位数据与索引" },
    ],
    resources: { uptimeSeconds: Math.floor(process.uptime()), processMemoryBytes: process.memoryUsage().rss, systemMemoryBytes: os.totalmem(), systemFreeBytes: os.freemem(), loadAverage: os.loadavg()[0], cpuCount: os.availableParallelism(), databaseBytes: fs.statSync(dbPath).size, walBytes: fs.existsSync(`${dbPath}-wal`) ? fs.statSync(`${dbPath}-wal`).size : 0, diskFreeBytes: disk.bavail * disk.bsize, diskTotalBytes: disk.blocks * disk.bsize },
    backup: { count: backups.length, latest: backups[0] || null, retentionDays: 14 },
  };
}
