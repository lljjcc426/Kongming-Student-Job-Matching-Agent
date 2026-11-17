const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Records the running frontend with isolated, explicitly labeled demo responses.
// Start Vite separately. This script never calls external model or job services.
const root = path.resolve(__dirname, "..");
const mediaDir = path.join(root, "docs/media");
const rawDir = path.join(root, "artifacts/showcase");
const demo = JSON.parse(fs.readFileSync(path.join(mediaDir, "demo-data.json"), "utf8"));
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
let browser;

async function main() {
  fs.mkdirSync(rawDir, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    channel: process.env.SHOWCASE_BROWSER_CHANNEL || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1440, height: 900 } },
  });
  await context.addInitScript(() => {
    // Keep the recording silent while preserving the interview UI lifecycle.
    window.speechSynthesis.speak = (utterance) => {
      queueMicrotask(() => utterance.dispatchEvent(new Event("end")));
    };
  });
  const recordingStart = Date.now();
  const page = await context.newPage();
  const video = page.video();

  await page.route("**/api/jobs/search", async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : {};
    await route.fulfill({
      json: {
        ok: true,
        ready: true,
        stale: false,
        query: body.query,
        queries: [body.query, ...(body.queries || [])],
        topK: body.topK,
        totalCandidates: demo.jobs.length,
        elapsedMs: 0,
        indexVersion: "showcase-demo",
        results: demo.jobs,
      },
    });
  });
  let interviewTurns = 0;
  await page.route("**/api/ark", async (route) => {
    const body = route.request().postDataJSON();
    let content;
    switch (body.task) {
      case "resume-structure":
        content = JSON.stringify(demo.resume);
        break;
      case "jd-analysis":
        content = JSON.stringify(demo.jd);
        break;
      case "career-chat":
        content = body.userMessage?.includes("面试官")
          ? ++interviewTurns === 1 ? "请介绍一次你参与用户调研的经历，说明你的职责、研究方法与最终产出。" : demo.interviewFollowup
          : demo.chat;
        break;
      case "match-analysis":
        content = "### 匹配说明\n\n心理学、访谈与数据分析经历可支撑用户研究方向。建议补充样本筛选过程、个人贡献，以及研究建议获得的实际反馈。此内容为固定演示回复。";
        break;
      default:
        throw new Error(`Unrecorded demo task: ${body.task}`);
    }
    await route.fulfill({ json: { ok: true, model: "showcase-demo", content } });
  });

  await page.goto(process.env.SHOWCASE_URL || "http://127.0.0.1:5173", { waitUntil: "networkidle" });
  await page.locator(".auth-page").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(rawDir, "login.png") });
  await page.getByRole("button", { name: /以访客身份体验/ }).click();
  await page.locator(".app-nav").waitFor();
  const trimStart = (Date.now() - recordingStart) / 1000;
  await page.evaluate(() => {
    const note = document.createElement("div");
    note.id = "showcase-note";
    note.textContent = "演示环境 · 虚构简历与岗位 · 固定接口响应";
    note.style.cssText = "position:fixed;right:28px;bottom:13px;z-index:99999;padding:7px 14px;border:1px solid #c9ddf5;border-radius:20px;background:rgba(246,250,255,.96);color:#385d8a;font:12px sans-serif;pointer-events:none";
    document.body.append(note);
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(rawDir, "home.png") });

  await page.locator(".app-nav > div button").filter({ hasText: "简历编辑" }).click();
  await page.waitForTimeout(1800);
  await page.getByLabel("上传原简历", { exact: true }).setInputFiles(path.join(mediaDir, "sample-resume.md"));
  await page.waitForFunction(() => document.querySelectorAll(".job-card").length >= 6);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(rawDir, "editor.png") });
  await page.waitForTimeout(3500);

  await page.locator(".app-nav > div button").filter({ hasText: "简历解析" }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(rawDir, "resume.png") });
  await page.waitForTimeout(5000);

  await page.locator(".app-nav > div button").filter({ hasText: "岗位推荐" }).click();
  await page.waitForTimeout(1800);
  await page.waitForTimeout(3500);
  await page.locator(".jd-lab input").fill("用户研究实习生");
  await page.locator(".jd-textarea").pressSequentially("参与用户访谈与问卷研究，使用 SPSS 进行数据分析，输出研究报告与产品改进建议。", { delay: 35 });
  await page.getByRole("button", { name: "分析该岗位", exact: true }).click();
  await page.locator(".custom-job-list article").waitFor();
  await page.screenshot({ path: path.join(rawDir, "jobs.png") });
  await page.waitForTimeout(3500);

  await page.locator(".app-nav > div button").filter({ hasText: "模拟面试" }).click();
  await page.getByLabel("模拟面试回答").waitFor();
  await page.getByRole("button", { name: "开始面试", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".interview-dialogue article.interviewer").length >= 2);
  await page.waitForTimeout(2500);
  await page.getByLabel("模拟面试回答").pressSequentially("我在校园调研项目中负责问卷设计与数据分析，回收了 286 份有效样本，并结合访谈整理出 3 项服务改进建议。", { delay: 35 });
  await page.getByLabel("模拟面试回答").press("Enter");
  await page.locator(".interview-dialogue").getByText(demo.interviewFollowup).last().waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(rawDir, "interview.png") });

  await page.locator(".app-nav > div button").filter({ hasText: "AI 助手" }).click();
  await page.getByLabel("AI 助手输入").waitFor();
  await page.getByLabel("AI 助手输入").pressSequentially("我应该怎样完善项目经历，准备用户研究实习？", { delay: 60 });
  await page.getByLabel("AI 助手输入").press("Enter");
  await page.getByText("以上为固定演示回复。", { exact: false }).waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(rawDir, "assistant.png") });
  await page.waitForTimeout(5000);

  console.log("页面录制完成，正在保存视频。");
  await page.close();
  await context.close();
  const rawVideo = await video.path();
  await browser.close();

  const encode = (args) => {
    const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`ffmpeg exited with ${result.status}`);
  };
  for (const name of ["home", "editor", "resume", "jobs", "interview", "assistant"]) {
    encode(["-i", path.join(rawDir, `${name}.png`), "-frames:v", "1", "-quality", "82", path.join(mediaDir, `${name}.webp`)]);
  }
  encode(["-ss", trimStart.toFixed(2), "-i", rawVideo, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "24", "-movflags", "+faststart", path.join(mediaDir, "kongming-demo.mp4")]);
  encode(["-i", path.join(mediaDir, "kongming-demo.mp4"), "-t", "16", "-filter_complex", "fps=6,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3", "-loop", "0", path.join(mediaDir, "demo-preview.gif")]);
  console.log(`Screenshots and demo saved to ${mediaDir}`);
}

main().catch(async (error) => {
  console.error(error);
  for (const context of browser?.contexts() || []) {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
  await browser?.close();
  process.exitCode = 1;
});
