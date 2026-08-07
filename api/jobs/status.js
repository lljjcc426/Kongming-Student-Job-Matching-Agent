import { runJobKnowledgeStatus } from "../../server/jobKnowledgeCore.js";

const setSecurityHeaders = (response) => {
  response.setHeader("Cache-Control", "no-store, private");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
};

export default async function handler(request, response) {
  setSecurityHeaders(response);
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, ready: false, error: "只支持 GET 请求。" });
    return;
  }
  try {
    const result = await runJobKnowledgeStatus({
      allowLocal: false,
      allowRemote: true,
    });
    response.status(result.status).json(result.payload);
  } catch {
    response.status(500).json({
      ok: false,
      ready: false,
      error: "岗位知识库状态网关异常。",
    });
  }
}
