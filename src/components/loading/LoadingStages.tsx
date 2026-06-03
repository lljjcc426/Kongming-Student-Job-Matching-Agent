import { Check } from "lucide-react";
import { loadingStages } from "./stageData";

type LoadingStagesProps = {
  progress: number;
  currentStage: number;
};

export default function LoadingStages({ progress, currentStage }: LoadingStagesProps) {
  return (
    <div className="loading-stage-list">
      {loadingStages.map((stage, index) => {
        const done = progress >= stage.percent;
        const active = index === currentStage && !done;
        const Icon = stage.Icon;
        return (
          <div key={stage.label} className={`loading-stage ${done ? "done" : ""} ${active ? "active" : ""}`}>
            <span className="loading-stage-icon">{done ? <Check size={16} /> : <Icon size={18} />}</span>
            <em>{stage.label}</em>
          </div>
        );
      })}
    </div>
  );
}
