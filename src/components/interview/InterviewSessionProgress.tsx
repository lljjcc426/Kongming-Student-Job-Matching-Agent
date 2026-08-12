import { CheckCircle2, Clock3, FileCheck2, Gauge, MessagesSquare } from "lucide-react";
import type { InterviewSessionEvaluation } from "../../types/interview";

type InterviewSessionProgressProps = {
  evaluation: InterviewSessionEvaluation;
};

const readinessLabel: Record<InterviewSessionEvaluation["readiness"], string> = {
  not_ready: "等待开始",
  stage_ready: "证据积累中",
  formal_ready: "可生成正式报告",
  complete: "核心考察完成",
  limit_reached: "已到轮次上限",
};

export default function InterviewSessionProgress({ evaluation }: InterviewSessionProgressProps) {
  const { policy } = evaluation;
  const answerPercent = Math.min(100, Math.round((evaluation.effectiveAnswers / Math.max(1, policy.targetEffectiveAnswers)) * 100));
  const roundPercent = Math.min(100, Math.round((evaluation.totalRounds / Math.max(1, policy.maximumRounds)) * 100));

  return (
    <section className={`interview-session-progress ${evaluation.readiness}`} aria-label="面试会话完整度" data-testid="interview-session-progress">
      <header>
        <div>
          <span><Gauge size={14} /> SESSION PLANNER</span>
          <strong>{readinessLabel[evaluation.readiness]}</strong>
        </div>
        <em>{evaluation.estimatedConfidence}% 预计置信度</em>
      </header>
      <div className="interview-session-metrics">
        <article>
          <FileCheck2 size={14} />
          <span>有效维度</span>
          <strong>{evaluation.evidenceDimensions}/{policy.targetDimensions}</strong>
          <i><b style={{ width: `${evaluation.evidenceCoveragePercent}%` }} /></i>
        </article>
        <article>
          <MessagesSquare size={14} />
          <span>有效回答</span>
          <strong>{evaluation.effectiveAnswers}/{policy.minimumEffectiveAnswers}</strong>
          <i><b style={{ width: `${answerPercent}%` }} /></i>
        </article>
        <article>
          <Clock3 size={14} />
          <span>会话轮次</span>
          <strong>{evaluation.totalRounds}/{policy.maximumRounds}</strong>
          <i><b style={{ width: `${roundPercent}%` }} /></i>
        </article>
      </div>
      <p>{evaluation.canGenerateFormal ? <CheckCircle2 size={13} /> : null}{evaluation.statusMessage}</p>
    </section>
  );
}
