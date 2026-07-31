import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = Number(process.env.JOB_RAG_TIMEOUT_MS || 180_000);
const DEFAULT_WINDOWS_PYTHON = "D:\\conda_envs\\kongming-rag\\python.exe";
const DEFAULT_DATA_PATH = "D:\\Kongming-RAG\\jobs-v1\\jobs-500.jsonl";
const DEFAULT_INDEX_ROOT = "D:\\Kongming-RAG\\jobs-v1\\index";
const DEFAULT_QDRANT_PATH = "D:\\Kongming-RAG\\jobs-v1\\database\\qdrant";
const DEFAULT_MODEL_CACHE = "D:\\ai_models\\huggingface";
const WORKER_PATH = fileURLToPath(new URL("./job_knowledge_worker.py", import.meta.url));

let worker = null;
let requestSequence = 0;
const pending = new Map();

const pythonCommand = () => {
  if (process.env.JOB_RAG_PYTHON_PATH) return process.env.JOB_RAG_PYTHON_PATH;
  if (process.platform === "win32" && existsSync(DEFAULT_WINDOWS_PYTHON)) {
    return DEFAULT_WINDOWS_PYTHON;
  }
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

  worker = spawn(pythonCommand(), ["-u", WORKER_PATH, "--serve"], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
      TOKENIZERS_PARALLELISM: "false",
      HF_HOME: process.env.HF_HOME
        || (process.platform === "win32" ? DEFAULT_MODEL_CACHE : process.env.HF_HOME || ""),
      HF_HUB_CACHE: process.env.HF_HUB_CACHE
        || (process.platform === "win32"
          ? `${DEFAULT_MODEL_CACHE}\\hub`
          : process.env.HF_HUB_CACHE || ""),
      JOB_RAG_DATA_PATH: process.env.JOB_RAG_DATA_PATH
        || (process.platform === "win32" ? DEFAULT_DATA_PATH : process.env.JOB_RAG_DATA_PATH || ""),
      JOB_RAG_INDEX_ROOT: process.env.JOB_RAG_INDEX_ROOT
        || (process.platform === "win32" ? DEFAULT_INDEX_ROOT : process.env.JOB_RAG_INDEX_ROOT || ""),
      JOB_RAG_QDRANT_PATH: process.env.JOB_RAG_QDRANT_PATH
        || (process.platform === "win32" ? DEFAULT_QDRANT_PATH : process.env.JOB_RAG_QDRANT_PATH || ""),
      JOB_RAG_JIEBA_CACHE: process.env.JOB_RAG_JIEBA_CACHE
        || (process.platform === "win32"
          ? `${DEFAULT_INDEX_ROOT}\\cache\\jieba`
          : process.env.JOB_RAG_JIEBA_CACHE || ""),
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
    else entry.reject(new Error(message.error || "本地岗位知识库检索失败。"));
  });

  worker.stderr.on("data", (chunk) => {
    const message = String(chunk).trim();
    if (message) console.warn(`[job-rag] ${message.slice(0, 1600)}`);
  });
  worker.on("error", (error) => {
    rejectPending(`无法启动本地岗位知识库：${error.message}`);
    worker = null;
  });
  worker.on("exit", (code) => {
    rejectPending(
      `本地岗位知识库进程已退出${typeof code === "number" ? `（${code}）` : ""}。`,
    );
    worker = null;
  });

  return worker;
};

const requestWorker = (action, body, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const processHandle = startWorker();
    const id = `job-rag-${Date.now()}-${requestSequence += 1}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("本地岗位知识库响应超时。"));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });

    processHandle.stdin.write(
      `${JSON.stringify({ id, action, body })}\n`,
      "utf8",
      (error) => {
        if (!error) return;
        clearTimeout(timer);
        pending.delete(id);
        reject(new Error(`无法向本地岗位知识库发送请求：${error.message}`));
      },
    );
  });

export const searchLocalJobKnowledge = (body, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  requestWorker("search", body, timeoutMs);

export const getLocalJobKnowledgeStatus = (timeoutMs = 15_000) =>
  requestWorker("status", {}, timeoutMs);

export const warmLocalJobKnowledge = (timeoutMs = DEFAULT_TIMEOUT_MS) =>
  requestWorker("warmup", {}, timeoutMs);

export const closeLocalJobKnowledgeWorker = () => {
  if (!worker) return;
  rejectPending("本地岗位知识库服务已停止。");
  worker.kill();
  worker = null;
};
