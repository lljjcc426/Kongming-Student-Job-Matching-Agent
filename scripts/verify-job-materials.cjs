const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const compiled = buildSync({
  absWorkingDir: repoRoot,
  entryPoints: ['harmony/entry/src/main/ets/common/NativeJobMaterialService.ets'],
  loader: { '.ets': 'ts' },
  resolveExtensions: ['.ets', '.ts', '.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
}).outputFiles[0].text;
const compiledModule = { exports: {} };
new Function('exports', 'module', 'require', compiled)(compiledModule.exports, compiledModule, require);
const service = new compiledModule.exports.NativeJobMaterialService();

const record = {
  jobKey: 'tencent-job',
  resumeContent: '负责鸿蒙客户端开发\n通过性能分析修复页面卡顿',
  baseResumeContent: '负责鸿蒙客户端开发',
  sourceResumeVersionId: 'resume-v1',
  updatedAt: '2026-09-27',
  stories: [{ id: 'story-1', title: '客户端优化', requirement: '工程设计与稳定性', action: '采样排查耗时函数' }],
};
const draft = service.cloneRecord(record);
draft.resumeContent = '新的岗位草稿';
draft.stories[0].action = '修改中的行动';
assert.equal(record.resumeContent, '负责鸿蒙客户端开发\n通过性能分析修复页面卡顿');
assert.equal(record.stories[0].action, '采样排查耗时函数');
assert.equal(draft.sourceResumeVersionId, 'resume-v1');
const otherJob = service.cloneRecord({ jobKey: 'baidu-job', resumeContent: '独立草稿' });
assert.equal(otherJob.stories.length, 0);
assert.equal(otherJob.resumeContent, '独立草稿');
assert.equal(otherJob.baseResumeContent, '');

const restored = service.cloneRecord(JSON.parse(JSON.stringify(record)));
assert.equal(restored.jobKey, record.jobKey);
assert.equal(restored.stories[0].evidence, '');
assert.equal(service.storyCompletedFields(restored.stories[0]), 1);
restored.stories[0].situation = '旧页面响应慢';
restored.stories[0].task = '负责优化渲染';
restored.stories[0].result = '测试中响应时间下降';
restored.stories[0].evidence = '公开项目链接与测试报告';
assert.equal(service.storyCompletedFields(restored.stories[0]), 5);
assert.equal(service.cloneRecord({ jobKey: 'legacy' }).stories.length, 0);
assert.equal(service.cloneRecord({ ...record, stories: [...record.stories, ...record.stories, { id: '' }] }).stories.length, 1);

assert.deepEqual(service.resumeChanges('甲\n乙\n乙', '乙\n丙').added, ['丙']);
assert.deepEqual(service.resumeChanges('甲\n乙\n乙', '乙\n丙').removed, ['甲', '乙']);
assert.equal(service.resumeChanges('甲\n乙', '乙\n甲').changed, true);
assert.deepEqual(service.resumeChanges('甲\n乙', '乙\n甲').added, []);
assert.equal(service.resumeChanges('甲\r\n乙', '甲\n乙').added.length, 0);

const session = {
  id: 'session-1',
  turns: [{ question: '如何定位页面卡顿？', answer: '我通过采样发现耗时函数并拆分任务。' }],
  requirementFocuses: ['工程设计与稳定性'],
  feedback: '补充结果与验证方式',
  improvedAnswer: '未经用户确认的改写，声称性能提升 90%',
};
const imported = service.storyFromSession(session, 0);
assert.equal(imported.sourceAnswer, session.turns[0].answer);
assert.equal(imported.sourceQuestion, session.turns[0].question);
assert.equal(imported.requirement, '工程设计与稳定性');
assert.equal(service.storyCompletedFields(imported), 0);
assert.equal(imported.result, '');
assert.equal(service.storyFromSession(session, 0).id, imported.id);
assert.equal(service.storyFromSession(session, 1), undefined);
assert.equal(service.storyFromSession({ ...session, feedback: '' }, 0), undefined);
assert.equal(service.storyFromSession({ ...session, turns: [{ question: '问题', answer: ' ' }] }, 0), undefined);

restored.stories.push(imported);
const exported = service.exportText(restored, 'AI 应用开发实习生', '腾讯', '腾讯投递版');
assert.ok(exported.includes(record.resumeContent));
assert.ok(exported.includes(session.turns[0].answer));
assert.ok(exported.includes('结果：待补充'));
assert.ok(exported.includes('绑定投递版本：腾讯投递版'));
assert.ok(!exported.includes('90%'));

const complete = service.cloneRecord({ ...record, candidateName: '测试候选人', contact: 'candidate@example.com',
  resumeContent: '本科软件工程专业，本人负责鸿蒙客户端页面与组件开发，通过采样定位交互阻塞，拆分耗时任务并使用相同用例复核。' });
const version = { id: 'bound-v1', jobKey: complete.jobKey, content: complete.resumeContent, name: '实际投递版' };
assert.equal(service.canExportResume(complete, version, false), false);
const confirmed = service.confirmResume(complete, true);
assert.equal(service.isResumeConfirmed(confirmed), true);
assert.equal(complete.confirmedSignature, '');
assert.equal(service.canExportResume(confirmed, version, false), true);
assert.equal(service.canExportResume(confirmed, version, true), false);
assert.equal(service.canExportResume(confirmed, undefined, false), false);
assert.equal(service.canExportResume(confirmed, { ...version, jobKey: 'other-job' }, false), false);
assert.equal(service.canExportResume(confirmed, { ...version, content: '旧版正文' }, false), false);
assert.equal(service.isResumeConfirmed({ ...confirmed, resumeContent: `${complete.resumeContent} 新内容` }), false);
assert.equal(service.isResumeConfirmed({ ...confirmed, candidateName: '另一个人' }), false);
assert.equal(service.isResumeConfirmed({ ...confirmed, contact: 'new@example.com' }), false);
assert.equal(service.isResumeConfirmed({ ...confirmed, stories: [] }), true);
assert.equal(service.isResumeConfirmed(service.confirmResume(confirmed, false)), false);
assert.equal(service.canExportResume(service.confirmResume({ ...complete, updatedAt: '' }, true), version, false), false);
assert.equal(service.preflight({ ...complete, contact: '' }, version, false).find(check => check.id === 'contact').state, 'block');
assert.equal(service.preflight({ ...complete, contact: '', resumeContent: `${complete.resumeContent} 邮箱 candidate@example.com` }, version, false)
  .find(check => check.id === 'contact').state, 'pass');
assert.equal(service.preflight({ ...complete, resumeContent: `${complete.resumeContent} 项目名称待填写` }, version, false)
  .find(check => check.id === 'body').state, 'block');
assert.equal(service.preflight({ ...complete, resumeContent: '真实经历'.repeat(3001) }, version, false)
  .find(check => check.id === 'body').state, 'block');
assert.equal(service.canExportResume({ ...confirmed, stories: [{ id: 'incomplete', situation: '', task: '', action: '', result: '', evidence: '' }] }, version, false), true);
assert.equal(service.cloneRecord(JSON.parse(JSON.stringify(confirmed))).confirmedSignature, confirmed.confirmedSignature);

const layoutCompiled = buildSync({
  absWorkingDir: repoRoot,
  entryPoints: ['harmony/entry/src/main/ets/common/NativeResumeLayoutService.ets'],
  loader: { '.ets': 'ts' }, resolveExtensions: ['.ets', '.ts', '.js'], bundle: true,
  platform: 'node', format: 'cjs', write: false,
}).outputFiles[0].text;
const layoutModule = { exports: {} };
new Function('exports', 'module', 'require', layoutCompiled)(layoutModule.exports, layoutModule, require);
const layout = new layoutModule.exports.NativeResumeLayoutService();
const measure = (text, size, bold) => Array.from(text).reduce((width, character) =>
  width + size * (character.codePointAt(0) < 128 ? 0.6 : 1) * (bold ? 1.05 : 1), 0);
const longText = '负责鸿蒙客户端与 ArkTS 工程实现，通过测试报告记录个人行动、结果和验证方法。'.repeat(100);
const input = { name: complete.candidateName, contact: complete.contact, jobTitle: '鸿蒙应用开发实习生',
  content: `教育背景\n本科，软件工程专业\n\n项目经历\n${longText}\nhttps://example.com/${'longpath'.repeat(25)}` };
const pages = layout.layout(input, measure);
assert.ok(pages.length > 1);
const allLines = pages.flatMap(page => page.lines);
assert.equal(allLines.filter(line => longText.includes(line.text) && line.text.startsWith('负责')).length > 0, true);
assert.ok(allLines.filter(line => line.baseline > 28).map(line => line.text).join('').includes(longText));
assert.ok(!allLines.some(line => line.text.includes('面试原回答') || line.text.includes('孔明职配') || line.text.includes('绑定投递版本')));
for (const [index, page] of pages.entries()) {
  for (const line of page.lines) {
    assert.ok(line.baseline >= 28 && line.baseline < layout.height - 40);
    assert.ok(line.left >= layout.margin);
    assert.ok(line.left + measure(line.text, line.size, line.bold) <= layout.width - layout.margin + 0.01);
  }
  assert.equal(page.lines.at(-1).text, `${index + 1} / ${pages.length}`);
  const lastBodyLine = page.lines.at(-2);
  assert.ok(!['教育背景', '项目经历'].includes(lastBodyLine.text), 'section heading must not be orphaned');
}
const unicode = 'ArkTS 性能优化😀与工程验证'.repeat(80);
assert.equal(layout.wrap(unicode, 11, false, measure).join(''), unicode);
assert.equal(layout.wrap('https://example.com/' + 'x'.repeat(300), 11, false, measure).join(''), 'https://example.com/' + 'x'.repeat(300));
assert.throws(() => layout.wrap('正文', 11, false, () => NaN));
assert.throws(() => layout.wrap('正文', 11, false, () => 9999));
assert.throws(() => layout.layout({ ...input, content: '' }, measure));
assert.throws(() => layout.layout({ ...input, content: '甲'.repeat(12001) }, measure));
let longestMeasured = 0;
layout.wrap('甲'.repeat(12000), 11, false, (text, size, bold) => {
  longestMeasured = Math.max(longestMeasured, text.length);
  return measure(text, size, bold);
});
assert.ok(longestMeasured <= 64, 'wrapping should not repeatedly shape the entire long paragraph');
const projects = Array.from({ length: 18 }, (_, index) => `客户端工程验证案例 ${index + 1}\n` +
  '本人负责页面与组件实现，使用性能采样分析交互阻塞，拆分同步计算并设置取消机制，避免旧请求覆盖新结果。'.repeat(2)).join('\n\n');
for (const page of layout.layout({ ...input, content: projects }, measure)) {
  assert.ok(!page.lines.at(-2).text.startsWith('客户端工程验证案例'), 'project title must stay with its description');
}
console.log('Native job materials verification passed: isolation, restore, provenance, confirmation invalidation, version gates and multipage PDF layout.');
