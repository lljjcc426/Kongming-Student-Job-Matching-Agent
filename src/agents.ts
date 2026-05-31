import type { Job, StudentProfile } from "./data";
import {
  appendArtifact,
  createArtifact,
  runWorkflow,
  type AgentNode,
} from "./agentRuntime";
import type { MatchResult } from "./matchEngine";

export type AgentTeamResult = {
  resumeAgent: {
    summary: string;
    signals: string[];
    missingInfo: string[];
  };
  jobSearchAgent: {
    searchQueries: string[];
    sourcePlan: string[];
    candidates: Array<{ title: string; score: number; reason: string }>;
  };
  advisorAgent: {
    decision: string;
    reasons: string[];
    nextActions: string[];
  };
  interviewAgent: {
    questions: string[];
    focus: string;
  };
  supervisorAgent: {
    priority: string;
    summary: string;
    handoff: string[];
  };
};

type WorkflowInput = {
  profile: StudentProfile;
  jobs: Job[];
  selectedJob: Job;
  result: MatchResult;
  resumeText: string;
};

type WorkflowState = Partial<AgentTeamResult>;

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const buildSearchUrl = (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

const resumeIntakeAgent: AgentNode<WorkflowInput, WorkflowState> = {
  id: "resume-intake",
  name: "简历解析智能体",
  role: "解析简历文本、经历证据和能力信号",
  modalities: ["text", "file"],
  run(context) {
    const { profile, result, resumeText } = context.input;
    const signals = unique([
      ...profile.skills.slice(0, 5),
      ...profile.experiences.flatMap((item) => item.tags).slice(0, 6),
      ...result.coveredKeywords.slice(0, 5),
    ]);
    const resumeAgent = {
      summary: `已识别 ${profile.experiences.length} 段经历、${signals.length} 个能力信号和 ${resumeText.length} 字简历文本。`,
      signals,
      missingInfo: [
        "建议补充每段经历的时间、团队规模和个人职责边界。",
        "建议补充至少 1 个量化结果，便于证明贡献。",
        result.missingKeywords.length > 0 ? `建议补充 ${result.missingKeywords.slice(0, 3).join("、")} 等岗位关键词。` : "当前关键词覆盖较完整，建议继续强化结果表达。",
      ],
    };

    return appendArtifact(
      { ...context, state: { ...context.state, resumeAgent } },
      createArtifact({
        agentId: "resume-intake",
        type: "profile",
        title: "学生画像摘要",
        modality: "text",
        payload: resumeAgent,
        evidence: profile.experiences.map((item) => item.title),
      }),
    );
  },
};

const jobDiscoveryAgent: AgentNode<WorkflowInput, WorkflowState> = {
  id: "job-discovery",
  name: "岗位搜索智能体",
  role: "生成联网检索计划并排序候选岗位",
  modalities: ["text", "link"],
  run(context) {
    const { profile, jobs, selectedJob, result } = context.input;
    const sortedCandidates = jobs
      .map((job) => ({
        job,
        score: job.id === selectedJob.id ? result.total : Math.max(45, result.total - Math.abs(job.keywords.length - selectedJob.keywords.length) * 5),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const searchQueries = unique([
      `${selectedJob.title} ${selectedJob.city} 实习`,
      `${selectedJob.track} 实习 ${result.coveredKeywords.slice(0, 2).join(" ")}`,
      `${profile.major} ${selectedJob.track} 学生岗位`,
    ]);
    const jobSearchAgent = {
      searchQueries,
      sourcePlan: ["企业招聘官网", "高校就业信息平台", "公开实习岗位平台", "行业社区与公开岗位集合"],
      candidates: sortedCandidates.map(({ job, score }) => ({
        title: job.title,
        score,
        reason: `${job.track}方向与当前画像存在交集，关键词覆盖 ${job.keywords.filter((keyword) => result.coveredKeywords.includes(keyword)).length}/${job.keywords.length}。`,
      })),
    };

    return appendArtifact(
      { ...context, state: { ...context.state, jobSearchAgent } },
      createArtifact({
        agentId: "job-discovery",
        type: "job-search",
        title: "岗位发现计划",
        modality: "link",
        payload: jobSearchAgent,
        evidence: searchQueries,
      }),
    );
  },
};

const matchReasoningAgent: AgentNode<WorkflowInput, WorkflowState> = {
  id: "match-reasoning",
  name: "匹配推理智能体",
  role: "解释匹配分数、优势和风险",
  modalities: ["text"],
  run(context) {
    const { result } = context.input;
    const advisorAgent = {
      decision: result.verdict,
      reasons: result.strengths,
      nextActions: [
        "优先处理关键词缺口，再改写项目经历。",
        "将最相关项目放到简历靠前位置。",
        "投递前准备与岗位职责对应的面试故事。",
      ],
    };

    return appendArtifact(
      { ...context, state: { ...context.state, advisorAgent } },
      createArtifact({
        agentId: "match-reasoning",
        type: "match-analysis",
        title: "匹配推理结果",
        modality: "text",
        payload: advisorAgent,
        evidence: [...result.strengths, ...result.risks],
      }),
    );
  },
};

const interviewCoachAgent: AgentNode<WorkflowInput, WorkflowState> = {
  id: "interview-coach",
  name: "模拟面试智能体",
  role: "基于岗位和风险生成面试问题",
  modalities: ["text", "audio"],
  run(context) {
    const { selectedJob, result } = context.input;
    const interviewAgent = {
      questions: [
        `请用 2 分钟介绍一段最能证明你适合${selectedJob.title}的经历。`,
        `你如何判断一个${selectedJob.track}需求是否值得优先推进？`,
        result.risks[0],
      ],
      focus: "重点考察经历真实性、问题拆解能力、岗位动机和结果复盘能力。",
    };

    return appendArtifact(
      { ...context, state: { ...context.state, interviewAgent } },
      createArtifact({
        agentId: "interview-coach",
        type: "interview",
        title: "模拟面试计划",
        modality: "text",
        payload: interviewAgent,
        evidence: interviewAgent.questions,
      }),
    );
  },
};

const supervisorAgent: AgentNode<WorkflowInput, WorkflowState> = {
  id: "supervisor",
  name: "协作监督智能体",
  role: "汇总所有智能体产物并给出执行优先级",
  modalities: ["text"],
  run(context) {
    const { selectedJob, result } = context.input;
    const supervisorAgent = {
      priority: result.total >= 82 ? "立即完善材料并优先投递" : "先补齐材料证据，再进入投递",
      summary: `围绕${selectedJob.title}，当前最重要的是补齐关键词证据、强化项目结果，并准备面试故事。`,
      handoff: [
        "简历解析智能体负责持续更新画像。",
        "岗位搜索智能体负责扩展候选岗位。",
        "匹配推理智能体负责解释分数和风险。",
        "模拟面试智能体负责求职准备闭环。",
      ],
    };

    return appendArtifact(
      { ...context, state: { ...context.state, supervisorAgent } },
      createArtifact({
        agentId: "supervisor",
        type: "supervisor-summary",
        title: "协作汇总结论",
        modality: "text",
        payload: supervisorAgent,
        evidence: context.artifacts.map((artifact) => artifact.title),
      }),
    );
  },
};

export function runAgentTeam(profile: StudentProfile, jobs: Job[], selectedJob: Job, result: MatchResult, resumeText: string): AgentTeamResult {
  const workflow = runWorkflow<WorkflowInput, WorkflowState>(
    { profile, jobs, selectedJob, result, resumeText },
    {},
    [resumeIntakeAgent, jobDiscoveryAgent, matchReasoningAgent, interviewCoachAgent, supervisorAgent],
  );

  return {
    resumeAgent: workflow.state.resumeAgent!,
    jobSearchAgent: workflow.state.jobSearchAgent!,
    advisorAgent: workflow.state.advisorAgent!,
    interviewAgent: workflow.state.interviewAgent!,
    supervisorAgent: workflow.state.supervisorAgent!,
  };
}

export function evaluateInterviewAnswer(answer: string, job: Job, result: MatchResult) {
  const trimmed = answer.trim();
  if (!trimmed) {
    return {
      score: 0,
      summary: "等待回答。建议按背景、任务、行动、结果四段组织。",
      suggestions: ["说明项目背景", "讲清个人动作", "补充量化结果"],
    };
  }

  const keywordHits = result.coveredKeywords.filter((keyword) => trimmed.includes(keyword)).length;
  const structureScore = ["背景", "任务", "行动", "结果", "复盘"].filter((word) => trimmed.includes(word)).length * 8;
  const lengthScore = Math.min(35, Math.round(trimmed.length / 8));
  const score = Math.min(100, 35 + keywordHits * 8 + structureScore + lengthScore);

  return {
    score,
    summary: `回答与${job.track}方向有一定关联，已命中 ${keywordHits} 个岗位关键词。`,
    suggestions: [
      score < 75 ? "建议补充更明确的量化结果。" : "结构较完整，可进一步压缩表达。",
      "建议明确自己在团队中的职责边界。",
      "结尾补充复盘收获，连接到目标岗位要求。",
    ],
  };
}

export function getSearchLinks(queries: string[]) {
  return queries.map((query) => ({ query, url: buildSearchUrl(query) }));
}

