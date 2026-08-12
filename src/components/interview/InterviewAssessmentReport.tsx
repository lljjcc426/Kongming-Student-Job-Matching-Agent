import { Database, Download, FileCheck2, Fingerprint, History, ShieldCheck, Target, TrendingUp } from "lucide-react";
import type { CSSProperties } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { InterviewDimensionReport, InterviewFeedbackReport } from "../../types/interview";
import InterviewGrowthComparisonPanel from "./InterviewGrowthComparisonPanel";

type InterviewAssessmentReportProps = {
  report: InterviewFeedbackReport;
  growthPlanStatus: "idle" | "saving" | "ready" | "error";
  onOpenGrowthPlan: () => void;
  memoryStatus: "idle" | "saving" | "saved" | "error";
};

const dimensionStatusLabel: Record<InterviewDimensionReport["status"], string> = {
  untested: "未考察",
  insufficient: "证据不足",
  supported: "已有支撑",
  boundary: "边界已识别",
};

const completionReasonLabel: Record<InterviewFeedbackReport["completionReason"], string> = {
  target_reached: "完成核心考察目标",
  round_limit: "达到最大面试轮次",
  user_completed: "用户在正式门槛后结束",
  user_early: "用户提前结束",
};

const integrityStatusLabel: Record<InterviewFeedbackReport["integrityEvaluation"]["risks"][number]["status"], string> = {
  pending: "待核验",
  explained: "已说明",
  unresolved: "未充分解释",
};

const integritySeverityLabel: Record<InterviewFeedbackReport["integrityEvaluation"]["risks"][number]["severity"], string> = {
  low: "提示",
  medium: "关注",
  high: "重要",
};

const escapeMarkdown = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");

const growthComparisonMarkdown = (report: InterviewFeedbackReport) => {
  const comparison = report.growthComparison;
  if (!comparison) return [
    "## 跨次面试成长对比",
    "",
    "本次为首份可比较能力基线。完成下一次同岗位、同面试类型面试后，系统将生成维度趋势。",
    "",
  ];
  return [
    "## 跨次面试成长对比",
    "",
    `- 历史基线：${comparison.baselineDate.slice(0, 10)} ${comparison.baselineJobTitle}（${comparison.baselineReportKind === "formal" ? "正式报告" : "阶段报告"}）`,
    `- 比较范围：${comparison.comparisonScope === "same_job" ? "同岗位" : "同胜任力方向"}；比较质量：${comparison.comparisonQuality === "high" ? "高" : comparison.comparisonQuality === "medium" ? "中" : "低"}`,
    `- 综合分：${comparison.previousOverallScore} → ${comparison.currentOverallScore}${comparison.overallComparable ? `（${comparison.overallDelta >= 0 ? "+" : ""}${comparison.overallDelta}）` : "（口径不同，不作成长结论）"}`,
    `- 覆盖率：${comparison.previousCoverageScore}% → ${comparison.currentCoverageScore}%；置信度：${comparison.previousConfidenceScore}% → ${comparison.currentConfidenceScore}%`,
    "",
    comparison.summary,
    "",
    "| 维度 | 历史 | 本次 | 变化 | 结论 |",
    "| --- | ---: | ---: | ---: | --- |",
    ...comparison.dimensionTrends.map((trend) => `| ${escapeMarkdown(trend.name)} | ${trend.previousScore ?? "--"} | ${trend.currentScore ?? "--"} | ${trend.delta === null ? "--" : `${trend.delta >= 0 ? "+" : ""}${trend.delta}`} | ${escapeMarkdown(trend.explanation)} |`),
    "",
    ...comparison.cautions.map((caution) => `- 注意：${caution}`),
    "",
  ];
};

const reportMarkdown = (report: InterviewFeedbackReport) => [
  `# ${report.modelName}${report.reportKind === "formal" ? "正式评估报告" : "阶段性诊断报告"}`,
  "",
  `- 报告性质：${report.reportKind === "formal" ? "正式报告（已达到最低证据门槛）" : "阶段性报告（尚未完成全部最低考察要求）"}`,
  `- 结束原因：${completionReasonLabel[report.completionReason]}`,
  `- 综合得分：${report.overallScore}/100`,
  `- 岗位胜任/匹配度：${report.professionalFit}/100`,
  `- 考察覆盖：${report.coverageScore}%`,
  `- 评估置信度：${report.confidenceScore}%`,
  `- 回答一致性：${report.integrityEvaluation.assessedTurns >= 2 || report.integrityEvaluation.riskCount ? `${report.integrityEvaluation.score}/100` : "待积累（至少需要两轮回答）"}`,
  `- 本次证据上限：${report.scoreCap}/100`,
  `- 有效回答：${report.sessionEvaluation.effectiveAnswers}/${report.sessionEvaluation.policy.minimumEffectiveAnswers}（目标 ${report.sessionEvaluation.policy.targetEffectiveAnswers}）`,
  `- 有效维度：${report.sessionEvaluation.evidenceDimensions}/${report.sessionEvaluation.policy.targetDimensions}`,
  "",
  "## 评估结论",
  "",
  report.summary,
  "",
  "## 评分口径",
  "",
  `综合得分 = min（综合证据上限 ${report.scoreCap}，岗位胜任/匹配度 ${report.professionalFit}×65% + 表达 ${report.expression}×15% + 逻辑与复盘 ${report.logic}×20%）= ${report.overallScore}。`,
  `本次共 ${report.evidenceStats.answerCount} 轮回答，其中 ${report.evidenceStats.substantiveAnswers} 条实质回答、${report.evidenceStats.starEvidence} 条 STAR 证据、${report.evidenceStats.quantifiedEvidence} 条量化证据。`,
  "",
  "## 回答一致性核验",
  "",
  report.integrityEvaluation.summary,
  ...report.integrityEvaluation.risks.flatMap((risk) => [
    `- [${integritySeverityLabel[risk.severity]} · ${integrityStatusLabel[risk.status]}] ${risk.title}`,
    `  - 主张一：${escapeMarkdown(risk.claim)}`,
    ...(risk.conflictingClaim ? [`  - 主张二：${escapeMarkdown(risk.conflictingClaim)}`] : []),
    `  - 核验依据：${escapeMarkdown(risk.rationale)}`,
    ...(risk.responseExcerpt ? [`  - 补充说明：${escapeMarkdown(risk.responseExcerpt)}`] : []),
  ]),
  "",
  ...growthComparisonMarkdown(report),
  "## 上下文来源",
  "",
  `- 岗位知识库：${report.grounding.knowledgeSources.length} 条来源`,
  ...report.grounding.knowledgeSources.map((source) => `  - ${source.company} · ${source.title}（${source.sourceName}，检索置信度 ${source.confidence}%）${source.sourceUrl ? ` ${source.sourceUrl}` : ""}`),
  `- 历史面试记忆：${report.grounding.memoryReferences.length} 次`,
  ...report.grounding.memoryReferences.map((reference) => `  - ${reference.createdAt.slice(0, 10)} ${reference.jobTitle}：${reference.overallScore}分，待复测 ${reference.weakDimensions.map((item) => item.name).join("、") || "暂无"}`),
  "",
  "## 六维胜任力",
  "",
  "| 维度 | 权重 | 得分 | 置信度 | 状态 | 行为锚点 |",
  "| --- | ---: | ---: | ---: | --- | --- |",
  ...report.dimensionReports.map((item) => (
    `| ${escapeMarkdown(item.name)} | ${item.weight}% | ${item.score} | ${item.confidence}% | ${dimensionStatusLabel[item.status]} | ${escapeMarkdown(item.anchorText)} |`
  )),
  "",
  "## 优势证据",
  "",
  ...report.strengths.map((item) => `- ${item}`),
  "",
  "## 风险与短板",
  "",
  ...report.weaknesses.map((item) => `- ${item}`),
  "",
  "## 提升建议",
  "",
  ...report.improvements.map((item) => `- ${item}`),
  "",
  "## 优化回答参考",
  "",
  report.optimizedAnswer,
  "",
  "> 评分说明：未考察维度不代表能力不足，但不计入能力认证；综合分同时受到回答证据质量、岗位权重覆盖和评估置信度约束。",
].join("\n");

const downloadReport = (report: InterviewFeedbackReport) => {
  const blob = new Blob([reportMarkdown(report)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `孔明职配-${report.modelTrack}-${report.reportKind === "formal" ? "正式评估报告" : "阶段性诊断报告"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function InterviewAssessmentReport({ report, growthPlanStatus, onOpenGrowthPlan, memoryStatus }: InterviewAssessmentReportProps) {
  const radarData = report.dimensionReports.map((item) => ({ name: item.name, score: item.score }));
  const decisionCount = report.decisionSummary.clarify
    + report.decisionSummary.deepen
    + report.decisionSummary.challenge
    + report.decisionSummary.switch;
  const hasComparableIntegrityEvidence = report.integrityEvaluation.assessedTurns >= 2 || report.integrityEvaluation.riskCount > 0;

  return (
    <section className={`interview-assessment-report ${report.reportKind}`} aria-label={report.reportKind === "formal" ? "岗位胜任力正式评估报告" : "岗位胜任力阶段性诊断报告"}>
      <header className="assessment-report-head">
        <div className="assessment-score-ring" style={{ "--assessment-score": `${report.overallScore * 3.6}deg` } as CSSProperties}>
          <strong>{report.overallScore}</strong>
          <span>综合得分</span>
        </div>
        <div>
          <span className="assessment-report-kicker"><FileCheck2 size={15} /> {report.reportKind === "formal" ? "FORMAL EVIDENCE REPORT" : "STAGE DIAGNOSTIC REPORT"} · V2</span>
          <h3>{report.modelName}{report.reportKind === "formal" ? "正式评估报告" : "阶段性诊断报告"}</h3>
          <p>{report.summary}</p>
        </div>
        <button type="button" className="secondary-action compact-action" onClick={() => downloadReport(report)}>
          <Download size={15} /> 下载报告
        </button>
      </header>

      <div className="assessment-metric-grid">
        <article>
          <Target size={17} />
          <span>岗位胜任/匹配度</span>
          <strong>{report.professionalFit}</strong>
        </article>
        <article>
          <FileCheck2 size={17} />
          <span>考察覆盖</span>
          <strong>{report.coverageScore}%</strong>
        </article>
        <article>
          <ShieldCheck size={17} />
          <span>评估置信度</span>
          <strong>{report.confidenceScore}%</strong>
        </article>
        <article>
          <TrendingUp size={17} />
          <span>动态追问</span>
          <strong>{decisionCount} 次</strong>
        </article>
        <article>
          <Fingerprint size={17} />
          <span>回答一致性</span>
          <strong>{hasComparableIntegrityEvidence ? report.integrityEvaluation.score : "--"}</strong>
        </article>
      </div>

      <div className="assessment-score-formula">
        <strong>评分公式</strong>
        <code>
          min（综合证据上限 {report.scoreCap}，岗位胜任/匹配度 {report.professionalFit} × 65% ＋ 表达 {report.expression} × 15% ＋ 逻辑与复盘 {report.logic} × 20%）＝ {report.overallScore}
        </code>
        <small>单维度得分＝最佳回答证据 × 55%＋该维度平均证据 × 45%；未说明的重要一致性信号将综合上限限制为 55 分，中等信号限制为 72 分。</small>
      </div>

      <div className={`assessment-session-summary ${report.reportKind}`} data-testid="assessment-session-summary">
        <strong>{report.reportKind === "formal" ? "正式报告门槛已满足" : "本报告不作为完整能力认证"}</strong>
        <span>有效维度 {report.sessionEvaluation.evidenceDimensions}/{report.sessionEvaluation.policy.targetDimensions}</span>
        <span>有效回答 {report.sessionEvaluation.effectiveAnswers}/{report.sessionEvaluation.policy.minimumEffectiveAnswers}</span>
        <span>会话轮次 {report.sessionEvaluation.totalRounds}/{report.sessionEvaluation.policy.maximumRounds}</span>
        {report.sessionEvaluation.missingRequirements.length ? <small>{report.sessionEvaluation.missingRequirements.join("；")}</small> : null}
      </div>

      <section className={`assessment-integrity-panel ${report.integrityEvaluation.pendingCount || report.integrityEvaluation.unresolvedCount ? "warning" : "stable"}`} data-testid="assessment-integrity-panel">
        <header>
          <div>
            <strong><Fingerprint size={15} /> 回答一致性核验</strong>
            <small>规则只识别需核验信号，不直接判断候选人是否诚实。</small>
          </div>
          <span>{hasComparableIntegrityEvidence ? `${report.integrityEvaluation.score}/100` : "待积累"}</span>
        </header>
        <p>{report.integrityEvaluation.summary}</p>
        {report.integrityEvaluation.risks.length ? (
          <div>
            {report.integrityEvaluation.risks.map((risk) => (
              <details key={risk.id} className={`${risk.severity} ${risk.status}`}>
                <summary>
                  <span>{integritySeverityLabel[risk.severity]} · {integrityStatusLabel[risk.status]}</span>
                  <strong>{risk.title}</strong>
                  <em>第 {risk.sourceTurns.join("、")} 轮</em>
                </summary>
                <div>
                  <p><strong>原始主张：</strong>{risk.claim}</p>
                  {risk.conflictingClaim ? <p><strong>对照主张：</strong>{risk.conflictingClaim}</p> : null}
                  <p><strong>核验原因：</strong>{risk.rationale}</p>
                  {risk.responseExcerpt ? <p><strong>补充说明：</strong>{risk.responseExcerpt}</p> : <p><strong>待核验问题：</strong>{risk.verificationQuestion}</p>}
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </section>

      <InterviewGrowthComparisonPanel comparison={report.growthComparison} report={report} />

      <div className="assessment-overview-grid">
        <article className="assessment-radar-card">
          <header>
            <strong>六维能力雷达</strong>
            <small>0 分代表本次未形成可采信证据</small>
          </header>
          <div className="assessment-radar" role="img" aria-label={report.dimensionReports.map((item) => `${item.name}${item.score}分`).join("，")}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="65%">
                <PolarGrid stroke="rgba(70, 142, 232, 0.2)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: "#315d91", fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={6} tick={{ fill: "#7a9cbd", fontSize: 9 }} />
                <Radar dataKey="score" stroke="#168bf0" fill="#38bdf8" fillOpacity={0.28} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="assessment-evidence-summary">
          <header>
            <strong>优势与风险结论</strong>
            <small>只引用本次回答中可追溯的证据</small>
          </header>
          <section className="assessment-summary-block strength">
            <strong>已确认优势</strong>
            <ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="assessment-summary-block weakness">
            <strong>风险与未覆盖项</strong>
            <ul>{report.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </article>
      </div>

      <section className="assessment-dimension-section">
        <header>
          <div>
            <strong>能力维度证据链</strong>
            <small>维度得分 → 行为锚点 → 原始回答 → 缺失证据 → 提升动作</small>
          </div>
          <span>权重合计 100%</span>
        </header>
        <div className="assessment-dimension-grid">
          {report.dimensionReports.map((dimension) => (
            <details key={dimension.id} className={`assessment-dimension-card ${dimension.status}`}>
              <summary>
                <div>
                  <span>{dimension.weight}% · {dimensionStatusLabel[dimension.status]}</span>
                  <strong>{dimension.name}</strong>
                </div>
                <em>{dimension.score}</em>
              </summary>
              <div className="assessment-dimension-body">
                <div className="assessment-confidence-row">
                  <span>评分置信度</span>
                  <i><b style={{ width: `${dimension.confidence}%` }} /></i>
                  <em>{dimension.confidence}%</em>
                </div>
                <p><strong>行为锚点：</strong>{dimension.anchorLevel ? `L${dimension.anchorLevel} · ` : ""}{dimension.anchorText}</p>
                <p><strong>最强证据：</strong>{dimension.strongestEvidence}</p>
                {dimension.evidence.length ? (
                  <ol className="assessment-evidence-list">
                    {dimension.evidence.map((evidence) => (
                      <li key={`${dimension.id}-${evidence.turn}`}>
                        <span>第 {evidence.turn} 轮 · 证据 {evidence.score} 分</span>
                        <p>“{evidence.answerExcerpt}”</p>
                        <small>{evidence.signalHits.length ? `命中：${evidence.signalHits.join("、")}` : `缺少：${evidence.missingEvidence.slice(0, 3).join("、")}`}</small>
                      </li>
                    ))}
                  </ol>
                ) : null}
                <p className="assessment-recommendation"><strong>下一步：</strong>{dimension.recommendation}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="assessment-grounding-panel" data-testid="assessment-grounding-panel">
        <header>
          <div>
            <strong>RAG 与长期记忆依据</strong>
            <small>岗位知识用于定义考察标准；历史记忆只用于确定复测方向，不直接加分。</small>
          </div>
          <span>{report.grounding.indexVersion || "LOCAL CONTEXT"}</span>
        </header>
        <div>
          <article>
            <strong><Database size={14} /> 岗位知识库 · {report.grounding.knowledgeSources.length} 条</strong>
            {report.grounding.knowledgeSources.length ? report.grounding.knowledgeSources.map((source) => (
              <p key={source.id}>
                <span>{source.company} · {source.title}</span>
                <small>{source.sourceName} · 置信度 {source.confidence}% · {source.matchedTerms.slice(0, 4).join("、") || "岗位要求"}</small>
              </p>
            )) : <p><small>本次未取得外部岗位检索结果，仅使用当前目标岗位信息。</small></p>}
          </article>
          <article>
            <strong><History size={14} /> 历史复测记忆 · {report.grounding.memoryReferences.length} 次</strong>
            {report.grounding.memoryReferences.length ? report.grounding.memoryReferences.map((reference) => (
              <p key={reference.id}>
                <span>{reference.createdAt.slice(0, 10)} · {reference.jobTitle} · {reference.overallScore}分 · {reference.reportKind === "formal" ? "正式" : "阶段"}</span>
                <small>待复测：{reference.weakDimensions.map((item) => item.name).slice(0, 4).join("、") || "暂无"}</small>
              </p>
            )) : <p><small>没有同岗位或同方向的历史面试，本次建立首份能力基线。</small></p>}
            <em className={memoryStatus}>{memoryStatus === "saving" ? "正在写入本次面试记忆" : memoryStatus === "saved" ? "本次报告已写入长期记忆" : memoryStatus === "error" ? "面试记忆写入失败" : "等待写入"}</em>
          </article>
        </div>
      </section>

      <section className="assessment-improvement-panel">
        <div>
          <strong>优先提升建议</strong>
          <ol>{report.improvements.map((item) => <li key={item}>{item}</li>)}</ol>
        </div>
        <div>
          <strong>优化回答参考</strong>
          <p>{report.optimizedAnswer}</p>
        </div>
      </section>

      <footer className="assessment-report-footer">
        <p><ShieldCheck size={14} /> {report.reportKind === "stage" ? "当前为阶段性诊断；" : "已达到正式报告门槛；"}未考察不等于能力不足，无回答证据不计分。</p>
        <button type="button" className="interview-growth-action" onClick={onOpenGrowthPlan} disabled={growthPlanStatus === "saving"}>
          <TrendingUp size={16} /> {growthPlanStatus === "saving" ? "正在生成成长计划" : growthPlanStatus === "error" ? "前往成长规划重试" : "基于短板生成成长计划"}
        </button>
      </footer>
    </section>
  );
}
