const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.route("**/api/ark", async (route) => {
    const body = route.request().postDataJSON();
    if (body.task === "resume-structure") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          model: "mock",
          content: JSON.stringify({
            name: "陈雨",
            education: ["华东师范大学 心理学 本科"],
            internships: ["在心理咨询中心担任助理，整理来访记录并协助团体辅导活动。"],
            projects: ["完成大学生压力与睡眠质量调查项目，使用 SPSS 分析 286 份问卷。"],
            campus: ["担任心理协会活动负责人，组织心理健康主题沙龙。"],
            honors: ["校级优秀学生干部", "心理统计课程优秀项目"],
            skills: ["SPSS", "问卷设计", "访谈", "数据分析"],
            targetRoles: ["用户研究实习生", "心理测评产品实习生"],
            summary: "心理学背景，具备访谈、问卷研究和数据分析经验。",
          }),
        }),
      });
      return;
    }
    if (body.task === "job-recommendations") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          model: "mock",
          content: JSON.stringify([
            {
              id: "ux-research-psychology",
              title: "用户研究实习生",
              track: "用户研究",
              city: "不限",
              level: "实习",
              companyScenario: "心理学与用户体验研究",
              summary: "基于访谈、问卷和行为数据理解用户需求。",
              responsibilities: ["设计访谈提纲", "执行用户研究", "输出洞察报告"],
              requirements: ["心理学或相关专业", "掌握问卷和访谈方法", "能整理研究证据"],
              bonus: ["有 SPSS 或统计分析经验", "有校园调研项目", "表达结构清晰"],
              keywords: ["心理学", "用户研究", "访谈", "问卷设计", "SPSS"],
              priority: "高",
            },
            {
              id: "assessment-product",
              title: "心理测评产品实习生",
              track: "产品",
              city: "不限",
              level: "实习",
              companyScenario: "测评工具与成长产品",
              summary: "协助心理测评产品的题项整理、用户反馈和体验优化。",
              responsibilities: ["整理测评题项", "分析用户反馈", "协助优化产品流程"],
              requirements: ["理解心理测量基础", "具备文献和数据整理能力", "关注用户体验"],
              bonus: ["有心理统计项目", "了解产品原型", "能做定性分析"],
              keywords: ["心理测评", "心理统计", "用户反馈", "产品体验"],
              priority: "高",
            },
            {
              id: "research-assistant",
              title: "行为研究助理",
              track: "研究",
              city: "不限",
              level: "实习",
              companyScenario: "用户行为与组织研究",
              summary: "支持问卷、访谈和实验数据整理。",
              responsibilities: ["整理研究资料", "清洗问卷数据", "协助撰写报告"],
              requirements: ["掌握基础统计", "细致负责", "有研究项目经历"],
              bonus: ["SPSS 熟练", "有心理协会活动经历", "英文阅读能力好"],
              keywords: ["行为研究", "问卷", "访谈", "数据分析"],
              priority: "中",
            },
            {
              id: "community-care",
              title: "社群关怀运营实习生",
              track: "运营",
              city: "不限",
              level: "实习",
              companyScenario: "心理健康社群与活动",
              summary: "围绕心理健康主题策划社群内容和活动。",
              responsibilities: ["策划社群活动", "整理用户反馈", "复盘活动效果"],
              requirements: ["理解心理健康议题", "沟通表达好", "能做数据复盘"],
              bonus: ["有协会活动经历", "会做内容策划", "同理心强"],
              keywords: ["心理健康", "社群", "活动运营", "用户反馈"],
              priority: "中",
            },
            {
              id: "education-product",
              title: "教育产品研究实习生",
              track: "教育产品",
              city: "不限",
              level: "实习",
              companyScenario: "学习体验与成长产品",
              summary: "结合心理学背景分析学习体验与学生需求。",
              responsibilities: ["分析学生需求", "协助课程体验调研", "输出优化建议"],
              requirements: ["心理学或教育相关背景", "能做访谈和问卷", "表达清晰"],
              bonus: ["有校园调研经历", "了解教育产品", "会基础统计"],
              keywords: ["教育产品", "学生需求", "问卷", "访谈"],
              priority: "中",
            },
            {
              id: "people-analytics",
              title: "员工体验调研实习生",
              track: "组织研究",
              city: "不限",
              level: "实习",
              companyScenario: "员工体验与组织数据",
              summary: "支持员工体验问卷、访谈和数据分析。",
              responsibilities: ["整理调研问卷", "分析访谈记录", "输出体验洞察"],
              requirements: ["理解心理学研究方法", "具备数据整理能力", "注重隐私和伦理"],
              bonus: ["SPSS 或 Excel 熟练", "有组织行为课程项目", "报告写作好"],
              keywords: ["员工体验", "组织研究", "问卷", "访谈"],
              priority: "中",
            },
          ]),
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, model: "mock", content: "模型增强分析测试结果" }),
    });
  });

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
    "姓名：陈雨",
    "华东师范大学 心理学 本科",
    "求职意向：用户研究实习生 / 心理测评产品实习生",
    "项目经历：完成大学生压力与睡眠质量调查项目，使用 SPSS 分析 286 份问卷。",
    "校园经历：担任心理协会活动负责人，组织心理健康主题沙龙。",
    "技能：SPSS、问卷设计、访谈、数据分析。",
  ].join("\n");

  await page.locator(".upload-control input").setInputFiles({
    name: "frontend-resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(uploadedResume, "utf8"),
  });
  await page.waitForFunction(() => document.body.innerText.includes("frontend-resume.txt"));
  await page.waitForFunction(() => document.querySelectorAll(".job-card").length >= 6);
  const jobCards = await page.locator(".job-card").count();
  const reportButtons = await page.locator("button.secondary-action").filter({ hasText: "下载分析报告" }).count();
  const copyButtons = await page.locator("button.secondary-action").filter({ hasText: "复制优化稿" }).count();
  const optimizedDraft = await page.getByText("优化后简历片段").count();
  const agentCards = await page.locator(".agent-card").count();
  const interviewInput = await page.getByLabel("模拟面试回答").count();
  const processCards = await page.locator(".process-grid article").count();
  const uploadMessage = await page.locator(".upload-message").innerText();
  const studentName = await page.locator(".identity-card strong").innerText();
  const educationCard = await page.locator(".resume-section-card").filter({ hasText: "学历" }).innerText();
  const dynamicSkillVisible = await page.getByText("SPSS", { exact: true }).count();
  const psychologyJobVisible = await page.getByText("心理测评产品实习生").count();

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
  if (interviewInput !== 1) {
    throw new Error(`Expected interview practice input after analysis, found ${interviewInput}`);
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
  if (studentName !== "陈雨") {
    throw new Error(`Student name did not update from model: ${studentName}`);
  }
  if (!educationCard.includes("心理学")) {
    throw new Error(`Education card did not update from model: ${educationCard}`);
  }
  if (dynamicSkillVisible < 1) {
    throw new Error("Expected uploaded resume skill SPSS to be visible");
  }
  if (psychologyJobVisible < 1) {
    throw new Error("Expected psychology-specific model job to be visible");
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
    studentName,
    educationCard,
    dynamicSkillVisible,
    psychologyJobVisible,
    screenshot: "artifacts/redesign-homepage.png",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
