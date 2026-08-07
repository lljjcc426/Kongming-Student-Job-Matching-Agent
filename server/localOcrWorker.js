import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { readBoundedIntegerEnv } from "./runtimeConfig.js";

const DEFAULT_TIMEOUT_MS = 95_000;
const DEFAULT_WINDOWS_PYTHON = "D:\\conda_envs\\kongming-ocr\\python.exe";
const DEFAULT_WINDOWS_CACHE = "D:\\ai_models\\kongming-ocr\\modelscope";
const WORKER_PATH = fileURLToPath(new URL("./local_ocr_worker.py", import.meta.url));

let worker = null;
let requestSequence = 0;
const pending = new Map();

const pythonCommand = () => {
  if (process.env.OCR_PYTHON_PATH) return process.env.OCR_PYTHON_PATH;
  if (process.platform === "win32" && existsSync(DEFAULT_WINDOWS_PYTHON)) return DEFAULT_WINDOWS_PYTHON;
  return process.platform === "win32" ? "python" : "python3";
};

const rejectPending = (message) => {
  pending.forEach(({ reject, timer }) => {
    clearTimeout(timer);
    reject(new Error(message));
  });
  pending.clear();
};

const startWorker = () => {
  if (worker && !worker.killed) return worker;

  worker = spawn(pythonCommand(), ["-u", WORKER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
      MODELSCOPE_CACHE: process.env.OCR_MODEL_CACHE
        || (process.platform === "win32" ? DEFAULT_WINDOWS_CACHE : process.env.MODELSCOPE_CACHE || ""),
    },
  });

  const lines = createInterface({ input: worker.stdout });
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(message.id);
    if (message.ok) entry.resolve(message.result);
    else entry.reject(new Error(message.error || "本地 OCR 识别失败。"));
  });

  worker.stderr.on("data", (chunk) => {
    const message = String(chunk).trim();
    if (message) console.warn(`[local-ocr] ${message.slice(0, 800)}`);
  });
  worker.on("error", (error) => {
    rejectPending(`无法启动本地 OCR：${error.message}`);
    worker = null;
  });
  worker.on("exit", (code) => {
    rejectPending(`本地 OCR 进程已退出${typeof code === "number" ? `（${code}）` : ""}。`);
    worker = null;
  });

  return worker;
};

const localOcrTimeoutMs = () => readBoundedIntegerEnv(
  "OCR_LOCAL_TIMEOUT_MS",
  DEFAULT_TIMEOUT_MS,
);

export const runLocalOcr = (imageDataUrl, timeoutMs = localOcrTimeoutMs()) => new Promise((resolve, reject) => {
  const processHandle = startWorker();
  const id = `ocr-${Date.now()}-${requestSequence += 1}`;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error("本地 OCR 识别超时。"));
  }, timeoutMs);
  pending.set(id, { resolve, reject, timer });

  processHandle.stdin.write(`${JSON.stringify({ id, imageDataUrl })}\n`, "utf8", (error) => {
    if (!error) return;
    clearTimeout(timer);
    pending.delete(id);
    reject(new Error(`无法向本地 OCR 发送页面：${error.message}`));
  });
});

export const closeLocalOcrWorker = () => {
  if (!worker) return;
  rejectPending("本地 OCR 服务已停止。");
  worker.kill();
  worker = null;
};
