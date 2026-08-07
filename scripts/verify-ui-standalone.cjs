const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const VITE_ENTRY = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const UI_VERIFY_ENTRY = path.join(ROOT, "scripts", "verify-ui.cjs");
const DEV_URL = "http://127.0.0.1:5173";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const stopProcess = async (processHandle) => {
  if (!processHandle || processHandle.exitCode !== null) return;
  processHandle.kill();
  await Promise.race([
    new Promise((resolve) => processHandle.once("exit", resolve)),
    delay(5_000),
  ]);
  if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
};

const waitForServer = async (processHandle, stderrLines) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Vite 提前退出（${processHandle.exitCode}）：${stderrLines.slice(-8).join("\n")}`);
    }
    try {
      const response = await fetch(DEV_URL, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error("Vite 在 30 秒内未就绪。");
};

const runUiVerification = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [UI_VERIFY_ENTRY], {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });
  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`UI 验证失败，退出码 ${code}`));
  });
});

async function main() {
  const stdoutLines = [];
  const stderrLines = [];
  const vite = spawn(process.execPath, [VITE_ENTRY, "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      JOB_RAG_SKIP_WARMUP: "true",
    },
  });

  vite.stdout.on("data", (chunk) => stdoutLines.push(String(chunk).trim()));
  vite.stderr.on("data", (chunk) => stderrLines.push(String(chunk).trim()));

  try {
    await waitForServer(vite, stderrLines);
    await runUiVerification();
    console.log(JSON.stringify({
      ok: true,
      url: DEV_URL,
      vite: stdoutLines.filter(Boolean).slice(-6),
    }, null, 2));
  } finally {
    await stopProcess(vite);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
