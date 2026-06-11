import { runArkCompletion } from "./arkCore.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

const setSecurityHeaders = (response) => {
  response.setHeader("Cache-Control", "no-store, private");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
};

export default async function handler(request, response) {
  setSecurityHeaders(response);

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "只支持 POST 请求。" });
    return;
  }

  try {
    const result = await runArkCompletion(request.body || {});
    response.status(result.status).json(result.payload);
  } catch {
    response.status(500).json({
      ok: false,
      error: "模型代理服务异常，请稍后重试。",
    });
  }
}
