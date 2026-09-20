import {
  runJobKnowledgeSearch,
  runJobKnowledgeStatus,
} from "../../server/jobKnowledgeCore.js";

export const config = {
  api: {
    bodyParser: { sizeLimit: "64kb" },
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
  try {
    const result = request.method === "GET"
      ? await runJobKnowledgeStatus({ allowLocal: false, allowRemote: true })
      : request.method === "POST"
        ? await runJobKnowledgeSearch(request.body || {}, {
            allowLocal: false,
            allowRemote: true,
          })
        : {
            status: 405,
            payload: { ok: false, error: "只支持 GET 和 POST 请求。" },
          };
    response.status(result.status).json(result.payload);
  } catch {
    response.status(500).json({
      ok: false,
      error: "岗位知识库网关异常，请稍后重试。",
    });
  }
}
