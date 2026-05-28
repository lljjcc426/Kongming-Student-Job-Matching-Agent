import { useMemo, useState } from "react";
import { BarChart3, BriefcaseBusiness, CheckCircle2, ClipboardList, FileText, Gauge, Lightbulb, Search, ShieldCheck, Sparkles, Target, Wand2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { jobs, studentProfile } from "./data";
import { analyzeMatch } from "./matchEngine";

const scoreColor = (score: number) => {
  if (score >= 82) return "strong";
  if (score >= 68) return "medium";
  return "weak";
};

function App() {
  const [selectedJobId, setSelectedJobId] = useState(jobs[0].id);
  const [resumeText, setResumeText] = useState(studentProfile.resumeText);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const result = useMemo(() => analyzeMatch(studentProfile, selectedJob, resumeText), [resumeText, selectedJob]);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <div className="eyebrow">
            <Sparkles size={16} />
            学生求职匹配智能体 Demo
          </div>
          <h1>孔明 Offer 捕手</h1>
          <p>把学生简历、求职偏好和岗位 JD 转化为可解释的匹配结果，帮助学生判断先投什么、差在哪里、简历怎么改。</p>
        </div>
        <div className="hero-actions" aria-label="Demo 状态">
          <span><ShieldCheck size={16} />本地可解释评分</span>
          <span><Wand2 size={16} />AI 建议模拟层</span>
          <span><Gauge size={16} />无密钥也可演示</span>
        </div>
      </header>

      <section className="metric-strip" aria-label="核心指标">
        <Metric icon={<Target size={20} />} label="当前目标岗位" value={selectedJob.title} note={`${selectedJob.city} · ${selectedJob.track}`} />
        <Metric icon={<BarChart3 size={20} />} label="匹配评分" value={`${result.total}`} note={result.verdict} tone={scoreColor(result.total)} />
        <Metric icon={<Search size={20} />} label="关键词覆盖" value={`${result.coveredKeywords.length}/${selectedJob.keywords.length}`} note="影响初筛识别" />
        <Metric icon={<ClipboardList size={20} />} label="待优化动作" value={`${result.resumeActions.length}`} note="投递前建议完成" />
      </section>

      <section className="workspace">
        <aside className="panel profile-panel">
          <PanelTitle icon={<FileText size={18} />} title="学生画像" subtitle="基于简历与求职偏好生成" />
          <div className="student-card">
            <div>
              <strong>{studentProfile.name}</strong>
              <span>{studentProfile.grade} · {studentProfile.major}</span>
            </div>
            <p>{studentProfile.target}</p>
          </div>

          <Block title="能力标签">
            <TagList items={studentProfile.skills} />
          </Block>

          <Block title="经历证据">
            <div className="evidence-list">
              {studentProfile.experiences.map((item) => (
                <article key={item.title} className="evidence-item">
                  <strong>{item.title}</strong>
                  <p>{item.evidence}</p>
                </article>
              ))}
            </div>
          </Block>

          <Block title="简历文本">
            <textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} aria-label="简历文本" />
          </Block>
        </aside>

        <section className="panel job-panel">
          <PanelTitle icon={<BriefcaseBusiness size={18} />} title="岗位捕手" subtitle="选择目标岗位后实时刷新匹配解释" />
          <div className="job-grid">
            {jobs.map((job) => {
              const jobResult = analyzeMatch(studentProfile, job, resumeText);
              return (
                <button
                  key={job.id}
                  className={`job-card ${job.id === selectedJob.id ? "active" : ""}`}
                  onClick={() => setSelectedJobId(job.id)}
                  type="button"
                >
                  <span className="job-priority">优先级 {job.priority}</span>
                  <strong>{job.title}</strong>
                  <small>{job.city} · {job.track} · {job.level}</small>
                  <div className="job-score">
                    <span>{jobResult.total}</span>
                    <div><i style={{ width: `${jobResult.total}%` }} /></div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="job-detail">
            <div>
              <h2>{selectedJob.title}</h2>
              <p>{selectedJob.summary}</p>
            </div>
            <div className="detail-columns">
              <Block title="岗位职责">
                <BulletList items={selectedJob.responsibilities} />
              </Block>
              <Block title="岗位要求">
                <BulletList items={selectedJob.requirements} />
              </Block>
              <Block title="加分项">
                <BulletList items={selectedJob.bonus} />
              </Block>
            </div>
          </div>

          <div className="chart-area">
            <h3>五维匹配评分</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={result.dimensions} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(15, 118, 110, 0.08)" }} />
                <Bar dataKey="score" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <aside className="panel insight-panel">
          <PanelTitle icon={<Lightbulb size={18} />} title="AI 优化建议" subtitle="解释分数来源，并给出投递前动作" />
          <div className={`verdict ${scoreColor(result.total)}`}>
            <span>{result.total}</span>
            <div>
              <strong>{result.verdict}</strong>
              <p>该分数用于求职决策参考，不代表企业筛选结果。</p>
            </div>
          </div>

          <Block title="匹配优势">
            <BulletList items={result.strengths} icon="check" />
          </Block>

          <Block title="风险与差距">
            <BulletList items={result.risks} icon="warn" />
          </Block>

          <Block title="关键词覆盖">
            <div className="keyword-groups">
              <div>
                <span>已覆盖</span>
                <TagList items={result.coveredKeywords} compact />
              </div>
              <div>
                <span>需补强</span>
                <TagList items={result.missingKeywords} compact muted />
              </div>
            </div>
          </Block>

          <Block title="简历优化动作">
            <div className="action-list">
              {result.resumeActions.map((action) => (
                <article key={action.title}>
                  <strong>{action.title}</strong>
                  <p>{action.detail}</p>
                </article>
              ))}
            </div>
          </Block>

          <Block title="投递前清单">
            <ol className="ordered-list">
              {result.actionPlan.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </Block>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone?: string }) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function PanelTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="panel-title">
      <div>{icon}</div>
      <section>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </section>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function TagList({ items, compact = false, muted = false }: { items: string[]; compact?: boolean; muted?: boolean }) {
  return (
    <div className={`tag-list ${compact ? "compact" : ""} ${muted ? "muted" : ""}`}>
      {items.length ? items.map((item) => <span key={item}>{item}</span>) : <span>暂无</span>}
    </div>
  );
}

function BulletList({ items, icon }: { items: string[]; icon?: "check" | "warn" }) {
  return (
    <ul className={`bullet-list ${icon ?? ""}`}>
      {items.map((item) => (
        <li key={item}>
          {icon === "check" ? <CheckCircle2 size={15} /> : null}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default App;

