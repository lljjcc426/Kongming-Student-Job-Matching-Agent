const assert = require('node:assert/strict');

async function main() {
  if (!process.argv.includes('--live')) {
    console.log('Use --live to check HTTPS routing and rejection paths. No paid model completion is requested.');
    return;
  }
  const option = process.argv.find(argument => argument.startsWith('--gateway-url='));
  const endpoint = new URL(option ? option.slice('--gateway-url='.length) : 'https://121.41.44.243/api/gateway');
  assert.equal(endpoint.protocol, 'https:');
  assert.equal(endpoint.pathname, '/api/gateway');
  assert.equal(endpoint.username + endpoint.password, '');
  const checks = [];
  const check = async (label, url, expectedStatus, options = {}) => {
    const response = await fetch(url, { redirect: 'error', ...options, signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    assert.equal(response.status, expectedStatus, label + ': unexpected HTTP status');
    if (expectedStatus === 200) {
      const payload = JSON.parse(body);
      assert.equal(payload.ok, true);
      assert.equal(payload.services.model.configured, true);
      assert.equal(payload.services.jobs.configured, true);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.doesNotMatch(body, /(?:apiSecret|apiPassword|apiKey|process\.env|IFLYTEK_SPARK_API_SECRET)/i);
    }
    checks.push({ label, httpStatus: response.status });
  };
  const operation = name => {
    const url = new URL(endpoint);
    url.searchParams.set('operation', name);
    return url;
  };
  await check('trusted HTTPS status and safe response', operation('status'), 200);
  for (const route of ['/', '/.env.local', '/server/modelProvider.js', '/api/ark', '/api/jobs']) {
    await check('unpublished route ' + route, new URL(route, endpoint), 404);
  }
  await check('preflight', endpoint, 204, { method: 'OPTIONS' });
  await check('unapproved browser origin', operation('status'), 403, { headers: { Origin: 'https://unapproved.example' } });
  await check('unknown operation', operation('unknown'), 404);
  await check('model GET rejected before completion', operation('model'), 405);
  await check('status POST rejected', operation('status'), 405, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  await check('plain text model request rejected', operation('model'), 415, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'anonymous invalid input',
  });
  await check('invalid JSON rejected', operation('model'), 400, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'invalid-json',
  });
  await check('oversized JSON rejected', operation('model'), 413, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invalid: 'a'.repeat(8000001) }),
  });
  console.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), paidModelCompletionsRequested: 0, checks }, null, 2));
}

main().catch(error => {
  console.error(error.message, error.cause?.code || '');
  process.exitCode = 1;
});
