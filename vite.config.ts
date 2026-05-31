import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { runArkCompletion } from "./api/arkCore.js";

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

export default defineConfig({
  plugins: [react(), arkDevProxy()],
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
});
