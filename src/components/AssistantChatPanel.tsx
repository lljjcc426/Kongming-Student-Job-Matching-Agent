import { ArrowUp, Bot, Database, Mic, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RefObject } from "react";
import logoUrl from "../assets/kongming-logo.png";
import type {
  AgentFeedback,
  AgentFeedbackRating,
  AgentMemoryStatus,
} from "../features/assistant/agentMemoryClient";

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
  feedback: AgentFeedback[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onVoiceInput: () => void;
  onQuickQuestion: (value: string) => void;
  onClearMemory: () => void;
  onFeedback: (messageId: string, rating: AgentFeedbackRating, correction?: string) => Promise<void>;
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
  feedback,
  onInputChange,
  onSend,
  onVoiceInput,
  onQuickQuestion,
  onClearMemory,
  onFeedback,
}: AssistantChatPanelProps) {
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const [feedbackDraftFor, setFeedbackDraftFor] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackSavingFor, setFeedbackSavingFor] = useState<string | null>(null);
  const [feedbackErrorFor, setFeedbackErrorFor] = useState<string | null>(null);

  const submitFeedback = async (
    messageId: string,
    rating: AgentFeedbackRating,
    correction = "",
  ) => {
    setFeedbackSavingFor(messageId);
    setFeedbackErrorFor(null);
    try {
      await onFeedback(messageId, rating, correction);
      setFeedbackDraftFor(null);
      setFeedbackDraft("");
    } catch {
      setFeedbackErrorFor(messageId);
    } finally {
      setFeedbackSavingFor(null);
    }
  };

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
              {message.role === "assistant" ? (
                <div className="assistant-message-content">
                  <AssistantMarkdownMessage content={message.content} />
                  <div className="assistant-feedback-row" aria-label="评价这条回答">
                    <span>这条建议是否有帮助？</span>
                    <button
                      type="button"
                      className={feedback.find((item) => item.messageId === message.id)?.rating === "positive" ? "active" : ""}
                      aria-label="这条回答有帮助"
                      aria-pressed={feedback.find((item) => item.messageId === message.id)?.rating === "positive"}
                      disabled={feedbackSavingFor === message.id}
                      onClick={() => void submitFeedback(message.id, "positive")}
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      type="button"
                      className={feedback.find((item) => item.messageId === message.id)?.rating === "negative" ? "active negative" : "negative"}
                      aria-label="这条回答需要改进"
                      aria-pressed={feedback.find((item) => item.messageId === message.id)?.rating === "negative"}
                      disabled={feedbackSavingFor === message.id}
                      onClick={() => {
                        const existing = feedback.find((item) => item.messageId === message.id);
                        setFeedbackDraftFor(message.id);
                        setFeedbackDraft(existing?.rating === "negative" ? existing.correction : "");
                        setFeedbackErrorFor(null);
                      }}
                    >
                      <ThumbsDown size={14} />
                    </button>
                    {feedback.find((item) => item.messageId === message.id) ? <em>已记录</em> : null}
                  </div>
                  {feedbackDraftFor === message.id ? (
                    <div className="assistant-feedback-editor">
                      <label htmlFor={`feedback-${message.id}`}>告诉我哪里需要调整（可选）</label>
                      <textarea
                        id={`feedback-${message.id}`}
                        value={feedbackDraft}
                        maxLength={1000}
                        placeholder="例如：我只考虑北京岗位，不接受销售方向。"
                        onChange={(event) => setFeedbackDraft(event.target.value)}
                      />
                      <div>
                        <button type="button" onClick={() => { setFeedbackDraftFor(null); setFeedbackDraft(""); }}>取消</button>
                        <button
                          type="button"
                          className="primary"
                          disabled={feedbackSavingFor === message.id}
                          onClick={() => void submitFeedback(message.id, "negative", feedbackDraft)}
                        >
                          {feedbackSavingFor === message.id ? "保存中" : "保存反馈"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {feedbackErrorFor === message.id ? <small className="assistant-feedback-error">反馈保存失败，请重试。</small> : null}
                </div>
              ) : <p>{message.content}</p>}
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
