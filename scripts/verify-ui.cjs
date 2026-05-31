const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

  const title = await page.locator("h1").innerText();
  const initialJobCards = await page.locator(".job-card").count();
  const workflowSteps = await page.locator(".workflow article").count();
  const jdButtonText = await page.locator(".primary-action").innerText();
  const initialReportButtons = await page.locator("button.secondary-action").filter({ hasText: "下载分析报告" }).count();
  const initialCopyButtons = await page.locator("button.secondary-action").filter({ hasText: "复制优化稿" }).count();
  const modelButtons = await page.locator("button.secondary-action").filter({ hasText: "模型增强分析" }).count();
  const initialOptimizedDraft = await page.getByText("优化后简历片段").count();
  const initialAgentCards = await page.locator(".agent-card").count();
  const initialInterviewInput = await page.getByLabel("模拟面试回答").count();
  const initialProcessCards = await page.locator(".process-grid article").count();
  const uploadControl = await page.locator(".upload-control").count();
  const uploadedResume = [
    "华南理工大学 软件工程专业 大三",
    "求职意向：前端开发实习生 / Web 工具平台",
    "项目经历：负责校园课程评价系统前端开发，使用 React、TypeScript、CSS 完成组件拆分、表单校验和可视化看板。",
    "实习经历：参与运营后台性能优化，首屏加载时间下降 32%，沉淀组件文档。",
    "技能：JavaScript、TypeScript、React、CSS、Figma、数据分析。",
  ].join("\n");

  await page.locator(".upload-control input").setInputFiles({
    name: "frontend-resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(uploadedResume, "utf8"),
  });
  await page.waitForFunction(() => document.body.innerText.includes("frontend-resume.txt"));
  const jobCards = await page.locator(".job-card").count();
  const reportButtons = await page.locator("button.secondary-action").filter({ hasText: "下载分析报告" }).count();
  const copyButtons = await page.locator("button.secondary-action").filter({ hasText: "复制优化稿" }).count();
  const optimizedDraft = await page.getByText("优化后简历片段").count();
  const agentCards = await page.locator(".agent-card").count();
  const interviewInput = await page.getByLabel("模拟面试回答").count();
  const processCards = await page.locator(".process-grid article").count();
  const uploadMessage = await page.locator(".upload-message").innerText();
  const profileSnapshot = await page.locator(".profile-snapshot").innerText();
  const dynamicSkillVisible = await page.getByText("TypeScript", { exact: true }).count();

  await page.screenshot({ path: "artifacts/redesign-homepage.png", fullPage: true });
  await browser.close();

  if (title !== "孔明职配") {
    throw new Error(`Unexpected title: ${title}`);
  }
  if (initialJobCards !== 0) {
    throw new Error(`Expected empty initial job cards, found ${initialJobCards}`);
  }
  if (initialReportButtons !== 0 || initialCopyButtons !== 0 || initialOptimizedDraft !== 0 || initialAgentCards !== 0 || initialInterviewInput !== 0) {
    throw new Error("Initial page should not show completed analysis sections");
  }
  if (initialProcessCards !== 3) {
    throw new Error(`Expected 3 initial process cards, found ${initialProcessCards}`);
  }
  if (workflowSteps !== 4) {
    throw new Error(`Expected 4 workflow steps, found ${workflowSteps}`);
  }
  if (!jdButtonText.includes("分析该岗位")) {
    throw new Error(`JD action not found: ${jdButtonText}`);
  }
  if (reportButtons !== 1) {
    throw new Error(`Expected report action, found ${reportButtons}`);
  }
  if (copyButtons !== 1) {
    throw new Error(`Expected copy action, found ${copyButtons}`);
  }
  if (modelButtons !== 1) {
    throw new Error(`Expected model analysis action, found ${modelButtons}`);
  }
  if (optimizedDraft !== 1) {
    throw new Error(`Expected optimized draft section, found ${optimizedDraft}`);
  }
  if (jobCards < 6) {
    throw new Error(`Expected at least 6 recommended job cards, found ${jobCards}`);
  }
  if (agentCards !== 0) {
    throw new Error(`Agent architecture cards should not be visible, found ${agentCards}`);
  }
  if (interviewInput !== 0) {
    throw new Error(`Interview architecture input should not be visible, found ${interviewInput}`);
  }
  if (processCards !== 3) {
    throw new Error(`Expected 3 process cards, found ${processCards}`);
  }
  if (uploadControl !== 1) {
    throw new Error(`Expected resume upload control, found ${uploadControl}`);
  }
  if (!uploadMessage.includes("frontend-resume.txt")) {
    throw new Error(`Upload did not update message: ${uploadMessage}`);
  }
  if (!profileSnapshot.includes("软件工程专业")) {
    throw new Error(`Profile snapshot did not update from resume: ${profileSnapshot}`);
  }
  if (dynamicSkillVisible < 1) {
    throw new Error("Expected uploaded resume skill TypeScript to be visible");
  }

  console.log(JSON.stringify({
    title,
    initialJobCards,
    initialReportButtons,
    initialCopyButtons,
    initialOptimizedDraft,
    initialAgentCards,
    initialInterviewInput,
    initialProcessCards,
    jobCards,
    workflowSteps,
    jdButtonText,
    reportButtons,
    copyButtons,
    modelButtons,
    optimizedDraft,
    agentCards,
    interviewInput,
    processCards,
    uploadControl,
    uploadMessage,
    profileSnapshot,
    dynamicSkillVisible,
    screenshot: "artifacts/redesign-homepage.png",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
