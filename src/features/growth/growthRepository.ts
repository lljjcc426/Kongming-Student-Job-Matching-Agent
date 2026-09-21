import type { GrowthPlan } from "./types";

const STORAGE_KEY = "kongming.growth-plan.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === "object" ? value as Record<string, unknown> : null
);

const asString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const asNumber = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export function loadGrowthPlan(storage: StorageLike): GrowthPlan | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = asRecord(JSON.parse(raw));
    if (!parsed || typeof parsed.id !== "string" || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.gaps)) return null;
    return parsed as unknown as GrowthPlan;
  } catch {
    return null;
  }
}

export function saveGrowthPlan(storage: StorageLike, plan: GrowthPlan | null): boolean {
  try {
    if (!plan) {
      storage.removeItem(STORAGE_KEY);
      return true;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}

export function normalizeGrowthPlan(plan: GrowthPlan): GrowthPlan {
  const gaps = Array.isArray(plan.gaps) ? plan.gaps : [];
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  return {
    ...plan,
    id: asString(plan.id, "growth-" + Date.now()),
    targetJobId: asString(plan.targetJobId),
    targetJobTitle: asString(plan.targetJobTitle, "目标岗位"),
    createdAt: asString(plan.createdAt, new Date().toISOString()),
    updatedAt: asString(plan.updatedAt, new Date().toISOString()),
    baselineCoverage: Math.max(0, Math.min(100, asNumber(plan.baselineCoverage))),
    empiricalCoverage: Math.max(0, Math.min(100, asNumber(plan.empiricalCoverage))),
    projectedCoverage: Math.max(0, Math.min(100, asNumber(plan.projectedCoverage))),
    gaps,
    tasks,
    interview: plan.interview ?? null,
    assessments: Array.isArray(plan.assessments) ? plan.assessments : [],
  };
}
