const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const roots = [
  path.join(repoRoot, "src"),
  path.join(repoRoot, "harmony", "entry", "src", "main", "resources", "resfile", "assets"),
];
const forbidden = [
  /abilityScore/,
  /experienceScore/,
  /interestScore/,
  /growthScore/,
  /total\s*>=\s*82/,
  /total\s*>=\s*68/,
  /resumeText\.length\s*>\s*120/,
  /五维匹配/,
  /成长潜力/,
];
const inspected = [];
const failures = [];

function walk(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/\.(?:ts|tsx|js|mjs|css|html)$/.test(entry.name)) inspected.push(fullPath);
  }
}

roots.forEach(walk);
for (const file of inspected) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) failures.push(`${path.relative(repoRoot, file)} -> ${pattern}`);
  }
}

if (failures.length) {
  console.error("Legacy score claims remain:\n" + failures.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, inspectedFiles: inspected.length, forbiddenPatterns: forbidden.length }, null, 2));
