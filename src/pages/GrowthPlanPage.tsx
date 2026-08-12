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
};

type EvidenceDraft = { text: string; url: string };

const stageLabels: Record<GrowthStageDays, string> = {
  30: "0-30天",
  60: "31-60天",
  90: "61-90天",
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
}: GrowthPlanPageProps) {
  const [activeStage, setActiveStage] = useState<GrowthStageDays>(30);
  const [drafts, setDrafts] = useState<Record<string, EvidenceDraft>>({});
  const [taskError, setTaskError] = useState<Record<string, string>>({});
  const [workingTask, setWorkingTask] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    setDrafts((current) => Object.fromEntries(plan.tasks.map((task) => [task.id,
      task.completed
        ? { text: task.evidenceText, url: task.evidenceUrl }
        : current[task.id] ?? { text: task.evidenceText, url: task.evidenceUrl },
    ])));
  }, [plan]);

  const stageTasks = useMemo(
    () => plan?.tasks.filter((task) => task.stageDays === activeStage) ?? [],
    [activeStage, plan],
  );

  if (!plan) {
    return (
      <section className="growth-plan-page growth-empty-page">
        <div className="growth-empty-card">
          <span><Sparkles size={22} /> Career Growth Agent</span>
          <h1>完成面试后生成职业成长计划</h1>
          <p>智能体将结合目标岗位、简历能力缺口和面试报告，生成可执行的30/60/90天学习规划。</p>
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

  const activeStageInfo = plan.stages.find((stage) => stage.days === activeStage) ?? plan.stages[0];
  const stageCompleted = stageTasks.filter((task) => task.completed).length;

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
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => void onUpdateTargetDate(event.target.value)}
            />
          </label>
          <button type="button" onClick={() => void onRegenerate()} disabled={status === "saving"}>
            <RefreshCw size={15} /> 按当前画像重排
          </button>
        </div>
      </header>

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
          <span>当前匹配度</span>
          <strong>{plan.baseMatchScore}<em>分</em></strong>
          <small>生成计划时的基线</small>
        </article>
        <article className="projected">
          <TrendingUp size={19} />
          <span>证据完成后预测</span>
          <strong>{plan.projectedMatchScore}<em>分</em></strong>
          <small>不代表真实招聘结果</small>
        </article>
        <article>
          <CheckCircle2 size={19} />
          <span>计划进度</span>
          <strong>{progress.percentage}<em>%</em></strong>
          <small>{progress.completed}/{progress.total} 项已完成</small>
        </article>
      </section>

      <div className="growth-content-grid">
        <section className="growth-main-column">
          <div className="growth-section-heading">
            <div>
              <span>30 / 60 / 90 DAY PLAN</span>
              <h2>阶段目标与每周任务</h2>
            </div>
            <small className={status === "error" ? "error" : ""}>{message}</small>
          </div>

          <div className="growth-stage-tabs" role="tablist" aria-label="成长计划阶段">
            {plan.stages.map((stage) => {
              const completed = plan.tasks.filter((task) => task.stageDays === stage.days && task.completed).length;
              const total = plan.tasks.filter((task) => task.stageDays === stage.days).length;
              return (
                <button
                  key={stage.days}
                  type="button"
                  className={activeStage === stage.days ? "active" : ""}
                  onClick={() => setActiveStage(stage.days)}
                >
                  {stage.unlocked ? <CircleDashed size={16} /> : <LockKeyhole size={16} />}
                  <span>{stageLabels[stage.days]}</span>
                  <small>{completed}/{total}</small>
                </button>
              );
            })}
          </div>

          <article className={`growth-stage-overview ${activeStageInfo.unlocked ? "" : "locked"}`}>
            <div>
              <span>{stageLabels[activeStageInfo.days]}</span>
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
                <article key={task.id} className={`growth-task-card ${task.completed ? "completed" : ""} ${!activeStageInfo.unlocked ? "locked" : ""}`}>
                  <header>
                    <div className="growth-task-icon">{taskIcon(task)}</div>
                    <div>
                      <span>第 {task.week} 周 · {task.estimatedHours} 小时</span>
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
                      <strong><CheckCircle2 size={15} /> 已提交证据</strong>
                      <p>{task.evidenceText || "已通过证据链接完成验收。"}</p>
                      {task.evidenceUrl ? <a href={task.evidenceUrl} target="_blank" rel="noreferrer">打开证据链接 <ExternalLink size={12} /></a> : null}
                      <button type="button" onClick={() => void submitTask(task, false)} disabled={workingTask === task.id}>撤销完成</button>
                    </div>
                  ) : (
                    <div className="growth-evidence-form">
                      <textarea
                        aria-label={`第${task.week}周证据说明`}
                        value={draft.text}
                        placeholder="说明你完成了什么、结果如何；也可以只填写下方证据链接。"
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [task.id]: { ...draft, text: event.target.value },
                        }))}
                        disabled={!activeStageInfo.unlocked}
                      />
                      <input
                        aria-label={`第${task.week}周证据链接`}
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
                        <CheckCircle2 size={15} /> {workingTask === task.id ? "正在验收" : "提交证据并完成"}
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
                <div><strong>{gap.name}</strong><span>{gap.currentScore} → {gap.targetScore}</span></div>
                <i><b style={{ width: `${gap.currentScore}%` }} /></i>
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
