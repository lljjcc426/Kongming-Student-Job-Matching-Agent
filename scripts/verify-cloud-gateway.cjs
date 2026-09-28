const assert = require("node:assert/strict");

async function main() {
  if (!process.argv.includes("--live")) {
    console.log("Use --live to explicitly test a deployed gateway with public job keywords only.");
    return;
  }
  const option = process.argv.find(argument => argument.startsWith("--gateway-url="));
  const endpoint = new URL(option ? option.slice("--gateway-url=".length) : "http://127.0.0.1:8787/api/gateway");
  assert.ok(["http:", "https:"].includes(endpoint.protocol));
  assert.equal(endpoint.pathname, "/api/gateway");
  assert.equal(endpoint.username + endpoint.password, "");
  const request = async parameters => {
    const url = new URL(endpoint);
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    } catch (error) {
      const cause = error.cause;
      throw new Error('Gateway ' + parameters.operation + ' request failed: ' + (cause?.code || error.name) + ' ' + (cause?.message || error.message));
    }
    assert.equal(response.status, 200, "Gateway returned HTTP " + response.status);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    return payload;
  };
  const status = await request({ operation: "status" });
  assert.equal(status.services.model.configured, true);
  assert.equal(status.services.jobs.configured, true);
  const snapshotOnly = process.argv.includes("--snapshot-only");
  const jobs = await request({ operation: "jobs", market: "cn", q: "算法实习生", limit: "20", refresh: snapshotOnly ? "false" : "true" });
  assert.ok(Array.isArray(jobs.jobs) && jobs.jobs.length > 0);
  assert.ok(jobs.jobs.length <= 20);
  assert.ok(jobs.jobs.every(job => job.market !== "global"));
  console.log(JSON.stringify({
    ok: true,
    checkedAt: new Date().toISOString(),
    returnedJobs: jobs.jobs.length,
    totalMatches: jobs.pagination.total,
    collection: jobs.collection,
    companies: [...new Set(jobs.jobs.map(job => job.company))],
    privateResumeUploaded: false,
    snapshotOnly,
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
