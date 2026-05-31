export type Modality = "text" | "file" | "link" | "image" | "audio";

export type AgentArtifactType =
  | "profile"
  | "job-search"
  | "match-analysis"
  | "resume-draft"
  | "interview"
  | "supervisor-summary";

export type AgentArtifact<T = unknown> = {
  id: string;
  agentId: string;
  type: AgentArtifactType;
  title: string;
  modality: Modality;
  payload: T;
  evidence: string[];
};

export type AgentEvent = {
  agentId: string;
  message: string;
  status: "ready" | "running" | "completed" | "blocked";
};

export type AgentContext<Input, SharedState> = {
  input: Input;
  state: SharedState;
  artifacts: AgentArtifact[];
  events: AgentEvent[];
};

export type AgentNode<Input, SharedState> = {
  id: string;
  name: string;
  role: string;
  modalities: Modality[];
  run: (context: AgentContext<Input, SharedState>) => AgentContext<Input, SharedState>;
};

export function createArtifact<T>(
  artifact: Omit<AgentArtifact<T>, "id">,
): AgentArtifact<T> {
  return {
    ...artifact,
    id: `${artifact.agentId}-${artifact.type}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function appendEvent<Input, SharedState>(
  context: AgentContext<Input, SharedState>,
  event: AgentEvent,
): AgentContext<Input, SharedState> {
  return {
    ...context,
    events: [...context.events, event],
  };
}

export function appendArtifact<Input, SharedState>(
  context: AgentContext<Input, SharedState>,
  artifact: AgentArtifact,
): AgentContext<Input, SharedState> {
  return {
    ...context,
    artifacts: [...context.artifacts, artifact],
  };
}

export function runWorkflow<Input, SharedState>(
  input: Input,
  initialState: SharedState,
  agents: Array<AgentNode<Input, SharedState>>,
) {
  return agents.reduce<AgentContext<Input, SharedState>>(
    (context, agent) => {
      const running = appendEvent(context, {
        agentId: agent.id,
        message: `${agent.name} 开始处理。`,
        status: "running",
      });
      const updated = agent.run(running);
      return appendEvent(updated, {
        agentId: agent.id,
        message: `${agent.name} 已完成。`,
        status: "completed",
      });
    },
    { input, state: initialState, artifacts: [], events: [] },
  );
}

