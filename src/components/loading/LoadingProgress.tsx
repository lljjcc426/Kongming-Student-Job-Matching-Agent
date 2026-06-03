import LoadingStages from "./LoadingStages";

type LoadingProgressProps = {
  progress: number;
  currentStage: number;
};

export default function LoadingProgress({ progress, currentStage }: LoadingProgressProps) {
  return (
    <section className="loading-progress-panel" aria-label="加载进度">
      <div className="loading-status-row">
        <span>
          <i aria-hidden="true" />
          AI 求职引擎加载中...
        </span>
        <strong>{Math.round(progress)}%</strong>
      </div>
      <div className="loading-tech-rule" aria-hidden="true" />
      <div className="loading-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <i style={{ width: `${progress}%` }}>
          <b />
        </i>
      </div>
      <LoadingStages progress={progress} currentStage={currentStage} />
    </section>
  );
}
