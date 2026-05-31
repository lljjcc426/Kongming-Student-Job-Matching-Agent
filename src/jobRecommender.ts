import type { Job, StudentProfile } from "./data";

type JobTemplate = Omit<Job, "id" | "priority"> & {
  id: string;
  signals: string[];
};

const templates: JobTemplate[] = [
  {
    id: "frontend",
    title: "前端开发实习生",
    track: "研发",
    city: "深圳",
    level: "实习",
    companyScenario: "Web 应用与效率工具",
    summary: "参与 Web 页面、组件库和业务工具开发，优化交互体验和前端性能。",
    responsibilities: ["实现页面和业务组件", "与产品设计协作还原交互", "参与性能优化和工程化建设"],
    requirements: ["熟悉 JavaScript、CSS", "了解 React 或 Vue", "具备基础工程化意识"],
    bonus: ["有完整 Web 项目", "了解 TypeScript", "关注可访问性和性能"],
    keywords: ["JavaScript", "TypeScript", "React", "Vue", "CSS", "组件化", "工程化", "性能优化"],
    signals: ["JavaScript", "TypeScript", "React", "Vue", "CSS", "前端", "Web"],
  },
  {
    id: "backend",
    title: "后端开发实习生",
    track: "研发",
    city: "北京",
    level: "实习",
    companyScenario: "业务平台与数据服务",
    summary: "参与服务端接口、数据模型和业务系统开发，关注稳定性与可维护性。",
    responsibilities: ["开发业务接口", "设计数据表和服务逻辑", "参与问题排查和性能优化"],
    requirements: ["熟悉 Java、Go、Python 之一", "理解数据库和接口设计", "具备基础算法和工程习惯"],
    bonus: ["有后端项目或开源经历", "了解缓存和消息队列", "能写清晰技术文档"],
    keywords: ["Java", "Go", "Python", "数据库", "接口", "后端", "服务端", "缓存"],
    signals: ["Java", "Go", "Python", "后端", "数据库", "Spring", "服务端"],
  },
  {
    id: "data-analyst",
    title: "数据分析实习生",
    track: "数据",
    city: "上海",
    level: "实习",
    companyScenario: "业务分析与经营看板",
    summary: "支持指标体系、数据看板、专题分析和业务复盘，输出可执行建议。",
    responsibilities: ["清洗和分析业务数据", "搭建指标看板", "输出专题分析报告"],
    requirements: ["熟悉 SQL 或 Python", "具备统计和业务理解能力", "表达结构清晰"],
    bonus: ["有建模、竞赛或 BI 项目", "了解 A/B 测试", "能沉淀分析方法"],
    keywords: ["SQL", "Python", "数据分析", "统计", "指标", "看板", "A/B 测试", "BI"],
    signals: ["SQL", "Python", "数据分析", "统计", "建模", "Tableau", "Power BI", "Excel"],
  },
  {
    id: "algorithm",
    title: "算法实习生",
    track: "算法",
    city: "北京",
    level: "实习",
    companyScenario: "推荐、搜索与机器学习",
    summary: "参与数据处理、模型训练、效果评估和算法策略迭代。",
    responsibilities: ["处理训练数据", "实现和评估模型", "分析实验结果并优化策略"],
    requirements: ["具备机器学习基础", "熟悉 Python", "理解常见模型评估指标"],
    bonus: ["有论文、竞赛或模型项目", "熟悉 PyTorch 或 TensorFlow", "了解推荐或 NLP"],
    keywords: ["机器学习", "深度学习", "Python", "PyTorch", "NLP", "推荐", "模型评估"],
    signals: ["机器学习", "深度学习", "PyTorch", "TensorFlow", "NLP", "算法", "模型"],
  },
  {
    id: "product",
    title: "产品经理实习生",
    track: "产品",
    city: "深圳",
    level: "实习",
    companyScenario: "用户产品与平台工具",
    summary: "参与需求分析、用户研究、原型设计和上线复盘。",
    responsibilities: ["调研用户和业务需求", "输出原型和需求文档", "跟进上线并复盘指标"],
    requirements: ["逻辑清晰", "熟悉原型工具", "能用数据验证判断"],
    bonus: ["有产品项目", "了解 SQL 或数据分析", "关注 AI 工具体验"],
    keywords: ["用户研究", "需求分析", "原型设计", "数据分析", "SQL", "产品复盘", "Figma"],
    signals: ["产品", "用户研究", "需求分析", "原型设计", "Axure", "Figma", "PRD"],
  },
  {
    id: "ux",
    title: "用户体验设计实习生",
    track: "设计",
    city: "杭州",
    level: "实习",
    companyScenario: "产品体验与设计系统",
    summary: "参与用户研究、交互方案、视觉规范和设计系统维护。",
    responsibilities: ["梳理用户场景", "产出交互和视觉稿", "参与可用性评估"],
    requirements: ["熟悉 Figma", "具备交互和视觉基础", "有作品集"],
    bonus: ["有设计系统经验", "能做用户访谈", "了解前端实现边界"],
    keywords: ["Figma", "交互设计", "用户研究", "视觉设计", "作品集", "可用性"],
    signals: ["Figma", "设计", "交互", "视觉", "作品集", "用户体验"],
  },
  {
    id: "content-ops",
    title: "内容运营实习生",
    track: "运营",
    city: "广州",
    level: "实习",
    companyScenario: "内容社区与用户增长",
    summary: "支持内容策划、活动运营、用户增长和数据复盘。",
    responsibilities: ["策划内容选题", "执行活动和用户触达", "复盘数据并优化策略"],
    requirements: ["表达能力好", "理解用户和内容平台", "具备数据意识"],
    bonus: ["有新媒体或社群经验", "会做数据复盘", "有校园活动经历"],
    keywords: ["内容运营", "活动运营", "用户增长", "社群", "数据复盘", "选题"],
    signals: ["内容运营", "活动运营", "社群", "新媒体", "用户增长", "运营"],
  },
  {
    id: "marketing",
    title: "市场营销实习生",
    track: "市场",
    city: "上海",
    level: "实习",
    companyScenario: "品牌传播与增长活动",
    summary: "参与市场调研、品牌传播、活动策划和投放数据分析。",
    responsibilities: ["支持市场调研", "执行传播活动", "整理投放和转化数据"],
    requirements: ["沟通表达清晰", "有内容策划能力", "具备基础数据分析意识"],
    bonus: ["有品牌或活动项目", "会使用 Excel 或 BI 工具", "了解社媒平台"],
    keywords: ["市场调研", "品牌传播", "活动策划", "投放", "数据分析", "社媒"],
    signals: ["市场", "营销", "品牌", "传播", "投放", "社媒"],
  },
  {
    id: "finance",
    title: "财务分析实习生",
    track: "财务",
    city: "北京",
    level: "实习",
    companyScenario: "经营分析与预算管理",
    summary: "支持预算、成本、收入和经营指标分析，协助输出财务洞察。",
    responsibilities: ["整理财务数据", "支持预算和成本分析", "输出经营分析材料"],
    requirements: ["财务或会计基础扎实", "熟悉 Excel", "具备严谨的数据处理能力"],
    bonus: ["了解 SQL 或 BI", "有财务建模经验", "表达准确"],
    keywords: ["财务", "会计", "预算", "成本", "Excel", "经营分析", "财务建模"],
    signals: ["财务", "会计", "审计", "预算", "Excel", "金融"],
  },
  {
    id: "legal",
    title: "法务实习生",
    track: "法务",
    city: "深圳",
    level: "实习",
    companyScenario: "合同、合规与知识产权",
    summary: "支持合同审阅、法律检索、合规材料整理和风险提示。",
    responsibilities: ["整理合同和法律文件", "进行法律检索", "协助输出风险提示"],
    requirements: ["法学基础扎实", "检索和写作能力好", "严谨细致"],
    bonus: ["通过相关考试或有律所实践", "了解互联网合规", "英文阅读能力好"],
    keywords: ["法学", "合同", "合规", "法律检索", "知识产权", "风险"],
    signals: ["法学", "法律", "合同", "合规", "知识产权", "律所"],
  },
  {
    id: "hr",
    title: "人力资源实习生",
    track: "人力",
    city: "上海",
    level: "实习",
    companyScenario: "招聘、员工体验与组织支持",
    summary: "支持招聘流程、候选人沟通、活动组织和人力数据整理。",
    responsibilities: ["维护招聘流程", "沟通候选人和业务团队", "整理招聘与员工体验数据"],
    requirements: ["沟通协调能力好", "细致负责", "具备基础数据整理能力"],
    bonus: ["有学生组织或活动经历", "了解招聘流程", "能使用 AI 工具提升效率"],
    keywords: ["招聘", "候选人", "沟通协调", "活动组织", "数据整理", "员工体验"],
    signals: ["人力", "HR", "招聘", "候选人", "员工", "组织"],
  },
  {
    id: "business-analysis",
    title: "商业分析实习生",
    track: "商业分析",
    city: "杭州",
    level: "实习",
    companyScenario: "行业研究与策略分析",
    summary: "参与行业研究、竞品分析、用户洞察和业务策略建议。",
    responsibilities: ["收集行业和竞品信息", "分析业务数据和用户反馈", "输出策略建议"],
    requirements: ["结构化思考能力强", "会做数据分析", "表达和文档能力好"],
    bonus: ["有咨询、商赛或研究项目", "熟悉 Excel、SQL 或 Python", "能独立拆解问题"],
    keywords: ["商业分析", "行业研究", "竞品分析", "策略", "数据分析", "用户洞察"],
    signals: ["商业分析", "咨询", "商赛", "策略", "行业研究", "竞品"],
  },
];

const textHas = (text: string, signal: string) => text.toLowerCase().includes(signal.toLowerCase());

const scoreTemplate = (template: JobTemplate, profile: StudentProfile, resumeText: string) => {
  const profileText = [
    profile.major,
    profile.target,
    ...profile.skills,
    ...profile.interests,
    ...profile.experiences.flatMap((item) => [item.title, item.role, item.evidence, ...item.tags]),
    resumeText,
  ].join(" ");
  const signalHits = template.signals.filter((signal) => textHas(profileText, signal)).length;
  const keywordHits = template.keywords.filter((keyword) => textHas(profileText, keyword)).length;
  const trackHit = textHas(profileText, template.track) ? 2 : 0;
  return signalHits * 10 + keywordHits * 7 + trackHit;
};

export function recommendJobs(profile: StudentProfile, resumeText: string, customJob: Job | null): Job[] {
  const scored = templates
    .map((template) => ({
      score: scoreTemplate(template, profile, resumeText),
      template,
    }))
    .sort((left, right) => right.score - left.score);

  const selected = scored.filter((item) => item.score > 0).slice(0, 8);
  const fallback = scored.slice(0, 6);
  const base = selected.length ? selected : fallback;
  const generated = base.map(({ score, template }) => ({
    ...template,
    id: `recommended-${template.id}`,
    priority: score >= 35 ? "高" : score >= 18 ? "中" : "低",
  })) satisfies Job[];

  return customJob ? [customJob, ...generated] : generated;
}
