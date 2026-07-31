import type { StructuredResume } from "./modelParsers";

export type ResumeFieldKey =
  | "basicInfo"
  | "education"
  | "projects"
  | "competitions"
  | "certificates"
  | "languages";

export const RESUME_FIELD_LABELS: Record<ResumeFieldKey, string> = {
  basicInfo: "基础信息",
  education: "教育经历",
  projects: "项目经历",
  competitions: "竞赛",
  certificates: "证书",
  languages: "语言能力",
};

const FIELD_SECTION_TERMS: Record<ResumeFieldKey, string[]> = {
  basicInfo: [
    "基础信息", "基本信息", "个人信息", "联系方式", "求职意向", "个人简介",
    "Personal Information", "Contact Information", "Profile", "About Me", "Objective",
  ],
  education: ["教育经历", "教育背景", "学历背景", "学习经历", "Education", "Academic Background"],
  projects: ["项目经历", "项目经验", "科研项目", "实践项目", "Projects", "Project Experience"],
  competitions: ["竞赛", "竞赛经历", "比赛经历", "赛事经历", "学科竞赛", "Competitions", "Contest Experience"],
  certificates: ["证书", "资格证书", "技能证书", "认证证书", "资质认证", "Certificates", "Certifications", "Licenses"],
  languages: ["语言能力", "外语能力", "语言技能", "语言水平", "Languages", "Language Skills", "Language Proficiency"],
};

const OTHER_SECTION_TERMS = [
  "实习经历", "工作经历", "职业经历", "实践经历", "校园经历", "学生工作", "社团经历", "社会实践",
  "专业技能", "技能特长", "技术能力", "技能清单", "荣誉奖项", "获奖经历", "兴趣爱好", "研究经历", "论文发表",
  "Internship", "Internship Experience", "Work Experience", "Professional Experience", "Experience",
  "Summary", "Technical Skills", "Professional Skills", "Skills", "Activities", "Campus Experience", "Honors", "Awards",
  "Research Experience", "Publications", "Interests", "社交帐号", "社交账号", "个人链接", "个人主页", "社交媒体",
  "Social Links", "Online Profiles", "Portfolio Links",
];

type NormalizedText = {
  value: string;
  sourceIndexes: number[];
};

export type ResumeHighlightRange = {
  start: number;
  end: number;
  strategy: "section" | "value" | "fuzzy";
};

const normalizeSearchText = (source: string): NormalizedText => {
  let value = "";
  const sourceIndexes: number[] = [];

  for (let sourceIndex = 0; sourceIndex < source.length;) {
    const codePoint = source.codePointAt(sourceIndex);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    if (/[\p{L}\p{N}@._+-]/u.test(character)) {
      value += character.toLocaleLowerCase();
      sourceIndexes.push(sourceIndex);
    }
    sourceIndex += character.length;
  }

  return { value, sourceIndexes };
};

const normalizeCandidate = (candidate: string) => normalizeSearchText(candidate).value;

const headingScore = (normalizedText: string, normalizedTerm: string) => {
  if (!normalizedText || !normalizedTerm) return 0;
  if (normalizedText === normalizedTerm) return 100 + normalizedTerm.length;
  const extraLength = normalizedText.length - normalizedTerm.length;
  if (extraLength < 0) return 0;
  if ((normalizedText.startsWith(normalizedTerm) || normalizedText.endsWith(normalizedTerm)) && extraLength <= 14) {
    return 80 + normalizedTerm.length - extraLength;
  }
  if (normalizedText.includes(normalizedTerm) && extraLength <= 8) {
    return 60 + normalizedTerm.length - extraLength;
  }
  return 0;
};

export const fieldForResumeSectionHeading = (text: string): ResumeFieldKey | null => {
  const normalizedText = normalizeCandidate(text);
  if (!normalizedText || normalizedText.length > 48) return null;

  const match = Object.entries(FIELD_SECTION_TERMS)
    .flatMap(([field, terms]) => terms.map((term) => {
      const normalizedTerm = normalizeCandidate(term);
      return {
        field: field as ResumeFieldKey,
        score: headingScore(normalizedText, normalizedTerm),
      };
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)[0];

  return match?.field ?? null;
};

export const isResumeSectionHeading = (text: string) => {
  if (fieldForResumeSectionHeading(text)) return true;
  const normalizedText = normalizeCandidate(text);
  if (!normalizedText || normalizedText.length > 48) return false;
  return OTHER_SECTION_TERMS.some((term) => headingScore(normalizedText, normalizeCandidate(term)) > 0);
};

const sourceRangeFromNormalized = (
  normalized: NormalizedText,
  start: number,
  end: number,
  strategy: ResumeHighlightRange["strategy"],
): ResumeHighlightRange | null => {
  const sourceStart = normalized.sourceIndexes[start];
  const sourceEnd = normalized.sourceIndexes[end - 1];
  if (sourceStart === undefined || sourceEnd === undefined) return null;
  return { start: sourceStart, end: sourceEnd + 1, strategy };
};

export const valuesForResumeField = (resume: StructuredResume, field: ResumeFieldKey) => resume[field]
  .map((item) => item.trim())
  .filter(Boolean);

const headingOccurrences = (source: string) => {
  const occurrences: Array<{ field: ResumeFieldKey | null; start: number; end: number }> = [];
  const linePattern = /[^\r\n]+/g;
  for (const match of source.matchAll(linePattern)) {
    const line = match[0].trim();
    const field = fieldForResumeSectionHeading(line);
    if ((!field && !isResumeSectionHeading(line)) || match.index === undefined) continue;
    occurrences.push({ field, start: match.index, end: match.index + match[0].length });
  }
  return occurrences;
};

const fuzzyAnchors = (candidate: string) => {
  const normalized = normalizeCandidate(candidate);
  const fragments = candidate
    .split(/[\s,，。；;：:、|/()（）【】\[\]—-]+/)
    .map(normalizeCandidate)
    .filter((fragment) => fragment.length >= 4);

  if (normalized.length >= 7) {
    const windowLength = Math.min(18, Math.max(7, Math.floor(normalized.length * 0.58)));
    const step = Math.max(3, Math.floor(windowLength / 2));
    for (let index = 0; index + windowLength <= normalized.length; index += step) {
      fragments.push(normalized.slice(index, index + windowLength));
    }
    fragments.push(normalized.slice(-windowLength));
  }

  return [...new Set(fragments)].sort((left, right) => right.length - left.length);
};

const mergeDuplicateRanges = (ranges: ResumeHighlightRange[]) => ranges
  .sort((left, right) => left.start - right.start || right.end - left.end)
  .filter((range, index, allRanges) => !allRanges.slice(0, index).some((existing) => (
    range.start >= existing.start && range.end <= existing.end
  )));

export const findResumeHighlightRanges = (
  source: string,
  field: ResumeFieldKey | null,
  resume: StructuredResume,
): ResumeHighlightRange[] => {
  if (!field || !source.trim()) return [];
  const normalized = normalizeSearchText(source);
  if (!normalized.value) return [];
  const candidates = valuesForResumeField(resume, field)
    .map((value) => ({ value, normalized: normalizeCandidate(value) }))
    .filter((candidate) => candidate.normalized.length >= 2)
    .sort((left, right) => right.normalized.length - left.normalized.length);

  const valueRanges = candidates.flatMap((candidate) => {
    const exactIndex = normalized.value.indexOf(candidate.normalized);
    if (exactIndex >= 0) {
      const range = sourceRangeFromNormalized(normalized, exactIndex, exactIndex + candidate.normalized.length, "value");
      return range ? [range] : [];
    }

    const fuzzy = fuzzyAnchors(candidate.value)
      .map((anchor) => ({ anchor, index: normalized.value.indexOf(anchor) }))
      .filter((match) => match.index >= 0)
      .sort((left, right) => right.anchor.length - left.anchor.length)[0];
    if (!fuzzy) return [];
    const range = sourceRangeFromNormalized(normalized, fuzzy.index, fuzzy.index + fuzzy.anchor.length, "fuzzy");
    return range ? [range] : [];
  });
  const uniqueValueRanges = mergeDuplicateRanges(valueRanges);
  if (uniqueValueRanges.length) return uniqueValueRanges;

  const headings = headingOccurrences(source);
  const activeHeading = headings.find((heading) => heading.field === field);
  if (!activeHeading) return [];
  const nextHeading = headings.find((heading) => heading.start > activeHeading.start);
  return [{
    start: activeHeading.start,
    end: nextHeading?.start ?? source.length,
    strategy: "section",
  }];
};

export const findResumeHighlightRange = (
  source: string,
  field: ResumeFieldKey | null,
  resume: StructuredResume,
) => findResumeHighlightRanges(source, field, resume)[0] ?? null;
