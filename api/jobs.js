import { collectPublicJobs } from "../server/jobCollector.js";

const rateState = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;

const clientKey = (req) => String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "anonymous")
  .split(",")[0]
  .trim();

const allowRequest = (key) => {
  const now = Date.now();
  const current = rateState.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    rateState.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_REQUESTS;
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "仅支持 GET 请求。" });
  if (!allowRequest(clientKey(req))) return res.status(429).json({ ok: false, error: "请求过于频繁，请稍后再试。" });

  try {
    const payload = await collectPublicJobs({
      query: req.query?.q,
      city: req.query?.city,
      limit: req.query?.limit,
    });
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1200");
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "公开岗位采集暂时不可用。",
      detail: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
    });
  }
}
