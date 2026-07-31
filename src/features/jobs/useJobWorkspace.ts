import { useMemo, useState } from "react";
import type { AsyncStatus, JdPipelineStep } from "../../app/types";
import { callArkAgent } from "../../arkClient";
import type { Job, StudentProfile } from "../../data";
import { parseCustomJob } from "../../jobParser";
import { analyzeMatch } from "../../matchEngine";
import {
  parseJdAnalysis,
  parseStructuredResume,
  type StructuredResume,
} from "../../modelParsers";
import { EMPTY_JOB } from "./recommendationSupervisor";

type UseJobWorkspaceOptions = {
  resumeText: string;
  resumeProfile: StructuredResume | null;
  onResumeProfileChange: (resume: StructuredResume) => void;
  modelJobs: Job[];
  profile: StudentProfile;
};

export function useJobWorkspace({
  resumeText,
  resumeProfile,
  onResumeProfileChange,
  modelJobs,
  profile,
}: UseJobWorkspaceOptions) {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customJdText, setCustomJdText] = useState("");
  const [customJobs, setCustomJobs] = useState<Job[]>([]);
  const [jdStatus, setJdStatus] = useState<AsyncStatus>("idle");
  const [jdStep, setJdStep] = useState<JdPipelineStep>("idle");
  const [jdMessage, setJdMessage] = useState("等待意向岗位输入");

  const availableJobs = useMemo(() => {
    if (!resumeText.trim() && !customJobs.length) return [];
    return [...customJobs, ...modelJobs];
  }, [customJobs, modelJobs, resumeText]);

  const rankedJobs = useMemo(
    () =>
      [...availableJobs].sort(
        (left, right) =>
          analyzeMatch(profile, right, resumeText).total - analyzeMatch(profile, left, resumeText).total,
      ),
    [availableJobs, profile, resumeText],
  );

  const selectedJob =
    rankedJobs.find((job) => job.id === selectedJobId) ??
    rankedJobs[0] ??
    EMPTY_JOB;
  const hasAnalysis = rankedJobs.length > 0;
  const matchResult = useMemo(
    () => analyzeMatch(profile, selectedJob, resumeText),
    [profile, resumeText, selectedJob],
  );

  const analyzeCustomJob = async () => {
    if (!resumeText.trim()) {
      setJdStatus("error");
      setJdStep("error");
      setJdMessage("请先上传或粘贴简历，再分析意向岗位。");
      return;
    }
    const draftJob = parseCustomJob(customTitle, customJdText);
    if (!draftJob) {
      setJdStatus("error");
      setJdStep("error");
      setJdMessage("请填写岗位名称或目标岗位 JD。");
      return;
    }
    setJdStatus("loading");
    setJdStep("parse");
    setJdMessage("正在解析意向岗位 JD");

    let activeResumeProfile = resumeProfile;
    if (!activeResumeProfile) {
      const structureResponse = await callArkAgent({
        task: "resume-structure",
        resumeText,
      });
      if (!structureResponse.ok || !structureResponse.content) {
        setJdStatus("error");
        setJdStep("error");
        setJdMessage(structureResponse.error || "简历画像解析失败，无法评估意向岗位。");
        return;
      }
      try {
        activeResumeProfile = parseStructuredResume(structureResponse.content, resumeText);
        onResumeProfileChange(activeResumeProfile);
      } catch {
        setJdStatus("error");
        setJdStep("error");
        setJdMessage("简历画像格式无法解析，无法评估意向岗位。");
        return;
      }
    }

    setJdStep("evaluate");
    setJdMessage("正在评估岗位匹配优先级");
    const response = await callArkAgent(
      {
        task: "jd-analysis",
        resumeText,
        resumeProfile: activeResumeProfile,
        jobTitle: customTitle,
        jdText: customJdText,
      },
      { timeoutMs: 45000 },
    );
    if (!response.ok || !response.content) {
      setJdStatus("error");
      setJdStep("error");
      setJdMessage(response.error || "意向岗位分析失败。");
      return;
    }

    try {
      const analysis = parseJdAnalysis(response.content);
      setJdStep("links");
      const nextJob: Job = {
        ...draftJob,
        id: `custom-${Date.now()}`,
        title: analysis.title || draftJob.title,
        track: analysis.track || draftJob.track,
        city: analysis.city || draftJob.city,
        level: analysis.level || draftJob.level,
        summary: analysis.summary || draftJob.summary,
        responsibilities: analysis.responsibilities.length
          ? analysis.responsibilities
          : draftJob.responsibilities,
        requirements: analysis.requirements.length
          ? analysis.requirements
          : draftJob.requirements,
        bonus: analysis.bonus.length ? analysis.bonus : draftJob.bonus,
        keywords: analysis.keywords.length ? analysis.keywords : draftJob.keywords,
        priority: analysis.priority,
        applicationLinks: analysis.applicationLinks,
        jdAnalysis: {
          conclusion: analysis.conclusion,
          strengths: analysis.strengths,
          risks: analysis.risks,
          actions: analysis.actions,
        },
      };
      setCustomJobs((current) => [nextJob, ...current]);
      setSelectedJobId(nextJob.id);
      setJdStatus("ready");
      setJdStep("done");
      setJdMessage("意向岗位分析已完成");
    } catch (error) {
      setJdStatus("error");
      setJdStep("error");
      setJdMessage(
        error instanceof Error
          ? `意向岗位结果解析失败：${error.message}`
          : "意向岗位结果解析失败。",
      );
    }
  };

  const deleteCustomJob = (jobId: string) => {
    setCustomJobs((current) => current.filter((item) => item.id !== jobId));
    setSelectedJobId((current) => (current === jobId ? "" : current));
  };

  return {
    selectedJob,
    hasAnalysis,
    matchResult,
    rankedJobs,
    customTitle,
    setCustomTitle,
    customJdText,
    setCustomJdText,
    customJobs,
    jdStatus,
    jdStep,
    jdMessage,
    selectJob: setSelectedJobId,
    deleteCustomJob,
    analyzeCustomJob,
  };
}
