import type { Job } from "../../data";
import type { StructuredResume } from "../../modelParsers";
import type { OriginalResumePreview } from "../resume/types";

export type WorkspaceSnapshot = {
  version: 1;
  resume: {
    text: string;
    originalText: string;
    structured: StructuredResume | null;
    modelJobs: Job[];
    insight: string;
    source: string;
    original: Pick<OriginalResumePreview, "kind" | "name">;
  };
  jobs: {
    customTitle: string;
    customJdText: string;
    customJobs: Job[];
    selectedJobId: string;
  };
};

const request = async (userId: string, payload: Record<string, unknown>, keepalive = false) => {
  const response = await fetch(import.meta.env.VITE_AGENT_MEMORY_API_URL || "/api/memory", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...payload, userId }),
    keepalive,
  });
  const data = await response.json() as { ok: boolean; error?: string; workspace?: WorkspaceSnapshot | null };
  if (!response.ok || !data.ok) throw new Error(data.error || "工作区服务暂不可用。");
  return data;
};

export const loadWorkspace = async (userId: string) => (await request(userId, { action: "load-workspace" })).workspace ?? null;
export const saveWorkspace = (userId: string, workspace: WorkspaceSnapshot, keepalive = false) => request(userId, { action: "save-workspace", workspace }, keepalive);
