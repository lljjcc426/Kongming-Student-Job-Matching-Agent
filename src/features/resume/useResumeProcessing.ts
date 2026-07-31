import { useEffect, useMemo, useState } from "react";
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
  const [modelMessage, setModelMessage] = useState("");
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [uploadMessage, setUploadMessage] = useState(INITIAL_UPLOAD_MESSAGE);
  const [resumeSource, setResumeSource] = useState("等待上传");
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
  ) => {
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
  };

  const runModelPipeline = async (nextResumeText: string, recommendationJdText: string) => {
    if (!nextResumeText.trim()) return;
    setModelStatus("loading");
    setPipelineStep("structure");
    setModelMessage("正在调用模型解析简历并生成岗位推荐");
    setStructuredResume(null);
    setModelJobs([]);

    const structureResponse = await callArkAgent({ task: "resume-structure", resumeText: nextResumeText });
    if (!structureResponse.ok || !structureResponse.content) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(structureResponse.error || "模型简历解析失败。");
      return;
    }

    try {
      const parsedResume = parseStructuredResume(structureResponse.content, nextResumeText);
      setStructuredResume(parsedResume);
      await runJobRecommendations(nextResumeText, parsedResume, recommendationJdText);
    } catch (error) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(error instanceof Error ? `模型返回格式无法解析：${error.message}` : "模型返回格式无法解析。");
    }
  };

  const applyDocumentResult = async (
    result: ResumeDocumentProcessingResult,
    recommendationJdText: string,
  ) => {
    if (result.ocrDocument) setResumeOcrDocument(result.ocrDocument);
    setModelMessage(result.modelMessage);
    setUploadMessage(result.uploadMessage);
    if (result.source) setResumeSource(result.source);

    if (!result.ok) {
      setModelStatus("error");
      setPipelineStep("error");
      return;
    }

    setResumeText(result.text);
    if (result.insight) setModelInsight(result.insight);
    setModelStatus("ready");
    await runModelPipeline(result.text, recommendationJdText);
  };

  const handleImageUpload = async (file: File, recommendationJdText: string) => {
    setModelStatus("loading");
    setPipelineStep("intake");
    setModelMessage("正在使用本地 OCR 识别图片简历");
    const result = await processImageResume(file, setModelMessage);
    await applyDocumentResult(result, recommendationJdText);
  };

  const handlePdfUpload = async (file: File, recommendationJdText: string) => {
    setModelStatus("loading");
    setPipelineStep("intake");
    setModelMessage("正在解析 PDF 简历");
    const result = await processPdfResume(file, setModelMessage);
    await applyDocumentResult(result, recommendationJdText);
  };

  const uploadResume = async (file?: File, context: ResumeUploadContext = {}) => {
    if (!file) return;
    if (file.size > MAX_RESUME_UPLOAD_BYTES) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage("文件超过 8MB，请压缩或精简后再上传。");
      setUploadMessage("文件超过 8MB，请压缩后重新上传。");
      return;
    }
    setUploadMessage(`正在读取 ${file.name}…`);
    rememberOriginalResume(file);
    const recommendationJdText = context.jdText ?? "";

    if (file.type.startsWith("image/")) {
      await handleImageUpload(file, recommendationJdText);
      return;
    }
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      await handlePdfUpload(file, recommendationJdText);
      return;
    }

    const text = await file.text();
    setResumeText(text);
    setUploadMessage(`已读取 ${file.name}，共 ${text.trim().length} 字，画像、岗位排序和匹配结果已更新。`);
    setResumeSource("文本文件读取");
    await runModelPipeline(text, recommendationJdText);
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
    modelMessage,
    pipelineStep,
    uploadMessage,
    resumeSource,
    hasResume: resumeText.trim().length > 0,
    uploadResume,
    runMatchAnalysis,
  };
}
