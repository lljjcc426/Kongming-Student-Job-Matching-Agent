import type { GrowthPlan } from "./types";

const USER_ID_STORAGE_KEY = "kongming.agent-memory.user-id.v1";
const memoryEndpoint = () => import.meta.env.VITE_AGENT_MEMORY_API_URL || "/api/memory";

type GrowthResponse = {
  ok: boolean;
  error?: string;
  plan?: GrowthPlan | null;
};

const memoryUserId = () => {
  const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existing) return existing;
  const randomPart = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replaceAll("-", "")
    : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  const userId = `km_${randomPart}`;
  window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  return userId;
};

const request = async (payload: Record<string, unknown>) => {
  const response = await fetch(memoryEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...payload, userId: memoryUserId() }),
  });
  const data = await response.json().catch(() => ({})) as GrowthResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "成长计划服务暂不可用。");
  }
  return data.plan ?? null;
};

export const loadGrowthPlan = () => request({ action: "load-growth" });
export const saveGrowthPlan = (plan: GrowthPlan) => request({ action: "save-growth", plan });
