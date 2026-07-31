import { useEffect, useMemo, useRef, useState } from "react";
import { buildCareerOpsEvaluation } from "../../careerOps";
import type { Job, StudentProfile } from "../../data";
import type { MatchResult } from "../../matchEngine";
import { buildMatchReport, downloadTextFile } from "../../report";
import {
  buildOptimizedResumeDraft,
  formatOptimizedResumeDraft,
} from "../../resumeOptimizer";

type UseMatchInsightsOptions = {
  profile: StudentProfile;
  selectedJob: Job;
  matchResult: MatchResult;
  resumeText: string;
};

export function useMatchInsights({
  profile,
  selectedJob,
  matchResult,
  resumeText,
}: UseMatchInsightsOptions) {
  const [copyStatus, setCopyStatus] = useState("复制优化稿");
  const copyResetTimerRef = useRef<number | null>(null);
  const optimizedDraft = useMemo(
    () => buildOptimizedResumeDraft(profile, selectedJob, matchResult),
    [matchResult, profile, selectedJob],
  );
  const careerOpsEvaluation = useMemo(
    () => buildCareerOpsEvaluation(profile, selectedJob, matchResult),
    [matchResult, profile, selectedJob],
  );

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const downloadReport = () => {
    if (!resumeText.trim()) return;
    const report = buildMatchReport(
      profile,
      selectedJob,
      matchResult,
      resumeText,
      optimizedDraft,
      careerOpsEvaluation,
    );
    downloadTextFile("kongming-match-report.md", report);
  };

  const copyOptimizedDraft = async () => {
    await navigator.clipboard.writeText(formatOptimizedResumeDraft(optimizedDraft));
    setCopyStatus("已复制");
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("复制优化稿");
      copyResetTimerRef.current = null;
    }, 1600);
  };

  return {
    optimizedDraft,
    careerOpsEvaluation,
    copyStatus,
    downloadReport,
    copyOptimizedDraft,
  };
}
