const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kongming-accounts-"));
  const dbPath = path.join(directory, "memory.sqlite3");
  const env = { ...process.env, HOST: "127.0.0.1", PORT: "0", NODE_ENV: "production", JOB_RAG_DATA_PATH: "", AGENT_MEMORY_DB_PATH: dbPath, AGENT_MEMORY_BACKUP_DIR: path.join(directory, "backups") };
  let child;
  let base;
  const start = async () => {
    child = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
    base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("账号测试服务未启动。")), 15_000);
      child.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/listening on (http:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`测试服务提前退出：${code}`)); });
    });
  };
  const stop = async () => {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    child = undefined;
  };
  const request = async (body, cookie = "") => {
    const response = await fetch(`${base}/api/memory`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
  };
  try {
    await start();
    assert.equal((await request({ action: "load" })).status, 401);
    const guestA = await request({ action: "login-demo" });
    const guestB = await request({ action: "login-demo" });
    assert.equal(guestA.status, 200);
    assert.equal(guestB.status, 200);
    const idA = guestA.body.identity.userId;
    const idB = guestB.body.identity.userId;
    assert.notEqual(idA, idB);
    assert.match(guestA.cookie, /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/);
    const cookieA = guestA.cookie.split(";")[0];
    const cookieB = guestB.cookie.split(";")[0];
    assert.equal((await request({ action: "login-demo" }, cookieA)).body.identity.userId, idA);
    const saved = await request({ action: "save", userId: idA, messages: [{ id: "private-message", role: "user", content: "隔离测试：此记录仅属于访客 A。" }], context: { targetJob: { title: "算法实习生" } } }, cookieA);
    assert.equal(saved.status, 200);
    const interview = { interviewId: "private-interview", jobId: "test-job", jobTitle: "算法实习生", interviewType: "技术面", report: { modelTrack: "ai_algorithm", overallScore: 60, confidenceScore: 50, coverageScore: 40, summary: "仅用于账号隔离验证。", dimensionReports: [] } };
    assert.equal((await request({ action: "save-interview", userId: idA, interview }, cookieA)).status, 200);
    const plan = { id: "private-plan", version: 1, targetJobTitle: "算法实习生", gaps: [], stages: [], tasks: [{ id: "practice", completed: false }] };
    assert.equal((await request({ action: "save-growth", userId: idA, plan }, cookieA)).status, 200);
    const emptyB = await request({ action: "load", userId: idB }, cookieB);
    assert.deepEqual(emptyB.body.memory.messages, []);
    assert.deepEqual(emptyB.body.memory.interviews, []);
    assert.equal((await request({ action: "load-growth" }, cookieB)).body.plan, null);
    for (const action of ["load", "save", "clear", "save-interview", "load-growth", "save-growth"]) {
      assert.equal((await request({ action, userId: idA }, cookieB)).status, 403);
    }
    assert.equal((await request({ action: "auth-status", userId: idA })).body.identity.userId, "");
    assert.equal((await request({ action: "login", nickname: "demo", password: "123456" })).status, 401);
    assert.equal((await request({ action: "clear", userId: idB }, cookieB)).status, 200);
    await stop();
    await start();
    const restored = await request({ action: "load", userId: idA }, cookieA);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.memory.messages[0].id, "private-message");
    assert.equal(restored.body.memory.interviews[0].id, "private-interview");
    assert.equal((await request({ action: "load-growth" }, cookieA)).body.plan.id, plan.id);

    execFileSync(process.execPath, ["scripts/backup-memory.mjs"], { env, stdio: "pipe" });
    const [snapshot] = await fs.readdir(env.AGENT_MEMORY_BACKUP_DIR);
    assert.ok(snapshot);
    await stop();
    env.AGENT_MEMORY_DB_PATH = path.join(directory, "restored.sqlite3");
    await fs.copyFile(path.join(env.AGENT_MEMORY_BACKUP_DIR, snapshot), env.AGENT_MEMORY_DB_PATH);
    await start();
    const fromBackup = await request({ action: "load", userId: idA }, cookieA);
    assert.equal(fromBackup.body.memory.messages[0].id, "private-message");
    assert.equal(fromBackup.body.memory.interviews.length, 1);
    assert.equal((await request({ action: "load-growth" }, cookieA)).body.plan.id, plan.id);
    await request({ action: "logout" }, cookieB);
    assert.equal((await request({ action: "load" }, cookieA)).status, 200);
    assert.equal((await request({ action: "load" }, cookieB)).status, 401);
    console.log("账号 HTTP 验证通过：独立访客、越权拒绝、旧请求隔离、重启持久化、在线备份及恢复。");
  } finally {
    if (child) await stop();
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
