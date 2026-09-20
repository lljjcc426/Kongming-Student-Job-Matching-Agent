import { CheckCircle2, ScanLine, ShieldQuestion, TriangleAlert } from "lucide-react";
import type { InterviewIntegrityEvaluation, InterviewIntegrityRisk } from "../../types/interview";

type InterviewIntegrityNoticeProps = {
  evaluation: InterviewIntegrityEvaluation;
  activeRisk?: InterviewIntegrityRisk | null;
};

const riskStatusLabel: Record<InterviewIntegrityRisk["status"], string> = {
  pending: "待核验",
  explained: "已说明",
  unresolved: "未充分解释",
};

export default function InterviewIntegrityNotice({ evaluation, activeRisk }: InterviewIntegrityNoticeProps) {
  const hasComparableEvidence = evaluation.assessedTurns >= 2 || evaluation.riskCount > 0;
  return (
    <section className={`interview-integrity-notice ${activeRisk ? "verifying" : evaluation.unresolvedCount ? "warning" : "stable"}`} data-testid="interview-integrity-notice" aria-label="回答一致性核验">
      <header>
        <div>
          {activeRisk ? <ShieldQuestion size={14} /> : evaluation.unresolvedCount ? <TriangleAlert size={14} /> : <ScanLine size={14} />}
          <strong>回答一致性 {hasComparableEvidence ? evaluation.score : "待积累"}</strong>
          <span>{evaluation.riskCount ? `${evaluation.riskCount} 个核验信号` : hasComparableEvidence ? "暂未发现冲突信号" : "至少需要两轮回答"}</span>
        </div>
        {evaluation.explainedCount ? <em><CheckCircle2 size={12} /> 已说明 {evaluation.explainedCount}</em> : null}
      </header>
      {activeRisk ? (
        <article>
          <span>{activeRisk.severity === "high" ? "重要核验" : "事实核验"} · {riskStatusLabel[activeRisk.status]}</span>
          <strong>{activeRisk.title}</strong>
          <p>{activeRisk.rationale}</p>
          <small>本轮会使用中性追问统一事实口径，不会据此直接判断陈述真伪。</small>
        </article>
      ) : evaluation.unresolvedCount ? (
        <p>仍有 {evaluation.unresolvedCount} 个信号未获得充分解释，将在阶段性报告中保留原始证据。</p>
      ) : null}
    </section>
  );
}
