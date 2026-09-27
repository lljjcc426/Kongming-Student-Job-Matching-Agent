const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const compiled = buildSync({
  absWorkingDir: repoRoot,
  entryPoints: ['harmony/entry/src/main/ets/common/NativeApplicationWorkspaceService.ets'],
  loader: { '.ets': 'ts' },
  resolveExtensions: ['.ets', '.ts', '.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
}).outputFiles[0].text;
const compiledModule = { exports: {} };
new Function('exports', 'module', 'require', compiled)(compiledModule.exports, compiledModule, require);
const { NativeApplicationListItem, NativeApplicationWorkspaceService } = compiledModule.exports;
const service = new NativeApplicationWorkspaceService();
const now = new Date(2026, 8, 27, 10, 0).getTime();
const item = (key, company, stage, overrides = {}) => new NativeApplicationListItem({
  key, company, applicationStage: stage, title: '鸿蒙客户端实习生',
  description: '使用 ArkTS 实现原生页面，编写交互测试并验证性能。',
  applicationDeadline: '', nextInterviewAt: '', applicationUpdatedAt: '',
  applicationResumeVersionId: '', applicationEvents: [], source: 'https://example.com/jobs',
  createdAt: '2026/9/20 12:00:00', updatedAt: '2026/9/26 12:00:00', ...overrides,
}, 3, '准备岗位材料');
const records = [
  item('closed', '百度', 'closed', { nextInterviewAt: '2026-09-28 09:00', updatedAt: '2026/9/27 09:00:00' }),
  item('offer', '腾讯', 'offer', { applicationDeadline: '2026-09-26 09:00' }),
  item('later', '网易', 'preparing', { applicationDeadline: '2026-10-10 12:00' }),
  item('unscheduled', '字节跳动', 'applied', { applicationDeadline: '2026-09-20 12:00' }),
  item('upcoming', '腾讯', 'interview', { nextInterviewAt: '2026-09-28 09:00', updatedAt: '2026/9/27 08:00:00' }),
  item('overdue', '网易', 'interested', { applicationDeadline: '2026-09-26 15:00' }),
];
const keys = results => results.map(result => result.record.key);
const original = JSON.stringify(records);
assert.equal(service.count(records, 'all'), 6);
assert.equal(service.count(records, 'active'), 4);
assert.equal(service.count(records, 'closed'), 1);
assert.equal(service.count(records, 'offer'), 1);
assert.equal(service.count(records, 'interview'), 1);
assert.equal(service.stageLabel('preparing'), '准备中');
assert.equal(service.stageLabel('legacy'), '已收藏');
assert.equal(service.filters(records).find(filter => filter.id === 'active').label, '进行中 (4)');
assert.deepEqual(keys(service.query(records, '', 'active', 'schedule', now)), ['overdue', 'upcoming', 'later', 'unscheduled']);
assert.deepEqual(keys(service.query(records, '', 'all', 'recent', now)).slice(0, 2), ['closed', 'upcoming']);
assert.deepEqual(keys(service.query(records, ' 腾讯  arkts ', 'all', 'recent', now)), ['upcoming', 'offer']);
assert.deepEqual(keys(service.query(records, '腾讯 鸿蒙', 'offer', 'schedule', now)), ['offer']);
assert.equal(service.query(records, '腾讯 网易', 'all', 'schedule', now).length, 0);
assert.equal(service.query(records, '不存在的技能', 'all', 'recent', now).length, 0);
assert.equal(service.query(records, '', 'applied', 'schedule', now)[0].record.key, 'unscheduled');
assert.equal(service.query([], '', 'all', 'schedule', now).length, 0);
const companyOrder = service.query(records, '', 'all', 'company', now).map(result => result.record.company);
assert.deepEqual(companyOrder, [...companyOrder].sort((left, right) => left.localeCompare(right, 'zh-CN')));
assert.equal(JSON.stringify(records), original);

assert.equal(service.schedule(records[0].record, now).label, '');
assert.equal(service.schedule(records[1].record, now).label, '');
assert.equal(service.schedule(records[3].record, now).priority, 3);
assert.equal(service.schedule(records[3].record, now).overdue, false);
assert.equal(service.schedule(records[4].record, now).label, '面试 · 09-28 09:00');
assert.equal(service.schedule(records[4].record, now).priority, 1);
assert.equal(service.schedule(records[5].record, now).label, '投递截止已过 · 09-26 15:00');
assert.equal(service.schedule(records[5].record, now).overdue, true);
const twoDates = item('two', '测试公司', 'preparing', { applicationDeadline: '2026-09-29 08:00', nextInterviewAt: '2026-09-28 11:00' });
assert.equal(service.schedule(twoDates.record, now).label, '面试 · 09-28 11:00');
twoDates.record.applicationDeadline = '2026-09-27 11:00';
assert.equal(service.schedule(twoDates.record, now).label, '投递截止 · 09-27 11:00');
twoDates.record.applicationDeadline = '2026-09-26 11:00';
assert.equal(service.schedule(twoDates.record, now).label, '面试 · 09-28 11:00');
twoDates.record.nextInterviewAt = '2026-09-25 11:00';
assert.equal(service.schedule(twoDates.record, now).label, '投递截止已过 · 09-26 11:00');
assert.equal(service.schedule(item('past', '测试公司', 'interview', { nextInterviewAt: '2026-09-26 12:00' }).record, now).label,
  '面试时间已过 · 09-26 12:00');
assert.equal(service.schedule(item('due', '测试公司', 'preparing', { applicationDeadline: '2026-09-27 10:00' }).record, now).overdue, false);

assert.equal(service.parseLocalTime('2026-09-27 10:00'), now);
assert.equal(service.parseLocalTime('2026/9/27 10:00:00'), now);
assert.equal(service.parseLocalTime('2026-09-27T10:00:00'), now);
assert.equal(service.parseLocalTime('2026-02-30 10:00'), 0);
assert.equal(service.parseLocalTime('2026-02-29 10:00'), 0);
assert.ok(service.parseLocalTime('2028-02-29 10:00') > 0);
assert.equal(service.parseLocalTime('2026-13-01 10:00'), 0);
assert.equal(service.parseLocalTime('2026-09-27 24:00'), 0);
assert.equal(service.parseLocalTime('2026-09-27 10:60'), 0);
assert.equal(service.parseLocalTime('2026-09-27 10:00:60'), 0);
assert.equal(service.parseLocalTime('invalid'), 0);
assert.equal(service.parseLocalTime(''), 0);
assert.equal(service.schedule(item('invalid', '测试公司', 'interview', { nextInterviewAt: '2026-02-30 10:00' }).record, now).label, '');
const tied = [item('z', '测试公司', 'preparing'), item('a', '测试公司', 'preparing')];
assert.deepEqual(keys(service.query(tied, '', 'all', 'schedule', now)), ['a', 'z']);
assert.deepEqual(keys(service.query(tied, '', 'all', 'recent', now)), ['a', 'z']);

console.log('Native application workspace verification passed.');
