import type { AsyncStatus, JdPipelineStep, PipelineStep } from "../../app/types";

type ResumePipelineStatusProps = {
  hasResume: boolean;
  resumeSource: string;
  modelStatus: AsyncStatus;
  pipelineStep: PipelineStep;
};

const RESUME_STEPS = [
  { id: "intake", label: "接收简历" },
  { id: "structure", label: "解析画像" },
  { id: "jobs", label: "生成岗位" },
  { id: "analysis", label: "匹配建议" },
] as const;

export function ResumePipelineStatus({
  hasResume,
  resumeSource,
  modelStatus,
  pipelineStep,
}: ResumePipelineStatusProps) {
  const progressIndex = pipelineStep === "done"
    ? RESUME_STEPS.length
    : pipelineStep === "error"
      ? 1
      : RESUME_STEPS.findIndex((step) => step.id === pipelineStep) + 1;
  const progress = !hasResume && pipelineStep === "idle"
    ? 0
    : Math.max(0, Math.min(100, Math.round((progressIndex / RESUME_STEPS.length) * 100)));

  return (
    <section className={`inline-progress ${modelStatus}`}>
      <div>
        <strong>简历分析进度</strong>
        <span>{modelStatus === "loading" ? "正在处理" : modelStatus === "ready" ? resumeSource : modelStatus === "error" ? "处理未完成" : "等待上传"}</span>
      </div>
      <div className="pipeline-bar" aria-label="简历分析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} role="progressbar">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="pipeline-steps">
        {RESUME_STEPS.map((step, index) => {
          const active = step.id === pipelineStep;
          const done = pipelineStep === "done" || index < progressIndex - 1;
          return (
            <span key={step.id} className={active ? "active" : done ? "done" : ""}>
              {step.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}

type JdPipelineStatusProps = {
  jdStatus: AsyncStatus;
  jdStep: JdPipelineStep;
  jdMessage: string;
};

const JD_STEPS = [
  { id: "parse", label: "解析 JD" },
  { id: "evaluate", label: "评估优先级" },
  { id: "links", label: "生成入口" },
] as const;

export function JdPipelineStatus({ jdStatus, jdStep, jdMessage }: JdPipelineStatusProps) {
  const progressIndex = jdStep === "done"
    ? JD_STEPS.length
    : jdStep === "error"
      ? 1
      : JD_STEPS.findIndex((step) => step.id === jdStep) + 1;
  const progress = jdStep === "idle"
    ? 0
    : Math.max(0, Math.min(100, Math.round((progressIndex / JD_STEPS.length) * 100)));

  return (
    <section className={`inline-progress ${jdStatus}`}>
      <div>
        <strong>岗位分析进度</strong>
        <span>{jdMessage}</span>
      </div>
      <div className="pipeline-bar" aria-label="意向岗位分析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} role="progressbar">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="pipeline-steps three">
        {JD_STEPS.map((step, index) => {
          const active = step.id === jdStep;
          const done = jdStep === "done" || index < progressIndex - 1;
          return (
            <span key={step.id} className={active ? "active" : done ? "done" : ""}>
              {step.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
