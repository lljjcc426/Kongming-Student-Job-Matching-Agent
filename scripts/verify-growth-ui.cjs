const { chromium } = require("playwright");

const baseUrl = process.env.KONGMING_BASE_URL || "http://127.0.0.1:5173";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ channel: "msedge", headless: true });
  }
}

async function enterApp(page) {
  const intro = page.locator(".intro-stage");
  if (await intro.count()) {
    await page.getByRole("button", { name: "立刻开始" }).click();
  }
  await page.locator(".app-nav").waitFor({ state: "visible", timeout: 15000 });
}

async function main() {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  let interviewRequests = 0;

  await page.route("**/api/ark", async (route) => {
    const body = route.request().postDataJSON() || {};
    interviewRequests += 1;
    const isFeedback = String(body.userMessage || "").includes("模拟面试反馈智能体");
    const content = isFeedback
      ? JSON.stringify({
        overallLevel: "developing",
        expression: "developing",
        professionalEvidence: "needs-evidence",
        logic: "developing",
        improvements: ["补充个人行动和结果数据", "使用 STAR 结构组织回答"],
        optimizedAnswer: "我负责推进一个真实项目，先明确目标，再完成实现、验证和复盘。",
        summary: "回答具备基础信息，但仍需强化结构化表达和岗位相关证据。",
      })
      : "请结合一个真实项目，说明背景、你的行动、结果和复盘。";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, model: "mock", content }),
    });
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await enterApp(page);
    await page.getByRole("button", { name: "简历解析" }).click();
    await page.locator(".privacy-consent input").check();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "模拟面试" }).click();
    await page.getByRole("button", { name: "开始面试" }).click();
    await page.getByLabel("模拟面试回答").fill("我负责设计并实现一个真实项目，完成接口联调、测试验证和复盘。上线后覆盖 30 个用户，交付时间缩短 20%。");
    await page.getByRole("button", { name: "发送" }).click();
    await page.getByRole("button", { name: "结束面试" }).click();
    await page.getByRole("button", { name: "查看成长任务" }).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "查看成长任务" }).click();
    await page.locator(".growth-plan-page").waitFor({ state: "visible", timeout: 5000 });

    const taskCards = page.locator(".growth-task-card");
    const taskCount = await taskCards.count();
    const initialCoverage = await page.locator(".growth-score-primary strong").innerText();
    assert(taskCount >= 1, `expected at least one growth task, got ${taskCount}`);

    const firstTask = taskCards.first();
    await firstTask.locator("textarea").fill("我做了一个项目。");
    await firstTask.locator("input").fill("not-a-url");
    await firstTask.getByRole("button", { name: "提交证据" }).click();
    await page.locator(".growth-task-card.growth-task-needs_revision").first().waitFor({ state: "attached", timeout: 5000 });
    const rejectedCoverage = await page.locator(".growth-score-primary strong").innerText();

    await firstTask.locator("textarea").fill("我负责设计并实现 React 页面，提交代码仓库和部署演示，页面加载时间降低 30%，并完成复盘。");
    await firstTask.locator("input").fill("https://example.com/demo");
    await firstTask.getByRole("button", { name: "提交证据" }).click();
    await page.locator(".growth-task-card.growth-task-verified").first().waitFor({ state: "attached", timeout: 5000 });
    const verifiedCoverage = await page.locator(".growth-score-primary strong").innerText();

    await page.waitForTimeout(150);
    const storedPlan = await page.evaluate(() => window.localStorage.getItem("kongming.growth-plan.v1"));
    assert(storedPlan, "expected growth plan to be persisted in localStorage");
    await page.reload({ waitUntil: "domcontentloaded" });
    await enterApp(page);
    await page.getByRole("button", { name: "成长任务" }).click();
    await page.locator(".growth-plan-page").waitFor({ state: "visible", timeout: 5000 });
    const restoredCoverage = await page.locator(".growth-score-primary strong").innerText();
    const restoredVerified = await page.locator(".growth-task-verified").count();

    assert(initialCoverage === "0%", `expected empty-job baseline coverage 0%, got ${initialCoverage}`);
    assert(rejectedCoverage === initialCoverage, `rejected evidence changed coverage: ${initialCoverage} -> ${rejectedCoverage}`);
    assert(verifiedCoverage === "9%", `expected verified evidence coverage 9%, got ${verifiedCoverage}`);
    assert(restoredCoverage === verifiedCoverage, `refresh did not restore coverage: ${verifiedCoverage} -> ${restoredCoverage}`);
    assert(restoredVerified === 1, `refresh did not restore verified task, got ${restoredVerified}`);
    assert(interviewRequests >= 2, `expected mocked interview requests, got ${interviewRequests}`);

    console.log(JSON.stringify({
      taskCount,
      initialCoverage,
      rejectedCoverage,
      verifiedCoverage,
      restoredCoverage,
      restoredVerified,
      interviewRequests,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
