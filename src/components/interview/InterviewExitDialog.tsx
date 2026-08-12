import { FileWarning, PlayCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import type { InterviewSessionEvaluation } from "../../types/interview";

type InterviewExitDialogProps = {
  evaluation: InterviewSessionEvaluation;
  onContinue: () => void;
  onGenerateStageReport: () => void;
};

export default function InterviewExitDialog({ evaluation, onContinue, onGenerateStageReport }: InterviewExitDialogProps) {
  const continueRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    continueRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onContinue();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContinue]);

  return (
    <div className="interview-exit-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onContinue();
    }}>
      <section className="interview-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="interview-exit-title" data-testid="interview-exit-dialog">
        <header>
          <span><ShieldAlert size={18} /> EVIDENCE CHECK</span>
          <h3 id="interview-exit-title">当前证据还不足以生成正式报告</h3>
          <p>你可以继续完成核心考察，或先生成一份明确标注为“阶段性”的诊断报告。</p>
        </header>
        <div className="interview-exit-metrics">
          <article><span>有效维度</span><strong>{evaluation.evidenceDimensions}/{evaluation.policy.targetDimensions}</strong></article>
          <article><span>有效回答</span><strong>{evaluation.effectiveAnswers}/{evaluation.policy.minimumEffectiveAnswers}</strong></article>
          <article><span>预计置信度</span><strong>{evaluation.estimatedConfidence}%</strong></article>
        </div>
        <div className="interview-exit-gaps">
          <strong>正式报告还需要</strong>
          <ul>{evaluation.missingRequirements.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <footer>
          <button ref={continueRef} type="button" className="primary-action" onClick={onContinue}>
            <PlayCircle size={16} /> 继续面试
          </button>
          <button type="button" className="secondary-action" onClick={onGenerateStageReport}>
            <FileWarning size={16} /> 生成阶段性报告
          </button>
        </footer>
      </section>
    </div>
  );
}
