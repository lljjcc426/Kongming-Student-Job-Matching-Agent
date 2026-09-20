import {
  Award,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileCheck2,
  Flag,
  FolderGit2,
  GraduationCap,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GrowthPlan, GrowthPlanStatus, GrowthStageDays, GrowthTask } from "../features/growth/types";
import { growthDateAfterDays } from "../features/growth/growthEngine";

type GrowthPlanPageProps = {
  plan: GrowthPlan | null;
  status: GrowthPlanStatus;
  message: string;
  progress: { completed: number; total: number; percentage: number };
  isTargetCurrent: boolean;
  onOpenInterview: () => void;
  onUpdateTask: (taskId: string, evidenceText: string, evidenceUrl: string, completed: boolean) => Promise<void>;
  onUpdateTargetDate: (targetDate: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onReassess: () => Promise<void>;
};

type EvidenceDraft = { text: string; url: string };

const stageLabel = (plan: GrowthPlan, stageIndex: number) => {
  const stage = plan.stages[stageIndex];
  const startDay = stage.startDay ?? (stageIndex === 0 ? 1 : plan.stages[stageIndex - 1].days + 1);
  return `第${startDay}-${stage.days}天`;
};

const taskIcon = (task: GrowthTask) => {
  if (task.kind === "course") return <BookOpenCheck size={17} />;
  if (task.kind === "project") return <FolderGit2 size={17} />;
  if (task.kind === "certificate") return <Award size={17} />;
  if (task.kind === "resume") return <FileCheck2 size={17} />;
  return <GraduationCap size={17} />;
};

export default function GrowthPlanPage({
  plan,
  status,
  message,
  progress,
  isTargetCurrent,
  onOpenInterview,
  onUpdateTask,
  onUpdateTargetDate,
  onRegenerate,
  onReassess,
}: GrowthPlanPageProps) {
  const [activeStage, setActiveStage] = useState<GrowthStageDays>(0);
  const [drafts, setDrafts] = useState<Record<string, EvidenceDraft>>({});
  const [taskError, setTaskError] = useState<Record<string, string>>({});
  const [workingTask, setWorkingTask] = useState<string | null>(null);
  const [dateError, setDateError] = useState("");
  const [workingDate, setWorkingDate] = useState(false);
  const [reassessError, setReassessError] = useState("");

  useEffect(() => {
    if (!plan) return;
    setDrafts((current) => Object.fromEntries(plan.tasks.map((task) => [task.id,
      task.completed
        ? { text: task.evidenceText, url: task.evidenceUrl }
        : current[task.id] ?? { text: task.evidenceText, url: task.evidenceUrl },
    ])));
  }, [plan]);

  useEffect(() => {
    if (!plan?.stages.length) return;
    setActiveStage((current) => plan.stages.some((stage) => stage.days === current)
      ? current
      : plan.stages[0].days);
  }, [plan]);

  const resolvedActiveStage = plan?.stages.some((stage) => stage.days === activeStage)
    ? activeStage
    : plan?.stages[0]?.days ?? activeStage;

  const stageTasks = useMemo(
    () => plan?.tasks.filter((task) => task.stageDays === resolvedActiveStage) ?? [],
    [plan, resolvedActiveStage],
  );

  if (!plan) {
    return (
      <section className="growth-plan-page growth-empty-page">
        <div className="growth-empty-card">
          <span><Sparkles size={22} /> Career Growth Agent</span>
          <h1>完成面试后生成职业成长计划</h1>
          <p>智能体将结合目标岗位、简历能力缺口、面试报告和你的期望时间，生成动态阶段与每周任务。</p>
          <div className="growth-empty-flow">
            <b>简历与岗位分析</b><i>→</i><b>模拟面试</b><i>→</i><b>成长计划</b><i>→</i><b>匹配度复评</b>
          </div>
          <button type="button" onClick={onOpenInterview}>
            <GraduationCap size={17} /> 前往模拟面试
          </button>
          <small className={status === "error" ? "error" : ""}>{message}</small>
        </div>
      </section>
    );
  }

  const activeStageInfo = plan.stages.find((stage) => stage.days === resolvedActiveStage) ?? plan.stages[0];
  const activeStageIndex = Math.max(0, plan.stages.findIndex((stage) => stage.days === activeStageInfo.days));
  const stageCompleted = stageTasks.filter((task) => task.completed && task.evidenceStatus === "verified").length;
  const verifiedTaskCount = plan.tasks.filter((task) => task.completed && task.evidenceStatus === "verified").length;
  const revisionTaskCount = plan.tasks.filter((task) => task.evidenceStatus === "needs_revision").length;
  const planningDays = plan.planningDays ?? plan.stages[plan.stages.length - 1]?.days ?? 90;
  const planningWeeks = plan.planningWeeks ?? Math.ceil(planningDays / 7);

  const updateTargetDate = async (targetDate: string) => {
    setWorkingDate(true);
    setDateError("");
    try {
      await onUpdateTargetDate(targetDate);
    } catch (error) {
      setDateError(error instanceof Error ? error.message : "目标日期更新失败，请重试。");
    } finally {
      setWorkingDate(false);
    }
  };

  const submitTask = async (task: GrowthTask, completed: boolean) => {
    const draft = drafts[task.id] ?? { text: "", url: "" };
    setWorkingTask(task.id);
    setTaskError((current) => ({ ...current, [task.id]: "" }));
    try {
      await onUpdateTask(task.id, draft.text, draft.url, completed);
    } catch (error) {
      setTaskError((current) => ({
        ...current,
        [task.id]: error instanceof Error ? error.message : "任务更新失败，请重试。",
      }));
    } finally {
      setWorkingTask(null);
    }
  };

  const reassess = async () => {
    setReassessError("");
    try {
      await onReassess();
    } catch (error) {
      setReassessError(error instanceof Error ? error.message : "复测失败，请重试。");
    }
  };

  return (
    <section className="growth-plan-page">
      <header className="growth-hero">
        <div>
          <span><Sparkles size={17} /> Career Growth Agent</span>
          <h1>职业成长闭环</h1>
          <p>从面试诊断出发，把岗位差距转化为每周任务、成果证据和下一阶段调整。</p>
        </div>
        <div className="growth-target-controls">
          <label>
            <CalendarDays size={15} /> 目标日期
            <input
              type="date"
              value={plan.targetDate}
              min={growthDateAfterDays(7)}
              max={growthDateAfterDays(365)}
              disabled={workingDate || !isTargetCurrent}
              onChange={(event) => void updateTargetDate(event.target.value)}
            />
          </label>
          <button type="button" onClick={() => void onRegenerate()} disabled={status === "saving"}>
            <RefreshCw size={15} /> 按当前画像重排
          </button>
          <button type="button" onClick={() => void reassess()} disabled={status === "saving" || !isTargetCurrent}>
            <TrendingUp size={15} /> 重新计算实证分
          </button>
        </div>
      </header>

      {dateError ? <div className="growth-warning">{dateError}</div> : null}
      {reassessError ? <div className="growth-warning">{reassessError}</div> : null}

      {!isTargetCurrent ? (
        <div className="growth-warning">
          当前岗位已经变化，本页仍展示“{plan.targetJobTitle}”计划。建议完成新岗位面试，或点击“按当前画像重排”。
        </div>
      ) : null}

      <section className="growth-summary-grid">
        <article>
          <Target size={19} />
          <span>目标岗位</span>
          <strong>{plan.targetJobTitle}</strong>
          <small>{plan.targetJobTrack}</small>
        </article>
        <article>
          <Flag size={19} />
          <span>当前实证匹配度</span>
          <strong>{plan.verifiedMatchScore}<em>分</em></strong>
          <small>初始 {plan.baseMatchScore} 分 · 最近复测结果</small>
        </article>
        <article className="projected">
          <TrendingUp size={19} />
          <span>已验证证据预测</span>
          <strong>{plan.projectedMatchScore}<em>分</em></strong>
          <small>仅为成长预测，不覆盖实证分</small>
        </article>
        <article>
          <CheckCircle2 size={19} />
          <span>证据审核进度</span>
          <strong>{progress.percentage}<em>%</em></strong>
          <small>{progress.completed}/{progress.total} 项已验证{revisionTaskCount ? ` · ${revisionTaskCount} 项待补充` : ""}</small>
        </article>
      </section>

      <section className="growth-score-boundary">
        <FileCheck2 size={18} />
        <div>
          <strong>预测分与实证分已分离</strong>
          <p>任务证据先由本地审核智能体检查相关性、完整性和可信度。审核通过只更新预测分；把成果写入简历或完成新一轮面试后，再点击“重新计算实证分”。</p>
        </div>
        <span>{verifiedTaskCount} 项证据已通过</span>
      </section>

      <div className="growth-content-grid">
        <section className="growth-main-column">
          <div className="growth-section-heading">
            <div>
              <span>DYNAMIC {planningDays} DAY PLAN · {planningWeeks} WEEKS</span>
              <h2>阶段目标与每周任务</h2>
            </div>
            <small className={status === "error" ? "error" : ""}>{message}</small>
          </div>

          <div className="growth-stage-tabs" role="tablist" aria-label="成长计划阶段">
            {plan.stages.map((stage, stageIndex) => {
              const completed = plan.tasks.filter((task) => task.stageDays === stage.days && task.completed && task.evidenceStatus === "verified").length;
              const total = plan.tasks.filter((task) => task.stageDays === stage.days).length;
              return (
                <button
                  key={stage.days}
                  type="button"
                  className={resolvedActiveStage === stage.days ? "active" : ""}
                  onClick={() => setActiveStage(stage.days)}
                >
                  {stage.unlocked ? <CircleDashed size={16} /> : <LockKeyhole size={16} />}
                  <span>{stageLabel(plan, stageIndex)}</span>
                  <small>{completed}/{total}</small>
                </button>
              );
            })}
          </div>

          <article className={`growth-stage-overview ${activeStageInfo.unlocked ? "" : "locked"}`}>
            <div>
              <span>{stageLabel(plan, activeStageIndex)} · 截止 {activeStageInfo.endDate || plan.targetDate}</span>
              <h3>{activeStageInfo.title}</h3>
              <p>{activeStageInfo.outcome}</p>
            </div>
            <strong>{stageCompleted}/{stageTasks.length}</strong>
            <ul>{activeStageInfo.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
          </article>

          <div className="growth-task-list">
            {stageTasks.map((task) => {
              const draft = drafts[task.id] ?? { text: "", url: "" };
              return (
                <article key={task.id} className={`growth-task-card evidence-${task.evidenceStatus} ${task.completed ? "completed" : ""} ${!activeStageInfo.unlocked ? "locked" : ""}`}>
                  <header>
                    <div className="growth-task-icon">{taskIcon(task)}</div>
                    <div>
                      <span>第 {task.week} 周 · {task.estimatedHours} 小时{task.dueDate ? ` · ${task.dueDate} 前` : ""}</span>
                      <h3>{task.title}</h3>
                    </div>
                    <em className={`priority-${task.priority}`}>{task.priority === "high" ? "优先" : task.priority === "medium" ? "重要" : "常规"}</em>
                  </header>
                  <p>{task.description}</p>
                  <div className="growth-task-evidence-rule">
                    <FileCheck2 size={15} />
                    <span>完成证据：{task.evidenceRequirement}</span>
                  </div>
                  {task.resources.length ? (
                    <div className="growth-task-resources">
                      {task.resources.map((resource) => (
                        <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">
                          <BookOpenCheck size={14} /> {resource.title}<ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {task.completed ? (
                    <div className="growth-completed-evidence">
                      <strong><CheckCircle2 size={15} /> 证据审核通过 · {task.evidenceReview?.score ?? 0} 分</strong>
                      <p>{task.evidenceText || "已通过证据链接完成验收。"}</p>
                      {task.evidenceUrl ? <a href={task.evidenceUrl} target="_blank" rel="noreferrer">打开证据链接 <ExternalLink size={12} /></a> : null}
                      {task.evidenceReview ? (
                        <small>{task.evidenceReview.summary} 相关性 {task.evidenceReview.relevance} · 完整性 {task.evidenceReview.completeness} · 可信度 {task.evidenceReview.credibility}</small>
                      ) : null}
                      <button type="button" onClick={() => void submitTask(task, false)} disabled={workingTask === task.id}>撤回证据</button>
                    </div>
                  ) : (
                    <div className="growth-evidence-form">
                      {task.evidenceStatus === "needs_revision" && task.evidenceReview ? (
                        <div className="growth-evidence-review needs-revision">
                          <strong>证据需补充 · {task.evidenceReview.score} 分</strong>
                          <p>{task.evidenceReview.summary}</p>
                          <ul>{task.evidenceReview.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                        </div>
                      ) : null}
                      <textarea
                        aria-label={`${task.title}证据说明（第${task.week}周）`}
                        value={draft.text}
                        placeholder="说明你的具体行动、可核验产物和结果；只写“已完成”不会通过审核。"
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [task.id]: { ...draft, text: event.target.value },
                        }))}
                        disabled={!activeStageInfo.unlocked}
                      />
                      <input
                        aria-label={`${task.title}证据链接（第${task.week}周）`}
                        value={draft.url}
                        placeholder="证据链接（可选）：GitHub、作品页、文档等"
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [task.id]: { ...draft, url: event.target.value },
                        }))}
                        disabled={!activeStageInfo.unlocked}
                      />
                      <button
                        type="button"
                        onClick={() => void submitTask(task, true)}
                        disabled={!activeStageInfo.unlocked || workingTask === task.id || status === "saving"}
                      >
                        <CheckCircle2 size={15} /> {workingTask === task.id ? "审核中" : task.evidenceStatus === "needs_revision" ? "重新提交证据审核" : "提交证据审核"}
                      </button>
                      {taskError[task.id] ? <small className="error">{taskError[task.id]}</small> : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="growth-side-column">
          <section className="growth-gap-panel">
            <header><Target size={17} /><h2>能力差距</h2></header>
            {plan.gaps.map((gap) => (
              <article key={gap.id}>
                <div><strong>{gap.name}</strong><span>实证 {gap.currentScore} · 预测 {gap.projectedScore} → {gap.targetScore}</span></div>
                <i><b style={{ width: `${gap.projectedScore}%` }} /></i>
                <p>{gap.reason}</p>
              </article>
            ))}
          </section>

          <section className="growth-resource-panel">
            <header><BookOpenCheck size={17} /><h2>课程、项目与证书</h2></header>
            {plan.recommendations.map((item) => (
              <article key={item.id}>
                <span>{item.kind === "course" ? "课程" : item.kind === "project" ? "项目" : "证书"}</span>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.provider || "查看资源"}<ExternalLink size={12} /></a> : null}
              </article>
            ))}
          </section>

          <section className="growth-adaptation-panel">
            <header><RefreshCw size={17} /><h2>智能调整记录</h2><em>v{plan.revision}</em></header>
            {plan.adaptations.slice().reverse().map((item) => (
              <article key={item.id}>
                <i />
                <p>{item.message}</p>
                <time>{new Date(item.createdAt).toLocaleString("zh-CN")}</time>
              </article>
            ))}
          </section>

          <section className="growth-assessment-panel">
            <header><TrendingUp size={17} /><h2>实证复测记录</h2><em>{plan.assessments.length} 次</em></header>
            {plan.assessments.slice().reverse().map((assessment) => (
              <article key={assessment.id}>
                <div>
                  <strong>{assessment.matchScore} 分</strong>
                  <span>面试 {assessment.interviewScore} · 证据覆盖 {assessment.evidenceCoverage}%</span>
                </div>
                <p>{assessment.summary}</p>
                <time>{new Date(assessment.createdAt).toLocaleString("zh-CN")}</time>
              </article>
            ))}
          </section>

          <section className="growth-interview-basis">
            <header><GraduationCap size={17} /><h2>面试诊断依据</h2></header>
            <div><span>总体</span><strong>{plan.interview.feedback.overallScore}</strong></div>
            <div><span>表达</span><strong>{plan.interview.feedback.expression}</strong></div>
            <div><span>专业</span><strong>{plan.interview.feedback.professionalFit}</strong></div>
            <div><span>逻辑</span><strong>{plan.interview.feedback.logic}</strong></div>
            <p>{plan.interview.feedback.summary}</p>
          </section>
        </aside>
      </div>
    </section>
  );
}
