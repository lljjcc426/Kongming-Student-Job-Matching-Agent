import { runAgentMemoryRequest } from "../server/agentMemoryCore.js";

export const config = {
  api: {
    bodyParser: { sizeLimit: "256kb" },
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

  const result = await runAgentMemoryRequest(request.body || {});
  response.status(result.status).json(result.payload);
}
