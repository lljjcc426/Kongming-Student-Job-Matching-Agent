import { runArkCompletion } from "./arkCore.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "只支持 POST 请求。" });
    return;
  }

  try {
    const result = await runArkCompletion(request.body || {});
    response.status(result.status).json(result.payload);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "模型代理服务异常。",
    });
  }
}
