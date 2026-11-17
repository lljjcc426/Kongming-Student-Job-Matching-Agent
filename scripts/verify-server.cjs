const assert = require("node:assert/strict");
const { once } = require("node:events");
const { mkdtemp, writeFile, mkdir, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), "kongming-http-"));
  process.env.AGENT_MEMORY_DB_PATH = path.join(root, "memory.sqlite3");
  const { createApp } = await import("../server/app.js");
  const { closeAgentMemoryStore } = await import("../server/agentMemoryCore.js");
  const dist = path.join(root, "dist");
  await mkdir(path.join(dist, "assets"), { recursive: true });
  await writeFile(path.join(dist, "index.html"), "<!doctype html><title>Kongming</title>");
  await writeFile(path.join(dist, "assets", "demo.mp4"), "0123456789");
  await writeFile(path.join(root, ".env"), "MODEL_API_KEY=private-test-value");
  const server = createApp({ distPath: dist }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.deepEqual(await health.json(), { ok: true });
    assert.match(health.headers.get("cache-control"), /no-store/);
    const route = await fetch(`${base}/interview`);
    assert.match(await route.text(), /<title>Kongming/);
    const range = await fetch(`${base}/assets/demo.mp4`, { headers: { Range: "bytes=2-5" } });
    assert.equal(range.status, 206);
    assert.equal(await range.text(), "2345");
    for (const routePath of ["/.env", "/server/modelProvider.js", "/assets/missing.js"]) {
      assert.equal((await fetch(`${base}${routePath}`)).status, 404, routePath);
    }
    assert.equal((await fetch(`${base}/api/ark`)).status, 401);
    const guest = await fetch(`${base}/api/memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login-demo" }) });
    await guest.json();
    const cookie = guest.headers.get("set-cookie").split(";")[0];
    assert.equal((await fetch(`${base}/api/ark`, { headers: { Cookie: cookie } })).status, 405);
    assert.equal((await fetch(`${base}/api/missing`, { headers: { Cookie: cookie } })).status, 404);
    const invalid = await fetch(`${base}/api/ark`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{invalid",
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { ok: false, error: "请求 JSON 格式不正确。" });
    const oversized = await fetch(`${base}/api/ark`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(8 * 1024 * 1024) }),
    });
    assert.equal(oversized.status, 413);
    const validation = await fetch(`${base}/api/ark`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ task: "invalid-task" }),
    });
    assert.equal(validation.status, 400);
    console.log("生产 HTTP 服务验证通过：API 路由、SPA 刷新、媒体分段、私有文件隔离、请求错误处理。");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    closeAgentMemoryStore();
    await rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
