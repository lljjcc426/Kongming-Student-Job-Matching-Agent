import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
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
const MIN_PASSWORD_CHARS = 8;
const MAX_PASSWORD_CHARS = 128;
const SESSION_TTL_MS = 30 * 86_400_000;
const DEMO_USER_ID = "km_demo_account_001";
const DEMO_NICKNAME = "demo";
const DEMO_PASSWORD = "123456";
export const AUTH_SESSION_COOKIE = "km_session";
const DEFAULT_MAX_MESSAGES = 120;
const DEFAULT_RETENTION_DAYS = 180;

let database;
let databasePath = "";
const authFailures = new Map();

const nowIso = () => new Date().toISOString();

const authFailureKey = (kind, nickname) => `${kind}:${nickname.toLocaleLowerCase("zh-CN")}`;
const authThrottle = (kind, nickname) => {
  const key = authFailureKey(kind, nickname);
  const state = authFailures.get(key);
  if (!state || state.resetAt <= Date.now()) {
    authFailures.delete(key);
    return false;
  }
  return state.count >= 5;
};
const recordAuthFailure = (kind, nickname) => {
  const key = authFailureKey(kind, nickname);
  const current = authFailures.get(key);
  authFailures.set(key, {
    count: current && current.resetAt > Date.now() ? current.count + 1 : 1,
    resetAt: Date.now() + 5 * 60_000,
  });
};
const clearAuthFailures = (kind, nickname) => authFailures.delete(authFailureKey(kind, nickname));

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
      password_salt TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      account_kind TEXT NOT NULL DEFAULT 'user' CHECK(account_kind IN ('user', 'demo')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES agent_memory_profiles(user_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_accounts_nickname
      ON agent_accounts(nickname COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS agent_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES agent_accounts(user_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id
      ON agent_sessions(user_id, expires_at);
  `);
  const accountColumns = new Set(
    database.prepare("PRAGMA table_info(agent_accounts)").all().map((column) => column.name),
  );
  if (!accountColumns.has("password_salt")) {
    database.exec("ALTER TABLE agent_accounts ADD COLUMN password_salt TEXT NOT NULL DEFAULT '';");
  }
  if (!accountColumns.has("password_hash")) {
    database.exec("ALTER TABLE agent_accounts ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';");
  }
  if (!accountColumns.has("account_kind")) {
    database.exec("ALTER TABLE agent_accounts ADD COLUMN account_kind TEXT NOT NULL DEFAULT 'user';");
  }
  ensureDemoAccount(database);
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

const sanitizePassword = (value, { allowDemo = false } = {}) => {
  if (typeof value !== "string") return "";
  const length = Array.from(value).length;
  if (allowDemo && value === DEMO_PASSWORD) return value;
  if (length < MIN_PASSWORD_CHARS || length > MAX_PASSWORD_CHARS) return "";
  if (["123456", "12345678", "password", "qwerty123", "11111111"].includes(value.toLowerCase())) return "";
  return value;
};

const passwordHash = (password, salt) =>
  scryptSync(password, salt, 64).toString("hex");

const createPasswordSecret = (password) => {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: passwordHash(password, salt) };
};

const verifyPassword = (password, salt, expectedHash) => {
  if (!password || !salt || !expectedHash) return false;
  const actual = Buffer.from(passwordHash(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const sessionTokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");

const createSession = (db, userId) => {
  const token = randomBytes(32).toString("base64url");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("DELETE FROM agent_sessions WHERE expires_at <= ?").run(createdAt);
  db.prepare(`
    INSERT INTO agent_sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionTokenHash(token), userId, createdAt, expiresAt);
  return { token, expiresAt };
};

const sessionAccount = (db, token) => {
  if (typeof token !== "string" || token.length < 32) return null;
  const account = db.prepare(`
    SELECT accounts.user_id AS userId, accounts.nickname,
           accounts.password_hash AS passwordHash,
           accounts.account_kind AS accountKind,
           accounts.created_at AS createdAt, accounts.updated_at AS updatedAt,
           sessions.expires_at AS sessionExpiresAt
    FROM agent_sessions AS sessions
    JOIN agent_accounts AS accounts ON accounts.user_id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(sessionTokenHash(token), nowIso());
  return account ?? null;
};

const revokeSession = (db, token) => {
  if (typeof token !== "string" || token.length < 32) return;
  db.prepare("DELETE FROM agent_sessions WHERE token_hash = ?").run(sessionTokenHash(token));
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

const ensureDemoAccount = (db) => {
  const existing = db.prepare("SELECT user_id FROM agent_accounts WHERE user_id = ?").get(DEMO_USER_ID);
  if (existing) return;
  const nicknameOwner = db.prepare("SELECT user_id FROM agent_accounts WHERE nickname = ? COLLATE NOCASE").get(DEMO_NICKNAME);
  if (nicknameOwner) return;
  ensureProfile(db, DEMO_USER_ID);
  const recovery = createRecoverySecret();
  const password = createPasswordSecret(DEMO_PASSWORD);
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO agent_accounts (
      user_id, nickname, recovery_salt, recovery_hash,
      password_salt, password_hash, account_kind, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'demo', ?, ?)
  `).run(
    DEMO_USER_ID,
    DEMO_NICKNAME,
    recovery.salt,
    recovery.hash,
    password.salt,
    password.hash,
    timestamp,
    timestamp,
  );
};

const identityPayload = (db, userId) => {
  const account = db.prepare(`
    SELECT nickname, password_hash AS passwordHash, account_kind AS accountKind,
           created_at AS createdAt, updated_at AS updatedAt
    FROM agent_accounts
    WHERE user_id = ?
  `).get(userId);
  return {
    ok: true,
    identity: account
      ? {
          userId,
          nickname: account.nickname,
          registered: true,
          authenticated: false,
          hasPassword: Boolean(account.passwordHash),
          accountKind: account.accountKind,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        }
      : {
          userId,
          nickname: "",
          registered: false,
          authenticated: false,
          hasPassword: false,
          accountKind: "user",
        },
  };
};

const authenticatedIdentityPayload = (account) => ({
  ok: true,
  authenticated: true,
  identity: {
    userId: account.userId,
    nickname: account.nickname,
    registered: true,
    authenticated: true,
    hasPassword: Boolean(account.passwordHash),
    accountKind: account.accountKind,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    sessionExpiresAt: account.sessionExpiresAt,
  },
});

const sessionResponse = (db, userId, payload = {}) => {
  const session = createSession(db, userId);
  const account = sessionAccount(db, session.token);
  return {
    status: 200,
    sessionToken: session.token,
    payload: { ...payload, ...authenticatedIdentityPayload(account) },
  };
};

const registerAccount = (db, userId, body) => {
  const nickname = sanitizeNickname(body.nickname);
  const password = sanitizePassword(body.password);
  if (!nickname) {
    return { status: 400, payload: { ok: false, error: `昵称需为 ${MIN_NICKNAME_CHARS}-${MAX_NICKNAME_CHARS} 个字符。` } };
  }
  if (!password) {
    return { status: 400, payload: { ok: false, error: "密码需为 8-128 个字符，且不能使用常见弱密码。" } };
  }
  const occupied = db.prepare(`
    SELECT user_id AS userId FROM agent_accounts
    WHERE nickname = ? COLLATE NOCASE AND user_id <> ?
  `).get(nickname, userId);
  if (occupied) {
    return { status: 409, payload: { ok: false, error: "该昵称已被使用，请直接登录或更换昵称。" } };
  }
  const existing = db.prepare(`
    SELECT nickname, password_hash AS passwordHash, account_kind AS accountKind
    FROM agent_accounts WHERE user_id = ?
  `).get(userId);
  if (existing?.passwordHash) {
    return { status: 409, payload: { ok: false, error: "该本地身份已经设置密码，请直接登录。" } };
  }
  if (existing?.accountKind === "demo") {
    return { status: 403, payload: { ok: false, error: "演示账号不能转换为正式账号。" } };
  }

  ensureProfile(db, userId);
  const recovery = createRecoverySecret();
  const passwordSecret = createPasswordSecret(password);
  const timestamp = nowIso();
  if (existing) {
    db.prepare(`
      UPDATE agent_accounts
      SET nickname = ?, recovery_salt = ?, recovery_hash = ?,
          password_salt = ?, password_hash = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      nickname,
      recovery.salt,
      recovery.hash,
      passwordSecret.salt,
      passwordSecret.hash,
      timestamp,
      userId,
    );
  } else {
    db.prepare(`
      INSERT INTO agent_accounts (
        user_id, nickname, recovery_salt, recovery_hash,
        password_salt, password_hash, account_kind, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?)
    `).run(
      userId,
      nickname,
      recovery.salt,
      recovery.hash,
      passwordSecret.salt,
      passwordSecret.hash,
      timestamp,
      timestamp,
    );
  }
  return sessionResponse(db, userId, {
    recoveryCode: recovery.recoveryCode,
    migratedLegacyIdentity: Boolean(existing),
  });
};

const loginAccount = (db, body) => {
  const nickname = sanitizeNickname(body.nickname);
  const password = typeof body.password === "string" ? body.password : "";
  if (nickname && authThrottle("login", nickname)) {
    return { status: 429, payload: { ok: false, error: "登录尝试过多，请 5 分钟后重试。" } };
  }
  const account = nickname ? db.prepare(`
    SELECT user_id AS userId, password_salt AS passwordSalt,
           password_hash AS passwordHash, account_kind AS accountKind
    FROM agent_accounts WHERE nickname = ? COLLATE NOCASE
  `).get(nickname) : null;
  if (!account?.passwordHash || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    if (nickname) recordAuthFailure("login", nickname);
    return { status: 401, payload: { ok: false, error: "昵称或密码不正确。" } };
  }
  clearAuthFailures("login", nickname);
  return sessionResponse(db, account.userId);
};

const recoverAccount = (db, body) => {
  const nickname = sanitizeNickname(body.nickname);
  const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode.trim() : "";
  const password = sanitizePassword(body.password);
  if (!nickname || !/^\d{6}$/.test(recoveryCode) || !password) {
    return { status: 400, payload: { ok: false, error: "请输入昵称、6 位恢复码和新的安全密码。" } };
  }
  if (authThrottle("recovery", nickname)) {
    return { status: 429, payload: { ok: false, error: "恢复尝试过多，请 5 分钟后重试。" } };
  }
  const account = db.prepare(`
    SELECT user_id AS userId, recovery_salt AS recoverySalt,
           recovery_hash AS recoveryHash, account_kind AS accountKind
    FROM agent_accounts WHERE nickname = ? COLLATE NOCASE
  `).get(nickname);
  if (
    !account
    || account.accountKind === "demo"
    || !verifyRecoveryCode(recoveryCode, account.recoverySalt, account.recoveryHash)
  ) {
    recordAuthFailure("recovery", nickname);
    return { status: 401, payload: { ok: false, error: "昵称或恢复码不正确。" } };
  }
  clearAuthFailures("recovery", nickname);
  const secret = createPasswordSecret(password);
  db.prepare(`
    UPDATE agent_accounts
    SET password_salt = ?, password_hash = ?, updated_at = ?
    WHERE user_id = ?
  `).run(secret.salt, secret.hash, nowIso(), account.userId);
  db.prepare("DELETE FROM agent_sessions WHERE user_id = ?").run(account.userId);
  return sessionResponse(db, account.userId);
};

const loginDemoAccount = (db) => {
  ensureDemoAccount(db);
  const account = db.prepare("SELECT user_id AS userId FROM agent_accounts WHERE nickname = ? COLLATE NOCASE").get(DEMO_NICKNAME);
  if (!account) return { status: 503, payload: { ok: false, error: "演示账号初始化失败。" } };
  db.prepare("DELETE FROM agent_sessions WHERE user_id = ?").run(account.userId);
  db.prepare("DELETE FROM agent_memory_messages WHERE user_id = ?").run(account.userId);
  db.prepare("DELETE FROM career_growth_plans WHERE user_id = ?").run(account.userId);
  db.prepare(`
    UPDATE agent_memory_profiles
    SET resume_profile_json = '{}', target_job_json = '{}', match_result_json = '{}',
        summary = '', updated_at = ? WHERE user_id = ?
  `).run(nowIso(), account.userId);
  return sessionResponse(db, account.userId);
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

export const runAgentMemoryRequest = async (body = {}, requestContext = {}) => {
  try {
    const db = openDatabase();
    const session = sessionAccount(db, requestContext.sessionToken);
    if (body.action === "auth-status") {
      if (session) return { status: 200, payload: authenticatedIdentityPayload(session) };
      const localUserId = validateUserId(body.userId);
      return {
        status: 200,
        payload: localUserId
          ? identityPayload(db, localUserId)
          : {
              ok: true,
              authenticated: false,
              identity: {
                userId: "",
                nickname: "",
                registered: false,
                authenticated: false,
                hasPassword: false,
                accountKind: "user",
              },
            },
      };
    }
    if (body.action === "register") {
      const localUserId = validateUserId(body.userId);
      if (!localUserId) return { status: 400, payload: { ok: false, error: "本地用户标识不合法。" } };
      return registerAccount(db, localUserId, body);
    }
    if (body.action === "login") return loginAccount(db, body);
    if (body.action === "recover-account") return recoverAccount(db, body);
    if (body.action === "login-demo") return loginDemoAccount(db);
    if (body.action === "logout") {
      revokeSession(db, requestContext.sessionToken);
      return { status: 200, clearSession: true, payload: { ok: true, authenticated: false } };
    }

    const trustedUserId = requestContext.trustedUserId ? validateUserId(body.userId) : "";
    const userId = session?.userId || trustedUserId;
    if (!userId) {
      return { status: 401, payload: { ok: false, error: "登录状态已失效，请重新登录。" } };
    }
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
      return {
        status: 200,
        payload: session ? authenticatedIdentityPayload(session) : identityPayload(db, userId),
      };
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
  authFailures.clear();
};
