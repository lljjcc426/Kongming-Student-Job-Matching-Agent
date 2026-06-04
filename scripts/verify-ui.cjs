const { chromium } = require("playwright");

const mockJobs = [
  ["ux-research-intern", "用户研究实习生", "用户研究", "实习"],
  ["psychometric-product-intern", "心理测评产品实习生", "产品", "实习"],
  ["campus-research-assistant", "校园调研助理", "研究", "实习"],
  ["content-research-intern", "内容洞察实习生", "内容策略", "实习"],
  ["hr-data-intern", "人才数据分析实习生", "HR 数据", "实习"],
  ["user-operations-intern", "用户运营实习生", "用户运营", "实习"],
].map(([id, title, track, level], index) => ({
  id,
  title,
  track,
  city: "不限",
  level,
  companyScenario: "结合心理学、调研和数据分析能力的学生求职场景",
  summary: `${title}适合具备访谈、问卷、数据整理和用户理解能力的候选人。`,
  responsibilities: ["梳理用户问题", "执行调研或数据分析", "输出可落地的分析结论"],
  requirements: ["心理学或相关专业", "具备访谈、问卷或数据分析经历", "表达清晰、能沉淀证据"],
  bonus: ["SPSS", "校园活动组织", "研究项目经历"],
  keywords: ["SPSS", "访谈", "问卷", "数据分析", "心理学"],
  priority: index < 2 ? "高" : "中",
  applicationLinks: [
    { company: "智联招聘", url: "https://www.zhaopin.com/", note: "公开招聘入口" },
    { company: "BOSS直聘", url: "https://www.zhipin.com/", note: "公开招聘入口" },
  ],
}));

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ channel: "msedge", headless: true });
  }
}

async function main() {
  const browser = await launchBrowser();
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
        body: JSON.stringify({ ok: true, model: "mock", content: JSON.stringify(mockJobs) }),
      });
      return;
    }

    if (body.task === "career-chat") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          model: "mock",
          content: "可以。基于当前简历，建议优先关注用户研究、心理测评产品和校园调研相关岗位，并补充量化成果。",
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
  const introStage = await page.locator(".loading-screen").count();
  const introProgress = await page.locator(".loading-progress-track").count();
  const introProgressCard = await page.locator(".loading-progress-card").count();
  const introParticles = await page.locator(".loading-stars > i").count();
  const introVideoBackdrop = await page.locator(".loading-video-backdrop video").count();
  await page.screenshot({ path: "artifacts/check-intro.png", fullPage: false });
  await page.waitForTimeout(1400);
  const introProgressAfterWheel = Number(await page.locator(".loading-progress-track").getAttribute("aria-valuenow"));
  await page.dblclick(".loading-screen").catch(() => {});
  await page.locator(".loading-screen").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
    await page.waitForFunction(() => !document.querySelector(".loading-screen"), null, { timeout: 5000 });
  });

  const title = await page.locator("h1").first().innerText();
  await page.locator(".app-nav > div button").nth(1).click();
  const initialJobCards = await page.locator(".job-card").count();
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
  const uploadMessage = await page.locator(".upload-message").innerText();
  const studentName = await page.locator(".identity-card strong").innerText();
  const educationCard = await page.locator(".resume-section-card").filter({ hasText: "学历" }).innerText();
  const dynamicSkillVisible = await page.getByText("SPSS", { exact: true }).count();
  await page.screenshot({ path: "artifacts/check-resume-after-upload.png", fullPage: false });

  await page.locator(".app-nav > div button").nth(3).click();
  const interviewInput = await page.getByLabel("模拟面试回答").count();
  await page.screenshot({ path: "artifacts/check-interview.png", fullPage: false });

  await page.locator(".app-nav > div button").nth(4).click();
  await page.waitForSelector(".particle-galaxy-core canvas", { timeout: 8000 });
  const assistantPage = await page.locator(".ai-assistant-page").count();
  const chatPanel = await page.locator(".assistant-chat-panel").count();
  const chatComposer = await page.locator(".assistant-chat-panel textarea[aria-label='AI 助手输入']").count();
  const quickQuestionButtons = await page.locator(".assistant-quick-row button").count();
  const readActionVisible = await page.locator(".assistant-chat-panel .chat-actions button").count() > 0;
  const composerIconButtons = await page.locator(".assistant-round-button").count();
  const composerButtonText = await page.locator(".assistant-round-button").allInnerTexts();
  const assistantGalaxy = await page.locator(".particle-galaxy-core").count();
  const galaxyCanvas = await page.locator(".particle-galaxy-core canvas").count();
  const galaxyLabel = await page.locator(".particle-galaxy-label").count();
  const chatPanelRadius = await page.locator(".assistant-chat-panel").evaluate((node) => getComputedStyle(node).borderRadius);
  await page.getByText("推荐适合我的岗位").click();
  const quickQuestionFilled = await page.locator(".assistant-chat-panel textarea[aria-label='AI 助手输入']").inputValue();
  await page.screenshot({ path: "artifacts/check-assistant.png", fullPage: false });
  await browser.close();

  if (introStage !== 1 || introProgress !== 1 || introProgressCard !== 1 || introVideoBackdrop !== 1) {
    throw new Error(`Expected intro video loading screen, found stage=${introStage}, progress=${introProgress}, card=${introProgressCard}, video=${introVideoBackdrop}`);
  }
  if (introParticles < 180 || introParticles > 320) {
    throw new Error(`Expected 180-320 background particles, found ${introParticles}`);
  }
  if (introProgressAfterWheel <= 0) {
    throw new Error(`Expected loading progress to advance, found ${introProgressAfterWheel}`);
  }
  if (!title.includes("孔明职配")) {
    throw new Error(`Unexpected home title: ${title}`);
  }
  if (initialJobCards !== 0) {
    throw new Error(`Initial page should not show preset job cards, found ${initialJobCards}`);
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
  if (jobCards < 6) {
    throw new Error(`Expected at least 6 recommended job cards, found ${jobCards}`);
  }
  if (dynamicSkillVisible < 1) {
    throw new Error("Expected uploaded resume skill SPSS to be visible");
  }
  if (interviewInput !== 1) {
    throw new Error(`Expected interview practice input after analysis, found ${interviewInput}`);
  }
  if (assistantPage !== 1 || chatPanel !== 1 || chatComposer !== 1) {
    throw new Error(`Expected assistant page and chat panel, found page=${assistantPage}, panel=${chatPanel}, composer=${chatComposer}`);
  }
  if (quickQuestionButtons !== 4 || quickQuestionFilled !== "推荐适合我的岗位") {
    throw new Error(`Expected assistant quick questions to work, found buttons=${quickQuestionButtons}, input=${quickQuestionFilled}`);
  }
  if (readActionVisible) {
    throw new Error("Read-aloud action should not be visible in assistant panel");
  }
  if (composerIconButtons !== 2 || composerButtonText.join("").trim() !== "") {
    throw new Error(`Expected two icon-only composer buttons, found count=${composerIconButtons}, text=${composerButtonText.join("|")}`);
  }
  if (assistantGalaxy !== 1 || galaxyCanvas !== 1 || galaxyLabel !== 1) {
    throw new Error(`Expected Three.js assistant galaxy visual, found galaxy=${assistantGalaxy}, canvas=${galaxyCanvas}, label=${galaxyLabel}`);
  }
  if (!chatPanelRadius || chatPanelRadius === "0px") {
    throw new Error(`Expected rounded assistant chat panel, found radius=${chatPanelRadius}`);
  }

  console.log(JSON.stringify({
    title,
    introStage,
    introProgress,
    introProgressCard,
    introParticles,
    introVideoBackdrop,
    introProgressAfterWheel,
    initialJobCards,
    uploadControl,
    uploadMessage,
    studentName,
    educationCard,
    jobCards,
    dynamicSkillVisible,
    interviewInput,
    assistantPage,
    chatPanel,
    chatComposer,
    quickQuestionButtons,
    quickQuestionFilled,
    readActionVisible,
    composerIconButtons,
    composerButtonText,
    assistantGalaxy,
    galaxyCanvas,
    galaxyLabel,
    chatPanelRadius,
    screenshots: [
      "artifacts/check-intro.png",
      "artifacts/check-resume-after-upload.png",
      "artifacts/check-interview.png",
      "artifacts/check-assistant.png",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
