import type { Job } from "./data";

const keywordBank = [
  "SQL",
  "Python",
  "JavaScript",
  "React",
  "TypeScript",
  "CSS",
  "用户研究",
  "原型设计",
  "需求分析",
  "数据分析",
  "数据复盘",
  "增长分析",
  "用户分层",
  "A/B 测试",
  "报表",
  "活动运营",
  "内容运营",
  "沟通协调",
  "候选人体验",
  "AI 工具",
  "AI 产品",
  "工程化",
  "性能优化",
  "组件化",
];

const inferTrack = (text: string) => {
  if (/前端|研发|React|JavaScript|TypeScript|工程化/i.test(text)) return "研发";
  if (/数据|SQL|Python|增长|分析|报表/i.test(text)) return "数据";
  if (/运营|活动|内容|用户增长/i.test(text)) return "运营";
  if (/招聘|候选人|HR|人力/i.test(text)) return "HR";
  return "产品";
};

const inferCity = (text: string) => {
  const cities = ["深圳", "广州", "上海", "北京", "杭州", "成都", "武汉"];
  return cities.find((city) => text.includes(city)) ?? "待确认";
};

const inferTitle = (title: string, text: string) => {
  if (title.trim()) return title.trim();
  const titleLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /实习|岗位|工程师|产品|运营|分析/.test(line));
  return titleLine || "自定义岗位";
};

const extractLines = (text: string, fallback: string[]) => {
  const lines = text
    .split(/\r?\n|；|。/)
    .map((line) => line.replace(/^[-*•\d.、\s]+/, "").trim())
    .filter((line) => line.length >= 8);
  return lines.slice(0, 3).length ? lines.slice(0, 3) : fallback;
};

export function parseCustomJob(title: string, jdText: string): Job | null {
  const text = jdText.trim();
  if (text.length < 20) return null;

  const keywords = keywordBank.filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  const track = inferTrack(text);

  return {
    id: "custom-jd",
    title: inferTitle(title, text),
    track,
    city: inferCity(text),
    level: /实习/.test(text) ? "实习" : "岗位",
    companyScenario: "自定义岗位 JD",
    summary: text.slice(0, 86) + (text.length > 86 ? "..." : ""),
    responsibilities: extractLines(text, ["理解岗位职责并拆解核心任务", "结合简历经历寻找可证明的能力证据", "准备与岗位要求相关的项目表达"]),
    requirements: extractLines(text, ["补齐岗位关键词", "突出项目经历中的行动与结果", "说明求职动机与岗位方向的关联"]),
    bonus: keywords.slice(0, 3).length ? keywords.slice(0, 3).map((keyword) => `简历中能清晰呈现 ${keyword}`) : ["有相关项目经历", "能提供量化结果", "表达清晰且结构完整"],
    keywords: keywords.length ? keywords : ["需求分析", "数据分析", "沟通协调", "项目复盘", "AI 工具"],
    priority: "高",
  };
}

