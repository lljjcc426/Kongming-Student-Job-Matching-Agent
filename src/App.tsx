import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Lightbulb,
  LogIn,
  LogOut,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { faClipboardCheck, faUserAstronaut, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { animate, stagger } from "animejs";
import { gsap } from "gsap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Job, JobKind } from "./data";
import { buildJobCatalog } from "./core/job/repositories";
import {
  applicationStageOptions,
  bindApplicationResumeVersion,
  buildDailyApplicationActions,
  loadApplicationRecords,
  saveApplicationRecords,
  updateApplicationStage,
  upsertApplication,
  type ApplicationRecord,
  type ApplicationStage,
} from "./core/tracking/applicationRepository";
import {
  buildProposalContextKey,
  createResumeVersion,
  fingerprintText,
  loadCareerWorkspace,
  saveCareerWorkspace,
  summarizeResumeVersionChanges,
  type CareerWorkspace,
  type ResumeVersion,
} from "./core/workspace/workspaceRepository";
import { callArkAgent, configureArkPrivacy } from "./arkClient";
import { defaultPrivacyPreferences, type PrivacyPreferences } from "./core/privacy/redaction";
import { buildCareerOpsEvaluation } from "./careerOps";
import { parseCustomJob } from "./jobParser";
import { fetchPublicJobs } from "./jobApi";
import {
  getHuaweiAuthState,
  getHarmonyNativeCapabilities,
  initialHuaweiAuthState,
  loginWithHuawei,
  logoutHuawei,
  recognizeImageWithHarmony,
  shareTextWithHarmony,
  updateApplicationFormWithHarmony,
  type HuaweiAuthState,
} from "./harmonyBridge";
import { analyzeMatch, type MatchResult } from "./matchEngine";
import { parseJdAnalysis, parseModelJobs, parseStructuredResume, profileFromStructuredResume, type StructuredResume } from "./modelParsers";
import { buildMatchReport, downloadTextFile } from "./report";
import { buildOptimizedResumeDraft, formatOptimizedResumeDraft, validateOptimizedResumeDraft } from "./resumeOptimizer";
import { checkServiceHealth, initialServiceHealth } from "./serviceHealth";
import HomePage from "./pages/HomePage";
import LoadingScreen from "./LoadingScreen";
import homeHeroVideo from "./assets/home-hero-video.mp4";

const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const InterviewPage = lazy(() => import("./pages/InterviewPage"));

const MAX_UPLOAD_BYTES = 8_000_000;
const INTRO_CELLS = Array.from({ length: 112 }, (_, index) => index);
const INTRO_PARTICLES = Array.from({ length: 228 }, (_, index) => index);
const INTRO_RESUME_LINES = Array.from({ length: 16 }, (_, index) => index);
const INTRO_HOLO_DOTS = Array.from({ length: 96 }, (_, index) => index);
const HERO_PARTICLES = Array.from({ length: 22 }, (_, index) => index);
const HERO_RING_PARTICLES = Array.from({ length: 18 }, (_, index) => index);
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

function ModelInsightMarkdown({ content }: { content: string }) {
  return (
    <div className="model-insight-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
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
type SpeechRecognitionErrorEventLike = {
  error?: string;
};
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
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
  jobKind: "career-direction",
  title: "等待岗位或职业方向",
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

const toneOf = (coverage: number) => {
  if (coverage >= 82) return "strong";
  if (coverage >= 68) return "medium";
  return "weak";
};

const recommendationPriority: Record<MatchResult["recommendation"], number> = {
  "apply-now": 4,
  "complete-evidence-first": 3,
  "skill-gap-too-large": 2,
  "hard-condition-failed": 1,
};

const readImageAsCompressedDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSide = 1280;
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
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_LOAD_FAILED"));
    };
    image.src = objectUrl;
  });

const RESUME_VISION_TIMEOUT_MS = 72_000;

const isUsableResumeText = (text: string) => text.replace(/\s/g, "").length >= 30;

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
  const [initialWorkspace] = useState<CareerWorkspace>(() =>
    typeof window === "undefined" ? loadCareerWorkspace({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }) : loadCareerWorkspace(window.localStorage),
  );
  const [introVisible, setIntroVisible] = useState(true);
  const [huaweiAuth, setHuaweiAuth] = useState<HuaweiAuthState>(initialHuaweiAuthState);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [serviceHealth, setServiceHealth] = useState(initialServiceHealth);
  const [selectedJobId, setSelectedJobId] = useState(initialWorkspace.selectedJobId);
  const [resumeText, setResumeText] = useState(initialWorkspace.resumeText);
  const [customTitle, setCustomTitle] = useState(initialWorkspace.customTitle);
  const [customJdText, setCustomJdText] = useState(initialWorkspace.customJdText);
  const [customJobs, setCustomJobs] = useState<Job[]>(initialWorkspace.customJobs);
  const [publicJobs, setPublicJobs] = useState<Job[]>(initialWorkspace.publicJobs);
  const [activeJobTab, setActiveJobTab] = useState<JobKind>(initialWorkspace.activeJobTab);
  const [resumeConfirmed, setResumeConfirmed] = useState(initialWorkspace.resumeConfirmed);
  const [externalModelConsent, setExternalModelConsent] = useState(false);
  const [privacyPreferences, setPrivacyPreferences] = useState<PrivacyPreferences>(initialWorkspace.privacyPreferences);
  const [applications, setApplications] = useState<ApplicationRecord[]>(() =>
    typeof window === "undefined" ? [] : loadApplicationRecords(window.localStorage),
  );
  const [publicJobStatus, setPublicJobStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [publicJobMessage, setPublicJobMessage] = useState("等待读取企业官方岗位");
  const [structuredResume, setStructuredResume] = useState<StructuredResume | null>(initialWorkspace.structuredResume);
  const [modelJobs, setModelJobs] = useState<Job[]>(initialWorkspace.modelJobs);
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
  const [uploadMessage, setUploadMessage] = useState(initialWorkspace.resumeText ? "已恢复本机工作区，可继续核对和修改。" : "请上传简历文本/图片，或直接粘贴简历内容开始分析。");
  const [resumeSource, setResumeSource] = useState(initialWorkspace.resumeSource);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const publicJobsLoadedRef = useRef(false);

  useEffect(() => {
    void getHuaweiAuthState().then(setHuaweiAuth);
    void checkServiceHealth().then(setServiceHealth);
  }, []);

  const refreshServiceHealth = async () => {
    setServiceHealth((current) => ({ ...current, status: "checking", message: "正在重新检查联网服务" }));
    setServiceHealth(await checkServiceHealth());
  };

  useEffect(() => {
    if (!accountNotice) return;
    const timeoutId = window.setTimeout(() => setAccountNotice(""), 4600);
    return () => window.clearTimeout(timeoutId);
  }, [accountNotice]);

  useEffect(() => {
    configureArkPrivacy({ externalModelConsent, preferences: privacyPreferences });
  }, [externalModelConsent, privacyPreferences]);

  const handleHuaweiAccount = useCallback(async () => {
    if (accountBusy) return;

    if (huaweiAuth.signedIn) {
      const shouldLogout = window.confirm("仅退出孔明职配，不会退出设备上的华为账号。确定继续吗？");
      if (!shouldLogout) return;
      setAccountBusy(true);
      const nextState = await logoutHuawei();
      setHuaweiAuth(nextState);
      setAccountNotice(nextState.message || "已退出孔明职配账号。");
      setAccountBusy(false);
      return;
    }

    const consented = window.confirm(
      "华为账号登录会向孔明职配提供账户唯一标识，仅用于登录与后续数据同步。孔明职配不会读取华为账号密码、手机号或简历内容。是否继续？",
    );
    if (!consented) return;

    setAccountBusy(true);
    setAccountNotice("正在打开华为账号登录…");
    const nextState = await loginWithHuawei();
    setHuaweiAuth(nextState);
    setAccountNotice(nextState.message || (nextState.signedIn ? "华为账号登录成功。" : "华为账号登录未完成。"));
    setAccountBusy(false);
  }, [accountBusy, huaweiAuth.signedIn]);

  const activeProfile = useMemo(
    () => profileFromStructuredResume(structuredResume, resumeText, resumeConfirmed),
    [structuredResume, resumeConfirmed, resumeText],
  );
  const hasResume = resumeText.trim().length > 0;
  const jobCatalog = useMemo(
    () => buildJobCatalog([...customJobs, ...publicJobs, ...modelJobs]),
    [customJobs, modelJobs, publicJobs],
  );
  const allJobs = useMemo(() => Object.values(jobCatalog).flat(), [jobCatalog]);
  const jobTabCounts = useMemo(() => ({
    "verified-job": jobCatalog["verified-job"].length,
    "imported-jd": jobCatalog["imported-jd"].length,
    "career-direction": jobCatalog["career-direction"].length,
  }), [jobCatalog]);
  const availableJobs = useMemo(
    () => jobCatalog[activeJobTab],
    [activeJobTab, jobCatalog],
  );
  const rankedJobs = useMemo(
    () =>
      [...availableJobs].sort((left, right) => {
        const leftResult = analyzeMatch(activeProfile, left, resumeText);
        const rightResult = analyzeMatch(activeProfile, right, resumeText);
        return recommendationPriority[rightResult.recommendation] - recommendationPriority[leftResult.recommendation]
          || rightResult.evidenceCoverage - leftResult.evidenceCoverage;
      }),
    [activeProfile, availableJobs, resumeText],
  );
  const selectedJob = rankedJobs.find((job) => job.id === selectedJobId) ?? rankedJobs[0] ?? emptyJob;
  const hasAnalysis = rankedJobs.length > 0;
  const result = useMemo(() => analyzeMatch(activeProfile, selectedJob, resumeText), [activeProfile, resumeText, selectedJob]);
  const optimizedDraft = useMemo(() => buildOptimizedResumeDraft(activeProfile, selectedJob, result), [activeProfile, selectedJob, result]);
  const careerOpsEvaluation = useMemo(() => buildCareerOpsEvaluation(activeProfile, selectedJob, result), [activeProfile, selectedJob, result]);
  const trackedApplication = applications.find((application) => application.jobId === selectedJob.id) ?? null;
  const dailyApplicationActions = useMemo(() => buildDailyApplicationActions(applications), [applications]);
  const nativeCapabilities = getHarmonyNativeCapabilities();
  const [copyStatus, setCopyStatus] = useState("复制优化稿");
  const [resumeVersionStatus, setResumeVersionStatus] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [proposalContextKey, setProposalContextKey] = useState(initialWorkspace.proposalContextKey);
  const [proposalDecisions, setProposalDecisions] = useState<Record<string, "accepted" | "rejected">>(initialWorkspace.proposalDecisions);
  const [proposalEdits, setProposalEdits] = useState<Record<string, string>>(initialWorkspace.proposalEdits);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>(initialWorkspace.resumeVersions);
  const currentJobVersions = useMemo(
    () => resumeVersions.filter((version) => version.jobId === selectedJob.id),
    [resumeVersions, selectedJob.id],
  );
  const currentProposalContextKey = useMemo(
    () => buildProposalContextKey(selectedJob.id, resumeText),
    [resumeText, selectedJob.id],
  );
  const editedDraft = useMemo(() => ({
    ...optimizedDraft,
    proposals: optimizedDraft.proposals.map((proposal) => ({
      ...proposal,
      suggestedText: proposalEdits[proposal.id] ?? proposal.suggestedText,
    })),
  }), [optimizedDraft, proposalEdits]);
  const acceptedProposalIds = useMemo(
    () => Object.entries(proposalDecisions).filter(([, decision]) => decision === "accepted").map(([id]) => id),
    [proposalDecisions],
  );
  const draftValidation = useMemo(
    () => validateOptimizedResumeDraft(editedDraft, acceptedProposalIds, activeProfile.experiences.map((experience) => experience.id)),
    [acceptedProposalIds, activeProfile.experiences, editedDraft],
  );

  useEffect(() => {
    if (proposalContextKey === currentProposalContextKey) return;
    setProposalContextKey(currentProposalContextKey);
    setProposalDecisions({});
    setProposalEdits({});
    setResumeVersionStatus("");
  }, [currentProposalContextKey, proposalContextKey]);

  useEffect(() => {
    saveApplicationRecords(window.localStorage, applications);
    const nextAction = dailyApplicationActions[0];
    void updateApplicationFormWithHarmony({
      trackedCount: applications.length,
      pendingCount: dailyApplicationActions.length,
      nextAction: nextAction?.action || "添加岗位后生成今日行动",
      jobTitle: nextAction?.title || "孔明职配",
      updatedAt: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    });
  }, [applications, dailyApplicationActions]);

  useEffect(() => {
    saveCareerWorkspace(window.localStorage, {
      resumeText,
      structuredResume,
      resumeConfirmed,
      resumeSource,
      customTitle,
      customJdText,
      customJobs,
      publicJobs,
      modelJobs,
      selectedJobId,
      activeJobTab,
      proposalContextKey,
      proposalDecisions,
      proposalEdits,
      resumeVersions,
      privacyPreferences,
      savedAt: initialWorkspace.savedAt,
    });
  }, [activeJobTab, customJdText, customJobs, customTitle, initialWorkspace.savedAt, modelJobs, privacyPreferences, proposalContextKey, proposalDecisions, proposalEdits, publicJobs, resumeConfirmed, resumeSource, resumeText, resumeVersions, selectedJobId, structuredResume]);

  useEffect(() => {
    chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, chatStatus]);

  const loadPublicJobFeed = useCallback(async () => {
    setPublicJobStatus("loading");
    setPublicJobMessage("正在从企业官网与公开招聘系统收集岗位…");
    try {
      const query = structuredResume?.targetRoles.slice(0, 3).join(" ") || customTitle.trim() || "前端 后端 AI 数据 产品";
      const feed = await fetchPublicJobs({ query, city: activeProfile.cityPreference[0], limit: 36 });
      setPublicJobs(feed.jobs);
      setPublicJobStatus("ready");
      setPublicJobMessage(feed.stale ? `${feed.message}；当前为最近一次有效快照` : feed.message);
      publicJobsLoadedRef.current = true;
      setActiveJobTab("verified-job");
      if (!selectedJobId && feed.jobs[0]) setSelectedJobId(feed.jobs[0].id);
    } catch (error) {
      if (publicJobs.length) {
        setPublicJobStatus("ready");
        setPublicJobMessage(`联网更新失败，继续展示本机保存的 ${publicJobs.length} 条岗位快照；投递前请打开企业官网复核。`);
      } else {
        setPublicJobStatus("error");
        setPublicJobMessage(error instanceof Error ? error.message : "官方岗位暂时无法读取。");
      }
    }
  }, [activeProfile.cityPreference, customTitle, publicJobs.length, selectedJobId, structuredResume]);

  useEffect(() => {
    if (activePage === "jobs" && !publicJobsLoadedRef.current && publicJobStatus === "idle") {
      void loadPublicJobFeed();
    }
  }, [activePage, loadPublicJobFeed, publicJobStatus]);

  const runJobRecommendations = async (nextResumeText: string, nextResume: StructuredResume) => {
    setPipelineStep("jobs");
    setModelMessage("职业方向智能体正在生成互联网与数字技术方向建议");
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
    setActiveJobTab("career-direction");
    setSelectedJobId(parsedJobs[0]?.id ?? "");
    setModelStatus("ready");
    setPipelineStep("done");
    setModelMessage(`已完成简历解析并生成 ${parsedJobs.length} 个职业方向建议；这些内容不是正在招聘的真实岗位`);
  };

  const runModelPipeline = async (nextResumeText: string) => {
    if (!nextResumeText.trim()) return;
    setModelStatus("loading");
    setPipelineStep("structure");
    setModelMessage("正在调用模型解析简历并生成职业方向建议");
    setStructuredResume(null);
    setModelJobs([]);
    setResumeConfirmed(false);

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
      setResumeConfirmed(false);
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
        setResumeConfirmed(false);
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
      setActiveJobTab("imported-jd");
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
    const report = buildMatchReport(activeProfile, selectedJob, result, resumeText, editedDraft, careerOpsEvaluation, draftValidation);
    downloadTextFile("kongming-match-report.md", report);
  };

  const handleShareReport = async () => {
    if (!hasResume || !hasAnalysis) return;
    const report = buildMatchReport(activeProfile, selectedJob, result, resumeText, editedDraft, careerOpsEvaluation, draftValidation);
    const shareResult = await shareTextWithHarmony(`${selectedJob.title} · 孔明职配分析`, report);
    setShareStatus(shareResult.message);
    window.setTimeout(() => setShareStatus(""), 3600);
  };

  const handleTrackSelectedJob = () => {
    setApplications((current) => upsertApplication(current, selectedJob));
  };

  const handleApplicationStage = (stage: ApplicationStage) => {
    if (!trackedApplication) return;
    if (stage === "applied" && !trackedApplication.resumeVersionId) {
      setResumeVersionStatus("进入已投递前，请先保存并绑定本次实际使用的简历版本。");
      return;
    }
    setApplications((current) => updateApplicationStage(current, trackedApplication.id, stage));
  };

  const handleBindResumeVersion = (resumeVersionId: string) => {
    if (!trackedApplication) return;
    const version = currentJobVersions.find((item) => item.id === resumeVersionId);
    if (!version) {
      setResumeVersionStatus("所选版本不属于当前岗位，未执行绑定。");
      return;
    }
    setApplications((current) => bindApplicationResumeVersion(current, trackedApplication.id, version.id));
    setResumeVersionStatus(`已将“${version.name}”绑定到当前投递记录。`);
  };

  const handleProposalEdit = (proposalId: string, value: string) => {
    setProposalEdits((current) => ({ ...current, [proposalId]: value }));
    setProposalDecisions((current) => {
      if (!current[proposalId]) return current;
      const next = { ...current };
      delete next[proposalId];
      return next;
    });
    setResumeVersionStatus("内容已修改，请重新核对并接受该项。");
  };

  const handleCopyDraft = async () => {
    if (!draftValidation.ok) {
      setCopyStatus(draftValidation.errors[0] || "请先完成事实确认");
      window.setTimeout(() => setCopyStatus("复制优化稿"), 2600);
      return;
    }
    await navigator.clipboard.writeText(formatOptimizedResumeDraft(editedDraft, draftValidation.acceptedProposalIds));
    setCopyStatus("已复制");
    window.setTimeout(() => setCopyStatus("复制优化稿"), 1600);
  };

  const handleSaveResumeVersion = () => {
    if (!draftValidation.ok) {
      setResumeVersionStatus(draftValidation.errors[0] || "请先完成事实确认。");
      return;
    }
    const content = formatOptimizedResumeDraft(editedDraft, draftValidation.acceptedProposalIds);
    const previousVersion = currentJobVersions[0];
    const version = createResumeVersion({
      name: `${selectedJob.title} · 投递版 ${currentJobVersions.length + 1}`,
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      content,
      acceptedProposalIds: draftValidation.acceptedProposalIds,
      proposalEdits: Object.fromEntries(draftValidation.acceptedProposalIds.map((id) => [
        id,
        proposalEdits[id] ?? optimizedDraft.proposals.find((proposal) => proposal.id === id)?.suggestedText ?? "",
      ])),
      evidenceCoverage: result.evidenceCoverage,
      sourceFingerprint: fingerprintText(resumeText),
      changeSummary: summarizeResumeVersionChanges(content, previousVersion?.content),
    });
    setResumeVersions((current) => [version, ...current].slice(0, 30));
    setResumeVersionStatus("投递版本已保存在本机；后续修改不会覆盖该版本。");
  };

  const handleCopyResumeVersion = async (version: ResumeVersion) => {
    await navigator.clipboard.writeText(version.content);
    setResumeVersionStatus(`已复制“${version.jobTitle}”的历史投递版本。`);
  };

  const handleRestoreResumeVersion = (version: ResumeVersion) => {
    if (version.jobId !== selectedJob.id || version.sourceFingerprint !== fingerprintText(resumeText)) {
      setResumeVersionStatus("该版本对应的岗位或简历原文已经变化。为避免错绑证据，只允许复制查看，不能直接恢复。");
      return;
    }
    setProposalContextKey(currentProposalContextKey);
    setProposalEdits({ ...version.proposalEdits });
    setProposalDecisions(Object.fromEntries(version.acceptedProposalIds.map((id) => [id, "accepted" as const])));
    setResumeVersionStatus(`已把“${version.name}”恢复到当前修改区，请再次检查后使用。`);
  };

  const handleDeleteResumeVersion = (version: ResumeVersion) => {
    const boundApplication = applications.find((application) => application.resumeVersionId === version.id);
    if (boundApplication) {
      setResumeVersionStatus(`“${version.name}”已绑定到“${boundApplication.title}”的投递记录，请先更换绑定版本。`);
      return;
    }
    if (!window.confirm(`确定删除“${version.name}”吗？删除后无法恢复。`)) return;
    setResumeVersions((current) => current.filter((item) => item.id !== version.id));
    setResumeVersionStatus(`已删除“${version.name}”。`);
  };

  const clearLocalCareerData = () => {
    const shouldClear = window.confirm("将清除本次会话中的简历、岗位、模型对话和修改记录；华为账号登录状态不受影响。确定继续吗？");
    if (!shouldClear) return;
    setResumeText("");
    setStructuredResume(null);
    setResumeConfirmed(false);
    setCustomTitle("");
    setCustomJdText("");
    setCustomJobs([]);
    setPublicJobs([]);
    setModelJobs([]);
    setSelectedJobId("");
    setActiveJobTab("verified-job");
    setModelInsight("");
    setModelStatus("idle");
    setModelMessage("");
    setPipelineStep("idle");
    setJdStatus("idle");
    setJdStep("idle");
    setJdMessage("等待意向岗位输入");
    setChatMessages([]);
    setApplications([]);
    setProposalDecisions({});
    setProposalEdits({});
    setProposalContextKey("");
    setResumeVersions([]);
    setResumeVersionStatus("");
    setUploadMessage("本地求职数据已清除。可重新输入简历开始分析。");
    setResumeSource("等待上传");
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("kongming."))
      .forEach((key) => window.localStorage.removeItem(key));
  };

  const recognizeResumeVisionPages = async (imageDataUrls: string[], extractedText = "") => {
    const pageResults: string[] = [];
    const errors: string[] = [];
    let nativePageCount = 0;

    for (let index = 0; index < imageDataUrls.length; index += 1) {
      const pageNumber = index + 1;
      setModelMessage(`正在本机识别简历图片第 ${pageNumber}/${imageDataUrls.length} 页`);
      const nativeResult = await recognizeImageWithHarmony(imageDataUrls[index]);
      if (nativeResult.ok && nativeResult.text.trim()) {
        nativePageCount += 1;
        pageResults.push(`【本机 OCR 第 ${pageNumber} 页】\n${nativeResult.text.trim()}`);
        continue;
      }
      if (!externalModelConsent) {
        errors.push(`${nativeResult.message} 如需外部视觉模型兜底，请先同意本次会话处理。`);
        continue;
      }

      setModelMessage(`本机 OCR 不可用，正在使用外部视觉模型识别第 ${pageNumber}/${imageDataUrls.length} 页`);
      const response = await callArkAgent(
        { task: "resume-vision", imageDataUrls: [imageDataUrls[index]], resumeText: extractedText },
        { timeoutMs: RESUME_VISION_TIMEOUT_MS },
      );
      if (response.ok && response.content?.trim()) {
        pageResults.push(`【外部视觉识别第 ${pageNumber} 页】\n${response.content.trim()}`);
      } else {
        errors.push(response.error || `第 ${pageNumber} 页识别失败`);
      }
    }

    return {
      ok: pageResults.length > 0,
      content: pageResults.join("\n\n"),
      error: errors[0],
      nativePageCount,
    };
  };

  const continueResumeAnalysis = async (text: string) => {
    if (externalModelConsent) {
      await runModelPipeline(text);
      return;
    }
    setModelStatus("idle");
    setPipelineStep("intake");
    setModelMessage("简历内容已在本地读取，尚未发送外部模型；同意本次会话处理后可继续结构化解析。");
  };

  const handleResumeUpload = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage("文件超过 8MB，请压缩或精简后再上传。");
      return;
    }
    const analysisOutcome = externalModelConsent
      ? "已进入外部模型结构化解析流程。"
      : "内容已留在本地，尚未进行外部模型结构化解析。";
    if (file.type.startsWith("image/")) {
      setModelStatus("loading");
      setPipelineStep("intake");
      setModelMessage("正在优先使用鸿蒙本机 OCR 识别图片简历");
      const imageDataUrl = await readImageAsCompressedDataUrl(file);
      const response = await recognizeResumeVisionPages([imageDataUrl]);
      if (response.ok && response.content) {
        setResumeText(response.content);
        setModelInsight(response.content);
        setModelStatus("ready");
        setModelMessage(response.nativePageCount > 0 ? "已使用 Core Vision 在本机完成图片识别" : "已使用外部视觉模型完成图片识别");
        setUploadMessage(`已识别 ${file.name}；${analysisOutcome}`);
        setResumeSource(response.nativePageCount > 0 ? "Core Vision 本机 OCR" : "外部图片视觉识别");
        await continueResumeAnalysis(response.content);
        return;
      }
      setModelStatus("error");
      setPipelineStep("error");
      setModelMessage(response.error || "图片简历识别失败；可改用文本简历，或同意外部视觉模型兜底。");
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
        setUploadMessage(`已解析 ${file.name}，共 ${pdfResult.pageCount} 页；${analysisOutcome}`);
        setResumeSource(`PDF 文本层识别，质量 ${Math.round(pdfResult.quality * 100)}%`);
        await continueResumeAnalysis(pdfResult.text);
        return;
      }

      if (pdfResult.imageDataUrls.length > 0) {
        const response = await recognizeResumeVisionPages(pdfResult.imageDataUrls, pdfResult.text);
        if (response.ok && response.content) {
          const combinedText = [isUsableResumeText(pdfResult.text) ? pdfResult.text : "", response.content].filter(Boolean).join("\n\n");
          setResumeText(combinedText);
          setModelInsight(response.content);
          setModelStatus("ready");
          setModelMessage("PDF 文本层质量较低，已完成视觉识别");
          setUploadMessage(`已识别 ${file.name}；${analysisOutcome}`);
          setResumeSource(response.nativePageCount > 0
            ? `PDF Core Vision 本机 OCR，文本层质量 ${Math.round(pdfResult.quality * 100)}%`
            : `PDF 外部视觉识别，文本层质量 ${Math.round(pdfResult.quality * 100)}%`);
          await continueResumeAnalysis(combinedText);
          return;
        }
        if (isUsableResumeText(pdfResult.text)) {
          setResumeText(pdfResult.text);
          setModelStatus("ready");
          setModelMessage(externalModelConsent ? "PDF 视觉识别未完成，已使用可读取文本层继续分析" : "PDF 视觉识别未完成，已在本地保留可读取文本层");
          setUploadMessage(`已读取 ${file.name} 的 PDF 文本层，视觉识别不稳定；${analysisOutcome}`);
          setResumeSource(`PDF 文本层兜底，质量 ${Math.round(pdfResult.quality * 100)}%`);
          await continueResumeAnalysis(pdfResult.text);
          return;
        }
        setModelStatus("error");
        setPipelineStep("error");
        setModelMessage(response.error || "PDF 文本层质量较低，视觉识别未完成。");
        setUploadMessage(`未能稳定识别 ${file.name}，请尝试上传清晰图片或可复制文字的 PDF。`);
        setResumeSource(`PDF 识别失败，文本层质量 ${Math.round(pdfResult.quality * 100)}%`);
        return;
      }

      if (isUsableResumeText(pdfResult.text)) {
        setResumeText(pdfResult.text);
        setModelStatus("ready");
        setModelMessage(externalModelConsent ? "PDF 页面渲染失败，已使用可读取文本层继续分析" : "PDF 页面渲染失败，已在本地保留可读取文本层");
        setUploadMessage(`已读取 ${file.name} 的 PDF 文本层，页面渲染不稳定；${analysisOutcome}`);
        setResumeSource(`PDF 文本层兜底，质量 ${Math.round(pdfResult.quality * 100)}%`);
        await continueResumeAnalysis(pdfResult.text);
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
    setUploadMessage(`已读取 ${file.name}，共 ${text.trim().length} 字；${analysisOutcome}`);
    setResumeSource("文本文件读取");
    await continueResumeAnalysis(text);
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
    let transcript = "";
    let committed = false;
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setInterviewStatus("listening");
      setInterviewMessage("正在收听回答，结束后会自动写入文本框。");
    };
    recognition.onresult = (event) => {
      transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("")
        .trim();
      if (transcript) setInterviewMessage("已识别到语音，结束后会写入文本框。");
    };
    recognition.onerror = (event) => {
      if (transcript || event.error === "no-speech" || event.error === "aborted") return;
      setInterviewStatus("error");
      setInterviewMessage("语音转写未完成，请检查浏览器麦克风权限。");
    };
    recognition.onend = () => {
      setInterviewStatus((current) => (current === "listening" ? "idle" : current));
      if (transcript && !committed) {
        committed = true;
        setInterviewAnswer((current) => [current, transcript].filter(Boolean).join("\n"));
        setInterviewMessage("已完成语音转写，可继续补充后提交反馈。");
      } else if (!transcript) {
        setInterviewMessage("未识别到有效语音，请重试或直接输入文本。");
      }
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
    let transcript = "";
    let committed = false;
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setChatStatus("listening");
      setChatMessage("正在收听，结束后会写入输入框。");
    };
    recognition.onresult = (event) => {
      transcript = Array.from(event.results)
        .map((item) => item[0]?.transcript ?? "")
        .join("")
        .trim();
      if (transcript) setChatMessage("已识别到语音，结束后会写入输入框。");
    };
    recognition.onerror = (event) => {
      if (transcript || event.error === "no-speech" || event.error === "aborted") return;
      setChatStatus("error");
      setChatMessage("语音转写未完成，请检查浏览器麦克风权限。");
    };
    recognition.onend = () => {
      setChatStatus((current) => (current === "listening" ? "idle" : current));
      if (transcript && !committed) {
        committed = true;
        setChatInput((current) => [current, transcript].filter(Boolean).join(current.trim() ? "\n" : ""));
        setChatMessage("已完成语音转写，可以继续编辑或发送。");
      } else if (!transcript) {
        setChatMessage("未识别到有效语音，请重试或直接输入文字。");
      }
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

  if (introVisible) {
    return <LoadingScreen onFinish={() => setIntroVisible(false)} />;
  }

  return (
    <main className="app-shell">
      <AppNav
        activePage={activePage}
        onChange={setActivePage}
        account={huaweiAuth}
        accountBusy={accountBusy}
        onAccount={() => void handleHuaweiAccount()}
      />

      {accountNotice ? (
        <div className={`account-notice ${huaweiAuth.signedIn ? "success" : ""}`} role="status">
          {accountNotice}
        </div>
      ) : null}

      {activePage === "home" ? (
        <>
          <HomePage onNavigate={setActivePage} />
        </>
      ) : null}

      <section className={`dashboard dashboard-${activePage}`} hidden={activePage !== "resume" && activePage !== "jobs"}>
        <aside className="profile-column">
          <Panel eyebrow="Profile" title="学生画像" icon={<FileText size={18} />}>
            <details className="privacy-center" open={!externalModelConsent}>
              <summary>
                <span><ShieldCheck size={15} />隐私与外部模型说明</span>
                <b>{externalModelConsent ? "已同意本次会话" : "待确认"}</b>
              </summary>
              <div className="privacy-center-body">
                <p>文本文件与 PDF 文本层可先在本地读取；鸿蒙安装包会优先使用 Core Vision 在本机识别图片。只有继续进行模型解析，或本机 OCR 不可用且需要视觉兜底时，才会在本次会话同意后把所选内容发送至外部模型代理；模型密钥仅保存在服务端。</p>
                <div className={`service-health service-${serviceHealth.status}`} role="status">
                  <div>
                    <strong>联网服务：{serviceHealth.status === "ready" ? "可用" : serviceHealth.status === "checking" ? "检查中" : serviceHealth.status === "offline" ? "未配置" : "部分可用"}</strong>
                    <span>岗位 {serviceHealth.jobsConfigured ? "已配置" : "未配置"} · 模型 {serviceHealth.modelConfigured ? "已配置" : "未配置"}</span>
                    <p>{serviceHealth.message}</p>
                  </div>
                  <button type="button" className="secondary-action compact-action" onClick={() => void refreshServiceHealth()} disabled={serviceHealth.status === "checking"}>重新检查</button>
                </div>
                <div className="native-capability-grid" aria-label="运行时能力状态">
                  {([
                    ["运行环境", nativeCapabilities.runtime === "harmony", nativeCapabilities.runtime === "harmony" ? "鸿蒙安装包" : "浏览器回退"],
                    ["华为账号", nativeCapabilities.account, nativeCapabilities.account ? "可调用" : "仅安装包可用"],
                    ["本机 OCR", nativeCapabilities.ocr, nativeCapabilities.ocr ? "Core Vision" : "需外部识别"],
                    ["语音播报", nativeCapabilities.speechSynthesis, nativeCapabilities.speechSynthesis ? "Core Speech" : "浏览器回退"],
                    ["语音转写", nativeCapabilities.speechRecognition, nativeCapabilities.speechRecognition ? "Core Speech" : "浏览器回退"],
                    ["求职卡片", nativeCapabilities.applicationForm, nativeCapabilities.applicationForm ? "可同步" : "仅安装包可用"],
                    ["系统分享", nativeCapabilities.share, nativeCapabilities.share ? "可调用" : "不可用"],
                  ] as Array<[string, boolean, string]>).map(([label, available, detail]) => (
                    <div key={label} className={available ? "available" : "fallback"}>
                      <span>{label}</span>
                      <strong>{detail}</strong>
                    </div>
                  ))}
                </div>
                <div className="privacy-options">
                  {([
                    ["hidePhone", "隐藏手机号"],
                    ["hideEmail", "隐藏邮箱"],
                    ["hideAddress", "隐藏详细地址"],
                    ["hideIdNumber", "隐藏身份证号"],
                    ["hideName", "隐藏真实姓名"],
                  ] as Array<[keyof PrivacyPreferences, string]>).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={privacyPreferences[key]}
                        onChange={(event) => setPrivacyPreferences((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="privacy-consent">
                  <input type="checkbox" checked={externalModelConsent} onChange={(event) => setExternalModelConsent(event.target.checked)} />
                  我已了解数据用途，并同意在本次会话中将所选内容发送至外部模型服务。
                </label>
                <button type="button" className="secondary-action compact-action" onClick={clearLocalCareerData}>
                  <Trash2 size={15} />
                  清除全部本地求职数据
                </button>
              </div>
            </details>
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

            <div className={`resume-confirmation ${resumeConfirmed ? "confirmed" : "pending"}`}>
              <div>
                <strong>{resumeConfirmed ? "简历证据已确认" : "简历证据待确认"}</strong>
                <p>请核对教育、技能和经历是否与原文一致；确认后才能作为强证据。</p>
              </div>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={!structuredResume || resumeConfirmed}
                onClick={() => setResumeConfirmed(true)}
              >
                <ShieldCheck size={15} />
                {resumeConfirmed ? "已确认" : "确认当前解析结果"}
              </button>
            </div>

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
                  setResumeConfirmed(false);
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
                disabled={!resumeText.trim() || !externalModelConsent || modelStatus === "loading"}
              >
                <FontAwesomeShapeIcon icon={faClipboardCheck} size={16} />
                解析简历并生成职业方向
              </button>
            </InfoBlock>
          </Panel>
        </aside>

        <section className="match-column">
          <Panel eyebrow="Evidence Matching" title="岗位证据工作台" icon={<BriefcaseBusiness size={18} />}>
            <div className={`job-source-bar ${publicJobStatus}`}>
              <div>
                <span>Official Job Radar</span>
                <p>{publicJobMessage}</p>
              </div>
              <button type="button" className="secondary-action compact-action" onClick={() => void loadPublicJobFeed()} disabled={publicJobStatus === "loading"}>
                <Search size={15} />
                {publicJobStatus === "loading" ? "收集中" : "刷新真实岗位"}
              </button>
            </div>
            <div className="job-kind-tabs" role="tablist" aria-label="岗位数据类型">
              {([
                ["verified-job", "已验证岗位"],
                ["imported-jd", "我的 JD"],
                ["career-direction", "职业方向"],
              ] as Array<[JobKind, string]>).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={activeJobTab === kind}
                  className={activeJobTab === kind ? "active" : ""}
                  onClick={() => {
                    setActiveJobTab(kind);
                    const next = allJobs.find((job) => job.jobKind === kind);
                    setSelectedJobId(next?.id || "");
                  }}
                >
                  <span>{label}</span>
                  <b>{jobTabCounts[kind]}</b>
                </button>
              ))}
            </div>
            <p className="job-kind-disclaimer">
              {activeJobTab === "verified-job"
                ? "仅展示带官方来源链接和验证记录的岗位；状态仍需在投递前再次核对。"
                : activeJobTab === "imported-jd"
                  ? "由你粘贴或导入的目标 JD，默认状态为待核对。"
                  : "AI 生成的职业探索方向，不代表企业正在招聘，也不能直接投递。"}
            </p>
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
                <button type="button" className="primary-action" onClick={() => void handleUseCustomJob()} disabled={(!customTitle.trim() && !customJdText.trim()) || !hasResume || !externalModelConsent || jdStatus === "loading"}>
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
                      {selectedJob.sourceMetadata ? (
                        <small className="job-source-proof">
                          {selectedJob.sourceMetadata.sourceType} · {selectedJob.sourceMetadata.verification}
                        </small>
                      ) : null}
                    </div>
                    <div className={`score-badge ${toneOf(result.evidenceCoverage)}`}>
                      <strong>{result.evidenceCoverage}%</strong>
                      <span>证据覆盖率</span>
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

                  <div className="application-tracker" data-tracked={trackedApplication ? "true" : "false"}>
                    <div>
                      <span>本地求职追踪</span>
                      <p>
                        {selectedJob.jobKind === "career-direction"
                          ? "职业方向不是可投递岗位，需先找到已验证岗位或导入具体 JD。"
                          : trackedApplication
                            ? `已于 ${new Date(trackedApplication.createdAt).toLocaleDateString("zh-CN")} 加入，仅在本机保存岗位进度。`
                            : "只保存岗位快照和进度，不保存完整简历。"}
                      </p>
                    </div>
                    {selectedJob.jobKind === "career-direction" ? (
                      <span className="tracking-blocked">不可直接投递</span>
                    ) : trackedApplication ? (
                      <div className="tracking-controls">
                        <label>
                          投递简历版本
                          <select
                            value={trackedApplication.resumeVersionId ?? ""}
                            onChange={(event) => handleBindResumeVersion(event.target.value)}
                            disabled={!currentJobVersions.length}
                          >
                            <option value="" disabled>{currentJobVersions.length ? "请选择实际使用版本" : "请先保存投递版本"}</option>
                            {currentJobVersions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
                          </select>
                        </label>
                        <label>
                          当前阶段
                          <select value={trackedApplication.stage} onChange={(event) => handleApplicationStage(event.target.value as ApplicationStage)}>
                            {applicationStageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <button type="button" className="secondary-action compact-action" onClick={handleTrackSelectedJob}>加入追踪</button>
                    )}
                  </div>
                  {resumeVersionStatus ? <p className="resume-version-status application-tracker-status" role="status">{resumeVersionStatus}</p> : null}

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
                            <span className={item.status === "满足" ? "strong" : item.status === "部分满足" || item.status === "待确认" ? "medium" : "weak"}>{item.status}</span>
                            <strong>{item.requirement}</strong>
                            <p>{item.evidence}</p>
                          </article>
                        ))}
                      </div>
                    </InfoBlock>
                  </div>
                </div>

                <div className="chart-card evidence-summary-card">
                  <div className="section-head">
                    <div>
                      <span>Evidence Coverage</span>
                      <h3>证据覆盖结构</h3>
                    </div>
                    <p>覆盖率只统计可评估要求，不代表企业筛选或录用概率。</p>
                  </div>
                  <div className="evidence-summary-grid">
                    <article><span>证据覆盖</span><strong>{result.evidenceCoverage}%</strong></article>
                    <article><span>硬性条件</span><strong>{result.hardGateResult === "pass" ? "通过" : result.hardGateResult === "fail" ? "不满足" : "待确认"}</strong></article>
                    <article><span>风险等级</span><strong>{result.riskLevel === "low" ? "低" : result.riskLevel === "medium" ? "中" : "高"}</strong></article>
                    <article><span>待确认项</span><strong>{result.requirementMatrix.filter((item) => item.status === "unknown" || item.status === "partially-supported").length}</strong></article>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="当前分类暂无内容" text="可刷新已验证岗位、导入目标 JD，或上传简历生成职业方向；三类数据不会混排。" />
            )}
          </Panel>
        </section>

        <aside className="insight-column">
          <Panel eyebrow="Evidence Insight" title="证据化匹配与事实约束改写" icon={<Lightbulb size={18} />}>
            {hasAnalysis ? (
              <>
                <div className={`verdict-card ${toneOf(result.evidenceCoverage)}`}>
                  <div>
                    <span>匹配结论</span>
                    <strong>{result.verdict}</strong>
                    <p>基于硬性条件和可追溯简历证据生成，不代表企业录用概率。</p>
                  </div>
                  <b>{result.evidenceCoverage}%</b>
                </div>

                <button type="button" className="secondary-action" onClick={handleDownloadReport} disabled={!hasResume || !hasAnalysis}>
                  <ArrowDownToLine size={16} />
                  下载分析报告
                </button>

                <button type="button" className="secondary-action" onClick={() => void handleShareReport()} disabled={!hasResume || !hasAnalysis}>
                  <Share2 size={16} />
                  系统分享
                </button>
                {shareStatus ? <p className="share-status" role="status">{shareStatus}</p> : null}

                <button type="button" className="secondary-action" onClick={() => void handleModelAnalysis()} disabled={modelStatus === "loading" || !hasResume || !hasAnalysis}>
                  <FontAwesomeShapeIcon icon={faWandMagicSparkles} size={16} />
                  {modelStatus === "loading" ? "模型分析中" : "模型增强分析"}
                </button>

                {(modelMessage || modelInsight) && (
                  <InfoBlock title="模型增强结果">
                    <div className={`model-insight ${modelStatus}`}>
                      {modelMessage ? <strong>{modelMessage}</strong> : null}
                      {modelInsight ? <ModelInsightMarkdown content={modelInsight} /> : null}
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

                <InfoBlock title="事实约束修改建议">
                  <div className="draft-card">
                    <div>
                      <span>个人总结</span>
                      <p>{optimizedDraft.summary}</p>
                    </div>
                    <div className="resume-proposal-list">
                      <span>逐条确认修改</span>
                      {optimizedDraft.proposals.length ? optimizedDraft.proposals.map((proposal) => {
                        const decision = proposalDecisions[proposal.id] || "pending";
                        return (
                          <article key={proposal.id} className={`resume-proposal ${decision}`}>
                            <small>{proposal.section} · 证据 {proposal.evidenceIds.join("、")}</small>
                            <label>原文<textarea value={proposal.originalText} readOnly /></label>
                            <label>建议稿<textarea value={proposalEdits[proposal.id] ?? proposal.suggestedText} onChange={(event) => handleProposalEdit(proposal.id, event.target.value)} /></label>
                            <p><b>对应要求：</b>{proposal.targetRequirement}</p>
                            <p><b>修改理由：</b>{proposal.changeReason}</p>
                            <p><b>风险：</b>{proposal.risk}</p>
                            <div className="proposal-actions">
                              <button type="button" className="secondary-action compact-action" onClick={() => { setProposalDecisions((current) => ({ ...current, [proposal.id]: "accepted" })); setResumeVersionStatus("已记录本次事实确认。"); }}>核对无误并接受</button>
                              <button type="button" className="secondary-action compact-action" onClick={() => { setProposalDecisions((current) => ({ ...current, [proposal.id]: "rejected" })); setResumeVersionStatus("已拒绝该项，不会进入投递稿。"); }}>拒绝</button>
                            </div>
                          </article>
                        );
                      }) : <p>当前没有可引用原文的修改建议。</p>}
                    </div>
                    <div>
                      <span>技能关键词</span>
                      <p>{optimizedDraft.skillLine}</p>
                    </div>
                    <div className={`draft-validation ${draftValidation.ok ? "ready" : "blocked"}`} role="status">
                      <strong>{draftValidation.ok ? "事实检查已通过" : "投递稿尚未通过事实检查"}</strong>
                      <p>{draftValidation.ok ? `共 ${draftValidation.acceptedProposalIds.length} 项已核对，可保存为独立投递版本。` : draftValidation.errors[0] || "请逐条核对修改。"}</p>
                    </div>
                    <div className="draft-version-actions">
                      <button type="button" className="secondary-action compact-action" onClick={handleCopyDraft}>
                        {copyStatus}（仅已接受项）
                      </button>
                      <button type="button" className="secondary-action compact-action" onClick={handleSaveResumeVersion}>
                        保存投递版本
                      </button>
                    </div>
                    {resumeVersionStatus ? <p className="resume-version-status" role="status">{resumeVersionStatus}</p> : null}
                    {currentJobVersions.length ? (
                      <div className="resume-version-list">
                        <span>当前岗位的本机投递版本</span>
                        {currentJobVersions.slice(0, 8).map((version) => (
                          <article key={version.id}>
                            <div className="resume-version-summary">
                              <strong>{version.name}</strong>
                              <small>{new Date(version.createdAt).toLocaleString("zh-CN")} · {version.acceptedProposalIds.length} 项事实确认 · 证据覆盖 {version.evidenceCoverage}%</small>
                              <small>{version.changeSummary}</small>
                              {trackedApplication?.resumeVersionId === version.id ? <b>当前投递记录使用版本</b> : null}
                              <details>
                                <summary>查看版本内容</summary>
                                <pre>{version.content}</pre>
                              </details>
                            </div>
                            <div className="resume-version-actions">
                              <button type="button" className="secondary-action compact-action" onClick={() => void handleCopyResumeVersion(version)}>复制</button>
                              <button type="button" className="secondary-action compact-action" onClick={() => handleRestoreResumeVersion(version)}>恢复</button>
                              <button type="button" className="secondary-action compact-action danger-action" onClick={() => handleDeleteResumeVersion(version)}>删除</button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </InfoBlock>

                <InfoBlock title="学习与补强建议">
                  <BulletList items={optimizedDraft.learningSuggestions.length ? optimizedDraft.learningSuggestions : ["当前没有需要从岗位要求迁入学习清单的技能。"]} icon="risk" />
                </InfoBlock>

                <InfoBlock title="投递前清单">
                  <ol className="checklist">
                    {careerOpsEvaluation.applicationChecklist.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </InfoBlock>

                <InfoBlock title="投递运营看板">
                  <div className="daily-actions" data-count={dailyApplicationActions.length}>
                    <div className="daily-actions-head">
                      <strong>本机今日行动</strong>
                      <span>{applications.length} 个岗位 · {dailyApplicationActions.length} 项待办</span>
                    </div>
                    {dailyApplicationActions.length ? dailyApplicationActions.slice(0, 4).map((item) => (
                      <article key={item.applicationId} className={`priority-${item.priority}`}>
                        <strong>{item.title}</strong>
                        <p>{item.action}</p>
                      </article>
                    )) : <p className="daily-actions-empty">尚未加入具体岗位；职业方向不会自动进入投递追踪。</p>}
                  </div>
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
          <Suspense fallback={<div className="page-loading">正在加载 AI 助手…</div>}>
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
          </Suspense>
        </section>
      ) : null}

      {activePage === "interview" ? (
        <Suspense fallback={<div className="page-loading">正在加载模拟面试…</div>}>
          <InterviewPage job={selectedJob} profile={activeProfile} resumeText={resumeText} hasAnalysis={hasAnalysis} />
        </Suspense>
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

function ProductAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`product-avatar ${compact ? "compact" : ""}`}>
      <img src={`${import.meta.env.BASE_URL}kongming-ip.png`} alt="" aria-hidden="true" />
    </span>
  );
}

function AppNav({
  activePage,
  onChange,
  account,
  accountBusy,
  onAccount,
}: {
  activePage: ActivePage;
  onChange: (page: ActivePage) => void;
  account: HuaweiAuthState;
  accountBusy: boolean;
  onAccount: () => void;
}) {
  const items: Array<{ id: ActivePage; label: string; icon: ReactNode }> = [
    { id: "home", label: "首页", icon: <FontAwesomeShapeIcon icon={faUserAstronaut} size={16} /> },
    { id: "resume", label: "简历解析", icon: <FileText size={16} /> },
    { id: "jobs", label: "岗位证据", icon: <BriefcaseBusiness size={16} /> },
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
        <button
          type="button"
          className={`nav-account ${account.signedIn ? "signed-in" : ""}`}
          onClick={onAccount}
          disabled={accountBusy}
          title={account.nativeAvailable ? account.message : "需在鸿蒙安装包中使用华为账号登录"}
        >
          {account.signedIn ? <LogOut size={16} /> : <LogIn size={16} />}
          <span className="nav-account-label">
            {accountBusy ? "登录中" : account.signedIn ? account.displayName || "华为用户" : "华为账号"}
          </span>
        </button>
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
        <p>孔明职配聚焦互联网与数字技术岗位，把官方岗位、用户导入 JD 与职业方向分开管理，并以可追溯的简历原文证据解释要求覆盖和修改建议。</p>
        <button type="button" className="hero-primary" onClick={onStart}>
          开始解析简历
          <ArrowUpRight size={16} />
        </button>
        <div className="hero-actions">
          <span><ShieldCheck size={16} />证据可追溯</span>
          <span><Search size={16} />岗位优先级</span>
          <span><ClipboardCheck size={16} />投递准备</span>
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
          <strong>{isReady ? `${result.evidenceCoverage}%` : "Evidence"}</strong>
          <em />
        </div>
        <div className="orbit-node node-a">
          <span>Resume</span>
          <strong>{isReady ? activeLabel(selectedJob.title) : "上传简历"}</strong>
        </div>
        <div className="orbit-node node-b">
          <span>Match</span>
          <strong>{isReady ? `${result.evidenceCoverage}%` : "证据匹配"}</strong>
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
          <strong>{isReady ? `${result.evidenceCoverage}% 证据` : "待分析"}</strong>
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
              <b>{result.evidenceCoverage}%</b>
              <div>
                <small>{result.verdict}</small>
              <i style={{ width: `${result.evidenceCoverage}%` }} />
              </div>
            </div>
            <p>已找到 {result.coveredKeywords.length} 个岗位关键词证据，另有 {result.missingKeywords.length} 个关键词无证据。</p>
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
    { id: "jobs", label: "职业方向" },
    { id: "analysis", label: "证据建议" },
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
    { id: "jobs", label: "职业方向" },
    { id: "analysis", label: "证据建议" },
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
  const kindLabel = job.jobKind === "verified-job" ? "已验证岗位" : job.jobKind === "imported-jd" ? "我的 JD" : "职业方向";
  return (
    <button className={`job-card ${active ? "active" : ""}`} onClick={onSelect} type="button">
      <div className="job-card-top">
        <span>{job.track}</span>
        <small>{kindLabel}</small>
      </div>
      <strong>{job.title}</strong>
      <p>{job.city} · {job.level} · {job.companyScenario}</p>
      <div className="job-card-bottom">
        <b>证据 {result.evidenceCoverage}%</b>
        <i style={{ width: `${result.evidenceCoverage}%` }} />
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
