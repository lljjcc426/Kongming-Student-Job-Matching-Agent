import { getAuthenticatedAccount } from "./agentMemoryCore.js";
import { sessionTokenFrom } from "./memoryHttp.js";

export function authorizeRequest(request, response) {
  const account = getAuthenticatedAccount(sessionTokenFrom(request));
  if (!account) {
    response.statusCode = 401;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store, private");
    response.end(JSON.stringify({ ok: false, error: "请登录后继续使用。" }));
    return null;
  }
  return account;
}
