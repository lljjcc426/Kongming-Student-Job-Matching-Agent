const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("playwright");
const JSZip = require("jszip");

async function docxFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>姓名：DOCX测试人</w:t></w:r></w:p><w:p><w:r><w:t>教育经历：计算机科学本科，熟悉 Python 与数据分析。</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格项目：整理 300 份问卷并形成数据分析报告。</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>');
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kongming-resume-editor-"));
  const child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", AGENT_MEMORY_DB_PATH: path.join(directory, "memory.sqlite3"), JOB_RAG_DATA_PATH: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("简历测试服务启动超时")), 15_000);
      child.stdout.on("data", chunk => {
        const match = String(chunk).match(/listening on (http:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once("exit", code => { clearTimeout(timeout); reject(new Error(`测试服务退出：${code}`)); });
    });
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10_000);
    const errors = [];
    const modelRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/jobs/search", route => route.fulfill({ status: 503, json: { ok: false, error: "测试模型推荐回退路径" } }));
    await page.route("**/api/ark", async route => {
      const body = route.request().postDataJSON();
      modelRequests.push(body);
      const content = body.task === "resume-structure" ? {
        name: "DOCX测试人", education: ["计算机科学本科"], projects: ["表格项目：整理 300 份问卷并形成数据分析报告。"],
        skills: ["Python", "数据分析"], targetRoles: ["数据分析实习生"], summary: "具备数据分析项目经历。",
      } : [{
        id: "test-analyst", title: "数据分析实习生", track: "数据分析", city: "不限", level: "实习", companyScenario: "验证岗位方向",
        summary: "使用 Python 整理问卷与业务数据", responsibilities: ["数据清洗与分析"], requirements: ["掌握 Python"], keywords: ["Python", "数据分析"],
      }];
      await route.fulfill({ json: { ok: true, model: "test", content: JSON.stringify(content) } });
    });
    await page.goto(base);
    await page.getByRole("button", { name: "访客体验", exact: true }).click();
    await page.waitForURL("**/app");
    await page.locator(".app-nav > div button").filter({ hasText: "简历编辑" }).click();
    const fields = page.locator(".resume-structured-form textarea");
    await fields.nth(0).fill("姓名：手填测试人\n求职意向：数据分析实习生\n个人简介：熟悉 Python 的学生");
    await fields.nth(1).fill("计算机科学本科，统计学与数据库课程");
    await fields.nth(2).fill("使用 Python 分析 200 份问卷并提交报告");
    await page.getByRole("button", { name: "生成岗位推荐", exact: true }).waitFor();
    assert.equal(modelRequests.length, 0, "字段输入不应自动调用模型");
    await page.locator(".app-nav > div button").filter({ hasText: "岗位推荐" }).click();
    await page.getByLabel("目标岗位 JD").fill("数据分析实习生，要求熟悉 Python 和统计分析。");
    assert.equal(await page.getByRole("button", { name: "分析该岗位", exact: true }).isEnabled(), true);
    await page.locator(".app-nav > div button").filter({ hasText: "简历编辑" }).click();
    await page.getByRole("button", { name: "生成岗位推荐", exact: true }).click();
    await page.getByRole("button", { name: "生成岗位推荐", exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector(".resume-structured-form > button").disabled);
    assert.equal(modelRequests.length, 3, "显式生成推荐才调用三个岗位子任务");
    assert.ok(modelRequests.every(body => body.resumeText.includes("分析 200 份问卷") && body.resumeProfile.name === "手填测试人"));
    await fields.nth(0).fill("");
    await fields.nth(2).fill("最新项目：使用 Python 分析 500 份问卷");
    await page.getByRole("button", { name: "生成岗位推荐", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".resume-structured-form > button").disabled);
    const editedRequests = modelRequests.slice(3);
    assert.equal(editedRequests.length, 3);
    assert.ok(editedRequests.every(body => body.resumeProfile.name === "" && body.resumeProfile.targetRoles.length === 0 && body.resumeProfile.summary === ""));
    assert.ok(editedRequests.every(body => body.resumeText.includes("分析 500 份问卷") && !body.resumeText.includes("手填测试人") && !body.resumeText.includes("分析 200 份问卷")));
    const upload = page.locator(".resume-editor-upload-control input");
    await upload.setInputFiles({ name: "简历测试.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await docxFixture() });
    await page.waitForFunction(() => document.querySelector(".resume-original-text")?.textContent.includes("DOCX测试人"));
    await page.waitForFunction(() => !document.querySelector(".resume-structured-form > button").disabled);
    const docxRequest = modelRequests.find(body => body.task === "resume-structure");
    assert.ok(docxRequest.resumeText.includes("DOCX测试人") && docxRequest.resumeText.includes("表格项目：整理 300 份问卷"));
    await page.locator(".resume-editor-upload-control input").setInputFiles({ name: "旧简历.doc", mimeType: "application/msword", buffer: Buffer.from("legacy document") });
    await page.locator(".resume-original-upload-bar small").filter({ hasText: "旧版 DOC 请另存为 DOCX、PDF 或 TXT" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("简历编辑验证通过：纯手填可分析、键入不调用模型、显式生成推荐、编辑后使用最新文本、清空身份字段、DOCX 段落/表格提取、旧 DOC 提示。");
  } finally {
    await browser?.close();
    if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
