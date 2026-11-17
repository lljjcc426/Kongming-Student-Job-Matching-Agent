import fs from "node:fs";
import path from "node:path";
import { backup } from "node:sqlite";
import { resolveAgentMemoryPath, initializeAgentMemoryStore, closeAgentMemoryStore } from "../server/agentMemoryCore.js";

const source = resolveAgentMemoryPath();
if (!fs.existsSync(source)) throw new Error("账号数据库尚未创建，未生成备份。");
const directory = path.resolve(process.env.AGENT_MEMORY_BACKUP_DIR || path.join(path.dirname(source), "backups"));
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const filename = `agent-memory-${new Date().toISOString().replace(/[-:.]/g, "")}.sqlite3`;
const target = path.join(directory, filename);
const database = initializeAgentMemoryStore();
// Keep operational metadata bounded; account and product records are unaffected.
database.prepare("DELETE FROM service_requests WHERE occurred_at < ?").run(new Date(Date.now() - 30 * 86_400_000).toISOString());
database.prepare("DELETE FROM admin_audit_events WHERE occurred_at < ?").run(new Date(Date.now() - 180 * 86_400_000).toISOString());
try {
  await backup(database, target);
  fs.chmodSync(target, 0o600);
} finally {
  closeAgentMemoryStore();
}

const cutoff = Date.now() - 14 * 86_400_000;
for (const name of fs.readdirSync(directory)) {
  if (/^agent-memory-\d{8}T\d{9}Z\.sqlite3$/.test(name)) {
    const file = path.join(directory, name);
    if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
  }
}
console.info(`[database] 已生成备份：${target}`);
