import http from "node:http";
import { runArkCompletion } from "./arkCore.js";

const PORT = Number(process.env.PORT || 9000);

const securityHeaders = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": process.env.ARK_CORS_ORIGIN || "*",
  "Vary": "Origin",
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    ...securityHeaders,
    ...corsHeaders,
  });
  response.end(JSON.stringify(payload));
};

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      ...securityHeaders,
      ...corsHeaders,
    });
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "只支持 POST 请求。" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const result = await runArkCompletion(body);
    sendJson(response, result.status, result.payload);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: "模型代理服务异常，请稍后重试。",
    });
  }
});

server.listen(PORT, () => {
  console.log(`CloudBase ark function listening on ${PORT}`);
});
