import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Lightbulb,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  SendHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
} from "lucide-react";
import { faClipboardCheck, faUserAstronaut, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { animate, stagger } from "animejs";
import { gsap } from "gsap";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Job } from "./data";
import { callArkAgent } from "./arkClient";
import { buildCareerOpsEvaluation } from "./careerOps";
import { parseCustomJob } from "./jobParser";
import { analyzeMatch, type MatchResult } from "./matchEngine";
import { parseJdAnalysis, parseModelJobs, parseStructuredResume, profileFromStructuredResume, type StructuredResume } from "./modelParsers";
import { buildMatchReport, downloadTextFile } from "./report";
import { buildOptimizedResumeDraft, formatOptimizedResumeDraft } from "./resumeOptimizer";
import AIAssistantPage from "./pages/AIAssistantPage";
import HomePage from "./pages/HomePage";
import InterviewPage from "./pages/InterviewPage";
import LoadingScreen from "./LoadingScreen";
import homeHeroVideo from "./assets/home-hero-video.mp4";

const MAX_UPLOAD_BYTES = 4_000_000;
const INTRO_CELLS = Array.from({ length: 112 }, (_, index) => index);
const INTRO_PARTICLES = Array.from({ length: 228 }, (_, index) => index);
const INTRO_RESUME_LINES = Array.from({ length: 16 }, (_, index) => index);
const INTRO_HOLO_DOTS = Array.from({ length: 96 }, (_, index) => index);
const HERO_PARTICLES = Array.from({ length: 22 }, (_, index) => index);
const HERO_RING_PARTICLES = Array.from({ length: 18 }, (_, index) => index);
const GALAXY_PARTICLES = Array.from({ length: 72 }, (_, index) => index);
const HERO_METRICS = ["Profile", "Match", "Interview", "Chat"];
const INTRO_MARKS = ["01", "02", "03", "04", "05"];

function FontAwesomeShapeIcon({ icon, size = 16 }: { icon: IconDefinition; size?: number }) {
  const [width, height, , , pathData] = icon.icon;
  const paths = Array.isArray(pathData) ? pathData : [pathData];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${width} ${height}`} fill="currentColor" aria-hidden="true" focusable="false">
      {paths.map((path, index) => (
        <path key={`${icon.iconName}-${index}`} d={path} />
      ))}
    </svg>
  );
}

type PipelineStep = "idle" | "intake" | "structure" | "jobs" | "analysis" | "done" | "error";
type JdPipelineStep = "idle" | "parse" | "evaluate" | "links" | "done" | "error";
type ActivePage = "home" | "resume" | "jobs" | "interview" | "assistant";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
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

const introParticleData = (index: number) => {
  const seed = Math.sin((index + 1) * 12.9898) * 43758.5453;
  const rand = seed - Math.floor(seed);
  const orbit = 220 + (index % 47) * 8;
  const angle = index * 2.399963 + rand * 0.6;
  const sx = Math.cos(angle) * orbit;
  const sy = Math.sin(angle) * orbit * 0.58;
  const sz = ((index % 19) - 9) * 18;
  const mx = Math.cos(angle * 0.72) * (132 + (index % 29) * 6);
  const my = Math.sin(angle * 1.12) * (86 + (index % 23) * 5);
  const mz = Math.sin(index * 0.38) * 180;
  let tx = 0;
  let ty = 0;
  let tz = 0;
  let group = "paper";

  if (index < 116) {
    const col = index % 14;
    const row = Math.floor(index / 14);
    const edge = row === 0 || row === 7 || col === 0 || col === 13;
    tx = (col - 6.5) * 15 + (edge ? Math.sin(row) * 2 : 0);
    ty = (row - 3.5) * 17 - 78;
    tz = edge ? 28 : 8;
    group = edge ? "paper-edge" : "paper-fill";
  } else if (index < 150) {
    const local = index - 116;
    const col = local % 17;
    const row = Math.floor(local / 17);
    tx = (col - 8) * 10;
    ty = row * 18 - 114;
    tz = 36;
    group = "paper-line";
  } else if (index < 190) {
    const local = index - 150;
    const t = local / 39;
    tx = -82 + t * 164;
    ty = 28 + Math.sin(t * Math.PI) * 42;
    tz = 24;
    group = "hand";
  } else if (index < 218) {
    const local = index - 190;
    const finger = Math.floor(local / 7);
    const step = local % 7;
    tx = -58 + finger * 30 + Math.sin(step) * 4;
    ty = -8 + step * 10 - Math.max(0, finger - 1) * 3;
    tz = 40;
    group = "finger";
  } else {
    const local = index - 218;
    tx = 54 + local * 7;
    ty = 32 - local * 5;
    tz = 46;
    group = "thumb";
  }

  return {
    sx: sx.toFixed(2),
    sy: sy.toFixed(2),
    sz: sz.toFixed(2),
    mx: mx.toFixed(2),
    my: my.toFixed(2),
    mz: mz.toFixed(2),
    tx: tx.toFixed(2),
    ty: ty.toFixed(2),
    tz: tz.toFixed(2),
    scale: (0.62 + rand * 0.7).toFixed(2),
    group,
  };
};

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
    { focus: `高相关岗位：优先围绕 ${targets} 和 ${education} 推荐，偏专业核心岗位`, jobCount: 3 },
    { focus: "相邻可迁移岗位：根据项目、校园经历、数据能力和可迁移能力推荐", jobCount: 3 },
    { focus: "成长型岗位：适合学生补强后投递或作为实习起点", jobCount: 3 },
  ];
};

const normalizeRoleText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "")
    .trim();

const normalizeJobLevel = (job: Job) => (/实习|助理/.test(`${job.title} ${job.level}`) ? "intern" : "regular");

const normalizeJobKey = (job: Job) => `${normalizeRoleText(job.title)}-${normalizeJobLevel(job)}`;

const superviseRecommendedJobs = (jobs: Job[]) => {
  const usedKeys = new Set<string>();
  const usedIds = new Set<string>();
  const normalizedJobs = jobs
    .filter((job) => {
      const key = normalizeJobKey(job);
      if (key.length < 2) return false;
      if (usedKeys.has(key)) return false;
      usedKeys.add(key);
      return true;
    })
    .map((job, index) => ({
      ...job,
      id: `${normalizeRoleText(job.id || job.title || "agent-job") || "agent-job"}-${index + 1}`,
      applicationLinks: job.applicationLinks,
      responsibilities: job.responsibilities.slice(0, 5),
      requirements: job.requirements.slice(0, 5),
      bonus: job.bonus.slice(0, 5),
      keywords: job.keywords.slice(0, 8),
    }))
    .slice(0, 6);
  return normalizedJobs.map((job, index) => {
    let nextId = job.id;
    while (usedIds.has(nextId)) {
      nextId = `${job.id}-${index + 1}`;
    }
    usedIds.add(nextId);
    return { ...job, id: nextId };
  });
};

function App() {
  const [introVisible, setIntroVisible] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customJdText, setCustomJdText] = useState("");
  const [customJobs, setCustomJobs] = useState<Job[]>([]);
  const [structuredResume, setStructuredResume] = useState<StructuredResume | null>(null);
  const [modelJobs, setModelJobs] = useState<Job[]>([]);
  const [modelInsight, setModelInsight] = useState("");
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelMessage, setModelMessage] = useState("");
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [jdStatus, setJdStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [jdStep, setJdStep] = useState<JdPipelineStep>("idle");
  const [jdMessage, setJdMessage] = useState("等待意向岗位输入");
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [interviewStatus, setInterviewStatus] = useState<"idle" | "listening" | "loading" | "ready" | "error">("idle");
  const [interviewMessage, setInterviewMessage] = useState("");
  const [videoMode, setVideoMode] = useState<"idle" | "preview" | "blocked">("idle");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "listening" | "loading" | "ready" | "error">("idle");
  const [chatMessage, setChatMessage] = useState("");
  const [activePage, setActivePage] = useState<ActivePage>("home");
  const [uploadMessage, setUploadMessage] = useState("请上传简历文本/图片，或直接粘贴简历内容开始分析。");
  const [resumeSource, setResumeSource] = useState("等待上传");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  const activeProfile = useMemo(() => profileFromStructuredResume(structuredResume, resumeText), [structuredResume, resumeText]);
  const hasResume = resumeText.trim().length > 0;
  const hasWorkspaceInput = hasResume || customJobs.length > 0;
  const availableJobs = useMemo(() => {
    if (!hasWorkspaceInput) return [];
    return [...customJobs, ...modelJobs];
  }, [customJobs, hasWorkspaceInput, modelJobs]);
  const rankedJobs = useMemo(
    () =>
      [...availableJobs].sort(
        (left, right) =>
          analyzeMatch(activeProfile, right, resumeText).total - analyzeMatch(activeProfile, left, resumeText).total,
      ),
    [activeProfile, availableJobs, resumeText],
  );
  const selectedJob = rankedJobs.find((job) => job.id === selectedJobId) ?? rankedJobs[0] ?? emptyJob;
  const hasAnalysis = rankedJobs.length > 0;
  const result = useMemo(() => analyzeMatch(activeProfile, selectedJob, resumeText), [activeProfile, resumeText, selectedJob]);
  const optimizedDraft = useMemo(() => buildOptimizedResumeDraft(activeProfile, selectedJob, result), [activeProfile, selectedJob, result]);
  const careerOpsEvaluation = useMemo(() => buildCareerOpsEvaluation(activeProfile, selectedJob, result), [activeProfile, selectedJob, result]);
  const [copyStatus, setCopyStatus] = useState("复制优化稿");

  useEffect(() => {
    chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, chatStatus]);

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

    let resumeProfile = structuredResume;
    if (!resumeProfile) {
      const structureResponse = await callArkAgent({ task: "resume-structure", resumeText });
      if (!structureResponse.ok || !structureResponse.content) {
        setJdStatus("error");
        setJdStep("error");
        setJdMessage(structureResponse.error || "简历画像解析失败，无法评估意向岗位。");
        return;
      }
      try {
        resumeProfile = parseStructuredResume(structureResponse.content);
        setStructuredResume(resumeProfile);
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
        resumeProfile,
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
        responsibilities: analysis.responsibilities.length ? analysis.responsibilities : draftJob.responsibilities,
        requirements: analysis.requirements.length ? analysis.requirements : draftJob.requirements,
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
      setJdMessage(error instanceof Error ? `意向岗位结果解析失败：${error.message}` : "意向岗位结果解析失败。");
    }
  };

  const handleDownloadReport = () => {
    if (!hasResume) return;
    const report = buildMatchReport(activeProfile, selectedJob, result, resumeText, optimizedDraft, careerOpsEvaluation);
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
        setModelMessage("已完成图片简历识别");
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
          setModelMessage("PDF 文本层质量较低，已完成视觉识别");
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
      setModelMessage("已完成增强分析");
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
      setInterviewMessage("已完成面试反馈");
      return;
    }

    setInterviewStatus("error");
    setInterviewMessage(response.error || "模拟面试反馈生成失败，请检查模型服务。");
  };

  const handleChatSpeechInput = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setChatStatus("error");
      setChatMessage("当前浏览器不支持语音转写，请直接输入文字。");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setChatStatus("listening");
      setChatMessage("正在收听，结束后会写入输入框。");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((item) => item[0]?.transcript ?? "")
        .join("")
        .trim();
      if (transcript) {
        setChatInput((current) => [current, transcript].filter(Boolean).join(current.trim() ? "\n" : ""));
      }
      setChatStatus("idle");
      setChatMessage(transcript ? "已完成语音转写，可以继续编辑或发送。" : "未识别到有效语音，请重试或直接输入文字。");
    };
    recognition.onerror = () => {
      setChatStatus("error");
      setChatMessage("语音转写未完成，请检查浏览器麦克风权限。");
    };
    recognition.onend = () => {
      setChatStatus((current) => (current === "listening" ? "idle" : current));
    };
    recognition.start();
  };

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message || chatStatus === "loading") return;

    const nextUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    const history = [...chatMessages, nextUserMessage];
    setChatMessages(history);
    setChatInput("");
    setChatStatus("loading");
    setChatMessage("正在生成回复");

    const response = await callArkAgent(
      {
        task: "career-chat",
        userMessage: message,
        chatMessages: history.map(({ role, content }) => ({ role, content })),
        resumeText,
        resumeProfile: structuredResume,
        selectedJob: hasAnalysis ? selectedJob : undefined,
        matchResult: hasAnalysis ? result : undefined,
      },
      { timeoutMs: 45000 },
    );

    if (response.ok && response.content) {
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content ?? "",
        },
      ]);
      setChatStatus("ready");
      setChatMessage("已回复");
      return;
    }

    setChatStatus("error");
    setChatMessage(response.error || "AI 助手暂时无法回复，请稍后重试。");
  };

  const handleReadLatestReply = () => {
    const latestReply = [...chatMessages].reverse().find((message) => message.role === "assistant");
    if (!latestReply || !("speechSynthesis" in window)) {
      setChatStatus("error");
      setChatMessage("当前没有可朗读的回复，或浏览器不支持语音朗读。");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestReply.content);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
    setChatMessage("正在朗读最新回复");
  };

  if (introVisible) {
    return <LoadingScreen onFinish={() => setIntroVisible(false)} />;
  }

  return (
    <main className="app-shell">
      <AppNav activePage={activePage} onChange={setActivePage} />

      {activePage === "home" ? (
        <>
          <HomePage onNavigate={setActivePage} />
        </>
      ) : null}

      <section className={`dashboard dashboard-${activePage}`} hidden={activePage !== "resume" && activePage !== "jobs"}>
        <aside className="profile-column">
          <Panel eyebrow="Profile" title="学生画像" icon={<FileText size={18} />}>
            <ResumePipelineStatus hasResume={hasResume} resumeSource={resumeSource} modelStatus={modelStatus} pipelineStep={pipelineStep} />

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
                <FontAwesomeShapeIcon icon={faClipboardCheck} size={16} />
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
                  <h3>意向岗位 JD</h3>
                </div>
              </div>
              <JdPipelineStatus jdStatus={jdStatus} jdStep={jdStep} jdMessage={jdMessage} />
              <div className="field-row">
                <label>
                  <span>岗位名称</span>
                  <input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} />
                </label>
              </div>
              <textarea className="jd-textarea" value={customJdText} onChange={(event) => setCustomJdText(event.target.value)} aria-label="目标岗位 JD" placeholder="目标岗位 JD" />
              <div className="jd-actions">
                <button type="button" className="primary-action" onClick={() => void handleUseCustomJob()} disabled={(!customTitle.trim() && !customJdText.trim()) || !hasResume || jdStatus === "loading"}>
                  <Plus size={16} />
                  分析该岗位
                </button>
                <span>{jdMessage}</span>
              </div>
            </div>

            {customJobs.length ? (
              <div className="custom-job-list">
                {customJobs.map((job) => (
                  <article key={job.id}>
                    <div>
                      <span>{job.priority}优先级</span>
                      <strong>{job.title}</strong>
                      <p>{job.jdAnalysis?.conclusion || job.summary}</p>
                    </div>
                    <div className="custom-job-actions">
                      <button type="button" className="secondary-action compact-action" onClick={() => setSelectedJobId(job.id)}>
                        <Search size={15} />
                        查看
                      </button>
                      <button type="button" className="secondary-action compact-action" onClick={() => setCustomJobs((current) => current.filter((item) => item.id !== job.id))}>
                        <Trash2 size={15} />
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

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

                  {(selectedJob.applicationLinks?.length ?? 0) > 0 ? (
                    <div className="apply-panel">
                      <div className="apply-links">
                        {(selectedJob.applicationLinks ?? []).map((link) => (
                        <a key={`${selectedJob.id}-${link.company}`} href={link.url} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} />
                          {link.company}
                        </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedJob.jdAnalysis ? (
                    <div className="jd-analysis-panel">
                      <InfoBlock title="意向岗位分析">
                        <p>{selectedJob.jdAnalysis.conclusion}</p>
                      </InfoBlock>
                      <InfoBlock title="匹配证据">
                        <BulletList items={selectedJob.jdAnalysis.strengths} icon="check" />
                      </InfoBlock>
                      <InfoBlock title="补强建议">
                        <BulletList items={[...selectedJob.jdAnalysis.risks, ...selectedJob.jdAnalysis.actions]} icon="risk" />
                      </InfoBlock>
                    </div>
                  ) : null}

                  <div className="career-ops-panel">
                    <InfoBlock title="岗位深度评估">
                      <p>{careerOpsEvaluation.roleSummary}</p>
                      <p>{careerOpsEvaluation.positioning}</p>
                    </InfoBlock>
                    <InfoBlock title="要求匹配表">
                      <div className="requirement-matrix">
                        {careerOpsEvaluation.requirementMatrix.map((item) => (
                          <article key={item.requirement}>
                            <span className={item.status === "强匹配" ? "strong" : item.status === "可补强" ? "medium" : "weak"}>{item.status}</span>
                            <strong>{item.requirement}</strong>
                            <p>{item.evidence}</p>
                          </article>
                        ))}
                      </div>
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
                  <FontAwesomeShapeIcon icon={faWandMagicSparkles} size={16} />
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

                <InfoBlock title="投递前清单">
                  <ol className="checklist">
                    {careerOpsEvaluation.applicationChecklist.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </InfoBlock>

                <InfoBlock title="投递运营看板">
                  <div className="pipeline-board">
                    {careerOpsEvaluation.pipeline.map((item) => (
                      <article key={item.stage} className={item.status === "已完成" ? "done" : item.status === "进行中" ? "active" : ""}>
                        <span>{item.status}</span>
                        <strong>{item.stage}</strong>
                        <p>{item.action}</p>
                      </article>
                    ))}
                  </div>
                </InfoBlock>
              </>
            ) : (
              <div>
                <EmptyState title="等待分析" text="当前没有简历或岗位输入。上传简历后，这里会生成匹配结论、关键词覆盖、优化动作和投递清单。" />
                <button type="button" className="secondary-action" onClick={() => void handleModelAnalysis()}>
                  <FontAwesomeShapeIcon icon={faWandMagicSparkles} size={16} />
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

      {activePage === "assistant" ? (
        <section className="assistant-panel">
          <AIAssistantPage
            messages={chatMessages}
            input={chatInput}
            status={chatStatus}
            statusMessage={chatStatus === "loading" ? "正在生成回复" : chatStatus === "listening" ? "正在收听" : chatMessage}
            bodyRef={chatBodyRef}
            onInputChange={setChatInput}
            onSend={() => void handleSendChat()}
            onVoiceInput={handleChatSpeechInput}
          />
        </section>
      ) : null}

      <section className="assistant-panel legacy-assistant-panel" hidden>
        <Panel eyebrow="AI Assistant" title="求职 AI 助手" icon={<Bot size={18} />}>
          <div className="chat-shell">
            <div className="chat-topbar">
              <div>
                <ProductAvatar compact />
                <div>
                  <strong>求职 AI 助手</strong>
                  <span>结合当前简历、岗位和匹配结果进行自由对话</span>
                </div>
              </div>
              <small className={chatStatus === "error" ? "error" : ""}>{chatStatus === "loading" ? "正在生成回复" : chatStatus === "listening" ? "正在收听" : chatMessage || "就绪"}</small>
            </div>
            <div className="chat-body" ref={chatBodyRef} aria-live="polite">
              {chatMessages.length ? (
                chatMessages.map((message) => (
                  <article key={message.id} className={`chat-message ${message.role}`}>
                    {message.role === "assistant" ? <ProductAvatar compact /> : <span className="chat-user-avatar">你</span>}
                    <p>{message.content}</p>
                  </article>
                ))
              ) : (
                <div className="chat-empty">
                  <AssistantGalaxy />
                  <strong>可以直接开始交流</strong>
                  <p>输入你的问题，助手会结合当前简历、岗位和匹配结果回答；没有上下文时也可以自由交流。</p>
                </div>
              )}
              {chatStatus === "loading" ? (
                <article className="chat-message assistant pending">
                  <ProductAvatar compact />
                  <p>正在思考...</p>
                </article>
              ) : null}
            </div>
            <div className="chat-composer">
              <button type="button" className="composer-plus-button" aria-label="add context">
                <Plus size={20} />
              </button>
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendChat();
                  }
                }}
                aria-label="AI 助手输入"
                placeholder="输入想交流的内容"
              />
              <span className="composer-mode">Thinking</span>
              <button type="button" className={`composer-icon-button voice-action ${chatStatus === "listening" ? "listening" : ""}`} aria-label="voice input" onClick={handleChatSpeechInput} disabled={chatStatus === "listening" || chatStatus === "loading"}>
                <Mic size={18} />
              </button>
              <button type="button" className="composer-icon-button send-action" aria-label="send" onClick={() => void handleSendChat()} disabled={!chatInput.trim() || chatStatus === "loading"}>
                <ArrowUp size={20} />
              </button>
              <div className="chat-actions">
                <button type="button" className="secondary-action compact-action" onClick={handleChatSpeechInput} disabled={chatStatus === "listening" || chatStatus === "loading"}>
                  <Mic size={16} />
                  {chatStatus === "listening" ? "收听中" : "语音输入"}
                </button>
                <button type="button" className="secondary-action compact-action" onClick={handleReadLatestReply} disabled={!chatMessages.some((message) => message.role === "assistant")}>
                  <Volume2 size={16} />
                  朗读
                </button>
                <button type="button" className="primary-action compact-action" onClick={() => void handleSendChat()} disabled={!chatInput.trim() || chatStatus === "loading"}>
                  <SendHorizontal size={16} />
                  {chatStatus === "loading" ? "发送中" : "发送"}
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      {activePage === "interview" ? (
        <InterviewPage job={selectedJob} profile={activeProfile} resumeText={resumeText} hasAnalysis={hasAnalysis} />
      ) : null}
    </main>
  );
}

function IntroExperience({ onComplete }: { onComplete: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  const completeIntro = useCallback(() => {
    const root = rootRef.current;
    if (completedRef.current) return;
    completedRef.current = true;
    if (!root) {
      onComplete();
      return;
    }
    gsap.to(root, {
      autoAlpha: 0,
      scale: 0.985,
      duration: 0.42,
      ease: "power2.inOut",
      onComplete,
    });
  }, [onComplete]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = gsap.context(() => {
      gsap.set(root, { "--intro-progress": 0, "--rx": 0, "--ry": 0, "--mx": 0, "--my": 0 });
      gsap.fromTo(".intro-logo .product-avatar", { autoAlpha: 0, scale: 0.76, rotation: -14 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: reduceMotion ? 0 : 0.7, ease: "back.out(1.7)" });
      gsap.fromTo(".intro-mascot", { y: 26, scale: 0.86, rotationY: -18, autoAlpha: 0 }, { y: 0, scale: 1, rotationY: 0, autoAlpha: 1, duration: reduceMotion ? 0 : 0.9, ease: "back.out(1.4)", delay: reduceMotion ? 0 : 0.16 });
      gsap.fromTo(".intro-title span", { yPercent: 110, rotationX: -60, autoAlpha: 0 }, { yPercent: 0, rotationX: 0, autoAlpha: 1, duration: reduceMotion ? 0 : 0.86, stagger: 0.045, ease: "power3.out", delay: reduceMotion ? 0 : 0.12 });
      gsap.fromTo(".intro-copy", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: reduceMotion ? 0 : 0.64, ease: "power2.out", delay: reduceMotion ? 0 : 0.48 });
      gsap.fromTo(".intro-orbit", { scale: 0.84, rotation: -28, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: reduceMotion ? 0 : 0.9, ease: "power3.out", delay: reduceMotion ? 0 : 0.2 });
      gsap.to(".intro-orbit", { rotation: 360, duration: 18, repeat: -1, ease: "none" });
      gsap.to(".intro-mote", { y: reduceMotion ? 0 : -26, x: reduceMotion ? 0 : 14, duration: 3.6, repeat: reduceMotion ? 0 : -1, yoyo: true, stagger: { amount: 1.8, from: "random" }, ease: "sine.inOut" });
      const particles = gsap.utils.toArray<HTMLElement>(".intro-shape-particle");
      const read = (target: HTMLElement, key: string) => Number(target.dataset[key] || 0);
      gsap.set(".intro-shape", { rotationX: -8, rotationY: 0, rotationZ: 0 });
      gsap.set(particles, {
        x: (_index, target) => read(target as HTMLElement, "sx"),
        y: (_index, target) => read(target as HTMLElement, "sy"),
        z: (_index, target) => read(target as HTMLElement, "sz"),
        scale: 0.35,
        autoAlpha: 0,
      });
      const particleTimeline = gsap.timeline({ repeat: reduceMotion ? 0 : -1, repeatDelay: 0.7 });
      particleTimeline
        .to(particles, {
          autoAlpha: 0.85,
          scale: (_index, target) => read(target as HTMLElement, "scale"),
          duration: reduceMotion ? 0 : 1.6,
          stagger: { amount: 1.2, from: "random" },
          ease: "power2.out",
        })
        .to(
          ".intro-shape",
          {
            rotationY: reduceMotion ? 0 : 28,
            rotationX: reduceMotion ? 0 : 18,
            rotationZ: reduceMotion ? 0 : -8,
            duration: reduceMotion ? 0 : 4.2,
            ease: "power2.inOut",
          },
          0.4,
        )
        .to(
          particles,
          {
            x: (_index, target) => read(target as HTMLElement, "mx"),
            y: (_index, target) => read(target as HTMLElement, "my"),
            z: (_index, target) => read(target as HTMLElement, "mz"),
            duration: reduceMotion ? 0 : 4.2,
            stagger: { amount: 1.4, from: "center" },
            ease: "sine.inOut",
          },
          0.9,
        )
        .to(
          particles,
          {
            x: (_index, target) => read(target as HTMLElement, "tx"),
            y: (_index, target) => read(target as HTMLElement, "ty"),
            z: (_index, target) => read(target as HTMLElement, "tz"),
            scale: (_index, target) => read(target as HTMLElement, "scale") + 0.16,
            autoAlpha: 1,
            duration: reduceMotion ? 0 : 5.4,
            stagger: { amount: 1.8, from: "random" },
            ease: "power3.inOut",
          },
          4.1,
        )
        .to(
          ".intro-shape",
          {
            rotationY: reduceMotion ? 0 : -18,
            rotationX: reduceMotion ? 0 : 10,
            rotationZ: reduceMotion ? 0 : 4,
            duration: reduceMotion ? 0 : 5.4,
            ease: "power3.inOut",
          },
          4.1,
        )
        .to(particles, {
          scale: (_index, target) => read(target as HTMLElement, "scale") + 0.28,
          duration: reduceMotion ? 0 : 1.4,
          repeat: reduceMotion ? 0 : 1,
          yoyo: true,
          stagger: { amount: 0.9, from: "edges" },
          ease: "sine.inOut",
        });
    }, root);

    const cellAnimation = animate(root.querySelectorAll(".intro-cell"), {
      opacity: [0.08, 0.76],
      scale: [0.72, 1],
      duration: reduceMotion ? 1 : 1300,
      delay: stagger(18, { grid: [16, 7], from: "center" }),
      loop: reduceMotion ? false : true,
      alternate: true,
      ease: "inOutSine",
    });

    const rxTo = gsap.quickTo(root, "--rx", { duration: 0.42, ease: "power3.out" });
    const ryTo = gsap.quickTo(root, "--ry", { duration: 0.42, ease: "power3.out" });
    const mxTo = gsap.quickTo(root, "--mx", { duration: 0.32, ease: "power2.out" });
    const myTo = gsap.quickTo(root, "--my", { duration: 0.32, ease: "power2.out" });
    const progressTo = gsap.quickTo(root, "--intro-progress", { duration: 0.25, ease: "power2.out" });
    const idleProgressTween = gsap.to(root, {
      "--intro-progress": reduceMotion ? 36 : 78,
      duration: reduceMotion ? 0.2 : 8.4,
      ease: "power1.inOut",
      onUpdate: () => {
        const next = Number(gsap.getProperty(root, "--intro-progress"));
        if (!completedRef.current && next > progressRef.current) {
          progressRef.current = next;
          setProgress(Math.round(next));
        }
      },
    });

    const handlePointerMove = (event: MouseEvent) => {
      idleProgressTween.kill();
      const rect = root.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      rxTo(py * -9);
      ryTo(px * 12);
      mxTo(px * 44);
      myTo(py * 44);
      const next = Math.max(progressRef.current, Math.min(88, 10 + Math.hypot(px, py) * 116));
      progressRef.current = next;
      setProgress(Math.round(next));
      progressTo(next);
    };
    const handleWheel = (event: WheelEvent) => {
      idleProgressTween.kill();
      const next = Math.min(100, progressRef.current + Math.abs(event.deltaY) * 0.08);
      progressRef.current = next;
      setProgress(Math.round(next));
      progressTo(next);
      if (next >= 98) completeIntro();
    };

    root.addEventListener("mousemove", handlePointerMove);
    root.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      root.removeEventListener("mousemove", handlePointerMove);
      root.removeEventListener("wheel", handleWheel);
      idleProgressTween.kill();
      cellAnimation.revert();
      context.revert();
    };
  }, [completeIntro]);

  return (
    <main className="intro-stage" ref={rootRef} aria-label="产品进场动画">
      <div className="intro-grid" aria-hidden="true">
        {INTRO_CELLS.map((item) => (
          <span key={item} className="intro-cell" />
        ))}
      </div>
      <div className="intro-shape" aria-hidden="true">
        {INTRO_PARTICLES.map((item) => {
          const particle = introParticleData(item);
          return (
            <i
              key={item}
              className={`intro-shape-particle ${particle.group}`}
              data-sx={particle.sx}
              data-sy={particle.sy}
              data-sz={particle.sz}
              data-mx={particle.mx}
              data-my={particle.my}
              data-mz={particle.mz}
              data-tx={particle.tx}
              data-ty={particle.ty}
              data-tz={particle.tz}
              data-scale={particle.scale}
            />
          );
        })}
      </div>
      <div className="intro-hologram" aria-hidden="true">
        <div className="holo-orbit-field">
          {INTRO_HOLO_DOTS.map((item) => (
            <i
              key={item}
              style={
                {
                  "--angle": `${item * 13}deg`,
                  "--radius": `${160 + (item % 16) * 16}px`,
                  "--size": `${2 + (item % 4)}px`,
                  "--orbit-duration": `${8 + (item % 11) * 0.45}s`,
                  "--orbit-tilt": `${52 + (item % 9) * 3}deg`,
                  "--delay": `${item * -0.09}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="holo-paper">
          <span className="holo-avatar" />
          {INTRO_RESUME_LINES.map((item) => (
            <i
              key={item}
              style={
                {
                  "--line-top": `${34 + item * 24}px`,
                  "--line-width": `${118 + (item % 5) * 18}px`,
                  "--line-opacity": `${0.95 - (item % 4) * 0.08}`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="holo-hand left-hand" />
        <div className="holo-hand right-hand" />
        <div className="holo-scan scan-a" />
        <div className="holo-scan scan-b" />
      </div>
      <section className="intro-panel">
        <div className="intro-logo">
          <ProductAvatar compact />
          <div>
            <strong>孔明职配</strong>
            <small>Kongming-Student Job Matching Agent</small>
          </div>
        </div>
        <div className="intro-loading-copy">
          <strong>AI 求职引擎加载中...</strong>
          <div className="intro-progress-value">{progress}%</div>
          <div className="intro-step-track">
            <span className={progress >= 18 ? "done" : ""}>解析简历</span>
            <span className={progress >= 42 ? "done" : ""}>岗位匹配</span>
            <span className={progress >= 66 ? "done" : ""}>生成建议</span>
            <span className={progress >= 88 ? "done" : ""}>模拟面试</span>
          </div>
        </div>
        <div className="intro-mascot">
          <ProductAvatar />
          <span className="mascot-orbit orbit-one" />
          <span className="mascot-orbit orbit-two" />
        </div>
        <h1 className="intro-title" aria-label="Kongming">
          {"Kongming".split("").map((letter, index) => (
            <span key={`${letter}-${index}`}>{letter}</span>
          ))}
        </h1>
        <p className="intro-copy">简历解析、岗位推荐、模拟面试和求职对话正在接入同一个学生求职工作流。</p>
        <div className="intro-progress" aria-label="进场动画进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} role="progressbar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="intro-meta">
          <span>滚轮可推进动画</span>
          <button type="button" onClick={completeIntro}>跳过动画</button>
        </div>
      </section>
      <aside className="intro-orbit" aria-hidden="true">
        <span className="intro-ring" />
        {INTRO_CELLS.slice(0, 24).map((item) => (
          <i key={item} className="intro-mote" style={{ "--i": item } as CSSProperties} />
        ))}
        <b className="intro-dot dot-a">Resume</b>
        <b className="intro-dot dot-b">Match</b>
        <b className="intro-dot dot-c">Interview</b>
        {INTRO_MARKS.map((mark, index) => (
          <em key={mark} className={`intro-mark mark-${index}`}>{mark}</em>
        ))}
      </aside>
    </main>
  );
}

function AssistantGalaxy() {
  return (
    <div className="assistant-galaxy" aria-hidden="true">
      <span className="galaxy-core" />
      <span className="galaxy-halo halo-a" />
      <span className="galaxy-halo halo-b" />
      <span className="galaxy-halo halo-c" />
      {GALAXY_PARTICLES.map((item) => {
        const ring = item % 9;
        const angle = (item * 137.5) % 360;
        const size = 2 + (item % 5);
        const radius = 34 + ring * 12 + (item % 3) * 5;
        const duration = 5.4 + ring * 1.1 + (item % 4) * 0.35;
        const delay = -((item % 17) * 0.37);
        const depth = ((item % 11) - 5) * 4;
        return (
          <i
            key={item}
            className={`galaxy-star ring-${ring}`}
            style={
              {
                "--angle": `${angle}deg`,
                "--size": `${size}px`,
                "--radius": `${radius}px`,
                "--duration": `${duration}s`,
                "--delay": `${delay}s`,
                "--depth": `${depth}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function ProductAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`product-avatar ${compact ? "compact" : ""}`}>
      <img src="/kongming-ip.png" alt="" aria-hidden="true" />
    </span>
  );
}

function AppNav({ activePage, onChange }: { activePage: ActivePage; onChange: (page: ActivePage) => void }) {
  const items: Array<{ id: ActivePage; label: string; icon: ReactNode }> = [
    { id: "home", label: "首页", icon: <FontAwesomeShapeIcon icon={faUserAstronaut} size={16} /> },
    { id: "resume", label: "简历解析", icon: <FileText size={16} /> },
    { id: "jobs", label: "岗位推荐", icon: <BriefcaseBusiness size={16} /> },
    { id: "interview", label: "模拟面试", icon: <Video size={16} /> },
    { id: "assistant", label: "AI 助手", icon: <Bot size={16} /> },
  ];

  return (
    <nav className="app-nav" aria-label="页面导航">
      <button type="button" className="nav-brand" onClick={() => onChange("home")}>
        <ProductAvatar compact />
        <span className="brand-name">孔明职配</span>
        <small>学生求职智能工作台</small>
      </button>
      <div>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activePage === item.id ? "active" : ""}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function HomeVideoPage() {
  return (
    <section className="home-video-page" aria-label="孔明职配首页">
      <video src={homeHeroVideo} autoPlay muted loop playsInline preload="auto" />
    </section>
  );
}

function Hero({ result, selectedJob, isReady, onStart }: { result: MatchResult; selectedJob: Job; isReady: boolean; onStart: () => void }) {
  const visualRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual) return;
    const context = gsap.context(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.fromTo(".hero-copy > *", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: reduceMotion ? 0 : 0.7, stagger: 0.08, ease: "power2.out" });
      gsap.to(".orbit-node", {
        y: reduceMotion ? 0 : -12,
        rotation: reduceMotion ? 0 : 6,
        duration: 2.8,
        repeat: reduceMotion ? 0 : -1,
        yoyo: true,
        stagger: { amount: 0.8, from: "center" },
        ease: "sine.inOut",
      });
      gsap.to(".scene-ring", {
        rotation: reduceMotion ? 0 : 360,
        duration: 28,
        repeat: reduceMotion ? 0 : -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });
      gsap.to(".planet-ring", { rotation: reduceMotion ? 0 : 360, duration: 16, repeat: reduceMotion ? 0 : -1, ease: "none", transformOrigin: "50% 50%" });
      gsap.fromTo(".hero-particle", { autoAlpha: 0.35 }, { y: reduceMotion ? 0 : -18, x: reduceMotion ? 0 : 10, autoAlpha: 0.95, duration: 2.8, repeat: reduceMotion ? 0 : -1, yoyo: true, stagger: { amount: 1.6, from: "random" }, ease: "sine.inOut" });
      gsap.to(".planet-core", { y: reduceMotion ? 0 : -8, duration: 2.4, repeat: reduceMotion ? 0 : -1, yoyo: true, ease: "sine.inOut" });
    }, visualRef);

    const xTo = gsap.quickTo(visual, "--mx", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(visual, "--my", { duration: 0.45, ease: "power3.out" });
    const handleMove = (event: MouseEvent) => {
      const rect = visual.getBoundingClientRect();
      xTo(((event.clientX - rect.left) / rect.width - 0.5) * 28);
      yTo(((event.clientY - rect.top) / rect.height - 0.5) * 28);
    };
    visual.addEventListener("mousemove", handleMove);

    return () => {
      visual.removeEventListener("mousemove", handleMove);
      context.revert();
    };
  }, []);

  return (
    <header className="hero asset-hero">
      <video className="home-hero-video" src={homeHeroVideo} autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
      <button type="button" className="hero-asset-start" onClick={onStart} aria-label="开始解析简历" />
      <div className="hero-copy">
        <div className="eyebrow">
          <Sparkles size={16} />
          学生求职匹配智能体
        </div>
        <h1>孔明职配</h1>
        <p>Kongming-Student Job Matching Agent是一款面向学生求职场景的 AI 智能匹配工具，旨在帮助学生从海量岗位信息中快速发现与自身背景、能力特长和职业兴趣高度匹配的机会，并针对目标岗位提供简历匹配度分析与优化建议。</p>
        <button type="button" className="hero-primary" onClick={onStart}>
          开始解析简历
          <ArrowUpRight size={16} />
        </button>
        <div className="hero-actions">
          <span><ShieldCheck size={16} />可解释评分</span>
          <span><Search size={16} />岗位优先级</span>
          <span><ClipboardCheck size={16} />初筛优化</span>
        </div>
      </div>
      <div className="hero-metric-rail" aria-hidden="true">
        {HERO_METRICS.map((item, index) => (
          <span key={item}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <em>{item}</em>
          </span>
        ))}
      </div>
      <div className="hero-card hero-visual" ref={visualRef}>
        <div className="hero-electric-web" aria-hidden="true">
          <i className="electric-line electric-a" />
          <i className="electric-line electric-b" />
          <i className="electric-line electric-c" />
          <i className="electric-line electric-d" />
        </div>
        <div className="hero-particle-field" aria-hidden="true">
          {HERO_PARTICLES.map((item) => (
            <i key={item} className="hero-particle" style={{ "--i": item } as CSSProperties} />
          ))}
        </div>
        <div className="hero-ring-particles" aria-hidden="true">
          {HERO_RING_PARTICLES.map((item) => (
            <i key={item} style={{ "--i": item } as CSSProperties} />
          ))}
        </div>
        <div className="scene-ring" />
        <div className="planet-core" aria-hidden="true">
          <ProductAvatar />
          <span className="planet-ring ring-main" />
          <span className="planet-ring ring-tilt" />
        </div>
        <div className="hero-match-hub" aria-hidden="true">
          <span>AI 智能匹配中</span>
          <strong>{isReady ? `${result.total}%` : "Match"}</strong>
          <em />
        </div>
        <div className="orbit-node node-a">
          <span>Resume</span>
          <strong>{isReady ? activeLabel(selectedJob.title) : "上传简历"}</strong>
        </div>
        <div className="orbit-node node-b">
          <span>Match</span>
          <strong>{isReady ? `${result.total}` : "智能匹配"}</strong>
        </div>
        <div className="orbit-node node-c">
          <span>Interview</span>
          <strong>模拟面试</strong>
        </div>
        <div className="hero-mini-panel mini-radar" aria-hidden="true">
          <span>能力图谱</span>
          <i />
        </div>
        <div className="hero-mini-panel mini-score" aria-hidden="true">
          <span>简历分析</span>
          <strong>{isReady ? `${result.total}分` : "84分"}</strong>
          <em />
        </div>
        <div className="hero-mini-panel mini-advice" aria-hidden="true">
          <span>优化建议</span>
          <small>突出成果数据化</small>
          <small>补充技能证书</small>
          <small>优化目标描述</small>
        </div>
        {isReady ? (
          <div className="hero-live-panel">
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
          </div>
        ) : (
          <div className="hero-empty hero-live-panel">
            <span>初始化状态</span>
            <strong>等待简历与岗位输入</strong>
            <p>上传或粘贴简历后，将生成学生画像、岗位推荐与优化建议。</p>
          </div>
        )}
      </div>
    </header>
  );
}

const activeLabel = (value: string) => (value.length > 8 ? `${value.slice(0, 8)}...` : value);

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
    </div>
  );
}

function ResumePipelineStatus({
  hasResume,
  resumeSource,
  modelStatus,
  pipelineStep,
}: {
  hasResume: boolean;
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

  return (
    <section className={`inline-progress ${modelStatus}`}>
      <div>
        <strong>简历识别进度</strong>
        <span>{modelStatus === "loading" ? "正在处理" : modelStatus === "ready" ? resumeSource : modelStatus === "error" ? "处理未完成" : "等待上传"}</span>
      </div>
      <div className="pipeline-bar" aria-label="简历识别进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} role="progressbar">
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
    </section>
  );
}

function JdPipelineStatus({
  jdStatus,
  jdStep,
  jdMessage,
}: {
  jdStatus: "idle" | "loading" | "ready" | "error";
  jdStep: JdPipelineStep;
  jdMessage: string;
}) {
  const jdSteps = [
    { id: "parse", label: "解析 JD" },
    { id: "evaluate", label: "评估优先级" },
    { id: "links", label: "生成入口" },
  ];
  const jdProgressIndex = jdStep === "done" ? jdSteps.length : jdStep === "error" ? Math.max(1, jdSteps.findIndex((step) => step.id === jdStep) + 1) : jdSteps.findIndex((step) => step.id === jdStep) + 1;
  const jdProgress = jdStep === "idle" ? 0 : Math.max(0, Math.min(100, Math.round((jdProgressIndex / jdSteps.length) * 100)));

  return (
    <section className={`inline-progress ${jdStatus}`}>
      <div>
        <strong>岗位分析进度</strong>
        <span>{jdMessage}</span>
      </div>
      <div className="pipeline-bar" aria-label="意向岗位分析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={jdProgress} role="progressbar">
        <i style={{ width: `${jdProgress}%` }} />
      </div>
      <div className="pipeline-steps three">
        {jdSteps.map((step, index) => {
          const active = step.id === jdStep;
          const done = jdStep === "done" || index < jdProgressIndex - 1;
          return (
            <span key={step.id} className={active ? "active" : done ? "done" : ""}>
              {step.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function ProcessState({
  hasResume,
  customJobCount,
  resumeSource,
  modelStatus,
  pipelineStep,
  jdStatus,
  jdStep,
  jdMessage,
}: {
  hasResume: boolean;
  customJobCount: number;
  resumeSource: string;
  modelStatus: "idle" | "loading" | "ready" | "error";
  pipelineStep: PipelineStep;
  jdStatus: "idle" | "loading" | "ready" | "error";
  jdStep: JdPipelineStep;
  jdMessage: string;
}) {
  const steps = [
    { id: "intake", label: "接收简历" },
    { id: "structure", label: "解析画像" },
    { id: "jobs", label: "生成岗位" },
    { id: "analysis", label: "匹配建议" },
  ];
  const progressIndex = pipelineStep === "done" ? steps.length : pipelineStep === "error" ? Math.max(1, steps.findIndex((step) => step.id === pipelineStep) + 1) : steps.findIndex((step) => step.id === pipelineStep) + 1;
  const progress = !hasResume && pipelineStep === "idle" ? 0 : Math.max(0, Math.min(100, Math.round((progressIndex / steps.length) * 100)));
  const jdSteps = [
    { id: "parse", label: "解析 JD" },
    { id: "evaluate", label: "评估优先级" },
    { id: "links", label: "生成入口" },
  ];
  const jdProgressIndex = jdStep === "done" ? jdSteps.length : jdStep === "error" ? Math.max(1, jdSteps.findIndex((step) => step.id === jdStep) + 1) : jdSteps.findIndex((step) => step.id === jdStep) + 1;
  const jdProgress = jdStep === "idle" ? 0 : Math.max(0, Math.min(100, Math.round((jdProgressIndex / jdSteps.length) * 100)));
  const items = [
    { label: "简历识别", value: hasResume ? resumeSource : "等待上传" },
    { label: "意向岗位", value: customJobCount ? `已添加 ${customJobCount} 个` : "可继续添加" },
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
      <div className={`pipeline-progress ${jdStatus}`}>
        <div className="pipeline-title">
          <strong>意向岗位分析</strong>
          <span>{jdMessage}</span>
        </div>
        <div className="pipeline-bar" aria-label="意向岗位分析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={jdProgress} role="progressbar">
          <i style={{ width: `${jdProgress}%` }} />
        </div>
        <div className="pipeline-steps three">
          {jdSteps.map((step, index) => {
            const active = step.id === jdStep;
            const done = jdStep === "done" || index < jdProgressIndex - 1;
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
