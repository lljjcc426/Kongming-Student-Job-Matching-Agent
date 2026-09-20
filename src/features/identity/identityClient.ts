export const AGENT_USER_ID_STORAGE_KEY = "kongming.agent-memory.user-id.v1";
const IDENTITY_STORAGE_KEY = "kongming.identity.account.v2";

const identityEndpoint = () => import.meta.env.VITE_AGENT_MEMORY_API_URL || "/api/memory";

export type AppIdentity = {
  userId: string;
  nickname: string;
  registered: boolean;
  authenticated: boolean;
  hasPassword: boolean;
  accountKind: "user" | "demo";
  createdAt?: string;
  updatedAt?: string;
  sessionExpiresAt?: string;
};

type IdentityResponse = {
  ok: boolean;
  authenticated?: boolean;
  error?: string;
  identity?: AppIdentity;
  recoveryCode?: string;
  migratedLegacyIdentity?: boolean;
};

const newUserId = () => {
  const randomPart = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replaceAll("-", "")
    : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `km_${randomPart}`;
};

export const getMemoryUserId = () => {
  const existing = window.localStorage.getItem(AGENT_USER_ID_STORAGE_KEY);
  if (existing) return existing;
  const userId = newUserId();
  window.localStorage.setItem(AGENT_USER_ID_STORAGE_KEY, userId);
  return userId;
};

const emptyIdentity = (userId = getMemoryUserId()): AppIdentity => ({
  userId,
  nickname: "",
  registered: false,
  authenticated: false,
  hasPassword: false,
  accountKind: "user",
});

const persistIdentity = (identity: AppIdentity) => {
  window.localStorage.setItem(AGENT_USER_ID_STORAGE_KEY, identity.userId || getMemoryUserId());
  window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
};

export const getCachedIdentity = (): AppIdentity => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(IDENTITY_STORAGE_KEY) || "null") as AppIdentity | null;
    if (stored?.userId && typeof stored.nickname === "string") {
      return { ...stored, authenticated: false };
    }
  } catch {
    window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
  }
  return emptyIdentity();
};

const requestIdentity = async (payload: Record<string, unknown>, requireIdentity = true) => {
  const response = await fetch(identityEndpoint(), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...payload, userId: getMemoryUserId() }),
  });
  const data = await response.json().catch(() => ({})) as IdentityResponse;
  if (!response.ok || !data.ok || (requireIdentity && !data.identity)) {
    throw new Error(data.error || "账户服务暂不可用。");
  }
  if (data.identity) persistIdentity(data.identity);
  return data;
};

export const loadAuthStatus = async () => {
  const data = await requestIdentity({ action: "auth-status" });
  return data.identity!;
};

export const registerAccount = async (nickname: string, password: string) => {
  const data = await requestIdentity({ action: "register", nickname, password });
  return {
    identity: data.identity!,
    recoveryCode: data.recoveryCode || "",
    migratedLegacyIdentity: Boolean(data.migratedLegacyIdentity),
  };
};

export const loginAccount = async (nickname: string, password: string) => {
  const data = await requestIdentity({ action: "login", nickname, password });
  return data.identity!;
};

export const recoverAccount = async (
  nickname: string,
  recoveryCode: string,
  password: string,
) => {
  const data = await requestIdentity({ action: "recover-account", nickname, recoveryCode, password });
  return data.identity!;
};

export const loginDemoAccount = async () => {
  const data = await requestIdentity({ action: "login-demo" });
  return data.identity!;
};

export const logoutAccount = async () => {
  await requestIdentity({ action: "logout" }, false);
  const identity = emptyIdentity(newUserId());
  window.localStorage.setItem(AGENT_USER_ID_STORAGE_KEY, identity.userId);
  window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
  return identity;
};
