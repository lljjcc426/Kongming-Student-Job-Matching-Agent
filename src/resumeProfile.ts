import { studentProfile, type StudentProfile } from "./data";

const skillDictionary = [
  "Python",
  "SQL",
  "JavaScript",
  "TypeScript",
  "React",
  "Vue",
  "Java",
  "C++",
  "Excel",
  "Power BI",
  "Tableau",
  "Figma",
  "Axure",
  "用户研究",
  "需求分析",
  "原型设计",
  "数据分析",
  "增长分析",
  "A/B 测试",
  "内容运营",
  "活动运营",
  "项目管理",
  "机器学习",
  "AIGC",
  "Prompt",
];

const trackDictionary = [
  "产品",
  "数据",
  "运营",
  "前端",
  "后端",
  "算法",
  "测试",
  "设计",
  "人力",
  "市场",
  "销售",
];

const cityDictionary = ["深圳", "广州", "上海", "北京", "杭州", "成都", "武汉", "南京", "远程"];

const sectionHints = ["项目", "实习", "经历", "竞赛", "实践", "工作"];

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const includesLoose = (source: string, keyword: string) =>
  source.toLowerCase().includes(keyword.toLowerCase().replace(/\s+/g, " "));

const getLines = (resumeText: string) =>
  resumeText
    .split(/\r?\n|。|；|;/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4);

const inferGrade = (resumeText: string) => {
  const match = resumeText.match(/大[一二三四]|研[一二三]|硕士|本科|博士|应届|毕业/);
  return match?.[0] ?? "学生";
};

const inferMajor = (resumeText: string) => {
  const match = resumeText.match(/([\u4e00-\u9fa5A-Za-z]{2,24}(?:专业|学院|方向))/);
  return match?.[1]?.replace(/学院$/, "") ?? studentProfile.major;
};

const inferSchool = (resumeText: string) => {
  const match = resumeText.match(/([\u4e00-\u9fa5A-Za-z]{2,24}(?:大学|学院|学校))/);
  return match?.[1] ?? "待识别院校";
};

const inferSkills = (resumeText: string) => {
  const hits = skillDictionary.filter((skill) => includesLoose(resumeText, skill));
  return unique(hits).slice(0, 12);
};

const inferInterests = (resumeText: string, skills: string[]) => {
  const tracks = trackDictionary.filter((track) => resumeText.includes(track));
  const skillTracks = skills.includes("SQL") || skills.includes("Python") ? ["数据"] : [];
  return unique([...tracks, ...skillTracks]).slice(0, 6);
};

const inferCities = (resumeText: string) => {
  const hits = cityDictionary.filter((city) => resumeText.includes(city));
  return hits.length ? hits : studentProfile.cityPreference;
};

const inferExperiences = (resumeText: string, skills: string[]): StudentProfile["experiences"] => {
  const lines = getLines(resumeText);
  const picked = lines
    .filter((line) => sectionHints.some((hint) => line.includes(hint)) || /\d+%|\d+人|\d+次|\d+万/.test(line))
    .slice(0, 3);

  if (picked.length === 0) {
    return [
      {
        title: "简历经历待补充",
        role: "候选人",
        evidence: resumeText.slice(0, 120) || "尚未上传或粘贴有效简历内容。",
        tags: skills.slice(0, 4),
      },
    ];
  }

  return picked.map((line, index) => ({
    title: line.slice(0, 22),
    role: index === 0 ? "核心经历" : "相关经历",
    evidence: line.slice(0, 160),
    tags: skills.filter((skill) => includesLoose(line, skill)).slice(0, 5),
  }));
};

const inferTarget = (resumeText: string, interests: string[]) => {
  const targetMatch = resumeText.match(/(?:求职意向|目标岗位|应聘岗位|意向岗位)[:：\s]*([^\n。；;]{2,40})/);
  if (targetMatch?.[1]) return targetMatch[1].trim();
  if (interests.length) return `${interests.slice(0, 3).join(" / ")}方向`;
  return studentProfile.target;
};

export function buildProfileFromResume(resumeText: string): StudentProfile {
  const normalized = resumeText.trim();
  if (!normalized) {
    return {
      ...studentProfile,
      name: "待识别候选人",
      school: "待识别院校",
      grade: "待识别阶段",
      major: "待识别专业",
      target: "待识别求职方向",
      skills: [],
      interests: [],
      experiences: [],
      resumeText: "",
    };
  }

  const skills = inferSkills(normalized);
  const interests = inferInterests(normalized, skills);

  return {
    ...studentProfile,
    name: "候选人",
    school: inferSchool(normalized),
    grade: inferGrade(normalized),
    major: inferMajor(normalized),
    target: inferTarget(normalized, interests),
    cityPreference: inferCities(normalized),
    skills,
    interests,
    experiences: inferExperiences(normalized, skills),
    resumeText: normalized,
  };
}

export function summarizeResumeProfile(profile: StudentProfile) {
  return [
    profile.school,
    profile.grade,
    profile.major,
    profile.target,
    profile.skills.length ? `${profile.skills.length} 个能力信号` : "能力信号待补充",
    profile.experiences.length ? `${profile.experiences.length} 段经历证据` : "经历证据待补充",
  ].filter(Boolean);
}
