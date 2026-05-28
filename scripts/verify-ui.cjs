const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

  const title = await page.locator("h1").innerText();
  const jobCards = await page.locator(".job-card").count();
  const workflowSteps = await page.locator(".workflow article").count();

  await page.screenshot({ path: "artifacts/redesign-homepage.png", fullPage: true });
  await browser.close();

  if (title !== "孔明职配") {
    throw new Error(`Unexpected title: ${title}`);
  }
  if (jobCards !== 4) {
    throw new Error(`Expected 4 job cards, found ${jobCards}`);
  }
  if (workflowSteps !== 4) {
    throw new Error(`Expected 4 workflow steps, found ${workflowSteps}`);
  }

  console.log(JSON.stringify({ title, jobCards, workflowSteps, screenshot: "artifacts/redesign-homepage.png" }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
