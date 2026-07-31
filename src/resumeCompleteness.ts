import type { StructuredResume } from "./modelParsers";

export type ResumeCompletenessKey =
  | "basic"
  | "education"
  | "internships"
  | "projects"
  | "skills"
  | "honors";

export type ResumeCompletenessDimension = {
  key: ResumeCompletenessKey;
  label: string;
  score: number;
  reason: string;
};

export type ResumeProfileAnalysis = {
  portrait: string;
  overallScore: number;
  dimensions: ResumeCompletenessDimension[];
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const compactText = (value: string, maxLength = 120) => {
  const normalized = value.replace(/\s+/g, " ").trim().replace(/[。；;，,]+$/, "");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}…` : normalized;
};

const hasPattern = (value: string, pattern: RegExp) => pattern.test(value);

function scoreBasicInformation(resume: StructuredResume, resumeText: string): ResumeCompletenessDimension {
  const hasName = Boolean(resume.name.trim());
  const hasTarget = resume.targetRoles.some((item) => item.trim());
  const hasPhone = /(?:^|\D)1[3-9]\d{9}(?:\D|$)/.test(resumeText);
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(resumeText);
  const hasLocation = hasPattern(resumeText, /(?:现居|所在地|意向城市|期望城市|籍贯|地址|城市)\s*[:：]?\s*[\u4e00-\u9fa5]{2,}/);

  const score = clampScore(
    (hasName ? 25 : 0)
      + (hasTarget ? 35 : 0)
      + (hasPhone ? 14 : 0)
      + (hasEmail ? 14 : 0)
      + (hasLocation ? 12 : 0),
  );
  const found = [
    hasName ? "姓名" : "",
    hasTarget ? "求职意向" : "",
    hasPhone ? "手机号" : "",
    hasEmail ? "邮箱" : "",
    hasLocation ? "城市信息" : "",
  ].filter(Boolean);
  const missing = [
    !hasName ? "姓名" : "",
    !hasTarget ? "求职意向" : "",
    !hasPhone && !hasEmail ? "联系方式" : "",
  ].filter(Boolean);

  return {
    key: "basic",
    label: "基本信息",
    score,
    reason: found.length
      ? `已识别${found.join("、")}；${missing.length ? `建议补充${missing.join("、")}。` : "关键信息较完整。"}`
      : "尚未识别个人信息与求职意向。",
  };
}

function scoreEducation(resume: StructuredResume): ResumeCompletenessDimension {
  const content = resume.education.join(" ");
  if (!content.trim()) {
    return { key: "education", label: "教育经历", score: 0, reason: "尚未识别教育经历。" };
  }

  const signals = {
    school: hasPattern(content, /大学|学院|学校|研究院|University|College/i),
    major: hasPattern(content, /专业|计算机|软件|金融|会计|法学|新闻|传播|心理|设计|工程|管理|经济|医学|教育|数学|统计|人工智能|电子|自动化|语言|文学/i),
    period: hasPattern(content, /(?:19|20)\d{2}|至今|在读/),
    degree: hasPattern(content, /本科|硕士|博士|专科|学士|研究生/),
    detail: hasPattern(content, /GPA|绩点|排名|主修|课程|奖学金/i),
  };
  const score = clampScore(
    30
      + (signals.school ? 20 : 0)
      + (signals.major ? 20 : 0)
      + (signals.period ? 15 : 0)
      + (signals.degree ? 15 : 0),
  );
  const completeParts = [
    signals.school ? "院校" : "",
    signals.major ? "专业" : "",
    signals.period ? "时间" : "",
    signals.degree ? "学历层次" : "",
  ].filter(Boolean);
  const detailNote = signals.detail ? "，并包含绩点、课程或排名等补充信息" : "";

  return {
    key: "education",
    label: "教育经历",
    score,
    reason: `已识别 ${resume.education.length} 段教育经历，包含${completeParts.join("、") || "基础描述"}${detailNote}。`,
  };
}

type StarKey = "S" | "T" | "A" | "R";

const STAR_LABELS: Record<StarKey, string> = {
  S: "背景",
  T: "任务",
  A: "行动",
  R: "结果",
};

function evaluateStarEntry(entry: string) {
  const situation = hasPattern(entry, /在.+(?:期间|团队|公司|部门|项目)|面向|针对|基于|业务背景|应用场景|为了解决/);
  const task = hasPattern(entry, /负责|承担|主导|任务|目标|需求|职责|分工|协助/);
  const action = hasPattern(entry, /使用|采用|通过|设计|开发|实现|搭建|优化|分析|调研|推进|组织|完成|制定|测试|部署/);
  const quantifiedResult = hasPattern(entry, /\d+(?:\.\d+)?\s*(?:%|％|个|人|次|项|天|周|月|小时|万元|元|倍|名|家|篇|分|秒)/);
  const statedResult = hasPattern(entry, /提升|降低|增长|减少|节省|上线|落地|交付|获奖|达成|产出|转化|完成率|准确率|效率|结果/);
  const coverage: Record<StarKey, boolean> = { S: situation, T: task, A: action, R: quantifiedResult || statedResult };
  const score = (situation ? 25 : 0)
    + (task ? 25 : 0)
    + (action ? 25 : 0)
    + (quantifiedResult ? 25 : statedResult ? 16 : 0);
  return { coverage, score, quantifiedResult };
}

function scoreStarExperiences(
  key: "internships" | "projects",
  label: string,
  entries: string[],
): ResumeCompletenessDimension {
  if (!entries.length) {
    return { key, label, score: 0, reason: `尚未识别${label}。` };
  }

  const evaluations = entries.map(evaluateStarEntry);
  const score = clampScore(evaluations.reduce((sum, item) => sum + item.score, 0) / evaluations.length);
  const coveredCounts = (["S", "T", "A", "R"] as StarKey[]).reduce<Record<StarKey, number>>(
    (counts, starKey) => ({
      ...counts,
      [starKey]: evaluations.filter((item) => item.coverage[starKey]).length,
    }),
    { S: 0, T: 0, A: 0, R: 0 },
  );
  const averageCoverage = Object.values(coveredCounts).reduce((sum, value) => sum + value, 0) / entries.length;
  const quantifiedCount = evaluations.filter((item) => item.quantifiedResult).length;
  const weakest = (["S", "T", "A", "R"] as StarKey[])
    .filter((starKey) => coveredCounts[starKey] < entries.length)
    .map((starKey) => STAR_LABELS[starKey]);

  return {
    key,
    label,
    score,
    reason: `${entries.length} 段经历平均覆盖 ${averageCoverage.toFixed(1)}/4 个 STAR 要素，${quantifiedCount} 段含量化结果${weakest.length ? `；${weakest.join("、")}仍可加强。` : "，结构完整。"}`,
  };
}

function scoreSkills(resume: StructuredResume): ResumeCompletenessDimension {
  const skills = resume.skills.map((item) => item.trim()).filter(Boolean);
  if (!skills.length) {
    return { key: "skills", label: "专业技能", score: 0, reason: "尚未识别专业技能。" };
  }

  const content = skills.join(" ");
  const hasLevel = hasPattern(content, /精通|熟练|掌握|了解|使用|具备|\d+\s*年/);
  const hasCategoryDepth = skills.length >= 5;
  const score = clampScore(28 + Math.min(skills.length, 7) * 8 + (hasLevel ? 10 : 0) + (hasCategoryDepth ? 6 : 0));

  return {
    key: "skills",
    label: "专业技能",
    score,
    reason: `已识别 ${skills.length} 项技能${hasLevel ? "，包含熟练度或使用说明。" : "；建议补充熟练度和应用场景。"}`,
  };
}

function scoreHonors(resume: StructuredResume): ResumeCompletenessDimension {
  const honors = resume.honors.map((item) => item.trim()).filter(Boolean);
  if (!honors.length) {
    return { key: "honors", label: "获奖与证书", score: 0, reason: "尚未识别获奖或证书信息。" };
  }

  const content = honors.join(" ");
  const hasDate = hasPattern(content, /(?:19|20)\d{2}|\d{1,2}\s*月/);
  const hasLevel = hasPattern(content, /国家级|省级|市级|校级|院级|一等奖|二等奖|三等奖|前\s*\d+|第\s*\d+|认证|证书/);
  const score = clampScore(35 + Math.min(honors.length, 3) * 15 + (hasDate ? 10 : 0) + (hasLevel ? 10 : 0));

  return {
    key: "honors",
    label: "获奖与证书",
    score,
    reason: `已识别 ${honors.length} 项记录${hasDate ? "，包含时间" : ""}${hasLevel ? "，包含级别或证书说明" : "；建议补充时间和奖项级别"}。`,
  };
}

function buildPortrait(resume: StructuredResume, dimensions: ResumeCompletenessDimension[]) {
  const name = resume.name.trim() || "该学生";
  const education = compactText(resume.education[0] || "");
  const targets = resume.targetRoles.map((item) => compactText(item, 30)).filter(Boolean).slice(0, 3);
  const skills = resume.skills.map((item) => compactText(item, 24)).filter(Boolean).slice(0, 5);
  const summary = compactText(resume.summary, 150);
  const facts = summary || [
    education ? `具有${education}背景` : "教育背景尚待补充",
    targets.length ? `求职方向聚焦于${targets.join("、")}` : "求职方向尚未明确",
    skills.length ? `简历呈现了${skills.join("、")}等技能` : "专业技能信息仍较有限",
  ].join("，");
  const experienceParts = [
    resume.internships.length ? `${resume.internships.length} 段实习` : "",
    resume.projects.length ? `${resume.projects.length} 段项目` : "",
  ].filter(Boolean);
  const ranked = [...dimensions].sort((left, right) => right.score - left.score);
  const strongest = ranked.filter((item) => item.score >= 70).slice(0, 2).map((item) => item.label);
  const weakest = [...dimensions].sort((left, right) => left.score - right.score).filter((item) => item.score < 60).slice(0, 2).map((item) => item.label);
  const evidence = experienceParts.length ? `当前材料包含${experienceParts.join("和")}经历` : "当前材料尚未形成明确的实习或项目证据";
  const diagnosis = strongest.length
    ? `${strongest.join("、")}的信息呈现相对充分`
    : "当前各部分信息仍有较大完善空间";
  const action = weakest.length ? `建议优先完善${weakest.join("、")}` : "各核心维度已得到较完整呈现";

  return `${name}：${facts}。${evidence}，${diagnosis}；${action}。`;
}

export function analyzeResumeProfile(resume: StructuredResume | null, resumeText: string): ResumeProfileAnalysis {
  if (!resume) {
    return {
      portrait: resumeText.trim() ? "简历文本已经载入，完成模型解析后将在这里生成人物画像与完整度诊断。" : "上传并解析简历后，这里将根据简历事实生成人物画像。",
      overallScore: 0,
      dimensions: [
        { key: "basic", label: "基本信息", score: 0, reason: "等待解析。" },
        { key: "education", label: "教育经历", score: 0, reason: "等待解析。" },
        { key: "internships", label: "实习经历", score: 0, reason: "等待解析。" },
        { key: "projects", label: "项目经历", score: 0, reason: "等待解析。" },
        { key: "skills", label: "专业技能", score: 0, reason: "等待解析。" },
        { key: "honors", label: "获奖与证书", score: 0, reason: "等待解析。" },
      ],
    };
  }

  const dimensions = [
    scoreBasicInformation(resume, resumeText),
    scoreEducation(resume),
    scoreStarExperiences("internships", "实习经历", resume.internships),
    scoreStarExperiences("projects", "项目经历", resume.projects),
    scoreSkills(resume),
    scoreHonors(resume),
  ];
  const overallScore = clampScore(dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length);

  return {
    portrait: buildPortrait(resume, dimensions),
    overallScore,
    dimensions,
  };
}
