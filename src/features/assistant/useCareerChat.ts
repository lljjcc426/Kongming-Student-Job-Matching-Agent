import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatStatus } from "../../app/types";
import { callArkAgent } from "../../arkClient";
import type { Job } from "../../data";
import type { MatchResult } from "../../matchEngine";
import type { StructuredResume } from "../../modelParsers";

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
  const bodyRef = useRef<HTMLDivElement | null>(null);

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
    setMessages(history);
    setInput("");
    setStatus("loading");
    setStatusMessage("正在生成回复");

    const response = await callArkAgent(
      {
        task: "career-chat",
        userMessage: message,
        chatMessages: history.map(({ role, content }) => ({ role, content })),
        resumeText,
        resumeProfile,
        selectedJob: hasAnalysis ? selectedJob : undefined,
        matchResult: hasAnalysis ? matchResult : undefined,
      },
      { timeoutMs: 45000 },
    );

    if (response.ok && response.content) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content ?? "",
        },
      ]);
      setStatus("ready");
      setStatusMessage("已回复");
      return;
    }

    setStatus("error");
    setStatusMessage(response.error || "AI 助手暂时无法回复，请稍后重试。");
  };

  return {
    messages,
    input,
    setInput,
    status,
    statusMessage,
    bodyRef,
    startVoiceInput,
    send,
  };
}
