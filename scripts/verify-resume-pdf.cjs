const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { PDFDocument } = require('pdf-lib');

const root = path.resolve(__dirname, '..');
const fontPath = process.argv[2];
if (!fontPath) throw new Error('Pass the path to a CJK font from the test device.');
const output = path.join(root, 'tmp/pdfs/native-resume');
fs.mkdirSync(output, { recursive: true });
const compiled = buildSync({
  absWorkingDir: root, entryPoints: ['scripts/resume-pdf-engine.js'],
  loader: { '.ets': 'ts' }, resolveExtensions: ['.ets', '.ts', '.js'],
  bundle: true, platform: 'node', format: 'cjs', write: false,
}).outputFiles[0].text;
const compiledModule = { exports: {} };
new Function('exports', 'module', 'require', compiled)(compiledModule.exports, compiledModule, require);
const font = fs.readFileSync(fontPath);
const fontBytes = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);
const input = {
  name: '测试候选人', contact: 'candidate@example.com', jobTitle: '鸿蒙应用开发实习生',
  content: '教育背景\n本科，软件工程专业\n\n项目经历\n' +
    Array.from({ length: 18 }, (_, index) => `项目 ${index + 1}：` +
      '负责鸿蒙客户端与 ArkTS 工程实现，通过测试报告记录个人行动、结果和验证方法。'.repeat(3)).join('\n\n') +
    '\n\n材料末尾核对标记：完整保留。',
};

(async () => {
  const result = await compiledModule.exports.buildResumePdf(fontBytes, input);
  assert.ok(result.bytes.byteLength > 1000);
  const document = await PDFDocument.load(result.bytes);
  assert.equal(document.getTitle(), `${input.name} - ${input.jobTitle}`);
  assert.equal(document.getAuthor(), input.name);
  assert.equal(document.getPageCount(), result.pages.length);
  assert.ok(result.pages.length >= 2);
  const text = result.pages.flatMap(page => page.lines).map(line => line.text).join('');
  assert.ok(text.includes('材料末尾核对标记：完整保留。'));
  assert.ok(!/待补充|面试原回答|投递版本|孔明职配/.test(text));
  for (const page of document.getPages()) {
    assert.equal(page.getWidth(), 595.28);
    assert.equal(page.getHeight(), 841.89);
  }
  await assert.rejects(compiledModule.exports.buildResumePdf(fontBytes, { ...input, content: '甲'.repeat(12001) }));
  await assert.rejects(compiledModule.exports.buildResumePdf(fontBytes, { ...input, content: '' }));
  await assert.rejects(compiledModule.exports.buildResumePdf(fontBytes, { ...input, content: `${input.content}\u{10FFFF}` }),
    /FONT_UNSUPPORTED_CHAR/);
  fs.writeFileSync(path.join(output, 'engine-test.pdf'), Buffer.from(result.bytes));
  fs.writeFileSync(path.join(output, 'engine-test-layout.json'), JSON.stringify(result.pages));
  console.log(`Resume PDF engine verified: A4, ${result.pages.length} pages, Chinese font, metadata, content isolation and glyph gate.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
