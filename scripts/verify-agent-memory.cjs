const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const TEMP_ROOT = "D:\\CodexTemp";
if (!fs.existsSync("D:\\")) {
  throw new Error("D 盘不可用，无法按项目约定验证智能体记忆。");
}
fs.mkdirSync(TEMP_ROOT, { recursive: true });
const testDirectory = fs.mkdtempSync(path.join(TEMP_ROOT, "kongming-agent-memory-"));
process.env.AGENT_MEMORY_DB_PATH = path.join(testDirectory, "agent-memory.sqlite3");
process.env.AGENT_MEMORY_MAX_MESSAGES = "20";
process.env.AGENT_MEMORY_RETENTION_DAYS = "180";

const coreUrl = pathToFileURL(path.resolve("server/agentMemoryCore.js")).href;

async function main() {
  const { closeAgentMemoryStore, resolveAgentMemoryPath, runAgentMemoryRequest } = await import(coreUrl);
  const userId = "km_verify_agent_memory_001";

  try {
    assert.equal(resolveAgentMemoryPath(), process.env.AGENT_MEMORY_DB_PATH);

    const empty = await runAgentMemoryRequest({ action: "load", userId });
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.payload.memory.messages, []);

    const saved = await runAgentMemoryRequest({
      action: "save",
      userId,
      messages: [
        { id: "user-1", role: "user", content: "我希望在北京寻找大模型算法实习。" },
        { id: "assistant-1", role: "assistant", content: "我会结合你的简历和目标岗位持续提供建议。" },
      ],
      context: {
        resumeProfile: {
          targetRoles: ["大模型算法实习生"],
          skills: ["Python", "RAG"],
        },
        targetJob: { title: "大模型算法实习生", city: "北京" },
        matchResult: { total: 78, verdict: "补强后投递", missingKeywords: ["模型评测"] },
      },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.payload.memory.messages.length, 2);
    assert.match(saved.payload.memory.summary, /大模型算法实习生/);
    assert.match(saved.payload.memory.summary, /模型评测/);
    assert.ok(fs.existsSync(process.env.AGENT_MEMORY_DB_PATH));

    closeAgentMemoryStore();
    const restored = await runAgentMemoryRequest({ action: "load", userId });
    assert.equal(restored.payload.memory.messages[0].content, "我希望在北京寻找大模型算法实习。");
    assert.equal(restored.payload.memory.targetJob.city, "北京");

    const cleared = await runAgentMemoryRequest({ action: "clear", userId });
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.payload.memory.messages, []);
    assert.equal(cleared.payload.memory.summary, "");
    console.log("[智能体记忆] 写入、重启恢复、结构化上下文与清除验证通过");
    console.log(`[智能体记忆] 测试数据库位于 D 盘临时目录：${testDirectory}`);
  } finally {
    closeAgentMemoryStore();
    const resolved = path.resolve(testDirectory);
    if (!resolved.startsWith(`${path.resolve(TEMP_ROOT)}${path.sep}`)) {
      throw new Error(`拒绝清理非测试目录：${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[智能体记忆] 验证失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
