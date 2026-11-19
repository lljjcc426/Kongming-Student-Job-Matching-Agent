const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("playwright");

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kongming-workspace-"));
  const child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", AGENT_MEMORY_DB_PATH: path.join(directory, "memory.sqlite3"), JOB_RAG_DATA_PATH: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("工作区测试服务启动超时")), 15_000);
      child.stdout.on("data", chunk => {
        const match = String(chunk).match(/listening on (http:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once("exit", code => { clearTimeout(timeout); reject(new Error(`测试服务退出：${code}`)); });
    });
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const contextB = await browser.newContext();
    const register = async (context, nickname) => {
      const response = await context.request.post(`${base}/api/memory`, { data: { action: "register", nickname, password: "workspace-test-password" } });
      assert.equal(response.status(), 200);
      return (await response.json()).identity.userId;
    };
    const idA = await register(contextA, "工作区测试甲");
    const idB = await register(contextB, "工作区测试乙");
    const request = (context, action, extra = {}) => context.request.post(`${base}/api/memory`, { data: { action, ...extra } });
    const job = (id, title) => ({ id, title, track: "数据分析", city: "上海", level: "实习", companyScenario: "测试岗位", summary: "使用 Python 分析数据", responsibilities: ["数据分析"], requirements: ["掌握 Python"], bonus: [], keywords: ["Python"], priority: "中" });
    const snapshot = {
      version: 1,
      resume: {
        text: "姓名：工作区测试甲\n计算机本科\n项目：Python 分析 200 份问卷",
        originalText: "原始 PDF 文本：工作区测试甲，计算机本科，Python 问卷分析项目。",
        structured: { basicInfo: ["姓名：工作区测试甲", "求职意向：数据分析实习生"], name: "工作区测试甲", education: ["计算机科学本科"], projects: ["Python 分析 200 份问卷"], competitions: ["数据竞赛"], certificates: ["计算机二级"], languages: ["英语六级"], socialAccounts: [], internships: [], campus: [], honors: ["数据竞赛"], skills: ["Python"], targetRoles: ["数据分析实习生"], summary: "数据分析项目经历" },
        modelJobs: [job("recommended-test", "推荐数据分析实习生")], insight: "保留的增强分析", source: "PDF 文本提取",
        original: { kind: "pdf", name: "原简历.pdf", url: "blob:temporary-preview" },
      },
      jobs: { customTitle: "自定义数据岗位", customJdText: "使用 Python 进行业务数据分析", customJobs: [job("custom-test", "自定义数据岗位")], selectedJobId: "custom-test" },
      loading: true,
    };
    assert.equal((await request(contextA, "save-workspace", { userId: idA, workspace: snapshot })).status(), 200);
    let storedA = (await (await request(contextA, "load-workspace")).json()).workspace;
    assert.equal(storedA.resume.original.url, undefined);
    assert.equal(storedA.loading, undefined);
    assert.equal((await (await request(contextB, "load-workspace")).json()).workspace, null);
    assert.equal((await request(contextB, "load-workspace", { userId: idA })).status(), 403);
    assert.equal((await request(contextB, "save-workspace", { userId: idA, workspace: snapshot })).status(), 403);
    assert.equal((await request(contextB, "save-workspace", { workspace: { ...snapshot, resume: { ...snapshot.resume, text: "a".repeat(1_000_001) } } })).status(), 413);

    const page = await contextA.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    let modelCalls = 0;
    let workspaceSaves = 0;
    let clearRequests = 0;
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", incoming => {
      if (incoming.url().endsWith("/api/ark")) modelCalls += 1;
      if (incoming.url().endsWith("/api/memory") && incoming.postDataJSON()?.action === "save-workspace") workspaceSaves += 1;
      if (incoming.url().endsWith("/api/memory") && incoming.postDataJSON()?.action === "clear") clearRequests += 1;
    });
    await page.route("**/api/ark", route => route.fulfill({ status: 500, json: { ok: false, error: "恢复工作区不应调用模型" } }));
    const nav = label => page.locator(".app-nav > div button").filter({ hasText: label });
    await page.goto(base);
    await nav("简历编辑").click();
    const fields = page.locator(".resume-structured-form textarea");
    assert.match(await fields.nth(0).inputValue(), /工作区测试甲/);
    assert.match(await fields.nth(2).inputValue(), /200 份问卷/);
    await page.getByText("已恢复简历文字；查看原文件预览需重新上传。", { exact: true }).waitFor();
    assert.equal(await page.locator(".resume-original-image, .resume-pdf-preview").count(), 0);
    await nav("岗位推荐").click();
    assert.equal(await page.getByLabel("目标岗位 JD").inputValue(), snapshot.jobs.customJdText);
    assert.match(await page.locator(".job-card.active").innerText(), /自定义数据岗位/);
    assert.equal(workspaceSaves, 0, "恢复时不应用首次空状态覆盖历史");
    await page.reload();
    await nav("岗位推荐").click();
    assert.equal(await page.locator(".job-card").count(), 2);
    assert.match(await page.locator(".job-card.active").innerText(), /自定义数据岗位/);
    assert.equal(modelCalls, 0);

    let failNextSave = true;
    let holdNextSave = false;
    let releaseSave;
    let heldSave;
    await page.route("**/api/memory", async route => {
      if (route.request().postDataJSON()?.action === "save-workspace") {
        if (failNextSave) { failNextSave = false; await route.fulfill({ status: 503, json: { ok: false, error: "测试保存失败" } }); return; }
        if (holdNextSave) { holdNextSave = false; heldSave(); await new Promise(resolve => { releaseSave = resolve; }); }
      }
      await route.continue();
    });
    await page.getByLabel("目标岗位 JD").fill("修改后的 JD 草稿：Python 与 SQL");
    await page.locator('.workspace-save-state[data-status="error"]').waitFor();
    await page.getByRole("button", { name: "重试保存", exact: true }).click();
    await page.locator('.workspace-save-state[data-status="saved"]').waitFor();
    await page.reload();
    await nav("岗位推荐").click();
    assert.equal(await page.getByLabel("目标岗位 JD").inputValue(), "修改后的 JD 草稿：Python 与 SQL");
    assert.equal(modelCalls, 0);

    const pageB = await contextB.newPage();
    const exitActions = [];
    pageB.on("request", incoming => {
      if (incoming.url().endsWith("/api/memory")) exitActions.push(incoming.postDataJSON()?.action);
    });
    await pageB.goto(base);
    await pageB.locator(".app-nav > div button").filter({ hasText: "简历编辑" }).click();
    assert.equal(await pageB.locator(".resume-structured-form textarea").first().inputValue(), "");
    await pageB.locator(".resume-structured-form textarea").first().fill("姓名：工作区测试乙");
    await pageB.locator(".nav-identity").click();
    await pageB.getByRole("button", { name: "退出当前账号", exact: true }).click();
    await pageB.getByRole("heading", { name: "登录孔明职配" }).waitFor();
    assert.ok(exitActions.indexOf("save-workspace") >= 0 && exitActions.indexOf("save-workspace") < exitActions.indexOf("logout"));
    assert.equal((await request(contextB, "login", { nickname: "工作区测试乙", password: "workspace-test-password" })).status(), 200);
    storedA = (await (await request(contextA, "load-workspace")).json()).workspace;
    assert.equal(storedA.resume.structured.name, "工作区测试甲");

    await nav("简历编辑").click();
    const pendingSave = new Promise(resolve => { heldSave = resolve; });
    holdNextSave = true;
    await fields.nth(2).fill("最后修改：Python 分析 500 份问卷");
    await pendingSave;
    await nav("AI 助手").click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "清除长期记忆", exact: true }).click();
    assert.equal(clearRequests, 0, "清除需等待正在保存的请求完成");
    const cleared = page.waitForResponse(response => response.url().endsWith("/api/memory") && response.request().postDataJSON()?.action === "clear");
    releaseSave();
    assert.equal((await cleared).status(), 200);
    await page.locator(".assistant-memory-state.ready").waitFor();
    assert.equal((await (await request(contextA, "load-workspace")).json()).workspace, null);
    await page.reload();
    await nav("简历编辑").click();
    assert.equal(await fields.nth(0).inputValue(), "");
    assert.equal((await (await request(contextA, "load-workspace")).json()).workspace, null);
    assert.equal((await (await request(contextB, "load-workspace")).json()).workspace.resume.structured.name, "工作区测试乙");
    assert.equal(modelCalls, 0);
    await nav("AI 助手").click();
    let releaseReply;
    let replyStarted;
    const pendingReply = new Promise(resolve => { replyStarted = resolve; });
    await page.route("**/api/ark", async route => {
      replyStarted();
      await new Promise(resolve => { releaseReply = resolve; });
      await route.fulfill({ status: 200, json: { ok: true, content: "测试回复：补充项目中可验证的个人贡献。" } });
    });
    await page.getByLabel("AI 助手输入").fill("怎样说明项目里的个人贡献？");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await pendingReply;
    assert.equal(await page.getByRole("button", { name: "清除长期记忆", exact: true }).isEnabled(), false, "模型回复期间不能清除后被旧回复写回");
    releaseReply();
    await page.getByText("测试回复：补充项目中可验证的个人贡献。", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "清除长期记忆", exact: true }).isEnabled(), true);
    assert.deepEqual(errors, []);
    console.log("工作区验证通过：简历/推荐/JD/选择跨刷新恢复、按账号隔离、恢复零模型调用、PDF 转文字提示、保存失败重试、退出前保存、保存与清除顺序、清除后不恢复旧快照。");
  } finally {
    await browser?.close();
    if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
