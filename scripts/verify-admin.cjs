const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { once } = require("node:events");
const { execFileSync } = require("node:child_process");

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kongming-admin-"));
  process.env.AGENT_MEMORY_DB_PATH = path.join(directory, "memory.sqlite3");
  process.env.AGENT_MEMORY_BACKUP_DIR = path.join(directory, "backups");
  const { DatabaseSync } = require("node:sqlite");
  const { migrateAdminConsole } = await import("../server/migrations/001-admin-console.js");
  const legacy = new DatabaseSync(path.join(directory, "legacy.sqlite3"));
  legacy.exec("CREATE TABLE agent_accounts (user_id TEXT PRIMARY KEY, nickname TEXT); INSERT INTO agent_accounts VALUES ('existing', '原有账号');");
  migrateAdminConsole(legacy);
  migrateAdminConsole(legacy);
  assert.deepEqual({ ...legacy.prepare("SELECT nickname, role, status FROM agent_accounts").get() }, { nickname: "原有账号", role: "user", status: "active" });
  legacy.close();

  const upstream = http.createServer((request, response) => {
    request.resume();
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ choices: [{ message: { content: "测试模型响应" } }], usage: { prompt_tokens: 120, completion_tokens: 36 } }));
  }).listen(0, "127.0.0.1");
  await once(upstream, "listening");
  Object.assign(process.env, { MODEL_PROVIDER: "openai-compatible", MODEL_TEXT_MODEL: "test-model", MODEL_BASE_URL: `http://127.0.0.1:${upstream.address().port}/v1`, MODEL_API_KEY: "admin-test-server-secret" });
  const { createApp } = await import("../server/app.js");
  const { closeAgentMemoryStore, initializeAgentMemoryStore } = await import("../server/agentMemoryCore.js");
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, body, cookie) => {
    const response = await fetch(`${base}/api${route}`, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    const account = await request("/memory", { action: "register", nickname: "管理测试", password: "account-admin-test", role: "admin" });
    const user = await request("/memory", { action: "register", nickname: "普通测试", password: "account-user-test" });
    const guest = await request("/memory", { action: "login-demo" });
    assert.equal(account.body.identity.role, "user", "注册不能指定管理员");
    assert.equal((await request("/admin/overview")).status, 401);
    for (const cookie of [account.cookie, user.cookie, guest.cookie]) assert.equal((await request("/admin/overview", null, cookie)).status, 403);
    execFileSync(process.execPath, ["scripts/manage-account.mjs", "--nickname", "管理测试", "--role", "admin"], { env: process.env, stdio: "pipe" });
    assert.equal((await request("/memory", { action: "auth-status" }, account.cookie)).body.identity.role, "admin");
    assert.equal((await request("/ark", { task: "career-chat", userMessage: "private-resume-content" }, user.cookie)).status, 200);
    for (const file of ["ark", "ocr", "jobs/search", "jobs/status"]) {
      const { default: handler } = await import(`../api/${file}.js`);
      const response = { setHeader() {}, end(value) { this.payload = JSON.parse(value); } };
      await handler({ method: file === "jobs/status" ? "GET" : "POST", headers: {} }, response);
      assert.equal(response.statusCode, 401, `${file} 入口也需要有效会话`);
    }
    const overview = await request("/admin/overview", null, account.cookie);
    assert.equal(overview.status, 200);
    assert.equal(overview.body.data.summary.totalTokens, 156);
    assert.equal(overview.body.data.summary.meteredCalls, 1);
    const history = await request("/admin/requests", null, account.cookie);
    assert.equal(history.body.data.rows.find((row) => row.route === "/api/ark").inputTokens, 120);
    assert.equal(JSON.stringify({ overview: overview.body, history: history.body }).includes("private-resume-content"), false);
    assert.equal(JSON.stringify(overview.body).includes(process.env.MODEL_API_KEY), false);
    const users = await request("/admin/users", null, account.cookie);
    assert.equal(users.body.data.total, 2);
    assert.equal(JSON.stringify(users.body).includes("password"), false);
    const action = (id, name) => request(`/admin/users/${id}/actions`, { action: name }, account.cookie);
    assert.equal((await action(user.body.identity.userId, "admin")).status, 400);
    assert.equal((await action(account.body.identity.userId, "disable")).status, 403);
    assert.equal((await action(user.body.identity.userId, "disable")).status, 200);
    assert.equal((await request("/ark", { task: "career-chat", userMessage: "blocked" }, user.cookie)).status, 401);
    assert.equal((await request("/memory", { action: "login", nickname: "普通测试", password: "account-user-test" })).status, 403);
    assert.equal((await action(user.body.identity.userId, "enable")).status, 200);
    const newLogin = await request("/memory", { action: "login", nickname: "普通测试", password: "account-user-test" });
    assert.equal(newLogin.status, 200);
    assert.equal((await action(user.body.identity.userId, "revoke-sessions")).status, 200);
    assert.equal((await request("/memory", { action: "load" }, newLogin.cookie)).status, 401);
    const audit = await request("/admin/audit", null, account.cookie);
    assert.equal(audit.body.data.total, 4);
    const db = initializeAgentMemoryStore();
    db.prepare("INSERT INTO service_requests (occurred_at, route, method, status, duration_ms) VALUES (?, '/api/ark', 'POST', 200, 1)").run("2020-01-01T00:00:00Z");
    execFileSync(process.execPath, ["scripts/backup-memory.mjs"], { env: process.env, stdio: "pipe" });
    const [file] = await fs.readdir(process.env.AGENT_MEMORY_BACKUP_DIR);
    const snapshot = new DatabaseSync(path.join(process.env.AGENT_MEMORY_BACKUP_DIR, file), { readOnly: true });
    assert.equal(snapshot.prepare("SELECT role FROM agent_accounts WHERE nickname = '管理测试'").get().role, "admin");
    assert.equal(snapshot.prepare("SELECT COUNT(*) AS count FROM service_requests WHERE occurred_at < '2021'").get().count, 0);
    assert.equal(snapshot.prepare("SELECT COUNT(*) AS count FROM admin_audit_events").get().count, 4);
    snapshot.close();
    console.log("管理员验证通过：旧库迁移、角色授权、接口隔离、模型用量、停用与会话撤销、审计及备份保留策略。");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
    closeAgentMemoryStore();
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
