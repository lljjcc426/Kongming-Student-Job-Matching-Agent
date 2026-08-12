import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readBoundedIntegerEnv } from "./runtimeConfig.js";

const DEFAULT_WINDOWS_ROOT = "D:\\Kongming-Memory";
const DEFAULT_OTHER_ROOT = path.resolve("data", "agent-memory");
const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const MAX_MESSAGE_CHARS = 6000;
const MAX_FEEDBACK_CORRECTION_CHARS = 1000;
const MAX_CONTEXT_CHARS = 120_000;
const MAX_GROWTH_PLAN_CHARS = 500_000;
const MIN_NICKNAME_CHARS = 2;
const MAX_NICKNAME_CHARS = 24;
const DEFAULT_MAX_MESSAGES = 120;
const DEFAULT_RETENTION_DAYS = 180;

let database;
let databasePath = "";

const nowIso = () => new Date().toISOString();

const memoryRoot = () => {
  if (process.env.AGENT_MEMORY_DATA_ROOT) {
    return path.resolve(process.env.AGENT_MEMORY_DATA_ROOT);
  }
  return process.platform === "win32" ? DEFAULT_WINDOWS_ROOT : DEFAULT_OTHER_ROOT;
};

export const resolveAgentMemoryPath = () =>
  path.resolve(
    process.env.AGENT_MEMORY_DB_PATH
      || path.join(memoryRoot(), "agent-memory.sqlite3"),
  );

const maxMessages = () => readBoundedIntegerEnv(
  "AGENT_MEMORY_MAX_MESSAGES",
  DEFAULT_MAX_MESSAGES,
  { minimum: 20, maximum: 500 },
);

const retentionDays = () => readBoundedIntegerEnv(
  "AGENT_MEMORY_RETENTION_DAYS",
  DEFAULT_RETENTION_DAYS,
  { minimum: 1, maximum: 3650 },
);

const openDatabase = () => {
  const nextPath = resolveAgentMemoryPath();
  if (database && databasePath === nextPath) return database;
  if (database) database.close();

  fs.mkdirSync(path.dirname(nextPath), { recursive: true });
  database = new DatabaseSync(nextPath);
  databasePath = nextPath;
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA secure_delete = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS agent_memory_profiles (
      user_id TEXT PRIMARY KEY,
      resume_profile_json TEXT NOT NULL DEFAULT '{}',
      target_job_json TEXT NOT NULL DEFAULT '{}',
      match_result_json TEXT NOT NULL DEFAULT '{}',
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_memory_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, message_id),
      FOREIGN KEY(user_id) REFERENCES agent_memory_profiles(user_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_memory_messages_user_id
      ON agent_memory_messages(user_id, id DESC);

    CREATE TABLE IF NOT EXISTS agent_memory_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      rating TEXT NOT NULL CHECK(rating IN ('positive', 'negative')),
      correction TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, message_id),
      FOREIGN KEY(user_id, message_id)
        REFERENCES agent_memory_messages(user_id, message_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_memory_feedback_user_id
      ON agent_memory_feedback(user_id, id DESC);

    CREATE TABLE IF NOT EXISTS career_growth_plans (
      user_id TEXT PRIMARY KEY,
      plan_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES agent_memory_profiles(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_accounts (
      user_id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
      recovery_salt TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES agent_memory_profiles(user_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_accounts_nickname
      ON agent_accounts(nickname COLLATE NOCASE);
  `);
  return database;
};

const parseJson = (value, fallback = {}) => {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const boundedJson = (value) => {
  if (!value || typeof value !== "object") return "{}";
  const serialized = JSON.stringify(value);
  return serialized.length <= MAX_CONTEXT_CHARS ? serialized : "{}";
};

const validateUserId = (value) =>
  typeof value === "string" && USER_ID_PATTERN.test(value) ? value : "";

const sanitizeNickname = (value) => {
  if (typeof value !== "string") return "";
  const nickname = value.trim().replace(/\s+/g, " ");
  const length = Array.from(nickname).length;
  if (length < MIN_NICKNAME_CHARS || length > MAX_NICKNAME_CHARS) return "";
  return /[\u0000-\u001f\u007f]/.test(nickname) ? "" : nickname;
};

const recoveryCodeHash = (recoveryCode, salt) =>
  scryptSync(recoveryCode, salt, 32).toString("hex");

const createRecoverySecret = () => {
  const recoveryCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  return { recoveryCode, salt, hash: recoveryCodeHash(recoveryCode, salt) };
};

const verifyRecoveryCode = (recoveryCode, salt, expectedHash) => {
  if (!/^\d{6}$/.test(recoveryCode)) return false;
  const actual = Buffer.from(recoveryCodeHash(recoveryCode, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const sanitizeMessage = (message) => {
  if (!message || typeof message !== "object") return null;
  const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : "";
  const content = typeof message.content === "string"
    ? message.content.trim().slice(0, MAX_MESSAGE_CHARS)
    : "";
  const id = typeof message.id === "string"
    ? message.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)
    : "";
  if (!role || !content || !id) return null;
  return { id, role, content };
};

const listMessages = (db, userId, limit = maxMessages()) =>
  db.prepare(`
    SELECT message_id AS id, role, content, created_at AS createdAt
    FROM agent_memory_messages
    WHERE user_id = ?
    ORDER BY agent_memory_messages.id DESC
    LIMIT ?
  `).all(userId, limit).reverse();

const listFeedback = (db, userId, limit = 20) =>
  db.prepare(`
    SELECT feedback.message_id AS messageId,
           feedback.rating,
           feedback.correction,
           feedback.created_at AS createdAt,
           feedback.updated_at AS updatedAt,
           SUBSTR(messages.content, 1, 500) AS responseExcerpt
    FROM agent_memory_feedback AS feedback
    JOIN agent_memory_messages AS messages
      ON messages.user_id = feedback.user_id
     AND messages.message_id = feedback.message_id
    WHERE feedback.user_id = ?
    ORDER BY feedback.id DESC
    LIMIT ?
  `).all(userId, limit).reverse();

const buildSummary = (profile, target, match, messages, feedback = []) => {
  const segments = [];
  const targetRoles = Array.isArray(profile?.targetRoles) ? profile.targetRoles.slice(0, 3) : [];
  const skills = Array.isArray(profile?.skills) ? profile.skills.slice(0, 6) : [];
  const targetTitle = typeof target?.title === "string" ? target.title : "";
  const targetCity = typeof target?.city === "string" ? target.city : "";
  const verdict = typeof match?.verdict === "string" ? match.verdict : "";
  const total = Number.isFinite(match?.total) ? Math.round(match.total) : null;
  const missingKeywords = Array.isArray(match?.missingKeywords)
    ? match.missingKeywords.slice(0, 5)
    : [];

  if (targetRoles.length) segments.push(`求职方向：${targetRoles.join("、")}`);
  if (skills.length) segments.push(`主要技能：${skills.join("、")}`);
  if (targetTitle) segments.push(`当前目标岗位：${targetTitle}${targetCity ? `（${targetCity}）` : ""}`);
  if (verdict || total !== null) segments.push(`最近匹配结论：${verdict || "待判断"}${total !== null ? `，${total}分` : ""}`);
  if (missingKeywords.length) segments.push(`待补能力：${missingKeywords.join("、")}`);

  const recentGoals = messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.content.replace(/\s+/g, " ").slice(0, 160));
  if (recentGoals.length) segments.push(`近期关注：${recentGoals.join("；")}`);
  const corrections = feedback
    .filter((item) => item.rating === "negative" && item.correction)
    .slice(-3)
    .map((item) => item.correction.replace(/\s+/g, " ").slice(0, 180));
  if (corrections.length) segments.push(`用户纠正：${corrections.join("；")}`);
  return segments.join("\n").slice(0, 1800);
};

const ensureProfile = (db, userId) => {
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO agent_memory_profiles (user_id, created_at, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO NOTHING
  `).run(userId, timestamp, timestamp);
};

const identityPayload = (db, userId) => {
  const account = db.prepare(`
    SELECT nickname, created_at AS createdAt, updated_at AS updatedAt
    FROM agent_accounts
    WHERE user_id = ?
  `).get(userId);
  return {
    ok: true,
    identity: account
      ? { userId, nickname: account.nickname, registered: true, ...account }
      : { userId, nickname: "", registered: false },
  };
};

const createIdentity = (db, userId, body) => {
  const nickname = sanitizeNickname(body.nickname);
  if (!nickname) {
    return {
      status: 400,
      payload: { ok: false, error: `昵称需为 ${MIN_NICKNAME_CHARS}-${MAX_NICKNAME_CHARS} 个字符。` },
    };
  }

  const occupied = db.prepare(`
    SELECT user_id
    FROM agent_accounts
    WHERE nickname = ? COLLATE NOCASE AND user_id <> ?
  `).get(nickname, userId);
  if (occupied) {
    return { status: 409, payload: { ok: false, error: "该昵称已被使用，请换一个昵称。" } };
  }

  ensureProfile(db, userId);
  const secret = createRecoverySecret();
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO agent_accounts (
      user_id, nickname, recovery_salt, recovery_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      nickname = excluded.nickname,
      recovery_salt = excluded.recovery_salt,
      recovery_hash = excluded.recovery_hash,
      updated_at = excluded.updated_at
  `).run(userId, nickname, secret.salt, secret.hash, timestamp, timestamp);

  return {
    status: 200,
    payload: {
      ...identityPayload(db, userId),
      recoveryCode: secret.recoveryCode,
      recoveryCodeIssuedAt: timestamp,
    },
  };
};

const restoreIdentity = (db, body) => {
  const nickname = sanitizeNickname(body.nickname);
  const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode.trim() : "";
  if (!nickname || !/^\d{6}$/.test(recoveryCode)) {
    return { status: 400, payload: { ok: false, error: "请输入昵称和 6 位恢复码。" } };
  }

  const account = db.prepare(`
    SELECT user_id AS userId, nickname, recovery_salt AS recoverySalt,
           recovery_hash AS recoveryHash, created_at AS createdAt, updated_at AS updatedAt
    FROM agent_accounts
    WHERE nickname = ? COLLATE NOCASE
  `).get(nickname);
  if (
    !account
    || !verifyRecoveryCode(recoveryCode, account.recoverySalt, account.recoveryHash)
  ) {
    return { status: 401, payload: { ok: false, error: "昵称或恢复码不正确。" } };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      identity: {
        userId: account.userId,
        nickname: account.nickname,
        registered: true,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    },
  };
};

const pruneMessages = (db, userId) => {
  const keep = maxMessages();
  db.prepare(`
    DELETE FROM agent_memory_messages
    WHERE user_id = ?
      AND id NOT IN (
        SELECT id FROM agent_memory_messages
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?
      )
  `).run(userId, userId, keep);

  const cutoff = new Date(Date.now() - retentionDays() * 86_400_000).toISOString();
  db.prepare(`
    DELETE FROM agent_memory_messages
    WHERE user_id = ? AND created_at < ?
  `).run(userId, cutoff);
};

const memoryPayload = (db, userId) => {
  const profileRow = db.prepare(`
    SELECT resume_profile_json, target_job_json, match_result_json,
           summary, created_at, updated_at
    FROM agent_memory_profiles
    WHERE user_id = ?
  `).get(userId);

  if (!profileRow) {
    return {
      ok: true,
      userId,
      memory: {
        messages: [],
        feedback: [],
        resumeProfile: {},
        targetJob: {},
        matchResult: {},
        summary: "",
        updatedAt: null,
      },
    };
  }

  return {
    ok: true,
    userId,
    memory: {
      messages: listMessages(db, userId),
      feedback: listFeedback(db, userId),
      resumeProfile: parseJson(profileRow.resume_profile_json),
      targetJob: parseJson(profileRow.target_job_json),
      matchResult: parseJson(profileRow.match_result_json),
      summary: profileRow.summary,
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    },
  };
};

const saveMemory = (db, userId, body) => {
  ensureProfile(db, userId);
  const existing = db.prepare(`
    SELECT resume_profile_json, target_job_json, match_result_json
    FROM agent_memory_profiles
    WHERE user_id = ?
  `).get(userId);
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const profileJson = Object.hasOwn(context, "resumeProfile")
    ? boundedJson(context.resumeProfile)
    : existing.resume_profile_json;
  const targetJson = Object.hasOwn(context, "targetJob")
    ? boundedJson(context.targetJob)
    : existing.target_job_json;
  const matchJson = Object.hasOwn(context, "matchResult")
    ? boundedJson(context.matchResult)
    : existing.match_result_json;

  const incomingMessages = Array.isArray(body.messages)
    ? body.messages.map(sanitizeMessage).filter(Boolean).slice(0, 20)
    : [];
  const insertMessage = db.prepare(`
    INSERT INTO agent_memory_messages (user_id, message_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, message_id) DO UPDATE SET
      role = excluded.role,
      content = excluded.content
  `);
  for (const message of incomingMessages) {
    insertMessage.run(userId, message.id, message.role, message.content, nowIso());
  }

  pruneMessages(db, userId);
  const messages = listMessages(db, userId);
  const feedback = listFeedback(db, userId);
  const summary = buildSummary(
    parseJson(profileJson),
    parseJson(targetJson),
    parseJson(matchJson),
    messages,
    feedback,
  );
  db.prepare(`
    UPDATE agent_memory_profiles
    SET resume_profile_json = ?, target_job_json = ?, match_result_json = ?,
        summary = ?, updated_at = ?
    WHERE user_id = ?
  `).run(profileJson, targetJson, matchJson, summary, nowIso(), userId);

  return memoryPayload(db, userId);
};

const saveFeedback = (db, userId, body) => {
  const messageId = typeof body.messageId === "string"
    ? body.messageId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)
    : "";
  const rating = body.rating === "positive" || body.rating === "negative"
    ? body.rating
    : "";
  const correction = rating === "negative" && typeof body.correction === "string"
    ? body.correction.trim().slice(0, MAX_FEEDBACK_CORRECTION_CHARS)
    : "";
  if (!messageId || !rating) {
    return { status: 400, payload: { ok: false, error: "反馈内容不合法。" } };
  }

  const assistantMessage = db.prepare(`
    SELECT message_id
    FROM agent_memory_messages
    WHERE user_id = ? AND message_id = ? AND role = 'assistant'
  `).get(userId, messageId);
  if (!assistantMessage) {
    return { status: 404, payload: { ok: false, error: "找不到对应的 AI 回答。" } };
  }

  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO agent_memory_feedback (
      user_id, message_id, rating, correction, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, message_id) DO UPDATE SET
      rating = excluded.rating,
      correction = excluded.correction,
      updated_at = excluded.updated_at
  `).run(userId, messageId, rating, correction, timestamp, timestamp);

  const profileRow = db.prepare(`
    SELECT resume_profile_json, target_job_json, match_result_json
    FROM agent_memory_profiles
    WHERE user_id = ?
  `).get(userId);
  const summary = buildSummary(
    parseJson(profileRow.resume_profile_json),
    parseJson(profileRow.target_job_json),
    parseJson(profileRow.match_result_json),
    listMessages(db, userId),
    listFeedback(db, userId),
  );
  db.prepare(`
    UPDATE agent_memory_profiles
    SET summary = ?, updated_at = ?
    WHERE user_id = ?
  `).run(summary, timestamp, userId);
  return { status: 200, payload: memoryPayload(db, userId) };
};

const growthPlanPayload = (db, userId) => {
  const row = db.prepare(`
    SELECT plan_json, created_at AS createdAt, updated_at AS updatedAt
    FROM career_growth_plans
    WHERE user_id = ?
  `).get(userId);
  return {
    ok: true,
    userId,
    plan: row ? parseJson(row.plan_json, null) : null,
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
};

const saveGrowthPlan = (db, userId, body) => {
  if (!body.plan || typeof body.plan !== "object") {
    return { status: 400, payload: { ok: false, error: "成长计划格式不正确。" } };
  }
  if (
    body.plan.version !== 1
    || typeof body.plan.id !== "string"
    || typeof body.plan.targetJobTitle !== "string"
    || !Array.isArray(body.plan.gaps)
    || !Array.isArray(body.plan.stages)
    || !Array.isArray(body.plan.tasks)
    || !body.plan.tasks.length
  ) {
    return { status: 400, payload: { ok: false, error: "成长计划缺少必要字段。" } };
  }
  const serialized = JSON.stringify(body.plan);
  if (serialized.length > MAX_GROWTH_PLAN_CHARS) {
    return { status: 413, payload: { ok: false, error: "成长计划内容过大。" } };
  }
  ensureProfile(db, userId);
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO career_growth_plans (user_id, plan_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan_json = excluded.plan_json,
      updated_at = excluded.updated_at
  `).run(userId, serialized, timestamp, timestamp);
  return { status: 200, payload: growthPlanPayload(db, userId) };
};

export const runAgentMemoryRequest = async (body = {}) => {
  const userId = validateUserId(body.userId);
  if (!userId) {
    return { status: 400, payload: { ok: false, error: "记忆用户标识不合法。" } };
  }

  try {
    const db = openDatabase();
    if (body.action === "load") {
      return { status: 200, payload: memoryPayload(db, userId) };
    }
    if (body.action === "save") {
      return { status: 200, payload: saveMemory(db, userId, body) };
    }
    if (body.action === "save-feedback") {
      return saveFeedback(db, userId, body);
    }
    if (body.action === "load-growth") {
      return { status: 200, payload: growthPlanPayload(db, userId) };
    }
    if (body.action === "save-growth") {
      return saveGrowthPlan(db, userId, body);
    }
    if (body.action === "identity-status") {
      return { status: 200, payload: identityPayload(db, userId) };
    }
    if (body.action === "create-identity") {
      return createIdentity(db, userId, body);
    }
    if (body.action === "restore-identity") {
      return restoreIdentity(db, body);
    }
    if (body.action === "clear") {
      const registered = db.prepare(`
        SELECT 1 FROM agent_accounts WHERE user_id = ?
      `).get(userId);
      if (registered) {
        db.prepare("DELETE FROM agent_memory_messages WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM career_growth_plans WHERE user_id = ?").run(userId);
        db.prepare(`
          UPDATE agent_memory_profiles
          SET resume_profile_json = '{}', target_job_json = '{}',
              match_result_json = '{}', summary = '', updated_at = ?
          WHERE user_id = ?
        `).run(nowIso(), userId);
      } else {
        db.prepare("DELETE FROM agent_memory_profiles WHERE user_id = ?").run(userId);
      }
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      return { status: 200, payload: memoryPayload(db, userId) };
    }
    return { status: 400, payload: { ok: false, error: "不支持的记忆操作。" } };
  } catch (error) {
    console.error("[agent-memory]", error);
    return {
      status: 500,
      payload: { ok: false, error: "智能体记忆服务暂不可用。" },
    };
  }
};

export const closeAgentMemoryStore = () => {
  if (!database) return;
  database.close();
  database = undefined;
  databasePath = "";
};
