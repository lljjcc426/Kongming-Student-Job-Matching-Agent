import { ArrowUpRight, FileSearch } from "lucide-react";
import type { CSSProperties } from "react";

type ProgressItem = readonly [string, number];

type ResumeAnalysisCardProps = {
  score: number;
  progressItems: readonly ProgressItem[];
};

export default function ResumeAnalysisCard({ score, progressItems }: ResumeAnalysisCardProps) {
  return (
    <article className="km-glass-card km-resume-card km-card-swap-motion">
      <header className="km-card-title">
        <span>
          <FileSearch size={19} />
          简历分析
        </span>
        <ArrowUpRight size={18} />
      </header>

      <div className="km-score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}>
        <div>
          <strong>{score}</strong>
          <span>分</span>
          <small>简历匹配度</small>
        </div>
      </div>

      <div className="km-progress-list">
        {progressItems.map(([label, value]) => (
          <section key={label}>
            <div>
              <span>{label}</span>
              <b>{value}%</b>
            </div>
            <i>
              <em style={{ "--progress": `${value}%` } as CSSProperties} />
            </i>
          </section>
        ))}
      </div>
    </article>
  );
}
