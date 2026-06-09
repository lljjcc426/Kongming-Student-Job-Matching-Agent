const { runArkCompletion } = require("./arkCore.js");

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

const parseBody = (event) => {
  if (!event?.body) return {};
  if (typeof event.body === "object") return event.body;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : String(event.body);
  return raw.trim() ? JSON.parse(raw) : {};
};

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    ...securityHeaders,
    ...corsHeaders,
  },
  body: JSON.stringify(payload),
});

async function main(event = {}) {
  const method = event.httpMethod || event.requestContext?.http?.method || event.requestContext?.httpMethod || "POST";
  if (method === "OPTIONS") return jsonResponse(204, {});
  if (method !== "POST") return jsonResponse(405, { ok: false, error: "只支持 POST 请求。" });
  try {
    const body = parseBody(event);
    const result = await runArkCompletion(body);
    return jsonResponse(result.status, result.payload);
  } catch (error) {
    console.error("ark cloud function failed", error);
    return jsonResponse(500, {
      ok: false,
      error: "模型代理服务异常，请稍后重试。",
    });
  }
}

module.exports = {
  main,
};
