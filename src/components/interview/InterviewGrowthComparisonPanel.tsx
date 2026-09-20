import { ArrowDownRight, ArrowUpRight, History, Minus, Sparkles } from "lucide-react";
import type {
  InterviewDimensionGrowthTrend,
  InterviewFeedbackReport,
  InterviewGrowthComparison,
} from "../../types/interview";

type InterviewGrowthComparisonPanelProps = {
  comparison: InterviewGrowthComparison | null;
  report: InterviewFeedbackReport;
};

const trendLabel: Record<InterviewDimensionGrowthTrend["status"], string> = {
  improved: "证据提升",
  stable: "保持稳定",
  regressed: "证据下降",
  new_evidence: "新增基线",
  not_retested: "本次未复测",
  not_comparable: "暂不可比",
};

const qualityLabel: Record<InterviewGrowthComparison["comparisonQuality"], string> = {
  high: "高可比",
  medium: "中等可比",
  low: "低可比",
};

const signed = (value: number, suffix = "") => `${value > 0 ? "+" : ""}${value}${suffix}`;

const TrendIcon = ({ status }: { status: InterviewDimensionGrowthTrend["status"] }) => {
  if (status === "improved") return <ArrowUpRight size={14} />;
  if (status === "regressed") return <ArrowDownRight size={14} />;
  if (status === "new_evidence") return <Sparkles size={14} />;
  return <Minus size={14} />;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toLocaleDateString("zh-CN");
};

export default function InterviewGrowthComparisonPanel({ comparison, report }: InterviewGrowthComparisonPanelProps) {
  if (!comparison) {
    return (
      <section className="assessment-growth-comparison empty" data-testid="assessment-growth-comparison">
        <header>
          <div>
            <strong><History size={15} /> 跨次面试成长对比</strong>
            <small>本次报告将作为后续同岗位、同面试类型复测的能力基线。</small>
          </div>
          <span>首次基线</span>
        </header>
        <div className="assessment-growth-baseline">
          <article><span>本次综合分</span><strong>{report.overallScore}</strong></article>
          <article><span>能力覆盖</span><strong>{report.coverageScore}%</strong></article>
          <article><span>评估置信度</span><strong>{report.confidenceScore}%</strong></article>
          <p>完成下一次同岗位、同面试类型的面试后，系统会按共同已考察维度生成提升、稳定和证据下降趋势；首次被考察的维度只建立新基线。</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`assessment-growth-comparison ${comparison.comparisonQuality}`} data-testid="assessment-growth-comparison">
      <header>
        <div>
          <strong><History size={15} /> 跨次面试成长对比</strong>
          <small>
            基线：{formatDate(comparison.baselineDate)} · {comparison.baselineJobTitle} · {comparison.baselineReportKind === "formal" ? "正式报告" : "阶段报告"}
          </small>
        </div>
        <span>{comparison.comparisonScope === "same_job" ? "同岗位" : "同方向"} · {qualityLabel[comparison.comparisonQuality]}</span>
      </header>

      <div className="assessment-growth-metrics">
        <article className={comparison.overallComparable ? (comparison.overallDelta >= 0 ? "positive" : "negative") : "muted"}>
          <span>综合分变化</span>
          <strong>{comparison.overallComparable ? signed(comparison.overallDelta) : "口径不同"}</strong>
          <small>{comparison.previousOverallScore} → {comparison.currentOverallScore}</small>
        </article>
        <article>
          <span>共同复测维度</span>
          <strong>{comparison.comparableDimensions}</strong>
          <small>共 {comparison.dimensionTrends.length} 个维度</small>
        </article>
        <article className={comparison.coverageDelta >= 0 ? "positive" : "negative"}>
          <span>能力覆盖变化</span>
          <strong>{signed(comparison.coverageDelta, "%")}</strong>
          <small>{comparison.previousCoverageScore}% → {comparison.currentCoverageScore}%</small>
        </article>
        <article className={comparison.confidenceDelta >= 0 ? "positive" : "negative"}>
          <span>置信度变化</span>
          <strong>{signed(comparison.confidenceDelta, "%")}</strong>
          <small>{comparison.previousConfidenceScore}% → {comparison.currentConfidenceScore}%</small>
        </article>
      </div>

      <p className="assessment-growth-summary">{comparison.summary}</p>

      <div className="assessment-growth-trends">
        {comparison.dimensionTrends.map((trend) => (
          <article key={trend.id} className={trend.status} title={trend.explanation}>
            <span className="assessment-growth-trend-icon"><TrendIcon status={trend.status} /></span>
            <div>
              <strong>{trend.name}</strong>
              <small>{trendLabel[trend.status]} · 置信度 {trend.previousConfidence}% → {trend.currentConfidence}%</small>
            </div>
            <em>
              {trend.previousScore === null ? "--" : trend.previousScore}
              <i>→</i>
              {trend.currentScore === null ? "--" : trend.currentScore}
            </em>
            <b>{trend.delta === null ? trendLabel[trend.status] : signed(trend.delta)}</b>
          </article>
        ))}
      </div>

      {comparison.cautions.length ? (
        <ul className="assessment-growth-cautions">
          {comparison.cautions.map((caution) => <li key={caution}>{caution}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
