import { useCallback, useEffect, useRef, useState } from "react";
import { saveWorkspace, type WorkspaceSnapshot } from "./workspaceClient";

export function useWorkspacePersistence(userId: string, snapshot: WorkspaceSnapshot) {
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const saved = useRef(snapshot);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const queued = useRef<WorkspaceSnapshot | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const paused = useRef(false);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");

  const persist = useCallback((keepalive = false) => {
    window.clearTimeout(timer.current);
    if (paused.current || latest.current === saved.current || latest.current === queued.current) return pending.current;
    const next = latest.current;
    queued.current = next;
    setStatus("saving");
    pending.current = pending.current.then(() => saveWorkspace(userId, next, keepalive))
      .then(() => {
        saved.current = next;
        if (queued.current === next) queued.current = null;
        if (next === latest.current) setStatus("saved");
        setError("");
      })
      .catch((saveError: unknown) => {
        if (queued.current === next) queued.current = null;
        setError(saveError instanceof Error ? saveError.message : "工作区保存失败，请重试。");
        setStatus("error");
      });
    return pending.current;
  }, [userId]);
  const flush = useCallback(async () => {
    await persist();
    return latest.current === saved.current;
  }, [persist]);

  useEffect(() => {
    if (snapshot === saved.current || paused.current) return;
    setStatus("saving");
    timer.current = window.setTimeout(() => void persist(), 400);
    return () => window.clearTimeout(timer.current);
  }, [snapshot, persist]);

  useEffect(() => {
    const flush = () => { void persist(true); };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.clearTimeout(timer.current);
    };
  }, [persist]);

  return {
    status,
    error,
    flush,
    retry: () => { void persist(); },
    suspend: async () => {
      paused.current = true;
      window.clearTimeout(timer.current);
      await pending.current;
    },
    resume: () => { paused.current = false; void persist(); },
  };
}
