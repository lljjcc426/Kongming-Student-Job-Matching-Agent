const { chromium } = require("playwright");

const mockJobs = [
  ["frontend-intern", "前端开发实习生", "软件开发", "实习"],
  ["backend-intern", "后端开发实习生", "软件开发", "实习"],
  ["llm-app-intern", "大模型应用工程师", "AI 与算法", "实习"],
  ["data-analyst-intern", "数据分析实习生", "数据方向", "实习"],
  ["ai-product-intern", "AI 产品实习生", "产品方向", "实习"],
  ["test-development-intern", "测试开发实习生", "软件开发", "实习"],
].map(([id, title, track, level], index) => ({
  id,
  title,
  track,
  city: "不限",
  level,
  companyScenario: "互联网与数字技术职业方向",
  summary: `${title}方向示例，不代表企业正在招聘。`,
  responsibilities: ["完成互联网产品相关任务", "解释方案与实现过程", "输出可核验的项目结果"],
  requirements: ["本科及以上", "具备 React、Python 或数据分析项目经历", "能够清晰说明个人贡献"],
  bonus: ["TypeScript", "SQL", "大模型应用"],
  keywords: ["React", "TypeScript", "Python", "SQL", "数据分析"],
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
  let sensitivePayloadLeak = false;
  let arkRequestCount = 0;

  await page.route("**/api/ark", async (route) => {
    arkRequestCount += 1;
    const body = route.request().postDataJSON();
    const serializedBody = JSON.stringify(body);
    if (serializedBody.includes("13800138000") || serializedBody.includes("student@example.com")) sensitivePayloadLeak = true;
    if (body.task === "resume-structure") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          model: "mock",
          content: JSON.stringify({
            name: "林晨",
            education: ["示例大学 计算机科学与技术 本科"],
            internships: ["在校内实验室参与管理系统开发，负责 React 页面与接口联调。"],
            projects: ["完成校园数据看板项目，使用 TypeScript、React 和 SQL 处理公开数据。"],
            campus: ["担任技术社团项目负责人，组织代码评审与项目复盘。"],
            honors: ["校级程序设计竞赛二等奖"],
            skills: ["React", "TypeScript", "SQL", "Python"],
            targetRoles: ["前端开发实习生", "大模型应用工程师"],
            summary: "计算机专业背景，具备前端开发和数据处理项目经历。",
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
          content: "可以。基于当前简历，建议优先核对前端开发和大模型应用岗位要求，并补充可核验的项目结果。",
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, model: "mock", content: "模型增强分析测试结果" }),
    });
  });

  await page.route("**/api/jobs**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        stale: false,
        collection: { attempted: 6, succeeded: 5, failed: 1, collected: 24 },
        pagination: { total: 1, nextCursor: null },
        jobs: [{
          id: "official-frontend-1",
          title: "前端开发实习生",
          company: "示例互联网企业",
          city: "上海",
          level: "实习",
          employmentType: "intern",
          department: "研发部",
          summary: "参与招聘产品前端开发与体验优化。",
          description: "岗位职责\n使用 React 与 TypeScript 完成功能开发。\n任职要求\n具备前端项目经验。",
          keywords: ["React", "TypeScript"],
          sourceType: "official-ats",
          sourceName: "示例互联网企业",
          sourceUrl: "https://example.com/jobs/1",
          applyUrl: "https://example.com/jobs/1/apply",
          publishedAt: "2026-07-20T00:00:00.000Z",
          updatedAt: "2026-07-20T01:00:00.000Z",
          lastSeenAt: "2026-07-20T02:00:00.000Z",
          verification: "official-ats",
          confidence: 0.98,
        }],
      }),
    });
  });

  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  const introStage = await page.locator(".loading-screen").count();
  const introProgress = await page.locator(".loading-brand-progress-track").count();
  const introProgressCard = await page.locator(".loading-brand-progress").count();
  const introVideoBackdrop = await page.locator(".loading-video-stage video").count();
  const introStartButton = await page.locator(".loading-start-button").count();
  await page.screenshot({ path: "artifacts/check-intro.png", fullPage: false });
  await page.waitForTimeout(1400);
  const introProgressAfterPlayback = Number(await page.locator(".loading-brand-progress-track").getAttribute("aria-valuenow"));
  await page.locator(".loading-start-button").click();
  await page.locator(".loading-screen").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
    await page.waitForFunction(() => !document.querySelector(".loading-screen"), null, { timeout: 5000 });
  });

  const title = await page.locator("h1").first().innerText();
  await page.locator(".app-nav > div button").nth(2).click();
  await page.waitForFunction(() => document.querySelector(".job-source-bar")?.classList.contains("ready"));
  const publicJobCards = await page.locator(".job-card").count();
  const publicSourceText = await page.locator(".job-source-bar p").innerText();
  await page.locator(".app-nav > div button").nth(1).click();
  const initialJobCards = await page.locator(".job-card").count();
  const uploadControl = await page.locator(".upload-control").count();
  const uploadedResume = [
    "姓名：林晨",
    "手机号：13800138000 邮箱：student@example.com",
    "示例大学 计算机科学与技术 本科",
    "求职意向：前端开发实习生 / 大模型应用工程师",
    "项目经历：完成校园数据看板项目，使用 TypeScript、React 和 SQL 处理公开数据。",
    "校园经历：担任技术社团项目负责人，组织代码评审与项目复盘。",
    "技能：React、TypeScript、SQL、Python。",
  ].join("\n");

  const privacyOptions = await page.locator(".privacy-options input").count();
  await page.locator(".upload-control input").setInputFiles({
    name: "local-only.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("本科，使用 React 完成课程项目。", "utf8"),
  });
  await page.waitForFunction(() => document.body.innerText.includes("local-only.txt"));
  const modelRequestsBeforeConsent = arkRequestCount;
  await page.locator(".privacy-consent input").check();
  await page.locator(".upload-control input").setInputFiles({
    name: "frontend-resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(uploadedResume, "utf8"),
  });
  await page.waitForFunction(() => document.body.innerText.includes("frontend-resume.txt"));
  await page.waitForFunction(() => document.querySelectorAll(".job-card").length >= 6);

  const jobCards = await page.locator(".job-card").count();
  const activeJobTabText = await page.locator(".job-kind-tabs button.active").innerText();
  const careerDirectionDisclaimer = await page.locator(".job-kind-disclaimer").innerText();
  const uploadMessage = await page.locator(".upload-message").innerText();
  const studentName = await page.locator(".identity-card strong").innerText();
  const educationCard = await page.locator(".resume-section-card").filter({ hasText: "学历" }).innerText();
  const dynamicSkillVisible = await page.getByText("React", { exact: true }).count();
  const evidenceCoverageBeforeConfirmation = await page.locator(".verdict-card > b").innerText();
  await page.getByRole("button", { name: "确认当前解析结果" }).click();
  await page.waitForFunction(() => document.querySelector(".resume-confirmation")?.classList.contains("confirmed"));
  const evidenceCoverageAfterConfirmation = await page.locator(".verdict-card > b").innerText();
  const proposalCount = await page.locator(".resume-proposal").count();
  if (proposalCount > 0) await page.locator(".resume-proposal").first().getByRole("button", { name: "接受" }).click();
  const acceptedProposalCount = await page.locator(".resume-proposal.accepted").count();
  await page.locator(".app-nav > div button").nth(2).click();
  await page.locator(".job-kind-tabs button").filter({ hasText: "已验证岗位" }).click();
  const verifiedTabCards = await page.locator(".job-card").count();
  await page.locator(".application-tracker").getByRole("button", { name: "加入追踪" }).click();
  await page.locator(".application-tracker select").selectOption("applied");
  const persistedApplications = await page.evaluate(() => JSON.parse(localStorage.getItem("kongming.application-tracker.v1") || "[]"));
  await page.locator(".job-kind-tabs button").filter({ hasText: "职业方向" }).click();
  const directionTabCards = await page.locator(".job-card").count();
  const directionTrackingBlocked = await page.locator(".tracking-blocked").innerText();
  await page.screenshot({ path: "artifacts/check-resume-after-upload.png", fullPage: false });

  await page.locator(".app-nav > div button").nth(3).click();
  await page.getByLabel("模拟面试回答").waitFor({ state: "visible", timeout: 8000 });
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

  if (introStage !== 1 || introProgress !== 1 || introProgressCard !== 1 || introVideoBackdrop !== 1 || introStartButton !== 1) {
    throw new Error(`Expected intro video loading screen, found stage=${introStage}, progress=${introProgress}, card=${introProgressCard}, video=${introVideoBackdrop}, start=${introStartButton}`);
  }
  if (introProgressAfterPlayback <= 0) {
    throw new Error(`Expected loading progress to advance during playback, found ${introProgressAfterPlayback}`);
  }
  if (!title.includes("孔明职配")) {
    throw new Error(`Unexpected home title: ${title}`);
  }
  if (publicJobCards !== 1 || !publicSourceText.includes("5/6 个来源可用")) {
    throw new Error(`Official job feed did not render correctly: cards=${publicJobCards}, source=${publicSourceText}`);
  }
  if (initialJobCards !== 1) {
    throw new Error(`Expected the verified official job to remain available before resume analysis, found ${initialJobCards}`);
  }
  if (uploadControl !== 1) {
    throw new Error(`Expected resume upload control, found ${uploadControl}`);
  }
  if (privacyOptions !== 5 || sensitivePayloadLeak) {
    throw new Error(`Privacy gate or redaction failed: options=${privacyOptions}, leak=${sensitivePayloadLeak}`);
  }
  if (modelRequestsBeforeConsent !== 0) {
    throw new Error(`Local text upload called the external model before consent: ${modelRequestsBeforeConsent}`);
  }
  if (!uploadMessage.includes("frontend-resume.txt")) {
    throw new Error(`Upload did not update message: ${uploadMessage}`);
  }
  if (studentName !== "林晨") {
    throw new Error(`Student name did not update from model: ${studentName}`);
  }
  if (!educationCard.includes("计算机科学与技术")) {
    throw new Error(`Education card did not update from model: ${educationCard}`);
  }
  if (jobCards < 6) {
    throw new Error(`Expected at least 6 recommended job cards, found ${jobCards}`);
  }
  if (!activeJobTabText.includes("职业方向") || !careerDirectionDisclaimer.includes("不代表企业正在招聘")) {
    throw new Error(`Expected career directions to be clearly separated from real jobs: tab=${activeJobTabText}, disclaimer=${careerDirectionDisclaimer}`);
  }
  if (evidenceCoverageBeforeConfirmation === evidenceCoverageAfterConfirmation) {
    throw new Error(`Expected confirmation to change evidence strength: before=${evidenceCoverageBeforeConfirmation}, after=${evidenceCoverageAfterConfirmation}`);
  }
  if (proposalCount < 1 || acceptedProposalCount !== 1) {
    throw new Error(`Expected fact-constrained resume proposals with per-item acceptance: proposals=${proposalCount}, accepted=${acceptedProposalCount}`);
  }
  if (verifiedTabCards !== 1 || directionTabCards < 6) {
    throw new Error(`Job repositories mixed their records: verified=${verifiedTabCards}, directions=${directionTabCards}`);
  }
  if (persistedApplications.length !== 1 || persistedApplications[0].stage !== "applied") {
    throw new Error(`Expected one locally persisted application in applied stage: ${JSON.stringify(persistedApplications)}`);
  }
  if (directionTrackingBlocked !== "不可直接投递") {
    throw new Error(`Career directions must be blocked from application tracking: ${directionTrackingBlocked}`);
  }
  if (dynamicSkillVisible < 1) {
    throw new Error("Expected uploaded resume skill React to be visible");
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
    publicJobCards,
    publicSourceText,
    introStage,
    introProgress,
    introProgressCard,
    introVideoBackdrop,
    introStartButton,
    introProgressAfterPlayback,
    initialJobCards,
    uploadControl,
    privacyOptions,
    sensitivePayloadLeak,
    modelRequestsBeforeConsent,
    uploadMessage,
    studentName,
    educationCard,
    jobCards,
    activeJobTabText,
    careerDirectionDisclaimer,
    evidenceCoverageBeforeConfirmation,
    evidenceCoverageAfterConfirmation,
    proposalCount,
    acceptedProposalCount,
    verifiedTabCards,
    directionTabCards,
    persistedApplicationStage: persistedApplications[0]?.stage,
    directionTrackingBlocked,
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
