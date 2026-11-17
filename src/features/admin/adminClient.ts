export type PageResult<T> = { rows: T[]; total: number; page: number; pageSize: number };
export type AccountRow = { userId: string; nickname: string; role: "admin" | "user"; status: "active" | "disabled"; accountKind: "user" | "demo"; createdAt: string; lastLoginAt: string | null; activeSessions: number; modelCalls: number };
export type RequestRow = { id: number; occurredAt: string; route: string; method: string; task: string; status: number; durationMs: number; provider: string | null; model: string | null; inputTokens: number | null; outputTokens: number | null };
export type AuditRow = { id: number; occurredAt: string; actor: string; target: string; action: string; detail: string };
export type Overview = {
  observedAt: string; startedAt: string; range: string;
  summary: { requests: number; successful: number; serverErrors: number; clientErrors: number; modelCalls: number; inputTokens: number; outputTokens: number; meteredCalls: number; averageMs: number; p95Ms: number; inFlight: number; totalTokens: number };
  trend: Array<{ time: string; requests: number; errors: number; tokens: number }>;
  endpoints: Array<{ route: string; requests: number; errors: number; averageMs: number }>;
  accounts: { total: number; registered: number | null; guests: number | null; admins: number | null; disabled: number | null };
  storage: { messages: number; interviews: number; growthPlans: number; requests: number };
  services: Array<{ id: string; name: string; state: "healthy" | "configured" | "missing"; detail: string }>;
  resources: { uptimeSeconds: number; processMemoryBytes: number; systemMemoryBytes: number; systemFreeBytes: number; loadAverage: number; cpuCount: number; databaseBytes: number; walBytes: number; diskFreeBytes: number; diskTotalBytes: number };
  backup: { count: number; latest: { createdAt: string; bytes: number } | null; retentionDays: number };
};

async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    credentials: "include",
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "控制台暂时无法读取数据。");
  return result.data as T;
}

export const loadOverview = (range: string) => request<Overview>(`/overview?range=${range}`);
export const loadAccounts = (page: number, search: string, kind: string) => request<PageResult<AccountRow>>(`/users?${new URLSearchParams({ page: String(page), search, kind })}`);
export const loadRequests = (page: number, failed: boolean) => request<PageResult<RequestRow>>(`/requests?page=${page}&failed=${failed}`);
export const loadAudit = (page: number) => request<PageResult<AuditRow>>(`/audit?page=${page}`);
export const changeAccount = (userId: string, action: string) => request<void>(`/users/${encodeURIComponent(userId)}/actions`, { action });
