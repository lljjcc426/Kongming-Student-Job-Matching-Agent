import type { RefObject } from "react";
import AssistantChatPanel, { type AssistantChatMessage, type AssistantChatStatus } from "../components/AssistantChatPanel";
import ParticleGalaxyCore from "../components/ParticleGalaxyCore";

type AIAssistantPageProps = {
  messages: AssistantChatMessage[];
  input: string;
  status: AssistantChatStatus;
  statusMessage: string;
  bodyRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onVoiceInput: () => void;
};

export default function AIAssistantPage({
  messages,
  input,
  status,
  statusMessage,
  bodyRef,
  onInputChange,
  onSend,
  onVoiceInput,
}: AIAssistantPageProps) {
  return (
    <div className="ai-assistant-page">
      <section className="ai-assistant-visual">
        <div className="assistant-title-block">
          <span>AI Assistant</span>
          <h1>AI 求职助手</h1>
          <p>用多维智能分析，陪你完成从简历到面试的每一步。</p>
          <div className="assistant-ability-grid" aria-label="助手能力概览">
            <small>简历诊断</small>
            <small>岗位澄清</small>
            <small>面试准备</small>
          </div>
          <div className="assistant-signal-strip" aria-label="分析状态">
            <i />
            <strong>多智能体上下文已接入</strong>
            <em>Resume / Match / Interview</em>
          </div>
        </div>
        <ParticleGalaxyCore />
      </section>

      <AssistantChatPanel
        messages={messages}
        input={input}
        status={status}
        statusMessage={statusMessage}
        bodyRef={bodyRef}
        onInputChange={onInputChange}
        onSend={onSend}
        onVoiceInput={onVoiceInput}
        onQuickQuestion={onInputChange}
      />
    </div>
  );
}
