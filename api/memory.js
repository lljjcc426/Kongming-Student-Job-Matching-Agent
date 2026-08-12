import { AUTH_SESSION_COOKIE, runAgentMemoryRequest } from "../server/agentMemoryCore.js";

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

const sessionTokenFrom = (request) => {
  const cookieHeader = request.headers?.cookie || "";
  for (const segment of cookieHeader.split(";")) {
    const [name, ...value] = segment.trim().split("=");
    if (name === AUTH_SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return "";
};

const setSessionCookie = (request, response, result) => {
  if (!result.sessionToken && !result.clearSession) return;
  const forwardedProtocol = String(request.headers?.["x-forwarded-proto"] || "");
  const secure = forwardedProtocol === "https" || process.env.NODE_ENV === "production";
  const maxAge = result.clearSession ? 0 : 30 * 24 * 60 * 60;
  const value = result.clearSession ? "" : encodeURIComponent(result.sessionToken);
  response.setHeader(
    "Set-Cookie",
    `${AUTH_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`,
  );
};

export default async function handler(request, response) {
  setSecurityHeaders(response);
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "只支持 POST 请求。" });
    return;
  }

  const result = await runAgentMemoryRequest(request.body || {}, {
    sessionToken: sessionTokenFrom(request),
  });
  setSessionCookie(request, response, result);
  response.status(result.status).json(result.payload);
}
