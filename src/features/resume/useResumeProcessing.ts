import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineStep } from "../../app/types";
import { callArkAgent } from "../../arkClient";
import type { Job } from "../../data";
import { searchJobKnowledge } from "../../jobKnowledgeClient";
import type { MatchResult } from "../../matchEngine";
import {
  parseModelJobs,
  parseStructuredResume,
  profileFromStructuredResume,
  type StructuredResume,
} from "../../modelParsers";
import type { OcrDocument } from "../../ocrTypes";
import {
  buildJobDiscoveryAgents,
  superviseRecommendedJobs,
} from "../jobs/recommendationSupervisor";
import {
  buildJobKnowledgeQueries,
  jobsFromKnowledgeResponse,
} from "../jobs/jobKnowledgeAdapter";
import {
  processImageResume,
  processPdfResume,
  type ResumeDocumentProcessingResult,
} from "./documentProcessing";
import { MAX_RESUME_UPLOAD_BYTES } from "./fileProcessing";
import type { OriginalResumePreview } from "./types";

type RunMatchAnalysisOptions = {
  selectedJob: Job;
  matchResult: MatchResult;
  hasAnalysis: boolean;
};

type ResumeUploadContext = {
  jdText?: string;
};

const INITIAL_UPLOAD_MESSAGE = "支持 PDF、图片及 TXT/Markdown 文本文件，单个文件不超过 8MB。";

export function useResumeProcessing() {
  const [resumeText, setResumeText] = useState("");
  const [originalResumePreview, setOriginalResumePreview] = useState<OriginalResumePreview>({
    kind: "text",
    name: "",
  });
  const [resumeOcrDocument, setResumeOcrDocument] = useState<OcrDocument | null>(null);
  const [structuredResume, setStructuredResume] = useState<StructuredResume | null>(null);
  const [modelJobs, setModelJobs] = useState<Job[]>([]);
  const [modelInsight, setModelInsight] = useState("");
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [documentStatus, setDocumentStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelMessage, setModelMessage] = useState("");
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [uploadMessage, setUploadMessage] = useState(INITIAL_UPLOAD_MESSAGE);
  const [resumeSource, setResumeSource] = useState("等待上传");
  const pipelineRunRef = useRef(0);
  const activeProfile = useMemo(
    () => profileFromStructuredResume(structuredResume, resumeText),
    [resumeText, structuredResume],
  );

  useEffect(() => {
    return () => {
      if (originalResumePreview.url) {
        URL.revokeObjectURL(originalResumePreview.url);
      }
    };
  }, [originalResumePreview.url]);

  const rememberOriginalResume = (file: File) => {
    setResumeOcrDocument(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf || file.type.startsWith("image/")) {
      setOriginalResumePreview({
        kind: isPdf ? "pdf" : "image",
        name: file.name,
        url: URL.createObjectURL(file),
      });
      return;
    }

    setOriginalResumePreview({ kind: "text", name: file.name });
  };

  const runJobRecommendations = async (
    nextResumeText: string,
    nextResume: StructuredResume,
    recommendationJdText: string,
    runId: number,
  ) => {
    if (runId !== pipelineRunRef.current) return;
    setPipelineStep("jobs");
    setModelMessage("正在从职业知识库检索真实岗位");
    const knowledgeQueries = buildJobKnowledgeQueries(
      nextResume,
      nextResumeText,
      recommendationJdText,
    );
    const knowledgeResponse = await searchJobKnowledge(
      knowledgeQueries[0] || nextResumeText,
      {
        topK: 30,
        queries: knowledgeQueries.slice(1),
        filters: { studentOnly: true },
        timeoutMs: 180_000,
      },
    );
    if (runId !== pipelineRunRef.current) return;
    const recommendationProfile = profileFromStructuredResume(
      nextResume,
      nextResumeText,
    );
    const knowledgeJobs = superviseRecommendedJobs(
      jobsFromKnowledgeResponse(knowledgeResponse, 30),
      {
        profile: recommendationProfile,
        resumeText: nextResumeText,
        limit: 6,
      },
    );
    if (knowledgeJobs.length) {
      setModelJobs(knowledgeJobs);
      setModelStatus("ready");
      setPipelineStep("done");
      setModelMessage(
        `已从职业知识库检索并筛选 ${knowledgeJobs.length} 个真实岗位，岗位详情来自官方招聘页面`,
      );
      setUploadMessage(`简历文档已就绪，画像和 ${knowledgeJobs.length} 个岗位推荐已更新。`);
      return;
    }

    setModelMessage("职业知识库暂不可用，正在回退到模型岗位方向推荐");
    const agents = buildJobDiscoveryAgents(nextResume);
    const responses = await Promise.allSettled(
      agents.map((agent) =>
        callArkAgent(
          {
            task: "job-recommendations",
            resumeText: nextResumeText,
            resumeProfile: nextResume,
            jdText: recommendationJdText,
            agentFocus: agent.focus,
            jobCount: agent.jobCount,
          },
          { timeoutMs: 38000 },
        ),
      ),
    );
    if (runId !== pipelineRunRef.current) return;
    const parsedJobs = superviseRecommendedJobs(
      responses.flatMap((response) => {
        if (response.status !== "fulfilled" || !response.value.ok || !response.value.content) return [];
        try {
          return parseModelJobs(response.value.content);
        } catch {
          return [];
        }
      }),
      {
        profile: recommendationProfile,
        resumeText: nextResumeText,
        limit: 6,
      },
    );

    if (!parsedJobs.length) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage("岗位推荐子任务均未返回有效结果，请补充简历信息后重试。");
      return;
    }

    setModelJobs(parsedJobs);
    setModelStatus("ready");
    setPipelineStep("done");
    setModelMessage(`已生成 ${parsedJobs.length} 个岗位方向建议；当前结果未连接职业知识库`);
    setUploadMessage(`简历文档已就绪，画像和 ${parsedJobs.length} 个岗位方向已更新。`);
  };

  const runModelPipeline = async (nextResumeText: string, recommendationJdText: string, runId: number) => {
    if (!nextResumeText.trim()) return;
    if (runId !== pipelineRunRef.current) return;
    setModelStatus("loading");
    setPipelineStep("structure");
    setModelMessage("正在调用模型解析简历并生成岗位推荐");
    setStructuredResume(null);
    setModelJobs([]);

    const structureResponse = await callArkAgent({ task: "resume-structure", resumeText: nextResumeText });
    if (runId !== pipelineRunRef.current) return;
    if (!structureResponse.ok || !structureResponse.content) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(structureResponse.error || "模型简历解析失败。");
      setUploadMessage("简历文档已可查看，但画像解析未完成，可稍后重新上传或重试。");
      return;
    }

    try {
      const parsedResume = parseStructuredResume(structureResponse.content, nextResumeText);
      setStructuredResume(parsedResume);
      await runJobRecommendations(nextResumeText, parsedResume, recommendationJdText, runId);
    } catch (error) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(error instanceof Error ? `模型返回格式无法解析：${error.message}` : "模型返回格式无法解析。");
      setUploadMessage("简历文档已可查看，但结构化画像格式异常，可稍后重试。");
    }
  };

  const applyDocumentResult = async (
    result: ResumeDocumentProcessingResult,
    recommendationJdText: string,
    runId: number,
  ) => {
    if (runId !== pipelineRunRef.current) return;
    if (result.ocrDocument) setResumeOcrDocument(result.ocrDocument);
    setModelMessage(result.modelMessage);
    setUploadMessage(result.uploadMessage);
    if (result.source) setResumeSource(result.source);

    if (!result.ok) {
      setDocumentStatus("error");
      setModelStatus("error");
      setPipelineStep("error");
      return;
    }

    setResumeText(result.text);
    if (result.insight) setModelInsight(result.insight);
    setDocumentStatus("ready");
    setUploadMessage(`${result.uploadMessage} 文档已可查看，正在后台生成画像和岗位推荐。`);
    void runModelPipeline(result.text, recommendationJdText, runId);
  };

  const handleImageUpload = async (file: File, recommendationJdText: string, runId: number) => {
    setModelStatus("loading");
    setDocumentStatus("loading");
    setPipelineStep("intake");
    setModelMessage("正在使用本地 OCR 识别图片简历");
    const result = await processImageResume(file, setModelMessage);
    await applyDocumentResult(result, recommendationJdText, runId);
  };

  const handlePdfUpload = async (file: File, recommendationJdText: string, runId: number) => {
    setModelStatus("loading");
    setDocumentStatus("loading");
    setPipelineStep("intake");
    setModelMessage("正在解析 PDF 简历");
    const result = await processPdfResume(file, setModelMessage);
    await applyDocumentResult(result, recommendationJdText, runId);
  };

  const uploadResume = async (file?: File, context: ResumeUploadContext = {}) => {
    if (!file) return;
    const runId = pipelineRunRef.current + 1;
    pipelineRunRef.current = runId;
    if (file.size > MAX_RESUME_UPLOAD_BYTES) {
      setDocumentStatus("error");
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage("文件超过 8MB，请压缩或精简后再上传。");
      setUploadMessage("文件超过 8MB，请压缩后重新上传。");
      return;
    }
    setUploadMessage(`正在读取 ${file.name}…`);
    setDocumentStatus("loading");
    rememberOriginalResume(file);
    const recommendationJdText = context.jdText ?? "";

    if (file.type.startsWith("image/")) {
      await handleImageUpload(file, recommendationJdText, runId);
      return;
    }
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      await handlePdfUpload(file, recommendationJdText, runId);
      return;
    }

    try {
      const text = await file.text();
      if (runId !== pipelineRunRef.current) return;
      setResumeText(text);
      setDocumentStatus("ready");
      setUploadMessage(`已读取 ${file.name}，共 ${text.trim().length} 字。文档已可查看，正在后台生成画像和岗位推荐。`);
      setResumeSource("文本文件读取");
      void runModelPipeline(text, recommendationJdText, runId);
    } catch {
      if (runId !== pipelineRunRef.current) return;
      setDocumentStatus("error");
      setModelStatus("error");
      setPipelineStep("error");
      setUploadMessage(`未能读取 ${file.name}，请检查文件格式后重试。`);
    }
  };

  const runMatchAnalysis = async ({
    selectedJob,
    matchResult,
    hasAnalysis,
  }: RunMatchAnalysisOptions) => {
    if (!resumeText.trim() || !hasAnalysis) {
      setModelStatus("error");
      setModelMessage("请先完成模型简历解析和岗位推荐，再进行模型增强分析。");
      return;
    }
    setModelStatus("loading");
    setPipelineStep("analysis");
    setModelMessage("正在调用模型生成增强分析");
    const response = await callArkAgent({
      task: "match-analysis",
      resumeText,
      selectedJob,
      matchResult,
    });

    if (response.ok && response.content) {
      setModelInsight(response.content);
      setModelStatus("ready");
      setPipelineStep("done");
      setModelMessage("已完成增强分析");
      return;
    }

    setModelStatus("error");
    setPipelineStep("error");
    setModelMessage(response.error || "模型增强分析失败，请检查运行环境。");
  };

  return {
    resumeText,
    originalResumePreview,
    resumeOcrDocument,
    structuredResume,
    setStructuredResume,
    activeProfile,
    modelJobs,
    modelInsight,
    modelStatus,
    documentStatus,
    modelMessage,
    pipelineStep,
    uploadMessage,
    resumeSource,
    hasResume: resumeText.trim().length > 0,
    uploadResume,
    runMatchAnalysis,
  };
}
