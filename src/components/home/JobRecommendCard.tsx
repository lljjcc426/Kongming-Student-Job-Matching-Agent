import { ArrowUpRight, BriefcaseBusiness } from "lucide-react";
import type { CSSProperties } from "react";

type JobItem = {
  title: string;
  track: string;
  score: number;
};

type JobRecommendCardProps = {
  jobs: JobItem[];
};

export default function JobRecommendCard({ jobs }: JobRecommendCardProps) {
  const handleOpenMore = () => {
    window.dispatchEvent(new CustomEvent("kongming-home-action", { detail: "jobs" }));
  };

  return (
    <article className="km-glass-card km-job-card km-card-swap-motion">
      <header className="km-card-title">
        <span>
          <BriefcaseBusiness size={19} />
          推荐岗位
        </span>
        <ArrowUpRight size={18} />
      </header>

      <div className="km-job-list">
        {jobs.map((job) => (
          <section key={job.title} className="km-job-item">
            <span className="km-job-icon">
              <BriefcaseBusiness size={17} />
            </span>
            <div className="km-job-copy">
              <strong>{job.title}</strong>
              <small>{job.track}</small>
              <i>
                <em style={{ "--progress": `${job.score}%` } as CSSProperties} />
              </i>
            </div>
            <b>{job.score}%</b>
          </section>
        ))}
      </div>

      <button type="button" className="km-card-link" onClick={handleOpenMore}>
        查看更多岗位
        <ArrowUpRight size={15} />
      </button>
    </article>
  );
}
