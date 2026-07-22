import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { runArkCompletion } from "./server/arkCore.js";
import { collectPublicJobs, getJobSourceStatus } from "./server/jobCollector.js";

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
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Robots-Tag", "noindex, nofollow");

      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }

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

const writeJson = (response: import("node:http").ServerResponse, status: number, payload: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.end(JSON.stringify(payload));
};

const jobDevProxy = (): Plugin => ({
  name: "job-dev-proxy",
  configureServer(server) {
    server.middlewares.use("/api/health", (request, response) => {
      if (request.method !== "GET") {
        writeJson(response, 405, { ok: false, error: "只支持 GET 请求。" });
        return;
      }
      response.setHeader("Cache-Control", "no-store, private");
      writeJson(response, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        services: {
          jobs: { configured: true },
          model: { configured: Boolean(process.env.ARK_API_KEY && process.env.ARK_BASE_URL) },
        },
      });
    });
    server.middlewares.use("/api/jobs", async (request, response) => {
      if (request.method !== "GET") {
        writeJson(response, 405, { ok: false, error: "只支持 GET 请求。" });
        return;
      }
      try {
        const url = new URL(request.url || "/", "http://localhost");
        const payload = await collectPublicJobs({
          query: url.searchParams.get("q"),
          city: url.searchParams.get("city"),
          company: url.searchParams.get("company"),
          employmentType: url.searchParams.get("employmentType"),
          sourceType: url.searchParams.get("sourceType"),
          updatedAfter: url.searchParams.get("updatedAfter"),
          cursor: url.searchParams.get("cursor"),
          limit: url.searchParams.get("limit"),
          refresh: url.searchParams.get("refresh") !== "false",
        });
        response.setHeader("Cache-Control", "public, max-age=60");
        writeJson(response, 200, payload);
      } catch (error) {
        console.error("[job-dev-proxy]", error);
        writeJson(response, 502, { ok: false, error: "公开岗位采集暂时不可用。" });
      }
    });
    server.middlewares.use("/api/job-sources", async (request, response) => {
      if (request.method !== "GET") {
        writeJson(response, 405, { ok: false, error: "只支持 GET 请求。" });
        return;
      }
      try {
        writeJson(response, 200, await getJobSourceStatus());
      } catch (error) {
        console.error("[job-source-dev-proxy]", error);
        writeJson(response, 500, { ok: false, error: "岗位来源状态暂时不可用。" });
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("ARK_") && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), arkDevProxy(), jobDevProxy()],
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
