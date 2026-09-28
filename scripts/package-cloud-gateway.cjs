const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { parseEnv } = require("node:util");

const repoRoot = path.resolve(__dirname, "..");
const deployRoot = path.join(repoRoot, "deploy", "gateway");
const outputRoot = path.join(repoRoot, "output", "cloud-gateway-20260928");
const temporaryRoot = path.join(repoRoot, "tmp");
fs.mkdirSync(outputRoot, { recursive: true });
fs.mkdirSync(temporaryRoot, { recursive: true });
const staging = fs.mkdtempSync(path.join(temporaryRoot, "cloud-gateway-"));

const sourceFiles = (directory, prefix = "") => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  if (entry.isSymbolicLink()) throw new Error("Deployment inputs must not contain symbolic links.");
  const relative = prefix ? prefix + "/" + entry.name : entry.name;
  if (entry.isDirectory()) return sourceFiles(path.join(directory, entry.name), relative);
  return entry.isFile() && entry.name.endsWith(".js") ? [relative] : [];
});
const inputs = sourceFiles(path.join(repoRoot, "server"))
  .map((file) => ({ source: path.join(repoRoot, "server", file), destination: "server/" + file }));
for (const file of ["package.json", "package-lock.json", "install.sh", "kongming-gateway.service", "gateway.env.example", "README.md"]) {
  inputs.push({ source: path.join(deployRoot, file), destination: file });
}
const localEnvPath = path.join(repoRoot, ".env.local");
const localEnv = fs.existsSync(localEnvPath) ? parseEnv(fs.readFileSync(localEnvPath, "utf8")) : {};
const privateValues = Object.entries(localEnv)
  .filter(([name, value]) => /(?:API_KEY|API_SECRET|API_PASSWORD|APP_ID)$/.test(name) && value.trim().length >= 6)
  .map(([, value]) => value.trim());
const checksums = [];
for (const input of inputs) {
  const content = fs.readFileSync(input.source);
  if (privateValues.some((value) => content.includes(value))) {
    throw new Error("Private credential detected in deployment input: " + input.destination);
  }
  const destination = path.join(staging, input.destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
  checksums.push(createHash("sha256").update(content).digest("hex") + "  " + input.destination);
}
fs.writeFileSync(path.join(staging, "SHA256SUMS"), checksums.sort().join("\n") + "\n");
const archive = path.join(outputRoot, "kongming-private-gateway.tgz");
execFileSync("tar", ["-czf", archive, "-C", staging, "server", "package.json", "package-lock.json", "install.sh", "kongming-gateway.service", "gateway.env.example", "README.md", "SHA256SUMS"], { stdio: "inherit" });
const archiveHash = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
fs.writeFileSync(archive + ".sha256", archiveHash + "  " + path.basename(archive) + "\n");
console.log("Private gateway bundle: " + archive);
console.log("Bytes: " + fs.statSync(archive).size + "; SHA256: " + archiveHash);
console.log("Only backend code and placeholder configuration included. Credentials, resumes, workspaces and HAP excluded.");
