export type StudentProfile = {
  name: string;
  grade: string;
  major: string;
  school: string;
  target: string;
  cityPreference: string[];
  skills: string[];
  interests: string[];
  experiences: Array<{
    title: string;
    role: string;
    evidence: string;
    tags: string[];
  }>;
  resumeText: string;
};

export type Job = {
  id: string;
  title: string;
  track: string;
  city: string;
  level: string;
  companyScenario: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  bonus: string[];
  keywords: string[];
  priority: "高" | "中" | "低";
};

export const studentProfile: StudentProfile = {
  name: "林同学",
  grade: "大三",
  major: "信息管理与信息系统",
  school: "华南某高校",
  target: "产品经理 / 数据产品 / 用户增长",
  cityPreference: ["深圳", "广州", "上海"],
  skills: ["用户研究", "SQL", "Python", "数据分析", "原型设计", "AIGC", "增长分析"],
  interests: ["互联网产品", "校园服务", "内容社区", "AI 工具"],
  experiences: [
    {
      title: "校园二手交易小程序",
      role: "产品负责人",
      evidence: "完成 26 名学生访谈、信息架构设计、原型评审和上线后数据复盘，推动月活提升 38%。",
      tags: ["用户研究", "原型设计", "数据复盘", "需求分析"],
    },
    {
      title: "省级数据分析竞赛",
      role: "建模与分析",
      evidence: "使用 Python 与 SQL 清洗行为数据，构建用户分层模型并输出运营策略建议，获得二等奖。",
      tags: ["Python", "SQL", "数据分析", "用户分层"],
    },
    {
      title: "互联网运营实习",
      role: "增长运营实习生",
      evidence: "参与活动转化漏斗分析，沉淀日报模板和 A/B 测试记录，支持运营复盘。",
      tags: ["增长分析", "运营", "A/B 测试", "报表"],
    },
  ],
  resumeText:
    "信息管理与信息系统专业，大三。掌握 SQL、Python、Axure、Figma，具备用户研究、数据分析和原型设计经验。曾负责校园二手交易小程序，从需求访谈到原型设计再到上线复盘，推动月活提升 38%。获得省级数据分析竞赛二等奖，曾在互联网公司运营岗位实习，参与活动转化分析和用户分层。",
};

export const jobs: Job[] = [
  {
    id: "pm-intern",
    title: "产品经理实习生",
    track: "产品",
    city: "深圳",
    level: "实习",
    companyScenario: "校园与内容产品",
    summary: "参与校园与内容产品方向的需求分析、用户研究、原型设计和数据复盘。",
    responsibilities: ["收集和分析用户需求", "输出产品原型与需求文档", "跟进研发上线并复盘核心指标"],
    requirements: ["具备用户研究和逻辑分析能力", "熟悉原型工具", "能够使用数据验证产品判断"],
    bonus: ["有校园产品或内容社区项目经验", "熟悉 SQL 或数据分析工具", "关注 AI 产品体验"],
    keywords: ["用户研究", "原型设计", "数据分析", "SQL", "需求分析", "产品复盘", "AI 产品"],
    priority: "高",
  },
  {
    id: "data-ops",
    title: "数据运营实习生",
    track: "运营",
    city: "广州",
    level: "实习",
    companyScenario: "用户增长与活动运营",
    summary: "负责活动数据监控、用户分层分析、运营策略复盘和日常报表建设。",
    responsibilities: ["搭建运营数据看板", "分析活动转化漏斗", "输出用户分层与增长建议"],
    requirements: ["熟练使用 SQL 或 Python", "具备数据敏感度", "能够将分析结论转化为运营动作"],
    bonus: ["有 A/B 测试经验", "有增长分析或校园运营经验", "表达清晰，能沉淀方法论"],
    keywords: ["SQL", "Python", "数据分析", "增长分析", "A/B 测试", "用户分层", "报表"],
    priority: "高",
  },
  {
    id: "frontend",
    title: "前端开发实习生",
    track: "研发",
    city: "深圳",
    level: "实习",
    companyScenario: "Web 工具平台",
    summary: "参与 Web 工具平台前端开发，负责组件实现、交互优化和性能体验。",
    responsibilities: ["实现业务组件和页面", "与产品设计协作优化交互体验", "参与前端工程化和性能优化"],
    requirements: ["熟悉 HTML、CSS、JavaScript", "了解 React 或 Vue", "具备基础工程化意识"],
    bonus: ["有完整 Web 项目经验", "关注可访问性和性能优化", "了解 TypeScript"],
    keywords: ["JavaScript", "React", "TypeScript", "CSS", "组件化", "工程化", "性能优化"],
    priority: "中",
  },
  {
    id: "hr-campus",
    title: "校园招聘运营实习生",
    track: "HR",
    city: "上海",
    level: "实习",
    companyScenario: "校园招聘项目运营",
    summary: "支持校园招聘项目运营、学生触达、活动策划和招聘数据分析。",
    responsibilities: ["维护校园招聘活动节奏", "分析学生触达和转化数据", "协同业务部门提升候选人体验"],
    requirements: ["沟通协调能力强", "具备数据整理和活动运营能力", "对校园招聘有兴趣"],
    bonus: ["有学生组织或校园活动经验", "熟悉内容运营", "能使用 AI 工具提升效率"],
    keywords: ["校园招聘", "活动运营", "数据整理", "候选人体验", "沟通协调", "AI 工具"],
    priority: "中",
  },
];
