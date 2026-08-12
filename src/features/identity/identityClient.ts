export const AGENT_USER_ID_STORAGE_KEY = "kongming.agent-memory.user-id.v1";
const IDENTITY_STORAGE_KEY = "kongming.identity.account.v1";
const IDENTITY_CHOICE_STORAGE_KEY = "kongming.identity.choice.v1";

const identityEndpoint = () => import.meta.env.VITE_AGENT_MEMORY_API_URL || "/api/memory";

export type AppIdentity = {
  userId: string;
  nickname: string;
  registered: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type IdentityResponse = {
  ok: boolean;
  error?: string;
  identity?: AppIdentity;
  recoveryCode?: string;
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

const anonymousIdentity = (userId = getMemoryUserId()): AppIdentity => ({
  userId,
  nickname: "",
  registered: false,
});

const persistIdentity = (identity: AppIdentity, markChoice = true) => {
  window.localStorage.setItem(AGENT_USER_ID_STORAGE_KEY, identity.userId);
  if (identity.registered) {
    window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } else {
    window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
  }
  if (markChoice) window.localStorage.setItem(IDENTITY_CHOICE_STORAGE_KEY, "done");
};

export const getCachedIdentity = (): AppIdentity => {
  const userId = getMemoryUserId();
  try {
    const stored = JSON.parse(window.localStorage.getItem(IDENTITY_STORAGE_KEY) || "null") as AppIdentity | null;
    if (stored?.registered && stored.userId === userId && typeof stored.nickname === "string") {
      return stored;
    }
  } catch {
    window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
  }
  return anonymousIdentity(userId);
};

export const hasCompletedIdentityChoice = () =>
  window.localStorage.getItem(IDENTITY_CHOICE_STORAGE_KEY) === "done"
  || getCachedIdentity().registered;

const requestIdentity = async (payload: Record<string, unknown>) => {
  const response = await fetch(identityEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...payload, userId: getMemoryUserId() }),
  });
  const data = await response.json().catch(() => ({})) as IdentityResponse;
  if (!response.ok || !data.ok || !data.identity) {
    throw new Error(data.error || "用户身份服务暂不可用。");
  }
  return data;
};

export const loadIdentityStatus = async () => {
  const data = await requestIdentity({ action: "identity-status" });
  persistIdentity(data.identity!, data.identity!.registered);
  return data.identity!;
};

export const createIdentity = async (nickname: string) => {
  const data = await requestIdentity({ action: "create-identity", nickname });
  persistIdentity(data.identity!);
  return { identity: data.identity!, recoveryCode: data.recoveryCode || "" };
};

export const restoreIdentity = async (nickname: string, recoveryCode: string) => {
  const data = await requestIdentity({ action: "restore-identity", nickname, recoveryCode });
  persistIdentity(data.identity!);
  return data.identity!;
};

export const continueAsAnonymous = () => {
  const identity = anonymousIdentity();
  persistIdentity(identity);
  return identity;
};

export const startFreshExperience = (rememberChoice = true) => {
  const identity = anonymousIdentity(newUserId());
  window.localStorage.setItem(AGENT_USER_ID_STORAGE_KEY, identity.userId);
  window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
  if (rememberChoice) {
    window.localStorage.setItem(IDENTITY_CHOICE_STORAGE_KEY, "done");
  } else {
    window.localStorage.removeItem(IDENTITY_CHOICE_STORAGE_KEY);
  }
  return identity;
};
