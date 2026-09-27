const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
buildSync({
  absWorkingDir: root,
  entryPoints: ['scripts/resume-pdf-engine.js'],
  outfile: 'harmony/entry/src/main/ets/vendor/ResumePdfEngine.js',
  bundle: true, platform: 'browser', format: 'esm', target: 'es2020', minify: true,
  loader: { '.ets': 'ts' }, resolveExtensions: ['.ets', '.ts', '.js'], legalComments: 'eof',
});
const directory = path.join(root, 'harmony/entry/src/main/resources/rawfile/licenses');
fs.mkdirSync(directory, { recursive: true });
const libraries = ['pdf-lib', '@pdf-lib/fontkit', '@pdf-lib/standard-fonts', '@pdf-lib/upng', 'pako', 'tslib'];
const licenses = libraries.map(name => {
  const folder = path.join(root, 'node_modules', name);
  const files = fs.readdirSync(folder).filter(file => /^(?:licen[cs]e|copyrightnotice)(?:\.|$)/i.test(file));
  if (!files.length && name === '@pdf-lib/fontkit') {
    return fs.readFileSync(path.join(root, 'scripts/assets/licenses/pdf-lib-fontkit.txt'), 'utf8');
  }
  if (!files.length) throw new Error(`Missing license for ${name}`);
  return `${name}\n\n${files.map(file => fs.readFileSync(path.join(folder, file), 'utf8')).join('\n\n')}`;
});
fs.writeFileSync(path.join(directory, 'resume-pdf.txt'), licenses.join('\n\n--------------------\n\n'));
console.log('Offline native resume PDF engine built with bundled licenses.');
