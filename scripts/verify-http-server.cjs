const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");

async function main() {
  const { createGatewayServer } = await import("../server/httpServer.js");
  const gateway = await import("../server/publicGateway.js");
  let forwardedInput;
  const server = createGatewayServer({
    maxBodyBytes: 128,
    handleRequest: (input) => {
      forwardedInput = input;
      return gateway.handlePublicGatewayRequest(input, {
        env: {},
        getModelServiceStatus: () => ({ configured: false, visionConfigured: false }),
        runArkCompletion: async () => ({ status: 200, payload: { ok: true, content: "匿名测试问题" } }),
      });
    },
  });
  assert.throws(() => createGatewayServer({ maxBodyBytes: Infinity }));
  assert.throws(() => createGatewayServer({ maxBodyBytes: 0 }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = "http://127.0.0.1:" + server.address().port;
  const modelUrl = baseUrl + "/api/gateway?operation=model";
  const modelHeaders = { "content-type": "application/json" };
  try {
    assert.equal(server.address().address, "127.0.0.1");
    const status = await fetch(baseUrl + "/api/gateway?operation=status");
    assert.equal(status.status, 200);
    assert.equal((await status.json()).services.model.configured, false);
    assert.equal(status.headers.get("cache-control"), "no-store, private");
    for (const route of ["/.env.local", "/server/modelProvider.js", "/api/ark", "/"]) {
      assert.equal((await fetch(baseUrl + route)).status, 404);
    }
    const preflight = await fetch(baseUrl + "/api/gateway", { method: "OPTIONS" });
    assert.equal(preflight.status, 204);
    assert.equal(await preflight.text(), "");
    const blocked = await fetch(baseUrl + "/api/gateway?operation=status", {
      headers: { origin: "https://evil.example" },
    });
    assert.equal(blocked.status, 403);
    assert.equal((await fetch(modelUrl)).status, 405);
    assert.equal((await fetch(modelUrl, { method: "POST", body: "plain text" })).status, 415);
    for (const body of ["invalid", "[]", "null", "42"]) {
      assert.equal((await fetch(modelUrl, { method: "POST", headers: modelHeaders, body })).status, 400);
    }
    const oversized = await fetch(modelUrl, {
      method: "POST", headers: modelHeaders, body: JSON.stringify({ userMessage: "长".repeat(150) }),
    });
    assert.equal(oversized.status, 413);
    const chunkedStatus = await new Promise((accept, reject) => {
      const request = http.request(modelUrl, { method: "POST", headers: modelHeaders }, (response) => {
        response.resume();
        response.on("end", () => accept(response.statusCode));
      });
      request.on("error", reject);
      request.write("{\"userMessage\":\"");
      request.end("a".repeat(200) + "\"}");
    });
    assert.equal(chunkedStatus, 413);
    gateway.resetPublicGatewayRateLimitsForTests();
    for (let index = 0; index < 13; index += 1) {
      const response = await fetch(modelUrl, {
        method: "POST",
        headers: { ...modelHeaders, "x-forwarded-for": "spoofed-" + index, "x-real-ip": "spoofed-" + index },
        body: JSON.stringify({ task: "career-chat", userMessage: "匿名测试" }),
      });
      assert.equal(response.status, index < 12 ? 200 : 429);
      assert.equal(forwardedInput.headers["x-forwarded-for"], undefined);
      assert.equal(forwardedInput.headers["x-real-ip"], undefined);
    }
  } finally {
    await new Promise((accept) => {
      server.close(accept);
      server.closeAllConnections();
    });
  }

  const proxiedServer = createGatewayServer({
    trustProxy: true,
    handleRequest: (input) => {
      forwardedInput = input;
      return { status: 200, payload: { ok: true } };
    },
  });
  proxiedServer.listen(0, "127.0.0.1");
  await once(proxiedServer, "listening");
  try {
    const proxyUrl = "http://127.0.0.1:" + proxiedServer.address().port + "/api/gateway?operation=status";
    const response = await fetch(proxyUrl, {
      headers: {
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.20",
        "x-forwarded-host": "forged.example",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(response.status, 200);
    assert.equal(forwardedInput.headers["x-real-ip"], "203.0.113.10");
    assert.equal(forwardedInput.headers["x-forwarded-for"], undefined);
    assert.equal(forwardedInput.headers["x-forwarded-host"], undefined);
    assert.equal(forwardedInput.headers["x-forwarded-proto"], "https");
  } finally {
    await new Promise((accept) => {
      proxiedServer.close(accept);
      proxiedServer.closeAllConnections();
    });
  }
  console.log("production HTTP gateway verification passed: routing, privacy, body limits, CORS, proxy spoofing, rate limits and trusted local proxy headers");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
