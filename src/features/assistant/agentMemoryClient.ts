import type { ChatMessage } from "../../app/types";
import type { Job } from "../../data";
import type { MatchResult } from "../../matchEngine";
import type { StructuredResume } from "../../modelParsers";
import { getMemoryUserId } from "../identity/identityClient";

const memoryEndpoint = () => import.meta.env.VITE_AGENT_MEMORY_API_URL || "/api/memory";

export type AgentMemoryStatus = "loading" | "ready" | "error";

export type StoredAgentMessage = ChatMessage & {
  createdAt?: string;
};

export type AgentFeedbackRating = "positive" | "negative";

export type AgentFeedback = {
  messageId: string;
  rating: AgentFeedbackRating;
  correction: string;
  responseExcerpt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AgentMemory = {
  messages: StoredAgentMessage[];
  feedback: AgentFeedback[];
  resumeProfile: Partial<StructuredResume>;
  targetJob: Partial<Job>;
  matchResult: Partial<MatchResult>;
  summary: string;
  createdAt?: string;
  updatedAt: string | null;
};

export type AgentMemoryContext = {
  resumeProfile?: StructuredResume | null;
  targetJob?: Job;
  matchResult?: MatchResult;
};

export type AgentMemoryPromptContext = {
  summary: string;
  relevantMessages: Array<Pick<ChatMessage, "role" | "content">>;
  feedback: Array<Pick<AgentFeedback, "rating" | "correction" | "responseExcerpt">>;
  resumeProfile: Partial<StructuredResume>;
  targetJob: Partial<Job>;
  matchResult: Partial<MatchResult>;
  updatedAt: string | null;
};

type MemoryResponse = {
  ok: boolean;
  error?: string;
  memory?: AgentMemory;
};

const emptyMemory = (): AgentMemory => ({
  messages: [],
  feedback: [],
  resumeProfile: {},
  targetJob: {},
  matchResult: {},
  summary: "",
  updatedAt: null,
});

const requestMemory = async (payload: Record<string, unknown>): Promise<AgentMemory> => {
  const response = await fetch(memoryEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...payload, userId: getMemoryUserId() }),
  });
  const data = await response.json().catch(() => ({})) as MemoryResponse;
  if (!response.ok || !data.ok || !data.memory) {
    throw new Error(data.error || "智能体记忆服务暂不可用。");
  }
  return data.memory;
};

export const loadAgentMemory = () => requestMemory({ action: "load" });

export const saveAgentMemory = (
  messages: ChatMessage[],
  context: AgentMemoryContext = {},
) => requestMemory({ action: "save", messages, context });

export const clearAgentMemory = () => requestMemory({ action: "clear" });

export const saveAgentFeedback = (
  messageId: string,
  rating: AgentFeedbackRating,
  correction = "",
) => requestMemory({
  action: "save-feedback",
  messageId,
  rating,
  correction,
});

const memoryTerms = (text: string) => {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  const terms = new Set<string>();
  for (const token of normalized.match(/[a-z0-9+#.]{2,}|[\u4e00-\u9fff]{2,}/g) ?? []) {
    terms.add(token);
    if (/^[\u4e00-\u9fff]+$/.test(token)) {
      for (let index = 0; index < token.length - 1; index += 1) {
        terms.add(token.slice(index, index + 2));
      }
    }
  }
  return terms;
};

const relevanceScore = (queryTerms: Set<string>, content: string) => {
  if (!queryTerms.size) return 0;
  const contentTerms = memoryTerms(content);
  let hits = 0;
  for (const term of queryTerms) {
    if (contentTerms.has(term)) hits += term.length > 2 ? 2 : 1;
  }
  return hits;
};

export const buildAgentMemoryPrompt = (
  memory: AgentMemory,
  userMessage: string,
  currentContext: AgentMemoryContext,
): AgentMemoryPromptContext => {
  const recent = memory.messages.slice(-8);
  const recentIds = new Set(recent.map((message) => message.id));
  const queryTerms = memoryTerms(userMessage);
  const relevant = memory.messages
    .filter((message) => !recentIds.has(message.id))
    .map((message) => ({ message, score: relevanceScore(queryTerms, message.content) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((item) => item.message);

  return {
    summary: memory.summary,
    relevantMessages: [...relevant, ...recent].map(({ role, content }) => ({ role, content })),
    feedback: memory.feedback.slice(-10).map(({ rating, correction, responseExcerpt }) => ({
      rating,
      correction,
      responseExcerpt,
    })),
    resumeProfile: currentContext.resumeProfile || memory.resumeProfile,
    targetJob: currentContext.targetJob || memory.targetJob,
    matchResult: currentContext.matchResult || memory.matchResult,
    updatedAt: memory.updatedAt,
  };
};

export const createEmptyAgentMemory = emptyMemory;
