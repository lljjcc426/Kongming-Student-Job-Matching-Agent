import { ArrowUp, Bot, Database, Mic, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RefObject } from "react";
import logoUrl from "../assets/kongming-logo.png";
import type { AgentMemoryStatus } from "../features/assistant/agentMemoryClient";

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type AssistantChatStatus = "idle" | "listening" | "loading" | "ready" | "error";

type AssistantChatPanelProps = {
  messages: AssistantChatMessage[];
  input: string;
  status: AssistantChatStatus;
  statusMessage: string;
  bodyRef: RefObject<HTMLDivElement | null>;
  memoryStatus: AgentMemoryStatus;
  memoryCount: number;
  memoryUpdatedAt: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onVoiceInput: () => void;
  onQuickQuestion: (value: string) => void;
  onClearMemory: () => void;
};

const quickQuestions = ["帮我分析简历", "推荐适合我的岗位", "生成面试问题", "优化求职目标"];

const statusText: Record<AssistantChatStatus, string> = {
  idle: "在线分析中",
  listening: "正在收听",
  loading: "正在生成回复",
  ready: "在线分析中",
  error: "需要重试",
};

function AssistantMarkdownMessage({ content }: { content: string }) {
  return (
    <div className="assistant-markdown-message">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default function AssistantChatPanel({
  messages,
  input,
  status,
  statusMessage,
  bodyRef,
  memoryStatus,
  memoryCount,
  memoryUpdatedAt,
  onInputChange,
  onSend,
  onVoiceInput,
  onQuickQuestion,
  onClearMemory,
}: AssistantChatPanelProps) {
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const scrollToLatest = (behavior: ScrollBehavior = "auto") => {
    const body = bodyRef.current;
    if (!body) return;

    body.scrollTop = body.scrollHeight;
    bottomAnchorRef.current?.scrollIntoView({ block: "end", behavior });
  };

  useLayoutEffect(() => {
    scrollToLatest("auto");
  }, [messages.length, status]);

  useEffect(() => {
    const performScroll = () => scrollToLatest("auto");

    const frame = window.requestAnimationFrame(performScroll);
    const timeout = window.setTimeout(performScroll, 90);
    const lateTimeout = window.setTimeout(performScroll, 240);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.clearTimeout(lateTimeout);
    };
  }, [bodyRef, messages, status, statusMessage]);

  return (
    <section className="assistant-chat-panel" aria-label="AI 求职助手对话面板">
      <header className="assistant-chat-header">
        <div className="assistant-chat-avatar">
          <Bot size={18} />
        </div>
        <div>
          <strong>孔明 AI 助手</strong>
          <span className={status === "error" ? "error" : ""}>{statusText[status]}</span>
        </div>
        <div className="assistant-memory-tools">
          <div
            className={`assistant-memory-state ${memoryStatus}`}
            title={memoryUpdatedAt ? `最近更新：${new Date(memoryUpdatedAt).toLocaleString("zh-CN")}` : "记忆尚未写入"}
          >
            <Database size={14} />
            <span>
              {memoryStatus === "loading"
                  ? "正在读取记忆"
                  : memoryStatus === "error"
                    ? "记忆暂不可用"
                    : memoryCount > 0
                      ? `长期记忆 ${memoryCount} 条`
                      : "长期记忆已启用"}
            </span>
          </div>
          <button
            type="button"
            className="assistant-memory-clear"
            aria-label="清除长期记忆"
            title="清除本机长期记忆"
            onClick={onClearMemory}
            disabled={memoryStatus === "loading"}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className="assistant-quick-row" aria-label="快捷问题">
        {quickQuestions.map((question) => (
          <button key={question} type="button" onClick={() => onQuickQuestion(question)}>
            {question}
          </button>
        ))}
      </div>

      <div className="assistant-chat-body" ref={bodyRef} aria-live="polite">
        {messages.length ? (
          messages.map((message) => (
            <article key={message.id} className={`assistant-chat-message ${message.role}`}>
              {message.role === "assistant" ? (
                <span className="assistant-message-avatar ai">
                  <img src={logoUrl} alt="" aria-hidden="true" />
                </span>
              ) : (
                <span className="assistant-message-avatar user">你</span>
              )}
              {message.role === "assistant" ? <AssistantMarkdownMessage content={message.content} /> : <p>{message.content}</p>}
            </article>
          ))
        ) : (
          <article className="assistant-chat-message assistant">
            <span className="assistant-message-avatar ai">
              <img src={logoUrl} alt="" aria-hidden="true" />
            </span>
            <p>你好，我可以帮你分析简历、推荐岗位、生成模拟面试问题，并给出个性化求职建议。</p>
          </article>
        )}
        {status === "loading" ? (
          <article className="assistant-chat-message assistant pending">
            <span className="assistant-message-avatar ai">
              <img src={logoUrl} alt="" aria-hidden="true" />
            </span>
            <p>正在分析你的问题...</p>
          </article>
        ) : null}
        <div ref={bottomAnchorRef} className="assistant-chat-bottom-anchor" aria-hidden="true" />
      </div>

      {statusMessage ? <div className={`assistant-chat-status ${status === "error" ? "error" : ""}`}>{statusMessage}</div> : null}

      <footer className="assistant-chat-composer">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          aria-label="AI 助手输入"
          placeholder="输入你的求职问题，例如：帮我分析这份简历适合哪些岗位"
        />
        <button type="button" className={`assistant-round-button voice ${status === "listening" ? "listening" : ""}`} aria-label="语音输入" onClick={onVoiceInput} disabled={status === "listening" || status === "loading"}>
          <Mic size={19} />
        </button>
        <button type="button" className="assistant-round-button send" aria-label="发送" onClick={onSend} disabled={!input.trim() || status === "loading"}>
          <ArrowUp size={21} />
        </button>
      </footer>
    </section>
  );
}
