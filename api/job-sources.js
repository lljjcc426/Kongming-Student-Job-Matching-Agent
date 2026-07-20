import { getJobSourceStatus } from "../server/jobCollector.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "只支持 GET 请求。" });
  try {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(await getJobSourceStatus());
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "岗位来源状态暂时不可用。",
      detail: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
    });
  }
}
