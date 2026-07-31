import { useMemo } from "react";
import { CheckCircle2, Radar as RadarIcon } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { StructuredResume } from "../modelParsers";
import { analyzeResumeProfile } from "../resumeCompleteness";

type ResumeProfileAnalysisProps = {
  resume: StructuredResume | null;
  resumeText: string;
};

const scoreTone = (score: number) => {
  if (score >= 80) return "strong";
  if (score >= 60) return "steady";
  if (score > 0) return "developing";
  return "empty";
};

export default function ResumeProfileAnalysis({ resume, resumeText }: ResumeProfileAnalysisProps) {
  const analysis = useMemo(() => analyzeResumeProfile(resume, resumeText), [resume, resumeText]);

  return (
    <div className="resume-profile-analysis">
      <article className="student-portrait-card">
        <header>
          <span>人物画像</span>
          <small>{resume ? "基于当前简历事实" : "等待生成"}</small>
        </header>
        <p>{analysis.portrait}</p>
      </article>

      <section className="resume-completeness-card" aria-label="简历完整度分析">
        <header className="completeness-heading">
          <div>
            <span className="completeness-icon"><RadarIcon size={17} /></span>
            <div>
              <strong>简历完整度</strong>
              <small>六个维度等权计算</small>
            </div>
          </div>
          <div className={`completeness-total ${scoreTone(analysis.overallScore)}`}>
            <strong>{analysis.overallScore}</strong>
            <span>分</span>
          </div>
        </header>

        <div className="completeness-radar-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={analysis.dimensions} outerRadius="68%" margin={{ top: 18, right: 28, bottom: 18, left: 28 }}>
              <PolarGrid gridType="polygon" stroke="rgba(96, 165, 250, 0.34)" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fill: "#334155", fontSize: 11, fontWeight: 700 }}
                tickLine={false}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
              <Radar
                name="完整度"
                dataKey="score"
                stroke="#2563eb"
                fill="#38bdf8"
                fillOpacity={0.3}
                strokeWidth={2.2}
                dot={{ r: 3.5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 1.5 }}
                animationDuration={650}
              />
              <Tooltip
                formatter={(value) => [`${Number(value)} 分`, "完整度"]}
                contentStyle={{ borderRadius: 10, border: "1px solid #bfdbfe", boxShadow: "0 10px 28px rgba(37, 99, 235, 0.12)" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="completeness-reasons">
          {analysis.dimensions.map((dimension) => (
            <article key={dimension.key} className={scoreTone(dimension.score)}>
              <span className="dimension-check"><CheckCircle2 size={15} /></span>
              <div>
                <header>
                  <strong>{dimension.label}</strong>
                  <b>{dimension.score} 分</b>
                </header>
                <p>{dimension.reason}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="star-score-note">实习与项目经历按照 STAR 法则评估：背景（S）、任务（T）、行动（A）和结果（R）。</p>
      </section>
    </div>
  );
}
