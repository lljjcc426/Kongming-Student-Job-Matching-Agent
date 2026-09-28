const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const live = process.argv.includes('--live');
const feedbackOnly = process.argv.includes('--feedback-only');
const gatewayOption = process.argv.find(argument => argument.startsWith('--gateway-url='));
const gateway = gatewayOption ? gatewayOption.slice('--gateway-url='.length) : 'http://127.0.0.1:5173/api/gateway';
const gatewayUrl = new URL(gateway);
assert.ok(['http:', 'https:'].includes(gatewayUrl.protocol));
assert.equal(gatewayUrl.pathname, '/api/gateway');
assert.equal(gatewayUrl.username + gatewayUrl.password, '', 'credentials must not be embedded in a gateway URL');
const compiledServiceOption = process.argv.find(argument => argument.startsWith('--compiled-service='));
const requests = [];
let responseMode = 'mock';
let destroyedRequests = 0;
const evaluation = {
  schemaVersion: 'interview-evaluation-v1', overallScore: 70,
  structureScore: 70, evidenceScore: 68, relevanceScore: 74, clarityScore: 68,
  strongestLabel: '方案清楚', priorityLabel: '补充验证边界', evidenceLabel: '仅依据测试回答',
  strengths: ['说明了个人实现'], gaps: ['缺少真机验证'], actions: ['补充设备测试'],
  evidenceReferences: ['第1轮：实现本机状态保存'], improvedAnswer: '实现本机状态保存，真机验证结果待补充。',
};

const http = {
  RequestMethod: { POST: 'POST' }, HttpDataType: { STRING: 'string' },
  createHttp: () => ({
    async request(url, options) {
      const payload = JSON.parse(options.extraData);
      requests.push({ url, payload });
      if (responseMode === 'failure') return { responseCode: 503, result: '{"ok":false}' };
      if (responseMode === 'invalid') return { responseCode: 200, result: 'invalid JSON' };
      if (responseMode === 'live') {
        const response = await fetch(url, {
          method: options.method, headers: options.header, body: options.extraData,
          signal: AbortSignal.timeout(options.readTimeout),
        });
        return { responseCode: response.status, result: await response.text() };
      }
      const feedback = payload.userMessage.includes('固定字段：schemaVersion');
      const content = feedback ? JSON.stringify(evaluation) : '请说明你实现本机状态保存时采用的方案与验证方法？';
      return { responseCode: 200, result: JSON.stringify({ ok: true, content }) };
    },
    destroy() { destroyedRequests += 1; },
  }),
};
const compiled = compiledServiceOption
  ? fs.readFileSync(path.resolve(compiledServiceOption.slice('--compiled-service='.length)), 'utf8')
  : require('esbuild').buildSync({
  absWorkingDir: repoRoot,
  entryPoints: ['harmony/entry/src/main/ets/common/NativeAiService.ets'],
  loader: { '.ets': 'ts' }, resolveExtensions: ['.ets', '.ts', '.js'],
  external: ['@kit.*'], bundle: true, platform: 'node', format: 'cjs', write: false,
}).outputFiles[0].text;
const compiledModule = { exports: {} };
const nativeRequire = specifier => specifier === '@kit.NetworkKit' ? { http } : require(specifier);
new Function('exports', 'module', 'require', compiled)(compiledModule.exports, compiledModule, nativeRequire);
const createService = endpoint => new compiledModule.exports.NativeAiService({
  resourceManager: { getStringByNameSync: () => endpoint },
});
const service = createService(gateway);
const resume = '人工构造匿名资料：软件工程本科在读。使用 ArkTS 和 ArkUI 实现任务列表、本机保存、异步错误处理和模拟器回归。无商业实习经历。';
const job = '鸿蒙应用开发实习生（人工构造测试岗位）';
const description = '人工构造 JD：使用 ArkTS、ArkUI 实现本机数据保存和接口联调，说明个人贡献及测试方法，不代表真实招聘。';
const types = ['综合面', '技术面', 'HR面'];
const difficulties = ['基础', '标准', '高压'];
const durations = [10, 15, 20];
const turns = [{
  question: '请说明个人实现与测试范围？',
  answer: '我实现任务列表和本机状态保存，处理异步失败，并在模拟器中检查重启恢复；尚未完成真机验证。',
  createdAt: '2026-09-27',
}];
const question = (client, type, difficulty, duration, history = []) => client.generateInterviewQuestion(
  `${type}（${difficulty}难度）`, history.length + 1, duration === 10 ? 3 : duration === 15 ? 4 : 5,
  resume, job, description, ['工程实现', '个人贡献'], history.length ? '测试验证' : '工程实现',
  history.length ? ['工程实现'] : [], history,
);
const feedback = (client, type) => client.generateInterviewFeedback(
  type, resume, job, description, ['工程实现'], ['工程实现'], turns,
);

async function main() {
  let combinations = 0;
  for (const type of types) {
    for (const difficulty of difficulties) {
      for (const duration of durations) {
        const result = await question(service, type, difficulty, duration);
        assert.ok(result.ok, `${type}/${difficulty}/${duration}`);
        const prompt = requests.at(-1).payload.userMessage;
        assert.ok(prompt.includes(`${type}（${difficulty}难度）`));
        assert.ok(prompt.includes(`当前轮次：1/${duration === 10 ? 3 : duration === 15 ? 4 : 5}`));
        combinations += 1;
      }
    }
    assert.ok((await feedback(service, type)).evaluation);
  }
  assert.ok((await question(service, '技术面', '高压', 20, turns)).ok);
  assert.equal(requests.at(-1).payload.chatMessages[1].content, turns[0].answer);
  const offline = createService('');
  const beforeOffline = requests.length;
  assert.equal((await question(offline, '技术面', '标准', 15)).configured, false);
  assert.equal((await feedback(offline, '技术面')).ok, false);
  assert.equal(requests.length, beforeOffline, 'offline mode must not send a network request');
  const previousError = console.error;
  console.error = () => {};
  try {
    for (const mode of ['failure', 'invalid']) {
      responseMode = mode;
      assert.equal((await question(service, 'HR面', '基础', 10)).ok, false);
    }
  } finally { console.error = previousError; }
  assert.equal(destroyedRequests, requests.length, 'HTTP resources must be released');
  console.log(`PASS native service contracts: ${combinations} mode combinations, three feedback types, history, offline and failure handling.`);

  if (live || feedbackOnly) {
    responseMode = 'live';
    if (!feedbackOnly) {
      for (const type of types) {
        for (const [index, difficulty] of difficulties.entries()) {
          const result = await question(service, type, difficulty, durations[index]);
          assert.ok(result.ok && result.content.trim(), `Live ${type}/${difficulty} failed`);
          console.log(`PASS live question: ${type}/${difficulty}/${durations[index]} minutes.`);
        }
      }
      assert.ok((await question(service, '技术面', '标准', 15, turns)).ok, 'Live follow-up failed');
      console.log('PASS live follow-up with anonymous answer context.');
    }
    const report = await feedback(service, '技术面');
    assert.ok(report.ok && report.evaluation, 'Live feedback did not provide valid structured scores');
    console.log('PASS live structured feedback. All live requests used artificial anonymous data.');
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
