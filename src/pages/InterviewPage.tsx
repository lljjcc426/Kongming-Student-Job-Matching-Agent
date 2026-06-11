import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Brain, BriefcaseBusiness, Code2, Mic, MicOff, RotateCcw, SkipForward, Sparkles, Square, UsersRound, Video } from "lucide-react";
import type { Job, StudentProfile } from "../data";
import { getInterviewModelProvider } from "../modelProviders/interviewProvider";
import { BrowserSpeechRecognitionAdapter } from "../speechToText/browserSpeechRecognitionAdapter";
import { BrowserSpeechSynthesisAdapter } from "../tts/browserSpeechSynthesisAdapter";
import type { AvatarSpeechState, InterviewFeedbackReport, InterviewInputMode, InterviewMessage, InterviewStatus, InterviewTurn, InterviewType } from "../types/interview";
import InterviewerAvatar from "../components/interview/InterviewerAvatar";
import StudentCameraPreview from "../components/interview/StudentCameraPreview";
import { useStudentCamera } from "../components/interview/useStudentCamera";

type InterviewPageProps = {
  job: Job;
  profile: StudentProfile;
  resumeText: string;
  hasAnalysis: boolean;
};

const interviewTypes: Array<{ value: InterviewType; label: string; description: string; icon: typeof Brain }> = [
  { value: "综合面", label: "综合面", description: "经历、动机、能力迁移", icon: Brain },
  { value: "技术面", label: "技术面", description: "专业能力、方案表达", icon: Code2 },
  { value: "HR面", label: "HR面", description: "稳定性、协作与规划", icon: UsersRound },
];

const createMessage = (role: InterviewMessage["role"], content: string, inputMode?: InterviewInputMode): InterviewMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  content,
  timestamp: Date.now(),
  inputMode,
});

const statusLabel: Record<InterviewStatus, string> = {
  idle: "准备中",
  opening: "正在开场",
  asking: "正在提问",
  listening: "正在倾听",
  thinking: "正在思考",
  feedback: "正在反馈",
  finished: "已结束",
  error: "已降级",
};

const avatarStateOf = (status: InterviewStatus): AvatarSpeechState => {
  if (status === "opening" || status === "asking" || status === "feedback") return "speaking";
  if (status === "listening") return "listening";
  if (status === "thinking") return "thinking";
  if (status === "error") return "error";
  return "idle";
};

const formatSeconds = (seconds: number) => {
  const minute = Math.floor(seconds / 60);
  const second = seconds % 60;
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
};

const firstOpeningOf = (type: InterviewType) => {
  if (type === "技术面") {
    return "你好，我是今天的 AI 技术面试官。接下来我会围绕你的项目经历、技术基础和问题解决过程进行模拟提问，请尽量结合真实经历回答。";
  }
  if (type === "HR面") {
    return "你好，我是今天的 AI HR 面试官。接下来我会围绕岗位动机、团队协作、职业规划和稳定性进行模拟提问，请用真实、自然的方式回答。";
  }
  return "你好，我是今天的 AI 面试官。接下来我会围绕你的目标岗位进行综合模拟面试，请尽量用真实面试的方式回答。";
};

export default function InterviewPage({ job, profile, resumeText, hasAnalysis }: InterviewPageProps) {
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [answer, setAnswer] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("等待开始面试");
  const [speechStatus, setSpeechStatus] = useState<"idle" | "recording" | "recognizing" | "unsupported" | "error">("idle");
  const [feedback, setFeedback] = useState<InterviewFeedbackReport | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inputMode, setInputMode] = useState<InterviewInputMode>("text");
  const [adapterNotice, setAdapterNotice] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("综合面");
  const chatRef = useRef<HTMLDivElement | null>(null);
  const sttRef = useRef<BrowserSpeechRecognitionAdapter | null>(null);
  const ttsRef = useRef(new BrowserSpeechSynthesisAdapter());
  const camera = useStudentCamera();
  const modelProvider = useMemo(() => getInterviewModelProvider(), []);
  const avatarMode = import.meta.env.VITE_AVATAR_MODE || "static";
  const resumeSummary = profile.resumeText || resumeText || profile.experiences.map((item) => item.evidence).join("；");

  const currentRound = turns.length + (status === "idle" || status === "finished" ? 0 : 1);
  const avatarState = avatarStateOf(status);
  const activeInterviewType = interviewTypes.find((item) => item.value === interviewType) || interviewTypes[0];

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    window.requestAnimationFrame(() => {
      const chat = chatRef.current;
      if (!chat) return;
      chat.scrollTo({ top: chat.scrollHeight, behavior });
    });
  }, []);

  const speakAsAvatar = useCallback(async (text: string, nextStatus: InterviewStatus = "listening", speakingStatus: InterviewStatus = "asking") => {
    setStatus(speakingStatus);
    try {
      await ttsRef.current.speak(text);
    } finally {
      setStatus(nextStatus);
    }
  }, []);

  useEffect(() => {
    scrollChatToBottom(messages.length <= 2 ? "auto" : "smooth");
  }, [messages, status, feedback, scrollChatToBottom]);

  useEffect(() => {
    if (status === "idle" || status === "finished") return undefined;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (avatarMode === "livetalking") {
      setAdapterNotice("LiveTalking 服务未连接，当前使用本地数字人预览。");
    } else {
      setAdapterNotice("");
    }
  }, [avatarMode]);

  const askQuestion = useCallback(
    async (nextMessages: InterviewMessage[], nextTurns: InterviewTurn[]) => {
      setStatus("thinking");
      const reply = await modelProvider.generateInterviewReply({
        messages: nextMessages,
        turns: nextTurns,
        jobTarget: job,
        interviewType,
        resumeSummary,
        currentRound: nextTurns.length + 1,
      });
      const interviewerMessage = createMessage("interviewer", reply);
      setMessages((current) => [...current, interviewerMessage]);
      setCurrentQuestion(reply);
      await speakAsAvatar(reply, "listening");
    },
    [interviewType, job, modelProvider, resumeSummary, speakAsAvatar],
  );

  const handleStart = async () => {
    setFeedback(null);
    setTurns([]);
    setElapsedSeconds(0);
    setAnswer("");
    ttsRef.current.stop();
    const opening = firstOpeningOf(interviewType);
    const openingMessage = createMessage("interviewer", opening);
    setMessages([openingMessage]);
    setCurrentQuestion("开场介绍");
    await speakAsAvatar(opening, "thinking", "opening");
    await askQuestion([openingMessage], []);
  };

  const handleSendAnswer = async (mode: InterviewInputMode = inputMode) => {
    const text = answer.trim();
    if (!text || status === "thinking" || status === "feedback") return;
    const studentMessage = createMessage("student", text, mode);
    const nextMessages = [...messages, studentMessage];
    const nextTurns = [
      ...turns,
      {
        question: currentQuestion,
        answer: text,
        timestamp: Date.now(),
        inputMode: mode,
      },
    ];
    setMessages(nextMessages);
    setTurns(nextTurns);
    setAnswer("");
    setInputMode("text");
    await askQuestion(nextMessages, nextTurns);
  };

  const handleSkip = async () => {
    const systemMessage = createMessage("system", "学生选择跳过当前问题。");
    const nextMessages = [...messages, systemMessage];
    setMessages(nextMessages);
    await askQuestion(nextMessages, turns);
  };

  const handleRestartAnswer = () => {
    setAnswer("");
    setInputMode("text");
    setStatus("listening");
  };

  const handleVoice = async () => {
    if (speechStatus === "recording") {
      setSpeechStatus("recognizing");
      const text = await sttRef.current?.stop();
      if (text) {
        setAnswer(text);
        setInputMode("voice");
      }
      setSpeechStatus("idle");
      return;
    }

    const adapter = new BrowserSpeechRecognitionAdapter();
    if (!adapter.isSupported()) {
      setSpeechStatus("unsupported");
      return;
    }
    sttRef.current = adapter;
    adapter.onPartialResult = setAnswer;
    adapter.onError = () => {
      if (!answer.trim()) setSpeechStatus("error");
    };
    setSpeechStatus("recording");
    setStatus("listening");
    await adapter.start().catch(() => {
      setSpeechStatus("error");
      setStatus(messages.length ? "listening" : "idle");
    });
  };

  const handleFinish = async () => {
    setStatus("feedback");
    ttsRef.current.stop();
    const report = await modelProvider.generateFeedback({
      messages,
      turns,
      jobTarget: job,
      interviewType,
      resumeSummary,
      currentRound,
    });
    setFeedback(report);
    const summary = `本次模拟面试已结束。总体评分 ${report.overallScore} 分，重点建议是：${report.improvements[0] || "继续强化结构化表达。"}`;
    const finalMessage = createMessage("interviewer", summary);
    setMessages((current) => [...current, finalMessage]);
    await speakAsAvatar(summary, "finished");
  };

  useEffect(() => () => {
    ttsRef.current.stop();
    void sttRef.current?.stop();
  }, []);

  return (
    <section className="interview-panel">
      <div className="interview-page-grid">
        <section className={`avatar-panel ${avatarState}`}>
          <div className="avatar-panel-top">
            <span>AI 面试官 · {interviewType}</span>
            <strong>{statusLabel[status]}</strong>
          </div>
          <InterviewerAvatar state={avatarState} />
          <StudentCameraPreview status={camera.status} videoRef={camera.videoRef} onStart={() => void camera.startCamera()} onStop={camera.stopCamera} />
          {adapterNotice ? <div className="avatar-adapter-notice">{adapterNotice}</div> : null}
        </section>

        <section className="interview-console">
          <div className="interview-console-head">
            <div>
              <span>Digital Interview</span>
              <h2>AI 数字人模拟面试</h2>
            </div>
            <button type="button" className="primary-action compact-action" onClick={() => void handleStart()} disabled={status === "thinking" || status === "feedback"}>
              <Video size={16} />
              {status === "idle" || status === "finished" ? "开始面试" : "重新开始"}
            </button>
          </div>

          <div className="interview-type-tabs" role="tablist" aria-label="面试类型选择">
            {interviewTypes.map((type) => {
              const Icon = type.icon;
              const active = type.value === interviewType;
              return (
                <button key={type.value} type="button" className={active ? "active" : ""} onClick={() => setInterviewType(type.value)} aria-pressed={active}>
                  <Icon size={16} />
                  <span>{type.label}</span>
                  <small>{type.description}</small>
                </button>
              );
            })}
          </div>

          <div className="interview-meta-grid">
            <article>
              <span>目标岗位</span>
              <strong>{hasAnalysis ? job.title : "目标岗位待确认"}</strong>
            </article>
            <article>
              <span>面试侧重</span>
              <strong>{activeInterviewType.description}</strong>
            </article>
            <article>
              <span>当前轮次</span>
              <strong>{Math.max(0, currentRound)}</strong>
            </article>
            <article>
              <span>已用时间</span>
              <strong>{formatSeconds(elapsedSeconds)}</strong>
            </article>
          </div>

          <div className="interview-dialogue" ref={chatRef} aria-live="polite">
            {messages.length ? messages.map((message) => (
              <article key={message.id} className={message.role}>
                <span>{message.role === "student" ? "学生" : message.role === "system" ? "系统" : "AI 面试官"}</span>
                <p>{message.content}</p>
              </article>
            )) : (
              <div className="interview-empty">
                <Sparkles size={22} />
                <strong>开始一场真实感模拟面试</strong>
                <p>支持综合面、技术面、HR 面三种模式，并结合目标岗位持续追问。</p>
              </div>
            )}

            {feedback ? (
              <div className="interview-feedback-report">
                <div className="feedback-score">
                  <strong>{feedback.overallScore}</strong>
                  <span>总体评分</span>
                </div>
                <div className="feedback-bars">
                  {[
                    ["表达能力", feedback.expression],
                    ["专业匹配度", feedback.professionalFit],
                    ["逻辑结构", feedback.logic],
                  ].map(([label, score]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <i><b style={{ width: `${score}%` }} /></i>
                      <em>{score}</em>
                    </div>
                  ))}
                </div>
                <div className="feedback-detail">
                  <strong>可改进点</strong>
                  <ul>{feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
                  <strong>推荐优化回答</strong>
                  <p>{feedback.optimizedAnswer}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="interview-composer">
            <textarea
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                setInputMode("text");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendAnswer("text");
                }
              }}
              placeholder="输入你的回答，或点击语音按钮完成转写后再发送"
              aria-label="模拟面试回答"
            />
            <div className="interview-composer-actions">
              <button type="button" className={`secondary-action compact-action ${speechStatus === "recording" ? "listening" : ""}`} onClick={() => void handleVoice()} disabled={status === "thinking" || status === "feedback"}>
                {speechStatus === "recording" ? <MicOff size={16} /> : <Mic size={16} />}
                {speechStatus === "recording" ? "停止录音" : speechStatus === "recognizing" ? "正在识别" : "语音回答"}
              </button>
              <button type="button" className="secondary-action compact-action" onClick={handleRestartAnswer}>
                <RotateCcw size={16} />
                重新回答
              </button>
              <button type="button" className="secondary-action compact-action" onClick={() => void handleSkip()} disabled={status === "idle" || status === "thinking" || status === "feedback"}>
                <SkipForward size={16} />
                跳过问题
              </button>
              <button type="button" className="secondary-action compact-action" onClick={() => void handleFinish()} disabled={status === "idle" || status === "feedback" || turns.length === 0}>
                <Square size={14} />
                结束面试
              </button>
              <button type="button" className="primary-action compact-action" onClick={() => void handleSendAnswer(inputMode)} disabled={!answer.trim() || status === "thinking" || status === "feedback"}>
                <ArrowUp size={16} />
                发送
              </button>
            </div>
            {speechStatus === "unsupported" ? <p className="interview-hint">当前浏览器不支持 Web Speech API，请使用文字输入。</p> : null}
            {speechStatus === "error" ? <p className="interview-hint error">语音识别失败，请重新录制或改用文字输入。</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
