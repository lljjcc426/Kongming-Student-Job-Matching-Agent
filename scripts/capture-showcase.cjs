const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync, execFileSync } = require("node:child_process");
const { once } = require("node:events");

// Capture the current application with a temporary database and fixed model responses.
const root = path.resolve(__dirname, "..");
const mediaDir = path.join(root, "docs/media");
const rawDir = path.join(root, "artifacts/showcase");
const demo = JSON.parse(fs.readFileSync(path.join(mediaDir, "demo-data.json"), "utf8"));
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

async function main() {
  fs.mkdirSync(rawDir, { recursive: true });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kongming-showcase-"));
  const env = { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", AGENT_MEMORY_DB_PATH: path.join(directory, "memory.sqlite3"), JOB_RAG_DATA_PATH: "" };
  const server = spawn(process.execPath, ["server/index.js"], { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("演示服务启动超时")), 15000);
      server.stdout.on("data", chunk => {
        const match = String(chunk).match(/listening on (http:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      server.once("exit", code => { clearTimeout(timeout); reject(new Error(`演示服务退出：${code}`)); });
    });
    const password = "showcase-local-password";
    for (const nickname of ["演示管理员", "示例用户"]) {
      const response = await fetch(`${base}/api/memory`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", nickname, password }),
      });
      if (!response.ok) throw new Error("无法创建临时演示账号");
    }
    execFileSync(process.execPath, ["scripts/manage-account.mjs", "--nickname", "演示管理员", "--role", "admin"], { cwd: root, env, stdio: "pipe" });
    browser = await chromium.launch({ headless: true, channel: process.env.SHOWCASE_BROWSER_CHANNEL || undefined });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1,
      recordVideo: { dir: rawDir, size: { width: 1440, height: 960 } },
    });
    await context.addInitScript(() => {
      window.speechSynthesis.speak = utterance => queueMicrotask(() => utterance.dispatchEvent(new Event("end")));
      window.addEventListener("DOMContentLoaded", () => {
        const note = document.createElement("div");
        note.textContent = "演示环境 · 虚构数据 · 固定模型响应";
        note.style.cssText = "position:fixed;left:16px;bottom:12px;z-index:99999;padding:6px 12px;border:1px solid #c9ddf5;border-radius:18px;background:rgba(246,250,255,.96);color:#385d8a;font:11px sans-serif;pointer-events:none";
        document.body.append(note);
      });
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setVisibleSize", { width: 1440, height: 960 });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const video = page.video();
    const recordingStart = Date.now();
    await page.route("**/api/jobs/search", route => {
      const body = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true, ready: true, stale: false, query: body.query, queries: [body.query, ...(body.queries || [])], topK: body.topK, totalCandidates: demo.jobs.length, elapsedMs: 0, indexVersion: "showcase-demo", results: demo.jobs } });
    });
    let interviewTurns = 0;
    await page.route("**/api/ark", route => {
      const body = route.request().postDataJSON();
      let content;
      switch (body.task) {
        case "resume-structure": content = JSON.stringify(demo.resume); break;
        case "jd-analysis": content = JSON.stringify(demo.jd); break;
        case "career-chat":
          content = body.userMessage?.includes("面试官")
            ? ++interviewTurns === 1 ? "请介绍一次你参与用户调研的经历，说明你的职责、研究方法与最终产出。" : demo.interviewFollowup
            : demo.chat;
          break;
        case "match-analysis": content = "### 匹配说明\n\n心理学、访谈与数据分析经历可支撑用户研究方向。建议补充样本筛选过程、个人贡献，以及研究建议获得的实际反馈。此内容为固定演示回复。"; break;
        default: throw new Error(`Unrecorded demo task: ${body.task}`);
      }
      return route.fulfill({ json: { ok: true, model: "showcase-demo", content } });
    });
    const nav = label => page.locator(".app-nav > div button").filter({ hasText: label });
    const shot = async name => {
      await page.screenshot({ path: path.join(rawDir, `${name}.png`) });
      console.log(`已录制：${name}`);
    };
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator(".auth-page").waitFor();
    const trimStart = (Date.now() - recordingStart) / 1000;
    await page.waitForTimeout(2500);
    await shot("account");
    await page.getByRole("tab", { name: "注册", exact: true }).click();
    await page.waitForTimeout(1600);
    await page.getByRole("tab", { name: "登录", exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "访客体验", exact: true }).click();
    await page.locator(".app-nav").waitFor();
    await page.waitForTimeout(3000);
    await shot("home");
    await nav("简历编辑").click();
    await page.getByLabel("上传原简历", { exact: true }).setInputFiles(path.join(mediaDir, "sample-resume.md"));
    await page.getByText(/画像和 \d+ 个岗位推荐已更新/).waitFor();
    await page.locator('.workspace-save-state[data-status="saved"]').waitFor();
    await page.waitForTimeout(2000);
    await shot("editor");
    await nav("简历解析").click();
    await page.waitForTimeout(1800);
    await shot("resume");
    await page.waitForTimeout(2000);
    await nav("岗位推荐").click();
    await page.waitForTimeout(1200);
    await page.locator(".jd-lab input").fill("用户研究实习生");
    await page.locator(".jd-textarea").pressSequentially("参与用户访谈与问卷研究，使用 SPSS 进行数据分析，输出研究报告与产品改进建议。", { delay: 25 });
    await page.getByRole("button", { name: "分析该岗位", exact: true }).click();
    await page.getByText("意向岗位分析已完成", { exact: true }).first().waitFor();
    await page.waitForTimeout(1800);
    await shot("jobs");
    await nav("模拟面试").click();
    await page.getByRole("button", { name: "开始面试", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll(".interview-dialogue article.interviewer").length >= 2);
    await page.waitForTimeout(1500);
    await page.getByLabel("模拟面试回答").pressSequentially("我在校园调研项目中负责问卷设计与数据分析，回收了 286 份有效样本，并结合访谈整理出 3 项服务改进建议。", { delay: 25 });
    await page.getByLabel("模拟面试回答").press("Enter");
    await page.locator(".interview-dialogue").getByText(demo.interviewFollowup).last().waitFor();
    await page.waitForTimeout(1600);
    await shot("interview");
    await page.getByRole("button", { name: "结束面试", exact: true }).click();
    await page.getByRole("button", { name: "生成阶段性报告", exact: true }).click();
    await page.getByRole("button", { name: "基于短板生成成长计划", exact: true }).waitFor();
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "基于短板生成成长计划", exact: true }).click();
    await page.locator(".growth-plan-page").waitFor();
    await page.waitForTimeout(1800);
    await shot("growth");
    await nav("AI 助手").click();
    await page.getByLabel("AI 助手输入").pressSequentially("我应该怎样完善项目经历，准备用户研究实习？", { delay: 35 });
    await page.getByLabel("AI 助手输入").press("Enter");
    await page.getByText("以上为固定演示回复。", { exact: false }).waitFor();
    await page.waitForTimeout(1800);
    await shot("assistant");
    await page.locator(".workspace-save-state[data-status='saved']").waitFor();
    await page.reload();
    await nav("岗位推荐").click();
    await page.locator(".job-card.active").waitFor();
    await page.waitForTimeout(1800);
    await page.locator(".nav-identity").click();
    await page.getByRole("button", { name: "退出当前账号", exact: true }).click();
    await page.getByRole("heading", { name: "登录孔明职配", exact: true }).waitFor();
    await page.getByPlaceholder("请输入昵称").fill("演示管理员");
    await page.getByPlaceholder("请输入密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.locator(".console-stat-grid").waitFor();
    await page.waitForTimeout(1800);
    await shot("console");
    await page.getByRole("button", { name: "用户管理", exact: true }).click();
    await page.getByRole("cell", { name: "示例用户", exact: false }).waitFor();
    await page.waitForTimeout(1800);
    await shot("users");
    if (errors.length) throw new Error(errors.join("\n"));
    await page.close();
    await context.close();
    const rawVideo = await video.path();
    await browser.close();
    browser = null;
    const encode = args => {
      const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`ffmpeg exited with ${result.status}`);
    };
    for (const name of ["account", "home", "editor", "resume", "jobs", "interview", "growth", "assistant", "console", "users"]) {
      encode(["-i", path.join(rawDir, `${name}.png`), "-frames:v", "1", "-quality", "85", path.join(mediaDir, `${name}.webp`)]);
    }
    encode(["-ss", trimStart.toFixed(2), "-i", rawVideo, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-pix_fmt", "yuv420p", "-r", "24", "-movflags", "+faststart", path.join(mediaDir, "kongming-demo.mp4")]);
    encode(["-i", path.join(mediaDir, "kongming-demo.mp4"), "-t", "20", "-filter_complex", "fps=7,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3", "-loop", "0", path.join(mediaDir, "demo-preview.gif")]);
    console.log("已更新 10 张截图、GIF 预览和完整视频。");
  } finally {
    await browser?.close();
    if (server.exitCode === null) { const exited = once(server, "exit"); server.kill(); await exited; }
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
