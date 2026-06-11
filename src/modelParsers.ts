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

export type JdAnalysis = {
  title: string;
  priority: "高" | "中" | "低";
  track: string;
  city: string;
  level: string;
  summary: string;
  conclusion: string;
  strengths: string[];
  risks: string[];
  actions: string[];
  keywords: string[];
  responsibilities: string[];
  requirements: string[];
  bonus: string[];
  applicationLinks: NonNullable<Job["applicationLinks"]>;
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

const asApplicationLinks = (value: unknown): NonNullable<Job["applicationLinks"]> => {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value
    .map((item) => {
      const record = item && typeof item === "object" ? item as Partial<NonNullable<Job["applicationLinks"]>[number]> : {};
      return {
        company: typeof record.company === "string" ? record.company.trim() : "",
        url: typeof record.url === "string" ? record.url.trim() : "",
        note: typeof record.note === "string" ? record.note.trim() : "招聘入口",
      };
    })
    .filter((item) => item.company && /^https?:\/\//i.test(item.url))
    .filter((item) => {
      const key = `${item.company}-${item.url}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 4);
};

const extractJsonText = (content: string) => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  const firstArray = source.indexOf("[");
  const firstObject = source.indexOf("{");
  const start = firstArray >= 0 && (firstObject < 0 || firstArray < firstObject) ? firstArray : firstObject;
  if (start < 0) return source;

  const opener = source[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  return source.slice(start);
};

const normalizeJsonCandidate = (content: string) =>
  extractJsonText(content)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();

const parseJsonWithBasicRepair = <T,>(content: string): T => {
  const source = normalizeJsonCandidate(content);
  const candidates = [
    source,
    source.replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":'),
    source.replace(/([{,]\s*)([A-Za-z_][\w]*)\s+/g, '$1"$2": '),
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("JSON parse failed");
};

const findKeyValueStart = (source: string, key: keyof StructuredResume) => {
  const patterns = [
    new RegExp(`"${key}"\\s*[:：]`),
    new RegExp(`${key}\\s*[:：]`),
    new RegExp(`"${key}"\\s+`),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) return match.index + match[0].length;
  }
  return -1;
};

const readLooseString = (source: string, key: keyof StructuredResume) => {
  const start = findKeyValueStart(source, key);
  if (start < 0) return "";
  const rest = source.slice(start).trimStart();
  const quoted = rest.match(/^["']([\s\S]*?)(?:["']\s*[,}]|\n\s*["']?\w+["']?\s*[:：]|$)/);
  if (quoted?.[1]) return quoted[1].trim();
  const plain = rest.match(/^([^,\n}]+)/);
  return plain?.[1]?.replace(/^["']|["']$/g, "").trim() || "";
};

const readLooseArray = (source: string, key: keyof StructuredResume) => {
  const start = findKeyValueStart(source, key);
  if (start < 0) return [];
  const rest = source.slice(start);
  const bracketStart = rest.indexOf("[");
  if (bracketStart < 0) {
    const single = readLooseString(source, key);
    return single ? [single] : [];
  }

  const afterBracket = rest.slice(bracketStart + 1);
  const bracketEnd = afterBracket.indexOf("]");
  const block = bracketEnd >= 0 ? afterBracket.slice(0, bracketEnd) : afterBracket;
  const quotedItems = [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1].trim()).filter(Boolean);
  if (quotedItems.length) return quotedItems;

  return block
    .split(/[,，;；\n]/)
    .map((item) => item.replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter(Boolean);
};

const parseLooseStructuredResume = (content: string): StructuredResume => {
  const source = normalizeJsonCandidate(content);
  const parsed = {
    name: readLooseString(source, "name"),
    education: readLooseArray(source, "education"),
    internships: readLooseArray(source, "internships"),
    projects: readLooseArray(source, "projects"),
    campus: readLooseArray(source, "campus"),
    honors: readLooseArray(source, "honors"),
    skills: readLooseArray(source, "skills"),
    targetRoles: readLooseArray(source, "targetRoles"),
    summary: readLooseString(source, "summary"),
  };

  if (!parsed.summary && source.length > 20) {
    parsed.summary = source.replace(/[{}\[\]"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  }

  return parsed;
};

export function parseStructuredResume(content: string): StructuredResume {
  let data: Partial<StructuredResume>;
  try {
    data = parseJsonWithBasicRepair<Partial<StructuredResume>>(content);
  } catch {
    data = parseLooseStructuredResume(content);
  }
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
  const data = parseJsonWithBasicRepair<Array<Partial<Job>>>(content);
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
      applicationLinks: asApplicationLinks(item.applicationLinks),
    }))
    .filter((item) => item.title && item.keywords.length > 0);
}

export function parseJdAnalysis(content: string): JdAnalysis {
  const data = parseJsonWithBasicRepair<Partial<JdAnalysis>>(content);
  return {
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "意向岗位",
    priority: data.priority === "高" || data.priority === "中" || data.priority === "低" ? data.priority : "中",
    track: typeof data.track === "string" && data.track.trim() ? data.track.trim() : "待确认",
    city: typeof data.city === "string" && data.city.trim() ? data.city.trim() : "不限",
    level: typeof data.level === "string" && data.level.trim() ? data.level.trim() : "岗位",
    summary: typeof data.summary === "string" ? data.summary.trim() : "",
    conclusion: typeof data.conclusion === "string" ? data.conclusion.trim() : "",
    strengths: asStringArray(data.strengths),
    risks: asStringArray(data.risks),
    actions: asStringArray(data.actions),
    keywords: asKeywordArray(data.keywords),
    responsibilities: asStringArray(data.responsibilities),
    requirements: asStringArray(data.requirements),
    bonus: asStringArray(data.bonus),
    applicationLinks: asApplicationLinks(data.applicationLinks),
  };
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
