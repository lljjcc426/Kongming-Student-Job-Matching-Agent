import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import {
  ArrowDownToLine,
  BriefcaseBusiness,
  ExternalLink,
  FileText,
  Lightbulb,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { RefObject } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivePage, AsyncStatus, JdPipelineStep, PipelineStep } from "../app/types";
import type { CareerOpsEvaluation } from "../careerOps";
import JobCard from "../components/jobs/JobCard";
import CareerAbilityGraph from "../components/matching/CareerAbilityGraph";
import ScoreEvidencePanel from "../components/matching/ScoreEvidencePanel";
import ModelInsightMarkdown from "../components/model/ModelInsightMarkdown";
import FontAwesomeShapeIcon from "../components/shared/FontAwesomeShapeIcon";
import { BulletList, EmptyState, InfoBlock, Panel, TagList } from "../components/shared/ContentPrimitives";
import { JdPipelineStatus, ResumePipelineStatus } from "../components/status/PipelineStatus";
import ResumeProfileAnalysis from "../components/ResumeProfileAnalysis";
import type { Job, StudentProfile } from "../data";
import { analyzeMatch, type MatchResult } from "../matchEngine";
import type { StructuredResume } from "../modelParsers";
import type { OptimizedResumeDraft } from "../resumeOptimizer";

type ResumeWorkspaceState = {
  hasResume: boolean;
  source: string;
  status: AsyncStatus;
  step: PipelineStep;
  text: string;
  structured: StructuredResume | null;
};

type JdWorkspaceState = {
  title: string;
  text: string;
  status: AsyncStatus;
  step: JdPipelineStep;
  message: string;
  customJobs: Job[];
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onAnalyze: () => void;
  onSelect: (jobId: string) => void;
  onDelete: (jobId: string) => void;
};

type MatchWorkspaceState = {
  hasAnalysis: boolean;
  profile: StudentProfile;
  rankedJobs: Job[];
  selectedJob: Job;
  result: MatchResult;
  careerOps: CareerOpsEvaluation;
  optimizedDraft: OptimizedResumeDraft;
};

type InsightWorkspaceState = {
  modelStatus: AsyncStatus;
  modelMessage: string;
  modelInsight: string;
  copyStatus: string;
  onDownloadReport: () => void;
  onRunModelAnalysis: () => void;
  onCopyDraft: () => void;
};

type MatchingWorkspacePageProps = {
  activePage: ActivePage;
  profileColumnRef: RefObject<HTMLElement | null>;
  resume: ResumeWorkspaceState;
  jd: JdWorkspaceState;
  match: MatchWorkspaceState;
  insight: InsightWorkspaceState;
};

const toneOf = (score: number) => {
  if (score >= 82) return "strong";
  if (score >= 68) return "medium";
  return "weak";
};

function ProfileColumn({
  profileColumnRef,
  resume,
}: Pick<MatchingWorkspacePageProps, "profileColumnRef" | "resume">) {
  return (
    <aside className="profile-column" ref={profileColumnRef}>
      <Panel eyebrow="Profile" title="学生画像" icon={<FileText size={18} />}>
        <ResumePipelineStatus
          hasResume={resume.hasResume}
          resumeSource={resume.source}
          modelStatus={resume.status}
          pipelineStep={resume.step}
        />
        <ResumeProfileAnalysis resume={resume.structured} resumeText={resume.text} />
      </Panel>
    </aside>
  );
}

function JobMatchingColumn({
  resume,
  jd,
  match,
}: Pick<MatchingWorkspacePageProps, "resume" | "jd" | "match">) {
  return (
    <section className="match-column">
      <Panel eyebrow="Matching" title="岗位匹配工作台" icon={<BriefcaseBusiness size={18} />}>
        <div className="jd-lab">
          <div className="section-head compact">
            <div>
              <span>JD Parser</span>
              <h3>意向岗位 JD</h3>
            </div>
          </div>
          <JdPipelineStatus jdStatus={jd.status} jdStep={jd.step} jdMessage={jd.message} />
          <div className="field-row">
            <label>
              <span>岗位名称</span>
              <input value={jd.title} onChange={(event) => jd.onTitleChange(event.target.value)} />
            </label>
          </div>
          <textarea
            className="jd-textarea"
            value={jd.text}
            onChange={(event) => jd.onTextChange(event.target.value)}
            aria-label="目标岗位 JD"
            placeholder="目标岗位 JD"
          />
          <div className="jd-actions">
            <button
              type="button"
              className="primary-action"
              onClick={jd.onAnalyze}
              disabled={(!jd.title.trim() && !jd.text.trim()) || !resume.hasResume || jd.status === "loading"}
            >
              <Plus size={16} />
              分析该岗位
            </button>
            <span>{jd.message}</span>
          </div>
        </div>

        {jd.customJobs.length ? (
          <div className="custom-job-list">
            {jd.customJobs.map((job) => (
              <article key={job.id}>
                <div>
                  <span>{job.priority}优先级</span>
                  <strong>{job.title}</strong>
                  <p>{job.jdAnalysis?.conclusion || job.summary}</p>
                </div>
                <div className="custom-job-actions">
                  <button type="button" className="secondary-action compact-action" onClick={() => jd.onSelect(job.id)}>
                    <Search size={15} />
                    查看
                  </button>
                  <button type="button" className="secondary-action compact-action" onClick={() => jd.onDelete(job.id)}>
                    <Trash2 size={15} />
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {match.hasAnalysis ? (
          <>
            <div className="job-board">
              {match.rankedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  active={job.id === match.selectedJob.id}
                  result={analyzeMatch(match.profile, job, resume.text, resume.structured)}
                  onSelect={() => jd.onSelect(job.id)}
                />
              ))}
            </div>

            <div className="selected-job">
              <div className="selected-job-head">
                <div>
                  <span>{match.selectedJob.companyScenario}</span>
                  <h2>{match.selectedJob.title}</h2>
                  <p>{match.selectedJob.summary}</p>
                </div>
                <div className={`score-badge ${toneOf(match.result.total)}`}>
                  <strong>{match.result.total}</strong>
                  <span>{match.result.verdict}</span>
                </div>
              </div>

              <div className="job-detail-grid">
                <InfoBlock title="岗位职责">
                  <BulletList items={match.selectedJob.responsibilities} />
                </InfoBlock>
                <InfoBlock title="岗位要求">
                  <BulletList items={match.selectedJob.requirements} />
                </InfoBlock>
                <InfoBlock title="加分项">
                  <BulletList items={match.selectedJob.bonus} />
                </InfoBlock>
              </div>

              {(match.selectedJob.applicationLinks?.length ?? 0) > 0 ? (
                <div className="apply-panel">
                  {match.selectedJob.knowledgeBase ? (
                    <div className="knowledge-source">
                      <strong>官方岗位数据</strong>
                      <span>
                        来源：{match.selectedJob.knowledgeBase.source}
                        {match.selectedJob.knowledgeBase.lastVerifiedAt
                          ? ` · 核验：${new Date(
                              match.selectedJob.knowledgeBase.lastVerifiedAt,
                            ).toLocaleDateString("zh-CN")}`
                          : ""}
                      </span>
                      {match.selectedJob.knowledgeBase.matchedTerms.length ? (
                        <small>
                          检索命中：
                          {match.selectedJob.knowledgeBase.matchedTerms
                            .slice(0, 6)
                            .join("、")}
                        </small>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="apply-links">
                    {(match.selectedJob.applicationLinks ?? []).map((link) => (
                      <a key={`${match.selectedJob.id}-${link.company}`} href={link.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        {link.note || link.company}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {match.selectedJob.jdAnalysis ? (
                <div className="jd-analysis-panel">
                  <InfoBlock title="意向岗位分析">
                    <p>{match.selectedJob.jdAnalysis.conclusion}</p>
                  </InfoBlock>
                  <InfoBlock title="匹配证据">
                    <BulletList items={match.selectedJob.jdAnalysis.strengths} icon="check" />
                  </InfoBlock>
                  <InfoBlock title="补强建议">
                    <BulletList items={[...match.selectedJob.jdAnalysis.risks, ...match.selectedJob.jdAnalysis.actions]} icon="risk" />
                  </InfoBlock>
                </div>
              ) : null}

              <div className="career-ops-panel">
                <InfoBlock title="岗位深度评估">
                  <p>{match.careerOps.roleSummary}</p>
                  <p>{match.careerOps.positioning}</p>
                </InfoBlock>
                <InfoBlock title="要求匹配表">
                  <div className="requirement-matrix">
                    {match.careerOps.requirementMatrix.map((item) => (
                      <article key={item.requirement}>
                        <span className={item.status === "强匹配" ? "strong" : item.status === "可补强" ? "medium" : "weak"}>{item.status}</span>
                        <strong>{item.requirement}</strong>
                        <p>{item.evidence}</p>
                      </article>
                    ))}
                  </div>
                </InfoBlock>
              </div>
            </div>

            <CareerAbilityGraph result={match.result} />

            <div className="chart-card">
              <div className="section-head">
                <div>
                  <span>Match Score</span>
                  <h3>五维证据评分</h3>
                </div>
                <p>总分严格按五维权重计算；展开下方解释可核对每一分的来源。</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={match.result.dimensions} margin={{ top: 10, right: 16, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbeafe" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
                  <Bar dataKey="score" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <ScoreEvidencePanel result={match.result} />
          </>
        ) : (
          <EmptyState title="暂无匹配结果" text="上传简历后会生成岗位推荐；粘贴 JD 后会优先分析目标岗位。" />
        )}
      </Panel>
    </section>
  );
}

function InsightColumn({
  resume,
  match,
  insight,
}: Pick<MatchingWorkspacePageProps, "resume" | "match" | "insight">) {
  return (
    <aside className="insight-column">
      <Panel eyebrow="AI Insight" title="初筛命中率提升建议" icon={<Lightbulb size={18} />}>
        {match.hasAnalysis ? (
          <>
            <div className={`verdict-card ${toneOf(match.result.total)}`}>
              <div>
                <span>匹配结论</span>
                <strong>{match.result.verdict}</strong>
                <p>基于简历文本、学生画像和目标岗位要求生成。</p>
              </div>
              <b>{match.result.total}</b>
            </div>

            <button type="button" className="secondary-action" onClick={insight.onDownloadReport} disabled={!resume.hasResume || !match.hasAnalysis}>
              <ArrowDownToLine size={16} />
              下载分析报告
            </button>

            <button
              type="button"
              className="secondary-action"
              onClick={insight.onRunModelAnalysis}
              disabled={insight.modelStatus === "loading" || !resume.hasResume || !match.hasAnalysis}
            >
              <FontAwesomeShapeIcon icon={faWandMagicSparkles} size={16} />
              {insight.modelStatus === "loading" ? "模型分析中" : "模型增强分析"}
            </button>

            {(insight.modelMessage || insight.modelInsight) && (
              <InfoBlock title="模型增强结果">
                <div className={`model-insight ${insight.modelStatus}`}>
                  {insight.modelMessage ? <strong>{insight.modelMessage}</strong> : null}
                  {insight.modelInsight ? <ModelInsightMarkdown content={insight.modelInsight} /> : null}
                </div>
              </InfoBlock>
            )}

            <InfoBlock title="匹配优势">
              <BulletList items={match.result.strengths} icon="check" />
            </InfoBlock>
            <InfoBlock title="风险与差距">
              <BulletList items={match.result.risks} icon="risk" />
            </InfoBlock>
            <InfoBlock title="关键词覆盖">
              <div className="keyword-box">
                <div>
                  <span>已覆盖</span>
                  <TagList items={match.result.coveredKeywords} compact />
                </div>
                <div>
                  <span>需补强</span>
                  <TagList items={match.result.missingKeywords} compact muted />
                </div>
              </div>
            </InfoBlock>

            <InfoBlock title="简历优化动作">
              <div className="action-stack">
                {match.result.resumeActions.map((action) => (
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
                  <p>{match.optimizedDraft.summary}</p>
                </div>
                <div>
                  <span>项目经历改写</span>
                  <ul>
                    {match.optimizedDraft.projectBullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <span>技能关键词</span>
                  <p>{match.optimizedDraft.skillLine}</p>
                </div>
                <button type="button" className="secondary-action compact-action" onClick={insight.onCopyDraft}>
                  {insight.copyStatus}
                </button>
              </div>
            </InfoBlock>

            <InfoBlock title="投递前清单">
              <ol className="checklist">
                {match.careerOps.applicationChecklist.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </InfoBlock>

            <InfoBlock title="投递运营看板">
              <div className="pipeline-board">
                {match.careerOps.pipeline.map((item) => (
                  <article key={item.stage} className={item.status === "已完成" ? "done" : item.status === "进行中" ? "active" : ""}>
                    <span>{item.status}</span>
                    <strong>{item.stage}</strong>
                    <p>{item.action}</p>
                  </article>
                ))}
              </div>
            </InfoBlock>
          </>
        ) : (
          <div>
            <EmptyState title="等待分析" text="当前没有简历或岗位输入。上传简历后，这里会生成匹配结论、关键词覆盖、优化动作和投递清单。" />
            <button type="button" className="secondary-action" onClick={insight.onRunModelAnalysis}>
              <FontAwesomeShapeIcon icon={faWandMagicSparkles} size={16} />
              模型增强分析
            </button>
            {insight.modelMessage ? (
              <InfoBlock title="模型增强结果">
                <div className={`model-insight ${insight.modelStatus}`}>
                  <strong>{insight.modelMessage}</strong>
                </div>
              </InfoBlock>
            ) : null}
          </div>
        )}
      </Panel>
    </aside>
  );
}

export default function MatchingWorkspacePage({
  activePage,
  profileColumnRef,
  resume,
  jd,
  match,
  insight,
}: MatchingWorkspacePageProps) {
  return (
    <section className={`dashboard dashboard-${activePage}`} hidden={activePage !== "resume" && activePage !== "jobs"}>
      <ProfileColumn profileColumnRef={profileColumnRef} resume={resume} />
      <JobMatchingColumn resume={resume} jd={jd} match={match} />
      <InsightColumn resume={resume} match={match} insight={insight} />
    </section>
  );
}
