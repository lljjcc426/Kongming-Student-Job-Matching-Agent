import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { runArkCompletion } from "./api/arkCore.js";

const readJsonBody = (request: import("node:http").IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
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
      response.setHeader("Cache-Control", "no-store");

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
        response.statusCode = 500;
        response.end(JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : "模型代理服务异常。",
        }));
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), arkDevProxy()],
});
