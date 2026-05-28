import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { jobs, studentProfile, type Job } from "./data";
import { analyzeMatch, type MatchResult } from "./matchEngine";

const toneOf = (score: number) => {
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
      <Hero result={result} selectedJob={selectedJob} />

      <section className="workflow" aria-label="产品工作流">
        <WorkflowStep index="01" title="学生画像" text="识别专业、经历、技能与求职偏好" />
        <WorkflowStep index="02" title="岗位捕手" text="筛选高匹配岗位并解释推荐原因" />
        <WorkflowStep index="03" title="初筛优化" text="定位关键词缺口与经历表达问题" />
        <WorkflowStep index="04" title="投递行动" text="输出投递前可执行清单" />
      </section>

      <section className="dashboard">
        <aside className="profile-column">
          <Panel eyebrow="Profile" title="学生画像" icon={<FileText size={18} />}>
            <div className="identity-card">
              <div>
                <span>{studentProfile.school}</span>
                <strong>{studentProfile.name}</strong>
                <p>{studentProfile.grade} · {studentProfile.major}</p>
              </div>
              <small>{studentProfile.target}</small>
            </div>

            <InfoBlock title="能力标签">
              <TagList items={studentProfile.skills} />
            </InfoBlock>

            <InfoBlock title="经历证据">
              <div className="timeline">
                {studentProfile.experiences.map((item) => (
                  <article key={item.title}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.role}</span>
                    </div>
                    <p>{item.evidence}</p>
                  </article>
                ))}
              </div>
            </InfoBlock>

            <InfoBlock title="简历文本">
              <textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} aria-label="简历文本" />
            </InfoBlock>
          </Panel>
        </aside>

        <section className="match-column">
          <Panel eyebrow="Matching" title="岗位匹配工作台" icon={<BriefcaseBusiness size={18} />}>
            <div className="job-board">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  active={job.id === selectedJob.id}
                  result={analyzeMatch(studentProfile, job, resumeText)}
                  onSelect={() => setSelectedJobId(job.id)}
                />
              ))}
            </div>

            <div className="selected-job">
              <div className="selected-job-head">
                <div>
                  <span>{selectedJob.companyScenario}</span>
                  <h2>{selectedJob.title}</h2>
                  <p>{selectedJob.summary}</p>
                </div>
                <div className={`score-badge ${toneOf(result.total)}`}>
                  <strong>{result.total}</strong>
                  <span>{result.verdict}</span>
                </div>
              </div>

              <div className="job-detail-grid">
                <InfoBlock title="岗位职责">
                  <BulletList items={selectedJob.responsibilities} />
                </InfoBlock>
                <InfoBlock title="岗位要求">
                  <BulletList items={selectedJob.requirements} />
                </InfoBlock>
                <InfoBlock title="加分项">
                  <BulletList items={selectedJob.bonus} />
                </InfoBlock>
              </div>
            </div>

            <div className="chart-card">
              <div className="section-head">
                <div>
                  <span>Match Score</span>
                  <h3>五维匹配评分</h3>
                </div>
                <p>评分用于辅助求职决策，不代表企业筛选结果。</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={result.dimensions} margin={{ top: 10, right: 16, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbeafe" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
                  <Bar dataKey="score" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        <aside className="insight-column">
          <Panel eyebrow="AI Insight" title="初筛命中率提升建议" icon={<Lightbulb size={18} />}>
            <div className={`verdict-card ${toneOf(result.total)}`}>
              <div>
                <span>匹配结论</span>
                <strong>{result.verdict}</strong>
                <p>基于简历文本、学生画像和目标岗位要求生成。</p>
              </div>
              <b>{result.total}</b>
            </div>

            <InfoBlock title="匹配优势">
              <BulletList items={result.strengths} icon="check" />
            </InfoBlock>

            <InfoBlock title="风险与差距">
              <BulletList items={result.risks} icon="risk" />
            </InfoBlock>

            <InfoBlock title="关键词覆盖">
              <div className="keyword-box">
                <div>
                  <span>已覆盖</span>
                  <TagList items={result.coveredKeywords} compact />
                </div>
                <div>
                  <span>需补强</span>
                  <TagList items={result.missingKeywords} compact muted />
                </div>
              </div>
            </InfoBlock>

            <InfoBlock title="简历优化动作">
              <div className="action-stack">
                {result.resumeActions.map((action) => (
                  <article key={action.title}>
                    <span>{action.impact}</span>
                    <strong>{action.title}</strong>
                    <p>{action.detail}</p>
                  </article>
                ))}
              </div>
            </InfoBlock>

            <InfoBlock title="投递前清单">
              <ol className="checklist">
                {result.actionPlan.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </InfoBlock>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function Hero({ result, selectedJob }: { result: MatchResult; selectedJob: Job }) {
  return (
    <header className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          <Sparkles size={16} />
          学生求职匹配智能体
        </div>
        <h1>孔明 Offer 捕手</h1>
        <p>面向校招与实习求职场景，把学生画像、岗位 JD 和简历文本转化为可解释的岗位推荐、差距诊断与简历优化建议。</p>
        <div className="hero-actions">
          <span><ShieldCheck size={16} />可解释评分</span>
          <span><Search size={16} />岗位优先级</span>
          <span><ClipboardCheck size={16} />初筛优化</span>
        </div>
      </div>
      <div className="hero-card">
        <span>当前分析</span>
        <strong>{selectedJob.title}</strong>
        <div className="hero-score">
          <b>{result.total}</b>
          <div>
            <small>{result.verdict}</small>
            <i style={{ width: `${result.total}%` }} />
          </div>
        </div>
        <p>已覆盖 {result.coveredKeywords.length} 个岗位关键词，仍需补强 {result.missingKeywords.length} 个关键词。</p>
      </div>
    </header>
  );
}

function WorkflowStep({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <article>
      <span>{index}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function Panel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>{icon}</div>
        <section>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </section>
      </div>
      {children}
    </section>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="info-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function JobCard({ job, active, result, onSelect }: { job: Job; active: boolean; result: MatchResult; onSelect: () => void }) {
  return (
    <button className={`job-card ${active ? "active" : ""}`} onClick={onSelect} type="button">
      <div className="job-card-top">
        <span>{job.track}</span>
        <small>优先级 {job.priority}</small>
      </div>
      <strong>{job.title}</strong>
      <p>{job.city} · {job.level} · {job.companyScenario}</p>
      <div className="job-card-bottom">
        <b>{result.total}</b>
        <i style={{ width: `${result.total}%` }} />
      </div>
    </button>
  );
}

function TagList({ items, compact = false, muted = false }: { items: string[]; compact?: boolean; muted?: boolean }) {
  return (
    <div className={`tag-list ${compact ? "compact" : ""} ${muted ? "muted" : ""}`}>
      {items.length ? items.map((item) => <span key={item}>{item}</span>) : <span>暂无</span>}
    </div>
  );
}

function BulletList({ items, icon }: { items: string[]; icon?: "check" | "risk" }) {
  return (
    <ul className={`bullet-list ${icon ?? ""}`}>
      {items.map((item) => (
        <li key={item}>
          {icon === "check" ? <CheckCircle2 size={15} /> : null}
          {icon === "risk" ? <ArrowUpRight size={15} /> : null}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default App;
