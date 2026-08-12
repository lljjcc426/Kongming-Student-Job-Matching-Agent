import type { MatchResult } from "../../matchEngine";

type ScoreEvidencePanelProps = {
  result: MatchResult;
};

export default function ScoreEvidencePanel({ result }: ScoreEvidencePanelProps) {
  const evidenceById = new Map(result.evidence.map((item) => [item.id, item]));

  return (
    <section className="score-evidence-panel" aria-labelledby="score-evidence-title" data-testid="score-evidence-panel">
      <div className="score-method-card">
        <div>
          <span>Evidence-based score · {result.scoreExplanation.methodVersion}</span>
          <h3 id="score-evidence-title">岗位匹配解释证据</h3>
          <p>{result.scoreExplanation.note}</p>
        </div>
        <div className="score-method-total">
          <strong>{result.total}</strong>
          <span>总分</span>
        </div>
        <code>{result.scoreExplanation.formula}</code>
        <div className="score-method-meta">
          <span>能力证据覆盖 {result.scoreExplanation.evidenceCoverage}%</span>
          <span>引用 {result.scoreExplanation.usedEvidenceCount} 条证据</span>
          <span>总权重 100%</span>
        </div>
      </div>

      <div className="dimension-evidence-list">
        {result.dimensions.map((dimension) => {
          const citedEvidence = dimension.evidenceIds
            .map((id) => evidenceById.get(id))
            .filter(Boolean)
            .slice(0, 4);
          return (
            <details key={dimension.id} className={`dimension-evidence-card ${dimension.score >= 82 ? "strong" : dimension.score >= 68 ? "medium" : "weak"}`} open={dimension.id === "ability"}>
              <summary>
                <div>
                  <span>{dimension.name} · 权重 {dimension.weight}% · 置信度 {dimension.confidence}</span>
                  <strong>{dimension.description}</strong>
                </div>
                <b>{dimension.score}<small>贡献 {dimension.contribution} 分</small></b>
              </summary>
              <div className="dimension-evidence-body">
                <code>{dimension.formula} = {dimension.score}</code>
                <div className="factor-evidence-list">
                  {dimension.factors.map((factor) => (
                    <article key={factor.label}>
                      <div>
                        <strong>{factor.label}</strong>
                        <span>{factor.score} 分 × {factor.weight}% = {factor.contribution}</span>
                      </div>
                      <div className="factor-score-track"><i style={{ width: `${factor.score}%` }} /></div>
                      <p>{factor.explanation}</p>
                    </article>
                  ))}
                </div>
                <div className="dimension-citations">
                  <h4>本维度引用</h4>
                  {citedEvidence.length ? citedEvidence.map((item) => (
                    <blockquote key={item!.id}>
                      <span>{item!.label}</span>
                      “{item!.text}”
                    </blockquote>
                  )) : <p>本维度没有可引用的简历证据，得分仅来自明确偏好字段或为 0。</p>}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
