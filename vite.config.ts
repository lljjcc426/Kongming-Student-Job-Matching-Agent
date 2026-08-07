import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { runArkCompletion } from "./server/arkCore.js";
import {
  runJobKnowledgeSearch,
  runJobKnowledgeStatus,
} from "./server/jobKnowledgeCore.js";
import { runOcrRequest } from "./server/ocrCore.js";
import {
  closeLocalJobKnowledgeWorker,
  warmLocalJobKnowledge,
} from "./server/localJobKnowledgeWorker.js";
import { closeLocalOcrWorker } from "./server/localOcrWorker.js";

const MAX_DEV_BODY_BYTES = 8_000_000;

const readJsonBody = (request: import("node:http").IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_DEV_BODY_BYTES) {
        reject(new Error("REQUEST_TOO_LARGE"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const arkDevProxy = (): Plugin => ({
  name: "ark-dev-proxy",
  configureServer(server) {
    server.middlewares.use("/api/ark", async (request, response) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Robots-Tag", "noindex, nofollow");

      if (request.method !== "POST") {
        response.statusCode = 405;
        response.end(JSON.stringify({ ok: false, error: "只支持 POST 请求。" }));
        return;
      }

      try {
        const body = await readJsonBody(request);
        const result = await runArkCompletion(body);
        response.statusCode = result.status;
        response.end(JSON.stringify(result.payload));
      } catch (error) {
        response.statusCode = error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 500;
        console.error("[ark-dev-proxy]", error);
        response.end(JSON.stringify({
          ok: false,
          error: response.statusCode === 413 ? "请求内容过大，请压缩后再上传。" : "模型代理服务异常，请稍后重试。",
        }));
      }
    });
  },
});

const ocrDevProxy = (): Plugin => ({
  name: "ocr-dev-proxy",
  configureServer(server) {
    server.httpServer?.once("close", closeLocalOcrWorker);
    server.middlewares.use("/api/ocr", async (request, response) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Robots-Tag", "noindex, nofollow");

      if (request.method !== "POST") {
        response.statusCode = 405;
        response.end(JSON.stringify({ ok: false, error: "只支持 POST 请求。" }));
        return;
      }

      try {
        const body = await readJsonBody(request);
        const result = await runOcrRequest(body, { allowLocal: true });
        response.statusCode = result.status;
        response.end(JSON.stringify(result.payload));
      } catch (error) {
        response.statusCode = error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 500;
        console.error("[ocr-dev-proxy]", error);
        response.end(JSON.stringify({
          ok: false,
          error: response.statusCode === 413 ? "OCR 页面图片过大。" : "OCR 代理服务异常。",
        }));
      }
    });
  },
});

const jobKnowledgeDevProxy = (): Plugin => ({
  name: "job-knowledge-dev-proxy",
  configureServer(server) {
    server.httpServer?.once("close", closeLocalJobKnowledgeWorker);
    server.httpServer?.once("listening", () => {
      if (process.env.JOB_RAG_SKIP_WARMUP === "true") return;
      void warmLocalJobKnowledge()
        .then(() => console.log("[job-rag] 岗位知识库预热完成"))
        .catch((error) => console.warn("[job-rag] 岗位知识库预热失败", error));
    });
    server.middlewares.use("/api/jobs/search", async (request, response) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Robots-Tag", "noindex, nofollow");

      try {
        const result = request.method === "GET"
          ? await runJobKnowledgeStatus({ allowLocal: true })
          : request.method === "POST"
            ? await runJobKnowledgeSearch(await readJsonBody(request), { allowLocal: true })
            : {
                status: 405,
                payload: { ok: false, error: "只支持 GET 和 POST 请求。" },
              };
        response.statusCode = result.status;
        response.end(JSON.stringify(result.payload));
      } catch (error) {
        response.statusCode = error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 500;
        console.error("[job-knowledge-dev-proxy]", error);
        response.end(JSON.stringify({
          ok: false,
          error: response.statusCode === 413 ? "岗位检索内容过大。" : "岗位知识库代理服务异常。",
        }));
      }
    });
  },
});

const serverEnvPrefixes = ["ARK_", "JOB_RAG_", "OCR_", "VOLC_OCR_", "HF_", "MODELSCOPE_"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (serverEnvPrefixes.some((prefix) => key.startsWith(prefix)) && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), arkDevProxy(), ocrDevProxy(), jobKnowledgeDevProxy()],
    build: {
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        output: {
          entryFileNames: "assets/[hash].js",
          chunkFileNames: "assets/[hash].js",
          assetFileNames: "assets/[hash][extname]",
        },
      },
    },
  };
});
