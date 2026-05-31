import type { Job, StudentProfile } from "./data";

export type StructuredResume = {
  name: string;
  education: string[];
  internships: string[];
  projects: string[];
  campus: string[];
  honors: string[];
  skills: string[];
  targetRoles: string[];
  summary: string;
};

const emptyStructuredResume: StructuredResume = {
  name: "",
  education: [],
  internships: [],
  projects: [],
  campus: [],
  honors: [],
  skills: [],
  targetRoles: [],
  summary: "",
};

const asStringArray = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
const asKeywordArray = (value: unknown) =>
  asStringArray(value)
    .flatMap((item) => item.split(/[，,、/]/g))
    .map((item) => item.trim())
    .filter(Boolean);

const extractJsonText = (content: string) => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstArray = trimmed.indexOf("[");
  const firstObject = trimmed.indexOf("{");
  const start = firstArray >= 0 && (firstObject < 0 || firstArray < firstObject) ? firstArray : firstObject;
  if (start < 0) return trimmed;
  const end = trimmed[start] === "[" ? trimmed.lastIndexOf("]") : trimmed.lastIndexOf("}");
  return end > start ? trimmed.slice(start, end + 1) : trimmed;
};

export function parseStructuredResume(content: string): StructuredResume {
  const data = JSON.parse(extractJsonText(content)) as Partial<StructuredResume>;
  return {
    name: typeof data.name === "string" ? data.name.trim() : "",
    education: asStringArray(data.education),
    internships: asStringArray(data.internships),
    projects: asStringArray(data.projects),
    campus: asStringArray(data.campus),
    honors: asStringArray(data.honors),
    skills: asStringArray(data.skills),
    targetRoles: asStringArray(data.targetRoles),
    summary: typeof data.summary === "string" ? data.summary.trim() : "",
  };
}

export function parseModelJobs(content: string): Job[] {
  const data = JSON.parse(extractJsonText(content)) as Array<Partial<Job>>;
  if (!Array.isArray(data)) return [];
  return data
    .map((item, index) => ({
      id: item.id ? String(item.id) : `model-job-${index + 1}`,
      title: String(item.title || "未命名岗位"),
      track: String(item.track || "待确认"),
      city: String(item.city || "不限"),
      level: String(item.level || "岗位"),
      companyScenario: String(item.companyScenario || "模型推荐岗位"),
      summary: String(item.summary || ""),
      responsibilities: asStringArray(item.responsibilities),
      requirements: asStringArray(item.requirements),
      bonus: asStringArray(item.bonus),
      keywords: asKeywordArray(item.keywords),
      priority: item.priority === "高" || item.priority === "中" || item.priority === "低" ? item.priority : "中",
    }))
    .filter((item) => item.title && item.keywords.length > 0);
}

export function profileFromStructuredResume(structured: StructuredResume | null, resumeText: string): StudentProfile {
  const data = structured ?? emptyStructuredResume;
  const educationText = data.education.join(" ");
  const targetText = data.targetRoles.join(" / ");
  return {
    name: data.name || "待识别姓名",
    school: educationText || "待识别学历",
    grade: educationText || "待识别阶段",
    major: educationText || "待识别专业",
    target: targetText || "待识别求职方向",
    cityPreference: ["不限"],
    skills: data.skills,
    interests: data.targetRoles,
    experiences: [...data.internships, ...data.projects, ...data.campus].map((item, index) => ({
      title: item.slice(0, 24) || `经历 ${index + 1}`,
      role: index === 0 ? "主要经历" : "相关经历",
      evidence: item,
      tags: data.skills.slice(0, 5),
    })),
    resumeText,
  };
}
