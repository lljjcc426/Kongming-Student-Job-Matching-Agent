import { AlertCircle, CheckCircle2, ExternalLink, FileCheck2, RefreshCw, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { GrowthPlan, GrowthTask } from "../features/growth/types";

type GrowthPlanPageProps = {
  plan: GrowthPlan | null;
  onSubmitEvidence: (taskId: string, evidenceText: string, evidenceUrl: string) => void;
  onOpenInterview: () => void;
};

type EvidenceDraft = { text: string; url: string };

const statusLabel: Record<GrowthTask["status"], string> = {
  todo: "待开始",
  submitted: "已提交",
  verified: "证据已通过",
  needs_revision: "需要补充",
};

const kindLabel: Record<GrowthTask["kind"], string> = {
  project: "实践项目",
  interview: "面试训练",
  resume: "简历证据",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "刚刚" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function GrowthPlanPage({ plan, onSubmitEvidence, onOpenInterview }: GrowthPlanPageProps) {
  const [drafts, setDrafts] = useState<Record<string, EvidenceDraft>>({});

  useEffect(() => {
    if (!plan) return;
    setDrafts((current) => Object.fromEntries(plan.tasks.map((task) => [task.id, {
      text: task.evidenceText || current[task.id]?.text || "",
      url: task.evidenceUrl || current[task.id]?.url || "",
    }])));
  }, [plan]);

  if (!plan) {
    return (
      <section className="growth-plan-page growth-empty-page">
        <div className="growth-empty-card">
          <span><Target size={20} /> Career Growth Agent</span>
          <h1>完成一次岗位面试，生成你的成长任务</h1>
          <p>成长计划会把岗位缺口转成可行动任务，并要求用代码、报告、演示或新的面试回答补充证据。</p>
          <div className="growth-empty-flow"><b>岗位证据</b><i>→</i><b>面试诊断</b><i>→</i><b>成长任务</b><i>→</i><b>复测对比</b></div>
          <button type="button" className="primary-action" onClick={onOpenInterview}>开始岗位面试</button>
        </div>
      </section>
    );
  }

  const verifiedCount = plan.tasks.filter((task) => task.status === "verified").length;
  const progress = plan.tasks.length ? Math.round((verifiedCount / plan.tasks.length) * 100) : 0;
  const latestAssessment = plan.assessments[plan.assessments.length - 1];

  return (
    <section className="growth-plan-page">
      <header className="growth-page-header">
        <div>
          <span className="growth-eyebrow">CAREER GROWTH COCKPIT</span>
          <h1>职业成长驾驶舱</h1>
          <p>围绕“{plan.targetJobTitle}”把岗位缺口变成可验证的行动。</p>
        </div>
        <button type="button" className="secondary-action" onClick={onOpenInterview}><RefreshCw size={16} />重新面试复测</button>
      </header>

      <div className="growth-score-grid">
        <article className="growth-score-card growth-score-primary">
          <span><FileCheck2 size={16} />当前实证覆盖</span>
          <strong>{plan.empiricalCoverage}%</strong>
          <small>只有新证据通过审核后才会变化</small>
        </article>
        <article className="growth-score-card">
          <span><TrendingUp size={16} />完成任务后的预测覆盖</span>
          <strong>{plan.projectedCoverage}%</strong>
          <small>预测值不等于已经掌握</small>
        </article>
        <article className="growth-score-card">
          <span><CheckCircle2 size={16} />已验证任务</span>
          <strong>{verifiedCount}/{plan.tasks.length}</strong>
          <small>{progress}% 的任务已形成可审核证据</small>
        </article>
      </div>

      <div className="growth-content-grid">
        <section className="growth-task-column">
          <div className="growth-section-heading">
            <div><span>TOP ACTIONS</span><h2>本轮最值得补的证据</h2></div>
            <small>{latestAssessment ? latestAssessment.summary : "完成任务后，实证覆盖率才会更新。"}</small>
          </div>
          {plan.tasks.map((task, index) => {
            const draft = drafts[task.id] ?? { text: task.evidenceText, url: task.evidenceUrl };
            const review = task.evidenceReview;
            return (
              <article key={task.id} className={"growth-task-card growth-task-" + task.status}>
                <div className="growth-task-card-head">
                  <div className="growth-task-index">0{index + 1}</div>
                  <div>
                    <div className="growth-task-meta"><span>{kindLabel[task.kind]}</span><b>{task.priority === "high" ? "本周优先" : "建议完成"}</b></div>
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                  </div>
                  <strong className={"growth-task-status status-" + task.status}>{statusLabel[task.status]}</strong>
                </div>
                <div className="growth-task-requirement"><strong>证据要求</strong><span>{task.evidenceRequirement}</span></div>
                <div className="growth-evidence-form">
                  <textarea
                    value={draft.text}
                    onChange={(event) => setDrafts((current) => ({ ...current, [task.id]: { ...draft, text: event.target.value } }))}
                    placeholder="描述你做了什么、个人负责什么、产出了什么结果"
                    aria-label={task.title + "证据说明"}
                  />
                  <div className="growth-evidence-row">
                    <input
                      value={draft.url}
                      onChange={(event) => setDrafts((current) => ({ ...current, [task.id]: { ...draft, url: event.target.value } }))}
                      placeholder="可选：代码仓库、报告或演示链接"
                      aria-label={task.title + "证据链接"}
                    />
                    <button type="button" className="primary-action compact-action" onClick={() => onSubmitEvidence(task.id, draft.text, draft.url)} disabled={!draft.text.trim()}>
                      <FileCheck2 size={15} />提交证据
                    </button>
                  </div>
                </div>
                {review ? (
                  <div className={"growth-review " + (review.decision === "verified" ? "verified" : "needs-revision")}>
                    {review.decision === "verified" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                    <div><strong>{review.summary}</strong><small>{review.reasons.join(" ")} · 证据评分 {review.score}</small></div>
                    {task.evidenceUrl ? <a href={task.evidenceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />查看</a> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <aside className="growth-side-column">
          <section className="growth-side-card">
            <span className="growth-eyebrow">WHY THIS PLAN</span>
            <h2>岗位缺口</h2>
            <div className="growth-gap-list">
              {plan.gaps.map((gap) => <article key={gap.id}><strong>{gap.title}</strong><p>{gap.reason}</p><small>{gap.source === "interview" ? "来自面试诊断" : "来自岗位要求矩阵"}</small></article>)}
            </div>
          </section>
          <section className="growth-side-card growth-history-card">
            <span className="growth-eyebrow">ASSESSMENT HISTORY</span>
            <h2>实证变化记录</h2>
            {plan.assessments.slice().reverse().map((item) => <div key={item.id} className="growth-history-item"><span>{formatDate(item.createdAt)}</span><strong>{item.empiricalCoverage}% <i>→</i> {item.projectedCoverage}%</strong><p>{item.summary}</p></div>)}
          </section>
        </aside>
      </div>
    </section>
  );
}
