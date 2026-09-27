const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const compiled = buildSync({
  absWorkingDir: repoRoot,
  entryPoints: ['harmony/entry/src/main/ets/common/NativeInterviewHistoryService.ets'],
  loader: { '.ets': 'ts' }, resolveExtensions: ['.ets', '.ts', '.js'],
  bundle: true, platform: 'node', format: 'cjs', write: false,
}).outputFiles[0].text;
const compiledModule = { exports: {} };
new Function('exports', 'module', 'require', compiled)(compiledModule.exports, compiledModule, require);
const service = new compiledModule.exports.NativeInterviewHistoryService();
const epoch = new Date(2026, 8, 27, 10, 0).getTime();
const session = (id, overrides = {}) => ({
  id, jobKey: 'job-a', jobTitle: '鸿蒙应用开发实习生', company: '测试企业', interviewType: '技术面',
  difficulty: '标准', durationMinutes: 15, elapsedSeconds: 120,
  turns: [{ question: '怎样定位交互阻塞？', answer: '使用性能采样发现同步计算问题，拆分任务并以相同用例复核。', createdAt: '2026/9/27 09:59:00' }],
  feedback: '补充验证口径和真实结果。', modelName: 'must-not-be-rendered',
  overallScore: 70, structureScore: 72, evidenceScore: 66, relevanceScore: 75, clarityScore: 71,
  strongestLabel: '关联', priorityLabel: '补充支持证据', evidenceLabel: '待核对',
  assessmentSource: '基础训练评估', assessmentVersion: 'local-v1', evidenceReferences: [],
  completedAt: '2026/9/27 10:00:00', completedAtEpoch: epoch,
  videoRecorded: false, videoUri: '', videoDurationSeconds: 0, videoSizeBytes: 0,
  trainingFocusDimension: '', trainingBaselineScore: 0, trainingTargetScore: 0,
  competencyLabels: ['工程设计'], competencyCoveredCount: 1, competencyResults: [],
  jobDescriptionSnapshot: '参与 ArkTS 客户端开发、性能分析与交互测试。',
  resumeVersionId: 'resume-a', resumeVersionName: '投递版 1', requirementFocuses: ['工程设计'],
  improvedAnswer: '参考改写，不是原回答。', ...overrides,
});
const earlier = session('earlier', { completedAtEpoch: epoch - 86400000 });
const later = session('later', { overallScore: 78, structureScore: 80, evidenceScore: 72 });
const otherJob = session('other-job', { jobKey: 'job-b', jobTitle: '数据分析实习生', company: '另一测试企业', interviewType: 'HR面' });
const records = [earlier, otherJob, later];
const original = JSON.stringify(records);
const ids = results => results.map(record => record.id);
assert.deepEqual(ids(service.query(records, 'job-a', 'current', 'all', '')), ['later', 'earlier']);
assert.deepEqual(ids(service.query(records, 'missing-job', 'current', 'all', '')), []);
assert.equal(service.query(records, 'missing-job', 'all', 'all', '').length, 3);
assert.deepEqual(ids(service.query(records, 'job-a', 'job:job-b', 'HR 面', '')), ['other-job']);
assert.deepEqual(ids(service.query(records, 'job-a', 'current', '技术面', ' ARKTS  采样 ')), ['later', 'earlier']);
assert.deepEqual(ids(service.query(records, 'job-a', 'current', 'all', '不在原文中的词')), []);
assert.deepEqual(ids(service.query(records, 'job-a', 'current', 'all', '采样 数据分析')), []);
assert.equal(service.query(records, 'job-a', 'all', 'all', '真实结果').length, 3);
assert.equal(service.query(records, 'job-a', 'all', 'all', '参考改写').length, 3);
assert.equal(service.filters(records, 'job-a')[0].label, '当前岗位 (2)');
assert.equal(service.filters(records, 'job-a')[1].label, '全部岗位 (3)');
assert.equal(service.filters(records, 'job-a').filter(filter => filter.id.startsWith('job:')).length, 2);
assert.equal(service.query(Array.from({ length: 12 }, (_, index) => session(`record-${index}`)), 'job-a', 'current', 'all', '').length, 12);
assert.equal(service.query([], 'job-a', 'all', 'all', '').length, 0);
assert.equal(service.records([...records, later, session('')]).length, 3);
assert.deepEqual(ids(service.find(records, ['later', 'missing'])), ['later']);

let selection = service.toggleComparison(records, [], 'later');
assert.deepEqual(selection.ids, ['later']);
selection = service.toggleComparison(records, selection.ids, 'other-job');
assert.deepEqual(selection.ids, ['later']);
assert.match(selection.message, /同一岗位/);
selection = service.toggleComparison(records, selection.ids, 'earlier');
assert.deepEqual(selection.ids, ['later', 'earlier']);
assert.equal(service.toggleComparison([...records, session('third')], selection.ids, 'third').ids.length, 2);
assert.match(service.toggleComparison([...records, session('third')], selection.ids, 'third').message, /最多/);
assert.deepEqual(service.toggleComparison(records, selection.ids, 'later').ids, ['earlier']);
assert.deepEqual(service.toggleComparison(records, ['deleted'], 'earlier').ids, ['earlier']);
assert.match(service.toggleComparison(records, [], 'missing').message, /不在/);
assert.match(service.toggleComparison([session('unknown-job', { jobKey: '' })], [], 'unknown-job').message, /同一岗位/);

let comparison = service.compare(records, ['later', 'earlier']);
assert.ok(comparison.comparable);
assert.ok(comparison.chronological);
assert.deepEqual(ids(comparison.records), ['earlier', 'later']);
assert.equal(comparison.metrics[0].delta, '+8');
assert.equal(comparison.metrics[1].delta, '+8');
assert.equal(comparison.metrics[4].delta, '持平');
assert.equal(service.compare([earlier, session('lower', { overallScore: 60 })], ['earlier', 'lower']).metrics[0].delta, '-10');
assert.equal(service.compare(records, ['later', 'other-job']).metrics.length, 0);
assert.equal(service.compare(records, ['earlier', 'earlier']).metrics.length, 0);
assert.equal(service.compare(records, ['earlier']).metrics.length, 0);
assert.equal(service.compare(records, ['missing', 'later']).metrics.length, 0);
const variants = [
  ['面试类型不同', { interviewType: 'HR面' }],
  ['追问强度不同', { difficulty: '高压' }],
  ['训练时长不同', { durationMinutes: 20 }],
  ['作答轮数不同', { turns: [] }],
  ['评分规则不同', { assessmentSource: '个性化训练评估' }],
  ['评分规则不同', { assessmentVersion: 'local-v2' }],
  ['部分记录缺少评分信息', { assessmentVersion: undefined }],
  ['岗位要求有变化', { jobDescriptionSnapshot: '职责已更新。' }],
  ['未保留完整的岗位要求', { jobDescriptionSnapshot: '' }],
  ['简历版本不同', { resumeVersionId: 'resume-b' }],
  ['未绑定可核对的简历版本', { resumeVersionId: '' }],
  ['考察重点不同', { competencyLabels: ['项目经历'] }],
  ['考察重点不同', { requirementFocuses: ['表达'] }],
  ['专项训练重点不同', { trainingFocusDimension: 'evidence' }],
  ['完成时间不足以判断先后', { completedAtEpoch: 0 }],
];
for (const [reason, overrides] of variants) {
  const variant = session('variant', overrides);
  comparison = service.compare([earlier, variant], ['earlier', 'variant']);
  assert.equal(comparison.comparable, false, reason);
  assert.ok(comparison.reasons.includes(reason), reason);
  assert.ok(comparison.metrics.every(metric => metric.delta === '--'), reason);
}
const whitespace = session('whitespace', { jobDescriptionSnapshot: ` ${earlier.jobDescriptionSnapshot}\n`, interviewType: '技术 面', trainingFocusDimension: 'general' });
assert.ok(service.compare([earlier, whitespace], ['earlier', 'whitespace']).comparable);
assert.equal(service.compare([earlier, session('invalid-score', { overallScore: NaN })], ['earlier', 'invalid-score']).metrics[0].delta, '--');
assert.equal(service.scoreText(0), '0');
assert.equal(service.scoreText(100), '100');
assert.equal(service.scoreText(66.1234), '66.12');
for (const value of [NaN, Infinity, -1, 101, undefined, null, '70']) assert.equal(service.scoreText(value), '--');
assert.equal(service.timestamp(session('invalid-time', { completedAtEpoch: Infinity })), 0);
assert.equal(service.timestamp(session('invalid-time', { completedAtEpoch: 9e15 })), 0);
assert.equal(service.dateLabel(later), '2026-09-27 10:00');
assert.equal(service.dateLabel(session('legacy', { completedAtEpoch: undefined })), '2026/9/27 10:00:00');
assert.equal(service.dateLabel(session('legacy', { completedAtEpoch: 0, completedAt: '' })), '时间未记录');
assert.equal(service.query([session('legacy', { turns: undefined })], 'job-a', 'all', 'all', '').length, 1);
assert.equal(JSON.stringify(records), original);
console.log('Native interview history verification passed: retrieval, full archive, same-job selection and comparison boundaries.');
