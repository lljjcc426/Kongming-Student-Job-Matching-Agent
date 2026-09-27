import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { handlePublicGatewayRequest } from "./server/publicGateway.js";

const MAX_DEV_BODY_BYTES = 8_000_000;

const readJsonBody = (request: import("node:http").IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    let raw = "";
    let rejected = false;
    request.on("data", (chunk) => {
      if (rejected) return;
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_DEV_BODY_BYTES) {
        rejected = true;
        raw = "";
        reject(new Error("REQUEST_TOO_LARGE"));
      }
    });
    request.on("end", () => {
      if (rejected) return;
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    request.on("error", reject);
  });

const publicGatewayDevProxy = (): Plugin => ({
  name: "public-gateway-dev-proxy",
  configureServer(server) {
    server.middlewares.use("/api/gateway", async (request, response) => {
      try {
        const url = new URL(request.url || "/", "http://localhost");
        const contentType = String(request.headers["content-type"] || "");
        const body = request.method === "POST" && /^application\/json(?:\s*;|$)/i.test(contentType)
          ? await readJsonBody(request)
          : {};
        const result = await handlePublicGatewayRequest({
          method: request.method,
          headers: request.headers,
          query: Object.fromEntries(url.searchParams.entries()),
          body,
          remoteAddress: request.socket.remoteAddress,
        });
        for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
        response.statusCode = result.status;
        response.end(result.payload === undefined ? undefined : JSON.stringify(result.payload));
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : "";
        response.statusCode = errorCode === "REQUEST_TOO_LARGE" ? 413 : errorCode === "INVALID_JSON" ? 400 : 500;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store, private");
        console.error("[public-gateway-dev-proxy]", error);
        response.end(JSON.stringify({
          ok: false,
          error: response.statusCode === 413
            ? "请求内容过大，请压缩后再上传。"
            : response.statusCode === 400 ? "请求内容不是有效 JSON。" : "业务网关暂时不可用。",
        }));
      }
    });
  },
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if ((key.startsWith("ARK_") || key.startsWith("IFLYTEK_SPARK_")
      || key.startsWith("JOB_") || key === "AI_MODEL_PROVIDER"
      || key === "MODEL_REQUEST_TIMEOUT_MS" || key === "PUBLIC_APP_ORIGINS")
      && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  if (command === "serve" && !process.env.JOB_STORE_PATH?.trim()) {
    process.env.JOB_STORE_PATH = resolve(process.cwd(), ".runtime", "jobs.json");
  }

  return {
    plugins: [react(), publicGatewayDevProxy()],
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
