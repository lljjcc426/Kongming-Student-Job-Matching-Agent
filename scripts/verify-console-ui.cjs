const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("playwright");

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kongming-console-ui-"));
  const output = path.resolve("output/verification/console");
  await fs.mkdir(output, { recursive: true });
  const env = { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", AGENT_MEMORY_DB_PATH: path.join(directory, "memory.sqlite3"), JOB_RAG_DATA_PATH: "" };
  const child = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("控制台测试服务启动超时")), 15_000);
      child.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/listening on (http:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`控制台测试服务退出：${code}`)); });
    });
    const register = async (nickname) => {
      const response = await fetch(`${base}/api/memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", nickname, password: "console-ui-test-password" }) });
      assert.equal(response.status, 200);
      await response.json();
    };
    await register("演示管理员");
    await register("示例用户");
    execFileSync(process.execPath, ["scripts/manage-account.mjs", "--nickname", "演示管理员", "--role", "admin"], { env, stdio: "pipe" });
    browser = await chromium.launch({ channel: process.env.CONSOLE_BROWSER_CHANNEL || "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.getByRole("heading", { name: "登录孔明职配" }).waitFor();
    assert.equal(await page.locator(".loading-screen").count(), 0);
    await page.screenshot({ path: path.join(output, "login.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "login-mobile.png") });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const login = async (nickname) => {
      await page.locator('input[autocomplete="username"]').fill(nickname);
      await page.locator('input[type="password"]').fill("console-ui-test-password");
      await page.getByRole("button", { name: "登录", exact: true }).click();
    };
    await login("示例用户");
    await page.waitForURL("**/app");
    assert.equal(await page.locator(".nav-console").count(), 0);
    await page.goto(`${base}/console`);
    await page.getByRole("heading", { name: "当前账号没有控制台权限" }).waitFor();
    assert.equal((await page.request.get(`${base}/api/admin/overview`)).status(), 403);
    await page.request.post(`${base}/api/memory`, { data: { action: "logout" } });
    await page.goto(base);
    await login("演示管理员");
    await page.waitForURL("**/console");
    await page.locator(".console-stat-grid").waitFor();
    await page.evaluate(() => {
      const label = document.createElement("div");
      label.textContent = "演示环境 · 临时账号与数据库";
      label.style.cssText = "position:fixed;right:18px;bottom:12px;z-index:9999;background:#eff7f2;color:#326751;border:1px solid #c7dfd0;border-radius:6px;padding:8px 12px;font:12px sans-serif";
      document.body.append(label);
    });
    await page.screenshot({ path: path.join(output, "overview.png"), fullPage: true });
    await page.getByRole("button", { name: "用户管理", exact: true }).click();
    await page.getByRole("cell", { name: "示例用户", exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "停用", exact: true }).count(), 1);
    await page.screenshot({ path: path.join(output, "users.png") });
    await page.getByRole("button", { name: "调用记录", exact: true }).click();
    await page.getByRole("heading", { name: "接口调用记录" }).waitFor();
    await page.getByRole("button", { name: "操作审计", exact: true }).click();
    await page.getByRole("cell", { name: "授予管理员" }).waitFor();
    await page.getByRole("button", { name: "运行概览", exact: true }).click();
    await page.locator(".console-stat-grid").waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole("button", { name: "打开产品工作区" }).waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(output, "console-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "打开产品工作区" }).click();
    await page.waitForURL("**/app");
    await page.locator(".nav-console").click();
    await page.waitForURL("**/console");
    await page.getByRole("button", { name: "退出控制台" }).click();
    await page.getByRole("heading", { name: "登录孔明职配" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("控制台界面验证通过：直接登录、普通账号拒绝访问、管理员分流、四个工作页、桌面与移动布局、产品切换及退出。");
  } finally {
    await browser?.close();
    if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
