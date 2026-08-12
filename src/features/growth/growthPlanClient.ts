import type { GrowthPlan } from "./types";
import { getMemoryUserId } from "../identity/identityClient";

const memoryEndpoint = () => import.meta.env.VITE_AGENT_MEMORY_API_URL || "/api/memory";

type GrowthResponse = {
  ok: boolean;
  error?: string;
  plan?: GrowthPlan | null;
};

const request = async (payload: Record<string, unknown>) => {
  const response = await fetch(memoryEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...payload, userId: getMemoryUserId() }),
  });
  const data = await response.json().catch(() => ({})) as GrowthResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "成长计划服务暂不可用。");
  }
  return data.plan ?? null;
};

export const loadGrowthPlan = () => request({ action: "load-growth" });
export const saveGrowthPlan = (plan: GrowthPlan) => request({ action: "save-growth", plan });
