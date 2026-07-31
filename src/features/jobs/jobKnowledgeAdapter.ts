import type { Job } from "../../data";
import type {
  JobKnowledgeResult,
  JobKnowledgeSearchResponse,
} from "../../jobKnowledgeClient";
import type { StructuredResume } from "../../modelParsers";

const compact = (value: string, limit: number) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

const unique = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))];

export const buildJobKnowledgeQuery = (
  resume: StructuredResume,
  resumeText: string,
  jdText: string,
) => buildJobKnowledgeQueries(resume, resumeText, jdText)[0]
  || compact(resumeText, 900);

export const buildJobKnowledgeQueries = (
  resume: StructuredResume,
  resumeText: string,
  jdText: string,
) => {
  const targetQuery = [
    resume.targetRoles.length
      ? `目标岗位：${resume.targetRoles.slice(0, 4).join("、")}`
      : "",
    jdText.trim() ? `目标 JD：${compact(jdText, 600)}` : "",
    resume.education.length
      ? `教育背景：${resume.education.slice(0, 2).join("；")}`
      : "",
    "适合学生、实习生或应届毕业生的岗位",
  ].filter(Boolean).join("\n");
  const capabilityQuery = [
    resume.targetRoles.length
      ? `求职方向：${resume.targetRoles.slice(0, 3).join("、")}`
      : "",
    resume.skills.length
      ? `专业技能：${resume.skills.slice(0, 16).join("、")}`
      : "",
    resume.certificates.length
      ? `证书与竞赛：${[
          ...resume.certificates.slice(0, 4),
          ...resume.competitions.slice(0, 4),
        ].join("、")}`
      : "",
    resume.languages.length
      ? `语言能力：${resume.languages.slice(0, 5).join("、")}`
      : "",
  ].filter(Boolean).join("\n");
  const experienceQuery = [
    resume.targetRoles.length
      ? `目标岗位：${resume.targetRoles.slice(0, 3).join("、")}`
      : "",
    resume.internships.length
      ? `实习经历：${resume.internships.slice(0, 3).join("；")}`
      : "",
    resume.projects.length
      ? `项目经历：${resume.projects.slice(0, 4).join("；")}`
      : "",
    resume.campus.length
      ? `校园经历：${resume.campus.slice(0, 3).join("；")}`
      : "",
    resume.summary
      ? `个人简介：${compact(resume.summary, 300)}`
      : "",
  ].filter(Boolean).join("\n");
  const fallback = compact(resumeText, 900);

  return unique([targetQuery, capabilityQuery, experienceQuery, fallback])
    .filter((query) => query.length >= 2)
    .map((query) => query.slice(0, 1200))
    .slice(0, 3);
};

const resultToJob = (result: JobKnowledgeResult): Job => {
  const keywords = unique([
    ...result.skills,
    result.job_family,
    result.recruitment_type,
  ]).slice(0, 12);
  const summarySource = [
    ...result.responsibilities.slice(0, 2),
    ...result.requirements.slice(0, 1),
  ].join("；");

  return {
    id: `knowledge-${result.id}`,
    title: result.title,
    track: result.job_family || "综合岗位",
    city: result.city || "未标注",
    level: result.recruitment_type || result.employment_type || "岗位",
    companyScenario: [
      result.company_name,
      result.department || result.job_family,
    ].filter(Boolean).join(" · "),
    summary: compact(summarySource || result.title, 180),
    responsibilities: result.responsibilities.slice(0, 6),
    requirements: result.requirements.slice(0, 6),
    bonus: result.preferred_qualifications.slice(0, 5),
    keywords: keywords.length ? keywords : [result.title],
    priority: "低",
    applicationLinks: [
      {
        company: result.company_name,
        url: result.source_url,
        note: "官方岗位详情",
      },
    ],
    knowledgeBase: {
      source: result.source_name,
      sourceJobId: result.source_job_id,
      lastVerifiedAt: result.last_verified_at,
      retrievalScore: result.retrieval.confidence,
      retrievalRankScore: result.retrieval.score,
      rerankScore: result.retrieval.rerankScore ?? undefined,
      rerankRank: result.retrieval.rerankRank ?? undefined,
      matchedTerms: result.retrieval.matchedTerms,
      matchedSections: result.retrieval.matchedSections ?? [],
    },
  };
};

export const jobsFromKnowledgeResponse = (
  response: JobKnowledgeSearchResponse,
  limit = 12,
) => {
  if (!response.ok) return [];

  return response.results.slice(0, limit).map(resultToJob);
};
