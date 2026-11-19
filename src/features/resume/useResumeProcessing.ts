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
import type { WorkspaceSnapshot } from "../workspace/workspaceClient";

type RunMatchAnalysisOptions = {
  selectedJob: Job;
  matchResult: MatchResult;
  hasAnalysis: boolean;
};

type ResumeUploadContext = {
  jdText?: string;
};

const INITIAL_UPLOAD_MESSAGE = "支持 DOCX、PDF、图片及 TXT/Markdown，单个文件不超过 8MB；旧版 DOC 请先转换。";

const textFromResumeFields = (resume: StructuredResume) => {
  const sections: Array<[string, string[]]> = [
    ["基础信息", resume.basicInfo],
    ["教育经历", resume.education],
    ["实习经历", resume.internships],
    ["项目经历", resume.projects],
    ["校园经历", resume.campus],
    ["竞赛", resume.competitions],
    ["证书", resume.certificates],
    ["语言能力", resume.languages],
    ["专业技能", resume.skills],
    ["荣誉", resume.honors],
    ["社交账号", resume.socialAccounts],
  ];
  return sections.filter(([, items]) => items.length)
    .map(([title, items]) => `${title}\n${items.join("\n")}`).join("\n\n");
};

export function useResumeProcessing(initial?: WorkspaceSnapshot["resume"]) {
  const [resumeText, setResumeText] = useState(initial?.text ?? "");
  const [originalResumeText, setOriginalResumeText] = useState(initial?.originalText ?? "");
  const [originalResumePreview, setOriginalResumePreview] = useState<OriginalResumePreview>(initial?.original ?? {
    kind: "text",
    name: "",
  });
  const [resumeOcrDocument, setResumeOcrDocument] = useState<OcrDocument | null>(null);
  const [structuredResume, setStructuredResume] = useState<StructuredResume | null>(initial?.structured ?? null);
  const [modelJobs, setModelJobs] = useState<Job[]>(initial?.modelJobs ?? []);
  const [modelInsight, setModelInsight] = useState(initial?.insight ?? "");
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">(initial?.structured ? "ready" : "idle");
  const [documentStatus, setDocumentStatus] = useState<"idle" | "loading" | "ready" | "error">(initial?.text ? "ready" : "idle");
  const [modelMessage, setModelMessage] = useState(initial?.text ? "已恢复上次工作区" : "");
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>(initial?.modelJobs.length ? "done" : "idle");
  const [uploadMessage, setUploadMessage] = useState(initial?.text
    ? initial.original.kind !== "text" ? "已恢复简历文字；查看原文件预览需重新上传。" : "已恢复上次简历。"
    : INITIAL_UPLOAD_MESSAGE);
  const [resumeSource, setResumeSource] = useState(initial?.source ?? "等待上传");
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

  const updateResumeFields = (resume: StructuredResume) => {
    pipelineRunRef.current += 1;
    const text = textFromResumeFields(resume);
    setStructuredResume(resume);
    setResumeText(text);
    setModelJobs([]);
    setModelInsight("");
    setModelStatus("idle");
    setPipelineStep("idle");
    setDocumentStatus(text ? "ready" : "idle");
    setModelMessage("简历字段已更新，可生成岗位推荐或分析意向岗位。");
    setUploadMessage("简历字段已更新，可生成岗位推荐或分析意向岗位。");
    if (!originalResumePreview.name) setResumeSource("手动填写");
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
      if (runId !== pipelineRunRef.current) return;
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
    setOriginalResumeText(result.text);
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
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isDocx = file.name.toLowerCase().endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isText = file.type.startsWith("text/") || /\.(txt|md|text)$/i.test(file.name);
    if (file.name.toLowerCase().endsWith(".doc") || (!isImage && !isPdf && !isText && !isDocx)) {
      const message = "暂不支持此文件格式；旧版 DOC 请另存为 DOCX、PDF 或 TXT 后上传。";
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(message);
      setUploadMessage(message);
      return;
    }
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

    if (isImage) {
      await handleImageUpload(file, recommendationJdText, runId);
      return;
    }
    if (isPdf) {
      await handlePdfUpload(file, recommendationJdText, runId);
      return;
    }

    try {
      let text: string;
      if (isDocx) {
        const { default: mammoth } = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value.trim();
      } else {
        text = await file.text();
      }
      if (runId !== pipelineRunRef.current) return;
      if (!text.trim()) throw new Error("文档中没有可读取的文字，请检查内容或转换为 PDF 后上传。");
      setResumeText(text);
      setOriginalResumeText(text);
      setDocumentStatus("ready");
      setUploadMessage(`已读取 ${file.name}，共 ${text.trim().length} 字。文档已可查看，正在后台生成画像和岗位推荐。`);
      setResumeSource(isDocx ? "DOCX 文本提取" : "文本文件读取");
      void runModelPipeline(text, recommendationJdText, runId);
    } catch (error) {
      if (runId !== pipelineRunRef.current) return;
      setDocumentStatus("error");
      setModelStatus("error");
      setPipelineStep("error");
      const message = isDocx
        ? `未能读取 ${file.name}，请确认文件是有效的 DOCX 文档，并包含文字。`
        : error instanceof Error ? error.message : `未能读取 ${file.name}，请检查文件格式后重试。`;
      setModelMessage(message);
      setUploadMessage(message);
    }
  };

  const generateRecommendations = async (context: ResumeUploadContext = {}) => {
    if (!resumeText.trim()) return;
    const runId = ++pipelineRunRef.current;
    setModelStatus("loading");
    setModelJobs([]);
    setModelInsight("");
    if (structuredResume) {
      await runJobRecommendations(resumeText, structuredResume, context.jdText ?? "", runId);
    } else {
      await runModelPipeline(resumeText, context.jdText ?? "", runId);
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
    const runId = ++pipelineRunRef.current;
    setModelStatus("loading");
    setPipelineStep("analysis");
    setModelMessage("正在调用模型生成增强分析");
    const response = await callArkAgent({
      task: "match-analysis",
      resumeText,
      selectedJob,
      matchResult,
    });
    if (runId !== pipelineRunRef.current) return;

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
    originalResumeText: originalResumeText || resumeText,
    originalResumePreview,
    resumeOcrDocument,
    structuredResume,
    setStructuredResume,
    updateResumeFields,
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
    generateRecommendations,
    runMatchAnalysis,
  };
}
