import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Job } from "./data";
import { callArkAgent } from "./arkClient";
import { parseCustomJob } from "./jobParser";
import { analyzeMatch, type MatchResult } from "./matchEngine";
import { parseModelJobs, parseStructuredResume, profileFromStructuredResume, type StructuredResume } from "./modelParsers";
import { buildMatchReport, downloadTextFile } from "./report";
import { buildOptimizedResumeDraft, formatOptimizedResumeDraft } from "./resumeOptimizer";

const MAX_UPLOAD_BYTES = 4_000_000;
type PipelineStep = "idle" | "intake" | "structure" | "jobs" | "analysis" | "done" | "error";
type SpeechRecognitionResultLike = {
  0?: {
    transcript?: string;
  };
};
type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
const getSpeechRecognition = () => {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
};

const emptyJob: Job = {
  id: "empty",
  title: "等待模型推荐岗位",
  track: "待识别",
  city: "不限",
  level: "岗位",
  companyScenario: "等待模型输出",
  summary: "",
  responsibilities: [],
  requirements: [],
  bonus: [],
  keywords: [],
  priority: "低",
};

const toneOf = (score: number) => {
  if (score >= 82) return "strong";
  if (score >= 68) return "medium";
  return "weak";
};

const readImageAsCompressedDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("IMAGE_CANVAS_UNAVAILABLE"));
        return;
      }
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_LOAD_FAILED"));
    };
    image.src = objectUrl;
  });

const buildJobDiscoveryAgents = (resume: StructuredResume) => {
  const targets = resume.targetRoles.slice(0, 3).join("、") || "学生简历中最匹配的岗位";
  const education = resume.education.slice(0, 2).join("、") || "专业背景";
  return [
    { focus: `高相关岗位：优先围绕 ${targets} 和 ${education} 推荐`, jobCount: 2 },
    { focus: "相邻可迁移岗位：根据项目、校园经历和可迁移能力推荐", jobCount: 2 },
    { focus: "成长型岗位：适合学生补强后投递或作为实习起点", jobCount: 2 },
  ];
};

const normalizeJobKey = (job: Job) => `${job.title.trim().toLowerCase()}-${job.track.trim().toLowerCase()}`;

const superviseRecommendedJobs = (jobs: Job[]) => {
  const usedKeys = new Set<string>();
  return jobs
    .filter((job) => {
      const key = normalizeJobKey(job);
      if (usedKeys.has(key)) return false;
      usedKeys.add(key);
      return true;
    })
    .map((job, index) => ({
      ...job,
      id: job.id || `agent-job-${index + 1}`,
      responsibilities: job.responsibilities.slice(0, 5),
      requirements: job.requirements.slice(0, 5),
      bonus: job.bonus.slice(0, 5),
      keywords: job.keywords.slice(0, 8),
    }))
    .slice(0, 6);
};

function App() {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customJdText, setCustomJdText] = useState("");
  const [structuredResume, setStructuredResume] = useState<StructuredResume | null>(null);
  const [modelJobs, setModelJobs] = useState<Job[]>([]);
  const [modelInsight, setModelInsight] = useState("");
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelMessage, setModelMessage] = useState("");
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [interviewStatus, setInterviewStatus] = useState<"idle" | "listening" | "loading" | "ready" | "error">("idle");
  const [interviewMessage, setInterviewMessage] = useState("");
  const [videoMode, setVideoMode] = useState<"idle" | "preview" | "blocked">("idle");
  const [uploadMessage, setUploadMessage] = useState("请上传简历文本/图片，或直接粘贴简历内容开始分析。");
  const [resumeSource, setResumeSource] = useState("等待上传");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const customJob = useMemo(() => parseCustomJob(customTitle, customJdText), [customTitle, customJdText]);
  const activeProfile = useMemo(() => profileFromStructuredResume(structuredResume, resumeText), [structuredResume, resumeText]);
  const hasResume = resumeText.trim().length > 0;
  const hasWorkspaceInput = hasResume || Boolean(customJob);
  const availableJobs = useMemo(() => {
    if (!hasWorkspaceInput) return [];
    return customJob ? [customJob, ...modelJobs] : modelJobs;
  }, [customJob, hasWorkspaceInput, modelJobs]);
  const rankedJobs = useMemo(
    () =>
      [...availableJobs].sort(
        (left, right) =>
          analyzeMatch(activeProfile, right, resumeText).total - analyzeMatch(activeProfile, left, resumeText).total,
      ),
    [activeProfile, availableJobs, resumeText],
  );
  const selectedJob = rankedJobs.find((job) => job.id === selectedJobId) ?? rankedJobs[0] ?? customJob ?? emptyJob;
  const hasAnalysis = rankedJobs.length > 0;
  const result = useMemo(() => analyzeMatch(activeProfile, selectedJob, resumeText), [activeProfile, resumeText, selectedJob]);
  const optimizedDraft = useMemo(() => buildOptimizedResumeDraft(activeProfile, selectedJob, result), [activeProfile, selectedJob, result]);
  const [copyStatus, setCopyStatus] = useState("复制优化稿");

  const runJobRecommendations = async (nextResumeText: string, nextResume: StructuredResume) => {
    setPipelineStep("jobs");
    setModelMessage("岗位发现智能体正在并行生成推荐岗位");
    const agents = buildJobDiscoveryAgents(nextResume);
    const responses = await Promise.allSettled(
      agents.map((agent) =>
        callArkAgent(
          {
            task: "job-recommendations",
            resumeText: nextResumeText,
            resumeProfile: nextResume,
            jdText: customJdText,
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
    );

    if (!parsedJobs.length) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage("岗位推荐子任务均未返回有效结果，请补充简历信息后重试。");
      return;
    }

    setModelJobs(parsedJobs);
    setSelectedJobId(parsedJobs[0]?.id ?? "");
    setModelStatus("ready");
    setPipelineStep("done");
    setModelMessage(`已完成简历解析并生成 ${parsedJobs.length} 个模型推荐岗位`);
  };

  const runModelPipeline = async (nextResumeText: string) => {
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
      const parsedResume = parseStructuredResume(structureResponse.content);
      setStructuredResume(parsedResume);
      await runJobRecommendations(nextResumeText, parsedResume);
    } catch (error) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(error instanceof Error ? `模型返回格式无法解析：${error.message}` : "模型返回格式无法解析。");
    }
  };

  const handleUseCustomJob = async () => {
    if (!resumeText.trim()) {
      setModelStatus("error");
      setModelMessage("请先上传或粘贴简历，再让模型结合目标 JD 推荐岗位。");
      return;
    }
    setModelStatus("loading");
    setPipelineStep("jobs");
    setModelMessage("正在结合目标 JD 重新生成岗位推荐");
    if (!structuredResume) {
      await runModelPipeline(resumeText);
      return;
    }
    await runJobRecommendations(resumeText, structuredResume);
  };

  const handleDownloadReport = () => {
    if (!hasResume) return;
    const report = buildMatchReport(activeProfile, selectedJob, result, resumeText, optimizedDraft);
    downloadTextFile("kongming-match-report.md", report);
  };

  const handleCopyDraft = async () => {
    await navigator.clipboard.writeText(formatOptimizedResumeDraft(optimizedDraft));
    setCopyStatus("已复制");
    window.setTimeout(() => setCopyStatus("复制优化稿"), 1600);
  };

  const handleResumeUpload = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage("文件超过 4MB，请压缩或精简后再上传。");
      return;
    }
    if (file.type.startsWith("image/")) {
      setModelStatus("loading");
      setPipelineStep("intake");
      setModelMessage("正在识别图片简历");
      const imageDataUrl = await readImageAsCompressedDataUrl(file);
      const response = await callArkAgent({ task: "resume-vision", imageDataUrl });
      if (response.ok && response.content) {
        setResumeText(response.content);
        setModelInsight(response.content);
        setModelStatus("ready");
        setModelMessage(`已通过 ${response.model ?? "模型"} 识别图片简历`);
        setUploadMessage(`已识别 ${file.name}，画像、岗位排序和匹配结果已更新。`);
        setResumeSource("图片视觉识别");
        await runModelPipeline(response.content);
        return;
      }
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(response.error || "图片简历识别失败，请检查模型环境变量。");
      return;
    }
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setModelStatus("loading");
      setPipelineStep("intake");
      setModelMessage("正在解析 PDF 简历");
      const { readPdfResume } = await import("./pdfResumeReader");
      const pdfResult = await readPdfResume(file);
      if (pdfResult.method === "text-layer") {
        setResumeText(pdfResult.text);
        setModelStatus("ready");
        setModelMessage(`已从 PDF 文本层提取 ${pdfResult.text.length} 字`);
        setUploadMessage(`已解析 ${file.name}，共 ${pdfResult.pageCount} 页，画像、岗位排序和匹配结果已更新。`);
        setResumeSource(`PDF 文本层识别，质量 ${Math.round(pdfResult.quality * 100)}%`);
        await runModelPipeline(pdfResult.text);
        return;
      }

      if (pdfResult.imageDataUrls.length > 0) {
        const response = await callArkAgent({ task: "resume-vision", imageDataUrls: pdfResult.imageDataUrls });
        if (response.ok && response.content) {
          setResumeText(response.content);
          setModelInsight(response.content);
          setModelStatus("ready");
          setModelMessage(`PDF 文本层质量较低，已通过 ${response.model ?? "模型"} 视觉识别`);
          setUploadMessage(`已识别 ${file.name}，画像、岗位排序和匹配结果已更新。`);
          setResumeSource(`PDF 视觉识别，文本层质量 ${Math.round(pdfResult.quality * 100)}%`);
          await runModelPipeline(response.content);
          return;
        }
        setModelStatus("error");
        setPipelineStep("error");
        setModelMessage(response.error || "PDF 文本层质量较低，视觉识别未完成。");
        setUploadMessage(`未能稳定识别 ${file.name}，请尝试上传清晰图片或可复制文字的 PDF。`);
        setResumeSource(`PDF 识别失败，文本层质量 ${Math.round(pdfResult.quality * 100)}%`);
        return;
      }

      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage("PDF 文本层为空，且无法渲染页面用于视觉识别。");
      setUploadMessage(`未能识别 ${file.name}，请上传清晰图片或文本版简历。`);
      setResumeSource("PDF 识别失败");
      return;
    }
    const text = await file.text();
    setResumeText(text);
    setUploadMessage(`已读取 ${file.name}，共 ${text.trim().length} 字，画像、岗位排序和匹配结果已更新。`);
    setResumeSource("文本文件读取");
    await runModelPipeline(text);
  };

  const handleModelAnalysis = async () => {
    if (!hasResume || !hasAnalysis) {
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
      matchResult: result,
    });

    if (response.ok && response.content) {
      setModelInsight(response.content);
      setModelStatus("ready");
      setPipelineStep("done");
      setModelMessage(`已通过 ${response.model ?? "模型"} 完成增强分析`);
      return;
    }

    setModelStatus("error");
    setPipelineStep("error");
    setModelMessage(response.error || "模型增强分析失败，请检查运行环境。");
  };

  const handleSpeechInput = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setInterviewStatus("error");
      setInterviewMessage("当前浏览器不支持语音转写，请先使用文本回答。");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setInterviewStatus("listening");
      setInterviewMessage("正在收听回答，结束后会自动写入文本框。");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("")
        .trim();
      if (transcript) {
        setInterviewAnswer((current) => [current, transcript].filter(Boolean).join("\n"));
      }
      setInterviewStatus("idle");
      setInterviewMessage(transcript ? "已完成语音转写，可继续补充后提交反馈。" : "未识别到有效语音，请重试或直接输入文本。");
    };
    recognition.onerror = () => {
      setInterviewStatus("error");
      setInterviewMessage("语音转写未完成，请检查浏览器麦克风权限。");
    };
    recognition.onend = () => {
      setInterviewStatus((current) => (current === "listening" ? "idle" : current));
    };
    recognition.start();
  };

  const handleVideoPreview = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVideoMode("blocked");
      setInterviewMessage("当前浏览器不支持摄像头预览。");
      return;
    }

    try {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setVideoMode("preview");
      setInterviewMessage("视频面试预览已开启；后续可接入实时对话或数字人渲染。");
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 0);
    } catch {
      setVideoMode("blocked");
      setInterviewMessage("未获得摄像头或麦克风权限，仍可使用文本模拟面试。");
    }
  };

  const handleInterviewFeedback = async () => {
    if (!hasResume || !hasAnalysis) {
      setInterviewStatus("error");
      setInterviewMessage("请先完成简历解析和岗位匹配，再进行模拟面试。");
      return;
    }
    if (!interviewAnswer.trim()) {
      setInterviewStatus("error");
      setInterviewMessage("请先输入或转写一段面试回答。");
      return;
    }

    setInterviewStatus("loading");
    setInterviewMessage("正在调用模型评估面试回答");
    const response = await callArkAgent({
      task: "interview-feedback",
      selectedJob,
      matchResult: result,
      interviewAnswer,
    });

    if (response.ok && response.content) {
      setInterviewFeedback(response.content);
      setInterviewStatus("ready");
      setInterviewMessage(`已通过 ${response.model ?? "模型"} 完成面试反馈`);
      return;
    }

    setInterviewStatus("error");
    setInterviewMessage(response.error || "模拟面试反馈生成失败，请检查模型服务。");
  };

  return (
    <main className="app-shell">
      <Hero result={result} selectedJob={selectedJob} isReady={hasAnalysis} />

      <section className="workflow" aria-label="产品工作流">
        <WorkflowStep index="01" title="学生画像" text="识别专业、经历、技能与求职偏好" />
        <WorkflowStep index="02" title="岗位捕手" text="筛选高匹配岗位并解释推荐原因" />
        <WorkflowStep index="03" title="初筛优化" text="定位关键词缺口与经历表达问题" />
        <WorkflowStep index="04" title="投递行动" text="输出投递前可执行清单" />
      </section>

      <ProcessState hasResume={hasResume} customJob={customJob} resumeSource={resumeSource} modelStatus={modelStatus} pipelineStep={pipelineStep} />

      <section className="dashboard">
        <aside className="profile-column">
          <Panel eyebrow="Profile" title="学生画像" icon={<FileText size={18} />}>
            <div className="identity-card">
              <div>
                <span>{structuredResume?.education[0] || "等待模型解析"}</span>
                <strong>{activeProfile.name}</strong>
                <p>{activeProfile.target}</p>
              </div>
              <small>{structuredResume?.summary || "上传简历后由模型提取学生画像。"}</small>
            </div>

            <ResumeSections structuredResume={structuredResume} />

            <InfoBlock title="简历文本">
              <label className="upload-control">
                <Upload size={15} />
                上传简历文本或图片
                <input
                  type="file"
                  accept=".txt,.md,.text,.pdf,application/pdf,image/*"
                  onChange={(event) => {
                    void handleResumeUpload(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <p className="upload-message">{uploadMessage}</p>
              <textarea
                value={resumeText}
                onChange={(event) => {
                  setResumeText(event.target.value);
                  setStructuredResume(null);
                  setModelJobs([]);
                  setSelectedJobId("");
                  setModelInsight("");
                  setModelStatus("idle");
                  setModelMessage("");
                  setPipelineStep(event.target.value.trim() ? "intake" : "idle");
                  setResumeSource(event.target.value.trim() ? "手动文本输入" : "等待上传");
                  setUploadMessage(`已读取当前文本 ${event.target.value.trim().length} 字。点击下方按钮后由模型解析画像和岗位。`);
                }}
                aria-label="简历文本"
              />
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={() => void runModelPipeline(resumeText)}
                disabled={!resumeText.trim() || modelStatus === "loading"}
              >
                <Sparkles size={16} />
                解析简历并推荐岗位
              </button>
            </InfoBlock>
          </Panel>
        </aside>

        <section className="match-column">
          <Panel eyebrow="Matching" title="岗位匹配工作台" icon={<BriefcaseBusiness size={18} />}>
            <div className="jd-lab">
              <div className="section-head compact">
                <div>
                  <span>JD Parser</span>
                  <h3>粘贴目标岗位 JD</h3>
                </div>
                <p>系统会抽取方向、城市和关键词，并加入下方岗位列表参与匹配。</p>
              </div>
              <div className="field-row">
                <label>
                  <span>岗位名称</span>
                  <input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="不填时从 JD 自动识别" />
                </label>
              </div>
              <textarea className="jd-textarea" value={customJdText} onChange={(event) => setCustomJdText(event.target.value)} aria-label="目标岗位 JD" />
              <div className="jd-actions">
                <button type="button" className="primary-action" onClick={() => void handleUseCustomJob()} disabled={!customJob || !hasResume || modelStatus === "loading"}>
                  <Search size={16} />
                  分析该岗位
                </button>
                <span>{customJob ? `已识别 ${customJob.keywords.length} 个关键词` : "JD 至少需要 20 个字"}</span>
              </div>
            </div>

            {hasAnalysis ? (
              <>
                <div className="job-board">
                  {rankedJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      active={job.id === selectedJob.id}
                      result={analyzeMatch(activeProfile, job, resumeText)}
                      onSelect={() => setSelectedJobId(job.id)}
                    />
                  ))}
                </div>

                <div className="selected-job">
                  <div className="selected-job-head">
                    <div>
                      <span>{selectedJob.companyScenario}</span>
                      <h2>{selectedJob.title}</h2>
                      <p>{selectedJob.summary}</p>
                    </div>
                    <div className={`score-badge ${toneOf(result.total)}`}>
                      <strong>{result.total}</strong>
                      <span>{result.verdict}</span>
                    </div>
                  </div>

                  <div className="job-detail-grid">
                    <InfoBlock title="岗位职责">
                      <BulletList items={selectedJob.responsibilities} />
                    </InfoBlock>
                    <InfoBlock title="岗位要求">
                      <BulletList items={selectedJob.requirements} />
                    </InfoBlock>
                    <InfoBlock title="加分项">
                      <BulletList items={selectedJob.bonus} />
                    </InfoBlock>
                  </div>
                </div>

                <div className="chart-card">
                  <div className="section-head">
                    <div>
                      <span>Match Score</span>
                      <h3>五维匹配评分</h3>
                    </div>
                    <p>评分用于辅助求职决策，不代表企业筛选结果。</p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={result.dimensions} margin={{ top: 10, right: 16, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbeafe" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
                      <Bar dataKey="score" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <EmptyState title="暂无匹配结果" text="上传简历后会生成岗位推荐；粘贴 JD 后会优先分析目标岗位。" />
            )}
          </Panel>
        </section>

        <aside className="insight-column">
          <Panel eyebrow="AI Insight" title="初筛命中率提升建议" icon={<Lightbulb size={18} />}>
            {hasAnalysis ? (
              <>
                <div className={`verdict-card ${toneOf(result.total)}`}>
                  <div>
                    <span>匹配结论</span>
                    <strong>{result.verdict}</strong>
                    <p>基于简历文本、学生画像和目标岗位要求生成。</p>
                  </div>
                  <b>{result.total}</b>
                </div>

                <button type="button" className="secondary-action" onClick={handleDownloadReport} disabled={!hasResume || !hasAnalysis}>
                  <ArrowDownToLine size={16} />
                  下载分析报告
                </button>

                <button type="button" className="secondary-action" onClick={() => void handleModelAnalysis()} disabled={modelStatus === "loading" || !hasResume || !hasAnalysis}>
                  <Sparkles size={16} />
                  {modelStatus === "loading" ? "模型分析中" : "模型增强分析"}
                </button>

                {(modelMessage || modelInsight) && (
                  <InfoBlock title="模型增强结果">
                    <div className={`model-insight ${modelStatus}`}>
                      {modelMessage ? <strong>{modelMessage}</strong> : null}
                      {modelInsight ? <p>{modelInsight}</p> : null}
                    </div>
                  </InfoBlock>
                )}

                <InfoBlock title="匹配优势">
                  <BulletList items={result.strengths} icon="check" />
                </InfoBlock>

                <InfoBlock title="风险与差距">
                  <BulletList items={result.risks} icon="risk" />
                </InfoBlock>

                <InfoBlock title="关键词覆盖">
                  <div className="keyword-box">
                    <div>
                      <span>已覆盖</span>
                      <TagList items={result.coveredKeywords} compact />
                    </div>
                    <div>
                      <span>需补强</span>
                      <TagList items={result.missingKeywords} compact muted />
                    </div>
                  </div>
                </InfoBlock>

                <InfoBlock title="简历优化动作">
                  <div className="action-stack">
                    {result.resumeActions.map((action) => (
                      <article key={action.title}>
                        <span>{action.impact}</span>
                        <strong>{action.title}</strong>
                        <p>{action.detail}</p>
                      </article>
                    ))}
                  </div>
                </InfoBlock>

                <InfoBlock title="优化后简历片段">
                  <div className="draft-card">
                    <div>
                      <span>个人总结</span>
                      <p>{optimizedDraft.summary}</p>
                    </div>
                    <div>
                      <span>项目经历改写</span>
                      <ul>
                        {optimizedDraft.projectBullets.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span>技能关键词</span>
                      <p>{optimizedDraft.skillLine}</p>
                    </div>
                    <button type="button" className="secondary-action compact-action" onClick={handleCopyDraft}>
                      {copyStatus}
                    </button>
                  </div>
                </InfoBlock>

                <InfoBlock title="模拟面试">
                  <div className="interview-studio">
                    <div className={`video-preview ${videoMode}`}>
                      {videoMode === "preview" ? <video ref={videoRef} autoPlay muted playsInline aria-label="视频面试预览" /> : <Video size={22} />}
                      <span>{videoMode === "preview" ? "视频预览中" : "视频对话接口预留"}</span>
                    </div>
                    <p>围绕当前岗位进行问答练习；现阶段支持文本与浏览器语音转写，后续可扩展为实时音视频对话。</p>
                    <textarea
                      className="interview-textarea"
                      value={interviewAnswer}
                      onChange={(event) => setInterviewAnswer(event.target.value)}
                      aria-label="模拟面试回答"
                      placeholder="输入或语音转写你的回答，例如：请介绍一个与你目标岗位相关的项目经历。"
                    />
                    <div className="interview-actions">
                      <button type="button" className="secondary-action compact-action" onClick={handleSpeechInput} disabled={interviewStatus === "listening" || interviewStatus === "loading"}>
                        <Mic size={16} />
                        {interviewStatus === "listening" ? "收听中" : "语音转写"}
                      </button>
                      <button type="button" className="secondary-action compact-action" onClick={() => void handleVideoPreview()}>
                        <Video size={16} />
                        视频预览
                      </button>
                      <button type="button" className="primary-action compact-action" onClick={() => void handleInterviewFeedback()} disabled={interviewStatus === "loading"}>
                        <Sparkles size={16} />
                        {interviewStatus === "loading" ? "评估中" : "生成反馈"}
                      </button>
                    </div>
                    {(interviewMessage || interviewFeedback) && (
                      <div className={`model-insight ${interviewStatus === "error" ? "error" : ""}`}>
                        {interviewMessage ? <strong>{interviewMessage}</strong> : null}
                        {interviewFeedback ? <p>{interviewFeedback}</p> : null}
                      </div>
                    )}
                  </div>
                </InfoBlock>

                <InfoBlock title="投递前清单">
                  <ol className="checklist">
                    {result.actionPlan.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </InfoBlock>
              </>
            ) : (
              <div>
                <EmptyState title="等待分析" text="当前没有简历或岗位输入。上传简历后，这里会生成匹配结论、关键词覆盖、优化动作和投递清单。" />
                <button type="button" className="secondary-action" onClick={() => void handleModelAnalysis()}>
                  <Sparkles size={16} />
                  模型增强分析
                </button>
                {modelMessage ? (
                  <InfoBlock title="模型增强结果">
                    <div className={`model-insight ${modelStatus}`}>
                      <strong>{modelMessage}</strong>
                    </div>
                  </InfoBlock>
                ) : null}
              </div>
            )}
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function Hero({ result, selectedJob, isReady }: { result: MatchResult; selectedJob: Job; isReady: boolean }) {
  return (
    <header className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          <Sparkles size={16} />
          学生求职匹配智能体
        </div>
        <h1>孔明职配</h1>
        <p>面向校园招聘与实习求职场景，把学生画像、岗位 JD 和简历文本转化为可解释的岗位推荐、差距诊断与简历优化建议。</p>
        <div className="hero-actions">
          <span><ShieldCheck size={16} />可解释评分</span>
          <span><Search size={16} />岗位优先级</span>
          <span><ClipboardCheck size={16} />初筛优化</span>
        </div>
      </div>
      <div className="hero-card">
        {isReady ? (
          <>
            <span>当前分析</span>
            <strong>{selectedJob.title}</strong>
            <div className="hero-score">
              <b>{result.total}</b>
              <div>
                <small>{result.verdict}</small>
                <i style={{ width: `${result.total}%` }} />
              </div>
            </div>
            <p>已覆盖 {result.coveredKeywords.length} 个岗位关键词，仍需补强 {result.missingKeywords.length} 个关键词。</p>
          </>
        ) : (
          <div className="hero-empty">
            <span>初始化状态</span>
            <strong>等待简历与岗位输入</strong>
            <p>上传或粘贴简历后，将生成学生画像、岗位推荐与优化建议。</p>
          </div>
        )}
      </div>
    </header>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </section>
  );
}

function ResumeSections({ structuredResume }: { structuredResume: StructuredResume | null }) {
  const sections = [
    { title: "学历", items: structuredResume?.education ?? [] },
    { title: "实习经历", items: structuredResume?.internships ?? [] },
    { title: "项目经历", items: structuredResume?.projects ?? [] },
    { title: "校园经历", items: structuredResume?.campus ?? [] },
    { title: "荣誉证书", items: structuredResume?.honors ?? [] },
  ];

  if (!structuredResume) {
    return (
      <div className="resume-section-stack">
        {sections.map((section) => (
          <details key={section.title} className="resume-section-card" open={section.title === "学历"}>
            <summary>{section.title}</summary>
            <p>等待模型解析。</p>
          </details>
        ))}
      </div>
    );
  }

  return (
    <div className="resume-section-stack">
      {sections.map((section, index) => (
        <details key={section.title} className="resume-section-card" open={index < 2}>
          <summary>{section.title}</summary>
          {section.items.length ? (
            <ul>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p>简历中未识别到明确内容。</p>
          )}
        </details>
      ))}
      <details className="resume-section-card">
        <summary>技能与求职方向</summary>
        <TagList items={[...structuredResume.skills, ...structuredResume.targetRoles]} compact />
      </details>
    </div>
  );
}

function WorkflowStep({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <article>
      <span>{index}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function ProcessState({
  hasResume,
  customJob,
  resumeSource,
  modelStatus,
  pipelineStep,
}: {
  hasResume: boolean;
  customJob: Job | null;
  resumeSource: string;
  modelStatus: "idle" | "loading" | "ready" | "error";
  pipelineStep: PipelineStep;
}) {
  const steps = [
    { id: "intake", label: "接收简历" },
    { id: "structure", label: "解析画像" },
    { id: "jobs", label: "生成岗位" },
    { id: "analysis", label: "匹配建议" },
  ];
  const progressIndex = pipelineStep === "done" ? steps.length : pipelineStep === "error" ? Math.max(1, steps.findIndex((step) => step.id === pipelineStep) + 1) : steps.findIndex((step) => step.id === pipelineStep) + 1;
  const progress = !hasResume && pipelineStep === "idle" ? 0 : Math.max(0, Math.min(100, Math.round((progressIndex / steps.length) * 100)));
  const items = [
    { label: "简历识别", value: hasResume ? resumeSource : "等待上传" },
    { label: "岗位输入", value: customJob ? "已识别目标 JD" : "使用画像推荐岗位" },
    { label: "模型状态", value: modelStatus === "loading" ? "处理中" : modelStatus === "ready" ? "已完成" : modelStatus === "error" ? "需处理" : "待调用" },
  ];
  return (
    <section className="process-state" aria-label="分析状态">
      <div className="section-head">
        <div>
          <span>Process</span>
          <h2>识别与分析状态</h2>
        </div>
        <p>{modelStatus === "loading" ? "正在处理当前简历。" : modelStatus === "ready" ? "当前分析已完成。" : modelStatus === "error" ? "处理未完成，请查看提示。" : "等待输入简历。"}</p>
      </div>
      <div className={`pipeline-progress ${modelStatus}`}>
        <div className="pipeline-bar" aria-label="模型解析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} role="progressbar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="pipeline-steps">
          {steps.map((step, index) => {
            const active = step.id === pipelineStep;
            const done = pipelineStep === "done" || index < progressIndex - 1;
            return (
              <span key={step.id} className={active ? "active" : done ? "done" : ""}>
                {step.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="process-grid">
        {items.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function Panel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>{icon}</div>
        <section>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </section>
      </div>
      {children}
    </section>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="info-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function JobCard({ job, active, result, onSelect }: { job: Job; active: boolean; result: MatchResult; onSelect: () => void }) {
  return (
    <button className={`job-card ${active ? "active" : ""}`} onClick={onSelect} type="button">
      <div className="job-card-top">
        <span>{job.track}</span>
        <small>优先级 {job.priority}</small>
      </div>
      <strong>{job.title}</strong>
      <p>{job.city} · {job.level} · {job.companyScenario}</p>
      <div className="job-card-bottom">
        <b>{result.total}</b>
        <i style={{ width: `${result.total}%` }} />
      </div>
    </button>
  );
}

function TagList({ items, compact = false, muted = false }: { items: string[]; compact?: boolean; muted?: boolean }) {
  return (
    <div className={`tag-list ${compact ? "compact" : ""} ${muted ? "muted" : ""}`}>
      {items.length ? items.map((item) => <span key={item}>{item}</span>) : <span>暂无</span>}
    </div>
  );
}

function BulletList({ items, icon }: { items: string[]; icon?: "check" | "risk" }) {
  return (
    <ul className={`bullet-list ${icon ?? ""}`}>
      {items.map((item) => (
        <li key={item}>
          {icon === "check" ? <CheckCircle2 size={15} /> : null}
          {icon === "risk" ? <ArrowUpRight size={15} /> : null}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default App;
