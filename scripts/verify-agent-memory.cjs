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
  const { closeAgentMemoryStore, resolveAgentMemoryPath, runAgentMemoryRequest: requestMemory } = await import(coreUrl);
  const runAgentMemoryRequest = (body) => requestMemory(body, { trustedUserId: true });
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

    const feedback = await runAgentMemoryRequest({
      action: "save-feedback",
      userId,
      messageId: "assistant-1",
      rating: "negative",
      correction: "我只考虑北京岗位，不接受销售方向。",
    });
    assert.equal(feedback.status, 200);
    assert.equal(feedback.payload.memory.feedback.length, 1);
    assert.equal(feedback.payload.memory.feedback[0].rating, "negative");
    assert.match(feedback.payload.memory.summary, /不接受销售方向/);

    closeAgentMemoryStore();
    const restoredFeedback = await runAgentMemoryRequest({ action: "load", userId });
    assert.equal(restoredFeedback.payload.memory.feedback[0].correction, "我只考虑北京岗位，不接受销售方向。");

    const invalidFeedback = await runAgentMemoryRequest({
      action: "save-feedback",
      userId,
      messageId: "missing-message",
      rating: "positive",
    });
    assert.equal(invalidFeedback.status, 404);

    const savedInterview = await runAgentMemoryRequest({
      action: "save-interview",
      userId,
      interview: {
        interviewId: "interview-memory-001",
        jobId: "llm-algorithm-intern",
        jobTitle: "大模型算法实习生",
        interviewType: "技术面",
        report: {
          modelTrack: "ai_algorithm",
          reportKind: "formal",
          overallScore: 61,
          confidenceScore: 68,
          coverageScore: 54,
          integrityEvaluation: { score: 94 },
          evidenceStats: {
            answerCount: 6,
            substantiveAnswers: 5,
            starEvidence: 3,
            quantifiedEvidence: 2,
          },
          summary: "算法基础已有部分证据，模型评测与工程部署需要继续复测。",
          dimensionReports: [
            { id: "algorithm-foundation", name: "算法与数学基础", weight: 20, score: 66, confidence: 72, status: "supported", attempts: 2, evidenceCount: 2 },
            { id: "ml-engineering", name: "机器学习工程与部署", weight: 18, score: 42, confidence: 58, status: "insufficient", attempts: 1, evidenceCount: 1 },
            { id: "data-experiment", name: "数据与实验设计", weight: 16, score: 0, confidence: 0, status: "untested", attempts: 0, evidenceCount: 0 },
          ],
        },
      },
    });
    assert.equal(savedInterview.status, 200);
    assert.equal(savedInterview.payload.memory.interviews.length, 1);
    assert.equal(savedInterview.payload.memory.interviews[0].reportKind, "formal");
    assert.equal(savedInterview.payload.memory.interviews[0].weakDimensions.length, 2);
    assert.equal(savedInterview.payload.memory.interviews[0].integrityScore, 94);
    assert.equal(savedInterview.payload.memory.interviews[0].evidenceStats.substantiveAnswers, 5);
    assert.equal(savedInterview.payload.memory.interviews[0].dimensions.length, 3);

    closeAgentMemoryStore();
    const restoredInterview = await runAgentMemoryRequest({ action: "load", userId });
    assert.equal(restoredInterview.payload.memory.interviews[0].jobTitle, "大模型算法实习生");
    assert.equal(restoredInterview.payload.memory.interviews[0].reportKind, "formal");
    assert.equal(restoredInterview.payload.memory.interviews[0].weakDimensions[0].name, "机器学习工程与部署");
    assert.equal(restoredInterview.payload.memory.interviews[0].dimensions[0].confidence, 72);

    const growthPlan = {
      id: "growth-verify-001",
      version: 1,
      targetJobTitle: "User Research Intern",
      gaps: [{ id: "gap-research", name: "Research" }],
      stages: [{ days: 30, unlocked: true }],
      tasks: [{ id: "week-1", completed: false, evidenceText: "" }],
    };
    const savedGrowth = await runAgentMemoryRequest({
      action: "save-growth",
      userId,
      plan: growthPlan,
    });
    assert.equal(savedGrowth.status, 200);
    assert.equal(savedGrowth.payload.plan.targetJobTitle, "User Research Intern");

    closeAgentMemoryStore();
    const restoredGrowth = await runAgentMemoryRequest({ action: "load-growth", userId });
    assert.equal(restoredGrowth.status, 200);
    assert.deepEqual(restoredGrowth.payload.plan.tasks, growthPlan.tasks);

    const invalidGrowth = await runAgentMemoryRequest({
      action: "save-growth",
      userId,
      plan: { version: 1 },
    });
    assert.equal(invalidGrowth.status, 400);

    const weakPassword = await requestMemory({
      action: "register",
      userId,
      nickname: "孔明验证用户",
      password: "123456",
    });
    assert.equal(weakPassword.status, 400);

    const registered = await requestMemory({
      action: "register",
      userId,
      nickname: "孔明验证用户",
      password: "safe-pass-2026",
    });
    assert.equal(registered.status, 200);
    assert.equal(registered.payload.identity.userId, userId);
    assert.equal(registered.payload.identity.authenticated, true);
    assert.match(registered.payload.recoveryCode, /^\d{6}$/);
    assert.ok(registered.sessionToken);
    const sessionContext = { sessionToken: registered.sessionToken };

    const memoryAfterBinding = await requestMemory({ action: "load", userId: "km_spoofed_other_user" }, sessionContext);
    assert.equal(memoryAfterBinding.payload.memory.messages.length, 2);
    const growthAfterBinding = await requestMemory({ action: "load-growth" }, sessionContext);
    assert.equal(growthAfterBinding.payload.plan.id, growthPlan.id);

    closeAgentMemoryStore();
    const identityStatus = await requestMemory({ action: "auth-status", userId }, sessionContext);
    assert.equal(identityStatus.status, 200);
    assert.equal(identityStatus.payload.identity.nickname, "孔明验证用户");
    assert.equal(identityStatus.payload.authenticated, true);

    const unauthorized = await requestMemory({ action: "load", userId });
    assert.equal(unauthorized.status, 401);

    const wrongPassword = await requestMemory({
      action: "login",
      nickname: "孔明验证用户",
      password: "wrong-password",
    });
    assert.equal(wrongPassword.status, 401);

    const loggedIn = await requestMemory({
      action: "login",
      nickname: "孔明验证用户",
      password: "safe-pass-2026",
    });
    assert.equal(loggedIn.status, 200);
    assert.ok(loggedIn.sessionToken);

    const wrongRecovery = await requestMemory({
      action: "recover-account",
      userId: "km_temporary_browser_001",
      nickname: "孔明验证用户",
      recoveryCode: "999999" === registered.payload.recoveryCode ? "888888" : "999999",
      password: "replacement-pass-2026",
    });
    assert.equal(wrongRecovery.status, 401);

    const restoredIdentity = await requestMemory({
      action: "recover-account",
      userId: "km_temporary_browser_001",
      nickname: "孔明验证用户",
      recoveryCode: registered.payload.recoveryCode,
      password: "replacement-pass-2026",
    });
    assert.equal(restoredIdentity.status, 200);
    assert.equal(restoredIdentity.payload.identity.userId, userId);
    assert.ok(restoredIdentity.sessionToken);

    const duplicateNickname = await requestMemory({
      action: "register",
      userId: "km_second_identity_001",
      nickname: "孔明验证用户",
      password: "another-safe-pass",
    });
    assert.equal(duplicateNickname.status, 409);

    const recoveredSession = { sessionToken: restoredIdentity.sessionToken };
    const oldSessionInvalidated = await requestMemory({ action: "load" }, sessionContext);
    assert.equal(oldSessionInvalidated.status, 401);

    const cleared = await requestMemory({ action: "clear" }, recoveredSession);
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.payload.memory.messages, []);
    assert.deepEqual(cleared.payload.memory.feedback, []);
    assert.deepEqual(cleared.payload.memory.interviews, []);
    assert.equal(cleared.payload.memory.summary, "");
    const clearedGrowth = await requestMemory({ action: "load-growth" }, recoveredSession);
    assert.equal(clearedGrowth.payload.plan, null);
    const identityAfterClear = await requestMemory({ action: "auth-status" }, recoveredSession);
    assert.equal(identityAfterClear.payload.identity.registered, true);
    assert.equal(identityAfterClear.payload.identity.nickname, "孔明验证用户");

    const demoLogin = await requestMemory({ action: "login-demo" });
    assert.equal(demoLogin.status, 200);
    assert.equal(demoLogin.payload.identity.accountKind, "demo");
    const demoMemory = await requestMemory({ action: "load" }, { sessionToken: demoLogin.sessionToken });
    assert.deepEqual(demoMemory.payload.memory.messages, []);

    const logout = await requestMemory({ action: "logout" }, recoveredSession);
    assert.equal(logout.status, 200);
    assert.equal(logout.clearSession, true);
    const afterLogout = await requestMemory({ action: "load" }, recoveredSession);
    assert.equal(afterLogout.status, 401);
    console.log("[智能体记忆] 写入、密码认证、会话隔离、恢复、演示账号、重启恢复与清除验证通过");
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
