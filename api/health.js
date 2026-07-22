const modelConfigured = () => Boolean(process.env.ARK_API_KEY && process.env.ARK_BASE_URL);

export default function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store, private");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "只支持 GET 请求。" });

  return response.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    services: {
      jobs: { configured: true },
      model: { configured: modelConfigured() },
    },
  });
}
