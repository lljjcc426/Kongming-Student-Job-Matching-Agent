import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatStatus } from "../../app/types";
import { callArkAgent } from "../../arkClient";
import type { Job } from "../../data";
import type { MatchResult } from "../../matchEngine";
import type { StructuredResume } from "../../modelParsers";
import {
  buildAgentMemoryPrompt,
  clearAgentMemory,
  createEmptyAgentMemory,
  loadAgentMemory,
  saveAgentMemory,
  type AgentMemory,
  type AgentMemoryContext,
  type AgentMemoryStatus,
} from "./agentMemoryClient";

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

const getSpeechRecognition = () => {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
};

type UseCareerChatOptions = {
  resumeText: string;
  resumeProfile: StructuredResume | null;
  selectedJob: Job;
  matchResult: MatchResult;
  hasAnalysis: boolean;
};

export function useCareerChat({
  resumeText,
  resumeProfile,
  selectedJob,
  matchResult,
  hasAnalysis,
}: UseCareerChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [memory, setMemory] = useState<AgentMemory>(createEmptyAgentMemory);
  const [memoryStatus, setMemoryStatus] = useState<AgentMemoryStatus>("loading");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const memoryRef = useRef(memory);

  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  useEffect(() => {
    let active = true;
    void loadAgentMemory()
      .then((storedMemory) => {
        if (!active) return;
        memoryRef.current = storedMemory;
        setMemory(storedMemory);
        setMessages(storedMemory.messages);
        setMemoryStatus("ready");
      })
      .catch(() => {
        if (active) setMemoryStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!resumeProfile && !hasAnalysis) return;
    const context: AgentMemoryContext = {
      ...(resumeProfile ? { resumeProfile } : {}),
      ...(hasAnalysis ? { targetJob: selectedJob, matchResult } : {}),
    };
    const timer = window.setTimeout(() => {
      void saveAgentMemory([], context)
        .then((storedMemory) => {
          memoryRef.current = storedMemory;
          setMemory(storedMemory);
          setMemoryStatus("ready");
        })
        .catch(() => setMemoryStatus("error"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hasAnalysis, matchResult, resumeProfile, selectedJob]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const startVoiceInput = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setStatus("error");
      setStatusMessage("当前浏览器不支持语音转写，请直接输入文字。");
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
      setStatus("listening");
      setStatusMessage("正在收听，结束后会写入输入框。");
    };
    recognition.onresult = (event) => {
      transcript = Array.from(event.results)
        .map((item) => item[0]?.transcript ?? "")
        .join("")
        .trim();
      if (transcript) setStatusMessage("已识别到语音，结束后会写入输入框。");
    };
    recognition.onerror = (event) => {
      if (transcript || event.error === "no-speech" || event.error === "aborted") return;
      setStatus("error");
      setStatusMessage("语音转写未完成，请检查浏览器麦克风权限。");
    };
    recognition.onend = () => {
      setStatus((current) => (current === "listening" ? "idle" : current));
      if (transcript && !committed) {
        committed = true;
        setInput((current) => [current, transcript].filter(Boolean).join(current.trim() ? "\n" : ""));
        setStatusMessage("已完成语音转写，可以继续编辑或发送。");
      } else if (!transcript) {
        setStatusMessage("未识别到有效语音，请重试或直接输入文字。");
      }
    };
    recognition.start();
  };

  const send = async () => {
    const message = input.trim();
    if (!message || status === "loading") return;

    const nextUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    const history = [...messages, nextUserMessage];
    const memoryContext: AgentMemoryContext = {
      ...(resumeProfile ? { resumeProfile } : {}),
      ...(hasAnalysis ? { targetJob: selectedJob, matchResult } : {}),
    };
    const persistentMemory = buildAgentMemoryPrompt(
      memoryRef.current,
      message,
      memoryContext,
    );
    setMessages(history);
    setInput("");
    setStatus("loading");
    setStatusMessage("正在生成回复");
    void saveAgentMemory([nextUserMessage], memoryContext)
      .then((storedMemory) => {
        memoryRef.current = storedMemory;
        setMemory(storedMemory);
        setMemoryStatus("ready");
      })
      .catch(() => setMemoryStatus("error"));

    const response = await callArkAgent(
      {
        task: "career-chat",
        userMessage: message,
        chatMessages: history.map(({ role, content }) => ({ role, content })),
        resumeText,
        resumeProfile,
        selectedJob: hasAnalysis ? selectedJob : undefined,
        matchResult: hasAnalysis ? matchResult : undefined,
        persistentMemory,
      },
      { timeoutMs: 45000 },
    );

    if (response.ok && response.content) {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.content,
      };
      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
      void saveAgentMemory([nextUserMessage, assistantMessage], memoryContext)
        .then((storedMemory) => {
          memoryRef.current = storedMemory;
          setMemory(storedMemory);
          setMemoryStatus("ready");
        })
        .catch(() => setMemoryStatus("error"));
      setStatus("ready");
      setStatusMessage("已回复");
      return;
    }

    setStatus("error");
    setStatusMessage(response.error || "AI 助手暂时无法回复，请稍后重试。");
  };

  const clearMemory = async () => {
    if (!window.confirm("确定清除本机保存的对话、简历画像和目标岗位记忆吗？此操作不可撤销。")) return;
    try {
      const clearedMemory = await clearAgentMemory();
      memoryRef.current = clearedMemory;
      setMemory(clearedMemory);
      setMessages([]);
      setMemoryStatus("ready");
      setStatusMessage("长期记忆已清除");
    } catch {
      setMemoryStatus("error");
    }
  };

  return {
    messages,
    input,
    setInput,
    status,
    statusMessage,
    bodyRef,
    memoryStatus,
    memoryCount: memory.messages.length,
    memoryUpdatedAt: memory.updatedAt,
    startVoiceInput,
    send,
    clearMemory,
  };
}
