import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  MessageCircleQuestion,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { jobs, studentProfile, type Job } from "./data";
import { evaluateInterviewAnswer, getSearchLinks, runAgentTeam, type AgentTeamResult } from "./agents";
import { callArkAgent } from "./arkClient";
import { parseCustomJob } from "./jobParser";
import { analyzeMatch, type MatchResult } from "./matchEngine";
import { buildMatchReport, downloadTextFile } from "./report";
import { buildOptimizedResumeDraft, formatOptimizedResumeDraft } from "./resumeOptimizer";

const starterJd = `产品经理实习生
工作地点：深圳
岗位职责：
1. 参与用户研究、需求分析、产品原型设计和数据复盘；
2. 协同研发、设计和运营推进产品上线；
3. 基于 SQL 或数据看板分析核心指标，输出优化建议。
岗位要求：
具备清晰的逻辑分析能力，熟悉原型设计工具，有校园项目或互联网产品实践经验。关注 AI 产品体验者优先。`;

const toneOf = (score: number) => {
  if (score >= 82) return "strong";
  if (score >= 68) return "medium";
  return "weak";
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function App() {
  const [selectedJobId, setSelectedJobId] = useState(jobs[0].id);
  const [resumeText, setResumeText] = useState(studentProfile.resumeText);
  const [customTitle, setCustomTitle] = useState("");
  const [customJdText, setCustomJdText] = useState(starterJd);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [modelInsight, setModelInsight] = useState("");
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelMessage, setModelMessage] = useState("");

  const customJob = useMemo(() => parseCustomJob(customTitle, customJdText), [customTitle, customJdText]);
  const availableJobs = useMemo(() => (customJob ? [customJob, ...jobs] : jobs), [customJob]);
  const selectedJob = availableJobs.find((job) => job.id === selectedJobId) ?? availableJobs[0];
  const result = useMemo(() => analyzeMatch(studentProfile, selectedJob, resumeText), [resumeText, selectedJob]);
  const optimizedDraft = useMemo(() => buildOptimizedResumeDraft(studentProfile, selectedJob, result), [selectedJob, result]);
  const agentTeam = useMemo(() => runAgentTeam(studentProfile, availableJobs, selectedJob, result, resumeText), [availableJobs, selectedJob, result, resumeText]);
  const interviewFeedback = useMemo(() => evaluateInterviewAnswer(interviewAnswer, selectedJob, result), [interviewAnswer, selectedJob, result]);
  const [copyStatus, setCopyStatus] = useState("复制优化稿");

  const handleUseCustomJob = () => {
    if (customJob) setSelectedJobId(customJob.id);
  };

  const handleDownloadReport = () => {
    const report = buildMatchReport(studentProfile, selectedJob, result, resumeText, optimizedDraft);
    downloadTextFile("kongming-match-report.md", report);
  };

  const handleCopyDraft = async () => {
    await navigator.clipboard.writeText(formatOptimizedResumeDraft(optimizedDraft));
    setCopyStatus("已复制");
    window.setTimeout(() => setCopyStatus("复制优化稿"), 1600);
  };

  const handleResumeUpload = async (file?: File) => {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      setModelStatus("loading");
      setModelMessage("正在识别图片简历");
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await callArkAgent({ task: "resume-vision", imageDataUrl });
      if (response.ok && response.content) {
        setResumeText(response.content);
        setModelInsight(response.content);
        setModelStatus("ready");
        setModelMessage(`已通过 ${response.model ?? "模型"} 识别图片简历`);
        return;
      }
      setModelStatus("error");
      setModelMessage(response.error || "图片简历识别失败，请检查模型环境变量。");
      return;
    }
    const text = await file.text();
    setResumeText(text);
  };

  const handleModelAnalysis = async () => {
    setModelStatus("loading");
    setModelMessage("正在调用模型生成增强分析");
    const response = await callArkAgent({
      task: "match-analysis",
      resumeText,
      selectedJob,
      matchResult: result,
    });

    if (response.ok && response.content) {
      setModelInsight(response.content);
      setModelStatus("ready");
      setModelMessage(`已通过 ${response.model ?? "模型"} 完成增强分析`);
      return;
    }

    setModelStatus("error");
    setModelMessage(response.error || "模型增强分析失败，请检查运行环境。");
  };

  return (
    <main className="app-shell">
      <Hero result={result} selectedJob={selectedJob} />

      <section className="workflow" aria-label="产品工作流">
        <WorkflowStep index="01" title="学生画像" text="识别专业、经历、技能与求职偏好" />
        <WorkflowStep index="02" title="岗位捕手" text="筛选高匹配岗位并解释推荐原因" />
        <WorkflowStep index="03" title="初筛优化" text="定位关键词缺口与经历表达问题" />
        <WorkflowStep index="04" title="投递行动" text="输出投递前可执行清单" />
      </section>

      <AgentTeamSection
        agentTeam={agentTeam}
        interviewAnswer={interviewAnswer}
        setInterviewAnswer={setInterviewAnswer}
        interviewFeedback={interviewFeedback}
      />

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
              <label className="upload-control">
                <Upload size={15} />
                上传简历文本或图片
                <input type="file" accept=".txt,.md,.text,image/*" onChange={(event) => void handleResumeUpload(event.target.files?.[0])} />
              </label>
              <textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} aria-label="简历文本" />
            </InfoBlock>
          </Panel>
        </aside>

        <section className="match-column">
          <Panel eyebrow="Matching" title="岗位匹配工作台" icon={<BriefcaseBusiness size={18} />}>
            <div className="jd-lab">
              <div className="section-head compact">
                <div>
                  <span>JD Parser</span>
                  <h3>粘贴目标岗位 JD</h3>
                </div>
                <p>系统会抽取方向、城市和关键词，并加入下方岗位列表参与匹配。</p>
              </div>
              <div className="field-row">
                <label>
                  <span>岗位名称</span>
                  <input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="不填时从 JD 自动识别" />
                </label>
              </div>
              <textarea className="jd-textarea" value={customJdText} onChange={(event) => setCustomJdText(event.target.value)} aria-label="目标岗位 JD" />
              <div className="jd-actions">
                <button type="button" className="primary-action" onClick={handleUseCustomJob} disabled={!customJob}>
                  <Search size={16} />
                  分析该岗位
                </button>
                <span>{customJob ? `已识别 ${customJob.keywords.length} 个关键词` : "JD 至少需要 20 个字"}</span>
              </div>
            </div>

            <div className="job-board">
              {availableJobs.map((job) => (
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

            <button type="button" className="secondary-action" onClick={handleDownloadReport}>
              <ArrowDownToLine size={16} />
              下载分析报告
            </button>

            <button type="button" className="secondary-action" onClick={() => void handleModelAnalysis()} disabled={modelStatus === "loading"}>
              <Sparkles size={16} />
              {modelStatus === "loading" ? "模型分析中" : "模型增强分析"}
            </button>

            {(modelMessage || modelInsight) && (
              <InfoBlock title="模型增强结果">
                <div className={`model-insight ${modelStatus}`}>
                  {modelMessage ? <strong>{modelMessage}</strong> : null}
                  {modelInsight ? <p>{modelInsight}</p> : null}
                </div>
              </InfoBlock>
            )}

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

            <InfoBlock title="优化后简历片段">
              <div className="draft-card">
                <div>
                  <span>个人总结</span>
                  <p>{optimizedDraft.summary}</p>
                </div>
                <div>
                  <span>项目经历改写</span>
                  <ul>
                    {optimizedDraft.projectBullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <span>技能关键词</span>
                  <p>{optimizedDraft.skillLine}</p>
                </div>
                <button type="button" className="secondary-action compact-action" onClick={handleCopyDraft}>
                  {copyStatus}
                </button>
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
        <h1>孔明职配</h1>
        <p>面向校园招聘与实习求职场景，把学生画像、岗位 JD 和简历文本转化为可解释的岗位推荐、差距诊断与简历优化建议。</p>
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

function AgentTeamSection({
  agentTeam,
  interviewAnswer,
  setInterviewAnswer,
  interviewFeedback,
}: {
  agentTeam: AgentTeamResult;
  interviewAnswer: string;
  setInterviewAnswer: (value: string) => void;
  interviewFeedback: ReturnType<typeof evaluateInterviewAnswer>;
}) {
  const searchLinks = getSearchLinks(agentTeam.jobSearchAgent.searchQueries);

  return (
    <section className="agent-team" aria-label="多智能体协作台">
      <div className="section-head">
        <div>
          <span>Agent Team</span>
          <h2>多智能体协作台</h2>
        </div>
        <p>四个智能体围绕同一份简历和目标岗位协作：解析简历、搜索岗位、给出策略、模拟面试。</p>
      </div>

      <div className="agent-grid">
        <AgentCard icon={<Bot size={18} />} title="简历解析智能体" subtitle={agentTeam.resumeAgent.summary}>
          <TagList items={agentTeam.resumeAgent.signals.slice(0, 8)} compact />
          <BulletList items={agentTeam.resumeAgent.missingInfo} />
        </AgentCard>

        <AgentCard icon={<Network size={18} />} title="岗位搜索智能体" subtitle="生成联网检索关键词与候选岗位排序">
          <div className="search-links">
            {searchLinks.map((item) => (
              <a key={item.query} href={item.url} target="_blank" rel="noreferrer">{item.query}</a>
            ))}
          </div>
          <div className="candidate-list">
            {agentTeam.jobSearchAgent.candidates.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.score}</span>
                <p>{item.reason}</p>
              </article>
            ))}
          </div>
        </AgentCard>

        <AgentCard icon={<Lightbulb size={18} />} title="策略建议智能体" subtitle={`当前建议：${agentTeam.advisorAgent.decision}`}>
          <BulletList items={agentTeam.advisorAgent.reasons} icon="check" />
          <BulletList items={agentTeam.advisorAgent.nextActions} />
        </AgentCard>

        <AgentCard icon={<MessageCircleQuestion size={18} />} title="模拟面试智能体" subtitle={agentTeam.interviewAgent.focus}>
          <BulletList items={agentTeam.interviewAgent.questions} />
          <textarea
            className="interview-answer"
            value={interviewAnswer}
            onChange={(event) => setInterviewAnswer(event.target.value)}
            placeholder="输入一段模拟回答，系统会给出结构化反馈。"
            aria-label="模拟面试回答"
          />
          <div className="interview-feedback">
            <strong>{interviewFeedback.score ? `回答评分 ${interviewFeedback.score}` : "等待回答"}</strong>
            <p>{interviewFeedback.summary}</p>
            <BulletList items={interviewFeedback.suggestions} />
          </div>
        </AgentCard>

        <AgentCard icon={<ShieldCheck size={18} />} title="协作监督智能体" subtitle={agentTeam.supervisorAgent.priority}>
          <p>{agentTeam.supervisorAgent.summary}</p>
          <BulletList items={agentTeam.supervisorAgent.handoff} />
        </AgentCard>
      </div>
    </section>
  );
}

function AgentCard({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <article className="agent-card">
      <div className="agent-card-head">
        <div>{icon}</div>
        <section>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </section>
      </div>
      {children}
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
