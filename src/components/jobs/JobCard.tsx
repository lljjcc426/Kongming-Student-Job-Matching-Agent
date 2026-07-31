import type { Job } from "../../data";
import type { MatchResult } from "../../matchEngine";

type JobCardProps = {
  job: Job;
  active: boolean;
  result: MatchResult;
  onSelect: () => void;
};

export default function JobCard({ job, active, result, onSelect }: JobCardProps) {
  return (
    <button className={`job-card ${active ? "active" : ""}`} onClick={onSelect} type="button">
      <div className="job-card-top">
        <span>{job.track}</span>
        <small>
          {job.knowledgeBase
            ? `职业知识库 · ${job.knowledgeBase.source}`
            : `优先级 ${job.priority}`}
        </small>
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
