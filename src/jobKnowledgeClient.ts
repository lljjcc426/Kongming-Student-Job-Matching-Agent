export type JobKnowledgeFilters = {
  sources?: string[];
  cities?: string[];
  recruitmentTypes?: string[];
  jobFamilies?: string[];
  skills?: string[];
  studentOnly?: boolean;
};

export type JobKnowledgeResult = {
  id: string;
  source: string;
  source_name: string;
  source_job_id: string;
  source_url: string;
  company_name: string;
  title: string;
  recruitment_type: string;
  employment_type: string;
  city: string;
  department: string;
  job_family: string;
  responsibilities: string[];
  requirements: string[];
  preferred_qualifications: string[];
  skills: string[];
  education_requirement: string;
  experience_requirement: string;
  published_at: string;
  refreshed_at: string;
  expires_at: string;
  last_verified_at: string;
  status: string;
  retrieval: {
    score: number;
    confidence: number;
    denseScore: number;
    lexicalScore: number;
    denseRank: number | null;
    lexicalRank: number | null;
    rerankScore: number | null;
    rerankRank: number | null;
    matchedTerms: string[];
    matchedSections: string[];
  };
};

export type JobKnowledgeSearchResponse =
  | {
      ok: true;
      query: string;
      queries: string[];
      queryCount: number;
      topK: number;
      filters: Required<JobKnowledgeFilters>;
      totalCandidates: number;
      elapsedMs: number;
      indexVersion: string;
      retrievalDiagnostics: {
        queryCount: number;
        denseLimitPerQuery: number;
        denseNodesRetrieved: number;
        denseCandidatesRetrieved: number;
        nodesPerRecord: number;
        filterPushdown: boolean;
        rerankerEnabled: boolean;
        rerankerApplied: boolean;
        rerankerModel: string | null;
        rerankCandidates: number;
        rerankElapsedMs: number;
        rerankerError: string | null;
        cacheHit: boolean;
        cacheAgeMs: number;
        cacheEntries: number;
        cacheMaxEntries: number;
        cacheTtlSeconds: number;
        cacheBypassed: boolean;
      };
      results: JobKnowledgeResult[];
    }
  | {
      ok: false;
      error: string;
    };

export async function searchJobKnowledge(
  query: string,
  options: {
    topK?: number;
    queries?: string[];
    filters?: JobKnowledgeFilters;
    timeoutMs?: number;
    rerank?: boolean;
    bypassCache?: boolean;
  } = {},
): Promise<JobKnowledgeSearchResponse> {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 180_000,
  );

  try {
    const response = await fetch("/api/jobs/search", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      signal: controller.signal,
      body: JSON.stringify({
        query,
        queries: options.queries ?? [],
        topK: options.topK ?? 10,
        filters: options.filters ?? {},
        rerank: options.rerank,
        bypassCache: options.bypassCache ?? false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : "岗位知识库检索失败。",
      };
    }
    return data as JobKnowledgeSearchResponse;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "岗位知识库检索超时。"
          : "无法连接岗位知识库服务。",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
