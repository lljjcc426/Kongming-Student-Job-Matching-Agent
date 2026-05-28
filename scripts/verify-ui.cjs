const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

  const title = await page.locator("h1").innerText();
  const jobCards = await page.locator(".job-card").count();
  const workflowSteps = await page.locator(".workflow article").count();
  const jdButtonText = await page.locator(".primary-action").innerText();
  const reportButtonText = await page.locator(".secondary-action").innerText();

  await page.screenshot({ path: "artifacts/redesign-homepage.png", fullPage: true });
  await browser.close();

  if (title !== "孔明职配") {
    throw new Error(`Unexpected title: ${title}`);
  }
  if (jobCards !== 5) {
    throw new Error(`Expected 5 job cards, found ${jobCards}`);
  }
  if (workflowSteps !== 4) {
    throw new Error(`Expected 4 workflow steps, found ${workflowSteps}`);
  }
  if (!jdButtonText.includes("分析该岗位")) {
    throw new Error(`JD action not found: ${jdButtonText}`);
  }
  if (!reportButtonText.includes("下载分析报告")) {
    throw new Error(`Report action not found: ${reportButtonText}`);
  }

  console.log(JSON.stringify({ title, jobCards, workflowSteps, jdButtonText, reportButtonText, screenshot: "artifacts/redesign-homepage.png" }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
