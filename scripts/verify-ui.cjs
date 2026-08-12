const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const UI_ARTIFACT_DIR =
  process.env.JOB_RAG_UI_ARTIFACT_DIR
  || "D:\\Kongming-RAG\\jobs-v1\\test-artifacts";
const screenshotPaths = {
  intro: path.join(UI_ARTIFACT_DIR, "check-intro.png"),
  resume: path.join(UI_ARTIFACT_DIR, "check-resume-after-upload.png"),
  interview: path.join(UI_ARTIFACT_DIR, "check-interview.png"),
  assistant: path.join(UI_ARTIFACT_DIR, "check-assistant.png"),
  assistantMobile: path.join(UI_ARTIFACT_DIR, "check-assistant-mobile.png"),
};

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

const mockKnowledgeJobs = mockJobs.map((job, index) => ({
  id: `official-${job.id}`,
  source: index === 5 ? "meituan" : "bytedance",
  source_name: index === 5 ? "美团" : "字节跳动",
  source_job_id: `ui-${index + 1}`,
  source_url:
    index === 5
      ? "https://zhaopin.meituan.com/web/position"
      : "https://jobs.bytedance.com/campus/position/7664535650662123829/detail",
  company_name: index === 5 ? "美团" : "字节跳动",
  title: job.title,
  recruitment_type: "实习",
  employment_type: "实习",
  city: index % 2 === 0 ? "北京" : "上海",
  department: "",
  job_family: job.track,
  responsibilities: job.responsibilities,
  requirements: job.requirements,
  preferred_qualifications: job.bonus,
  skills: job.keywords,
  education_requirement: "本科及以上学历在读",
  experience_requirement: "具备相关项目或校园实践经历",
  published_at: "",
  refreshed_at: "",
  expires_at: "",
  last_verified_at: "2026-07-31T00:00:00.000Z",
  status: "active",
  retrieval: {
    score: Number((1 - index * 0.08).toFixed(2)),
    confidence: Number((0.92 - index * 0.05).toFixed(2)),
    denseScore: Number((0.82 - index * 0.04).toFixed(2)),
    lexicalScore: Number((8 - index * 0.5).toFixed(2)),
    denseRank: index + 1,
    lexicalRank: index + 1,
    rerankScore: null,
    rerankRank: null,
    matchedTerms: ["心理学", "访谈", "数据分析"],
    matchedSections: ["overview", "requirements"],
  },
}));

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ channel: "msedge", headless: true });
  }
}

async function main() {
  fs.mkdirSync(UI_ARTIFACT_DIR, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  let jobKnowledgeRequestBody = null;
  page.on("request", (request) => {
    if (!request.url().includes("/api/jobs/search") || request.method() !== "POST") return;
    try {
      jobKnowledgeRequestBody = request.postDataJSON();
    } catch {
      jobKnowledgeRequestBody = null;
    }
  });

  await page.route("**/api/jobs/search", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          ready: true,
          stale: false,
        }),
      });
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        query: body.query,
        queries: [body.query, ...(body.queries || [])],
        queryCount: 1 + (body.queries || []).length,
        topK: body.topK,
        filters: body.filters,
        totalCandidates: mockKnowledgeJobs.length,
        elapsedMs: 3.2,
        indexVersion: "ui-mock-sections-v1",
        retrievalDiagnostics: {
          queryCount: 1 + (body.queries || []).length,
          denseLimitPerQuery: 36,
          denseNodesRetrieved: 18,
          denseCandidatesRetrieved: 6,
          nodesPerRecord: 3,
          filterPushdown: true,
          rerankerEnabled: false,
          rerankerApplied: false,
          rerankerModel: null,
          rerankCandidates: 0,
          rerankElapsedMs: 0,
          rerankerError: null,
          cacheHit: false,
          cacheAgeMs: 0,
          cacheEntries: 1,
          cacheMaxEntries: 64,
          cacheTtlSeconds: 900,
          cacheBypassed: false,
        },
        results: mockKnowledgeJobs,
      }),
    });
  });

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

    if (body.task === "jd-analysis") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          model: "mock",
          content: JSON.stringify({
            title: "用户研究实习生",
            priority: "高",
            track: "用户研究",
            city: "上海",
            level: "实习",
            summary: "负责用户访谈、问卷研究和洞察输出。",
            conclusion: "与心理学、访谈和 SPSS 经历高度相关。",
            strengths: ["心理学专业", "具备问卷与访谈经验"],
            risks: ["缺少企业实习量化成果"],
            actions: ["补充项目影响和样本规模"],
            keywords: ["用户访谈", "问卷研究", "SPSS"],
            responsibilities: ["执行用户访谈", "整理研究数据", "输出研究报告"],
            requirements: ["心理学或相关专业", "掌握定性与定量研究方法"],
            bonus: ["SPSS", "校园调研经历"],
            applicationLinks: [],
          }),
        }),
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
  const introProgress = await page.locator(".loading-brand-progress-track").count();
  const introProgressCard = await page.locator(".loading-brand-progress").count();
  const introDecorations = await page.locator(".loading-voltage-button .dot").count();
  const introVideoBackdrop = await page.locator(".loading-video-stage video").count();
  await page.screenshot({ path: screenshotPaths.intro, fullPage: false });
  await page.waitForTimeout(1400);
  const introProgressAfterWheel = Number(await page.locator(".loading-brand-progress-track").getAttribute("aria-valuenow"));
  await page.locator(".loading-start-button").click();
  await page.locator(".loading-screen").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
    await page.waitForFunction(() => !document.querySelector(".loading-screen"), null, { timeout: 5000 });
  });

  const title = await page.locator("h1").first().innerText();
  await page.locator(".app-nav > div button").nth(1).click();
  const initialJobCards = await page.locator(".job-card").count();
  const uploadControl = await page.locator(".resume-editor-upload-control").count();
  const uploadedResume = [
    "姓名：陈雨",
    "华东师范大学 心理学 本科",
    "求职意向：用户研究实习生 / 心理测评产品实习生",
    "项目经历：完成大学生压力与睡眠质量调查项目，使用 SPSS 分析 286 份问卷。",
    "校园经历：担任心理协会活动负责人，组织心理健康主题沙龙。",
    "技能：SPSS、问卷设计、访谈、数据分析。",
  ].join("\n");

  await page.locator(".resume-editor-upload-control input").setInputFiles({
    name: "frontend-resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(uploadedResume, "utf8"),
  });
  await page.waitForFunction(() => document.body.innerText.includes("frontend-resume.txt"));
  await page.waitForFunction(() => document.querySelectorAll(".job-card").length >= 6);

  const jobCards = await page.locator(".job-card").count();
  const activeJobCards = await page.locator(".job-card.active").count();
  const uploadMessage = await page.locator(".resume-original-upload-bar small").innerText();
  await page.locator(".app-nav > div button").nth(2).click();
  const studentPortrait = await page.locator(".student-portrait-card p").innerText();
  const educationCard = await page.locator(".completeness-reasons article").filter({ hasText: "教育经历" }).innerText();
  const skillsCard = await page.locator(".completeness-reasons article").filter({ hasText: "专业技能" }).innerText();
  await page.screenshot({ path: screenshotPaths.resume, fullPage: false });

  await page.locator(".app-nav > div button").nth(3).click();
  const knowledgeJobCards = await page.locator(".job-card small").filter({ hasText: "职业知识库" }).count();
  const knowledgeJobLevels = await page.locator(".job-card p").allInnerTexts();
  const officialJobLink = await page.locator(".selected-job .apply-links a").first().getAttribute("href");
  await page.locator(".jd-lab input").fill("用户研究实习生");
  await page.locator(".jd-textarea").fill("负责用户访谈、问卷研究、数据分析和用户洞察报告输出。");
  await page.getByRole("button", { name: "分析该岗位" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".custom-job-list article").length === 1);
  const customJobTitle = await page.locator(".custom-job-list article strong").innerText();
  const selectedJobTitle = await page.locator(".selected-job h2").innerText();
  const jdMessage = await page.locator(".jd-actions span").innerText();
  await page.locator(".app-nav > div button").nth(2).click();
  await page.getByRole("button", { name: "复制优化稿" }).click();
  await page.getByRole("button", { name: "已复制" }).waitFor({ state: "visible" });
  const copyStatus = await page.getByRole("button", { name: "已复制" }).innerText();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载分析报告" }).click();
  const reportFilename = (await downloadPromise).suggestedFilename();

  await page.locator(".app-nav > div button").nth(4).click();
  await page.getByLabel("模拟面试回答").waitFor({ state: "visible", timeout: 8000 });
  const interviewInput = await page.getByLabel("模拟面试回答").count();
  await page.screenshot({ path: screenshotPaths.interview, fullPage: false });

  await page.locator(".app-nav > div button").nth(5).click();
  await page.waitForSelector(".particle-galaxy-core canvas", { timeout: 8000 });
  const assistantPage = await page.locator(".ai-assistant-page").count();
  const chatPanel = await page.locator(".assistant-chat-panel").count();
  const chatComposer = await page.locator(".assistant-chat-panel textarea[aria-label='AI 助手输入']").count();
  await page.locator(".assistant-memory-state.ready").waitFor({ state: "visible", timeout: 8000 });
  const memoryIndicator = await page.locator(".assistant-memory-state.ready").count();
  const memoryClearButton = await page.getByRole("button", { name: "清除长期记忆" }).count();
  const memoryLabel = await page.locator(".assistant-memory-state").innerText();
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
  await page.screenshot({ path: screenshotPaths.assistant, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const assistantMobileLayout = await page.evaluate(() => {
    const chatPanelNode = document.querySelector(".assistant-chat-panel");
    const chatPanelRect = chatPanelNode?.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      chatPanelLeft: chatPanelRect?.left ?? null,
      chatPanelRight: chatPanelRect?.right ?? null,
    };
  });
  await page.screenshot({ path: screenshotPaths.assistantMobile, fullPage: false });

  const persistentQuestion = "请记住我优先考虑北京的大模型实习岗位";
  await page.locator(".assistant-chat-panel textarea[aria-label='AI 助手输入']").fill(persistentQuestion);
  await page.getByRole("button", { name: "发送" }).click();
  await page.waitForFunction(
    () => (document.querySelector(".assistant-memory-state")?.textContent || "").includes("2 条"),
    null,
    { timeout: 8000 },
  );
  const memoryLabelAfterChat = await page.locator(".assistant-memory-state").innerText();

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.locator(".loading-start-button").click();
  await page.locator(".loading-screen").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
    await page.waitForFunction(() => !document.querySelector(".loading-screen"), null, { timeout: 5000 });
  });
  await page.locator(".app-nav > div button").nth(5).click();
  await page.locator(".assistant-memory-state.ready").waitFor({ state: "visible", timeout: 8000 });
  const restoredQuestionCount = await page.getByText(persistentQuestion, { exact: true }).count();
  const memoryLabelAfterReload = await page.locator(".assistant-memory-state").innerText();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清除长期记忆" }).click();
  await page.waitForFunction(
    () => (document.querySelector(".assistant-memory-state")?.textContent || "").includes("已启用"),
    null,
    { timeout: 8000 },
  );
  const restoredQuestionCountAfterClear = await page.getByText(persistentQuestion, { exact: true }).count();
  await browser.close();

  if (introStage !== 1 || introProgress !== 1 || introProgressCard !== 1 || introVideoBackdrop !== 1) {
    throw new Error(`Expected intro video loading screen, found stage=${introStage}, progress=${introProgress}, card=${introProgressCard}, video=${introVideoBackdrop}`);
  }
  if (introDecorations !== 5) {
    throw new Error(`Expected five loading button decorations, found ${introDecorations}`);
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
  if (!studentPortrait.includes("陈雨")) {
    throw new Error(`Student portrait did not update from model: ${studentPortrait}`);
  }
  if (!educationCard.includes("已识别")) {
    throw new Error(`Education card did not update from model: ${educationCard}`);
  }
  if (jobCards < 6) {
    throw new Error(`Expected at least 6 recommended job cards, found ${jobCards}`);
  }
  if (activeJobCards !== 1) {
    throw new Error(`Expected one active recommended job card, found ${activeJobCards}`);
  }
  if (knowledgeJobCards < 1) {
    throw new Error("Expected recommended jobs to come from the career knowledge base");
  }
  if (knowledgeJobLevels.some((text) => /社会招聘|全职/.test(text))) {
    throw new Error(
      `Student recommendations should not contain social jobs: ${knowledgeJobLevels.join(" | ")}`,
    );
  }
  if (
    !jobKnowledgeRequestBody
    || jobKnowledgeRequestBody.filters?.studentOnly !== true
    || !Array.isArray(jobKnowledgeRequestBody.queries)
    || jobKnowledgeRequestBody.queries.length !== 2
  ) {
    throw new Error(
      `Expected three-query student retrieval request, found ${JSON.stringify(jobKnowledgeRequestBody)}`,
    );
  }
  if (!officialJobLink || ![
    "jobs.bytedance.com",
    "careers.tencent.com",
    "zhaopin.meituan.com",
  ].includes(new URL(officialJobLink).hostname)) {
    throw new Error(`Expected an official recruiting link, found ${officialJobLink}`);
  }
  if (customJobTitle !== "用户研究实习生" || selectedJobTitle !== customJobTitle || jdMessage !== "意向岗位分析已完成") {
    throw new Error(`Expected analyzed custom job to become selected, found custom=${customJobTitle}, selected=${selectedJobTitle}, message=${jdMessage}`);
  }
  if (copyStatus !== "已复制" || reportFilename !== "kongming-match-report.md") {
    throw new Error(`Expected copy and report actions to work, found copy=${copyStatus}, report=${reportFilename}`);
  }
  if (!skillsCard.includes("已识别 4 项技能")) {
    throw new Error(`Skills card did not update from model: ${skillsCard}`);
  }
  if (interviewInput !== 1) {
    throw new Error(`Expected interview practice input after analysis, found ${interviewInput}`);
  }
  if (assistantPage !== 1 || chatPanel !== 1 || chatComposer !== 1) {
    throw new Error(`Expected assistant page and chat panel, found page=${assistantPage}, panel=${chatPanel}, composer=${chatComposer}`);
  }
  if (memoryIndicator !== 1 || memoryClearButton !== 1 || !memoryLabel.includes("长期记忆")) {
    throw new Error(`Expected persistent memory controls, found indicator=${memoryIndicator}, clear=${memoryClearButton}, label=${memoryLabel}`);
  }
  if (!memoryLabelAfterChat.includes("2 条") || restoredQuestionCount !== 1 || !memoryLabelAfterReload.includes("2 条")) {
    throw new Error(`Expected memory to survive reload, found afterChat=${memoryLabelAfterChat}, restored=${restoredQuestionCount}, afterReload=${memoryLabelAfterReload}`);
  }
  if (restoredQuestionCountAfterClear !== 0) {
    throw new Error(`Expected memory clear to remove restored messages, found ${restoredQuestionCountAfterClear}`);
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
  if (
    assistantMobileLayout.documentScrollWidth > assistantMobileLayout.viewportWidth + 1
    || assistantMobileLayout.chatPanelLeft === null
    || assistantMobileLayout.chatPanelRight === null
    || assistantMobileLayout.chatPanelLeft < -1
    || assistantMobileLayout.chatPanelRight > assistantMobileLayout.viewportWidth + 1
  ) {
    throw new Error(`Assistant mobile layout overflowed: ${JSON.stringify(assistantMobileLayout)}`);
  }

  console.log(JSON.stringify({
    title,
    introStage,
    introProgress,
    introProgressCard,
    introDecorations,
    introVideoBackdrop,
    introProgressAfterWheel,
    initialJobCards,
    uploadControl,
    uploadMessage,
    studentPortrait,
    educationCard,
    jobCards,
    activeJobCards,
    knowledgeJobCards,
    knowledgeJobLevels,
    knowledgeQueryCount: 1 + jobKnowledgeRequestBody.queries.length,
    officialJobLink,
    customJobTitle,
    selectedJobTitle,
    jdMessage,
    copyStatus,
    reportFilename,
    skillsCard,
    interviewInput,
    assistantPage,
    chatPanel,
    chatComposer,
    memoryIndicator,
    memoryClearButton,
    memoryLabel,
    memoryLabelAfterChat,
    restoredQuestionCount,
    memoryLabelAfterReload,
    restoredQuestionCountAfterClear,
    quickQuestionButtons,
    quickQuestionFilled,
    readActionVisible,
    composerIconButtons,
    composerButtonText,
    assistantGalaxy,
    galaxyCanvas,
    galaxyLabel,
    chatPanelRadius,
    assistantMobileLayout,
    screenshots: Object.values(screenshotPaths),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
