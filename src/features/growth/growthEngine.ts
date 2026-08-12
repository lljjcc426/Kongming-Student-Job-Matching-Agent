import type { Job, StudentProfile } from "../../data";
import type { MatchResult } from "../../matchEngine";
import type {
  GrowthAdaptation,
  GrowthGap,
  GrowthPlan,
  GrowthRecommendation,
  GrowthResource,
  GrowthStage,
  GrowthStageDays,
  GrowthTask,
  GrowthTaskKind,
  InterviewGrowthSnapshot,
} from "./types";

type GrowthPlanInput = {
  profile: StudentProfile;
  job: Job;
  matchResult: MatchResult;
  interview: InterviewGrowthSnapshot;
  targetDate?: string;
  previousPlan?: GrowthPlan;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const slug = (value: string) => value.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "growth";
const DAY_MS = 86_400_000;
const MIN_PLANNING_DAYS = 7;
const MAX_PLANNING_DAYS = 365;

type GrowthSchedule = {
  startDate: string;
  targetDate: string;
  totalDays: number;
  totalWeeks: number;
  stageEnds: number[];
};

const dateString = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const parseLocalDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dateString(date) === value ? date : null;
};

export const growthDateAfterDays = (days: number, from = new Date()) => {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + days);
  return dateString(date);
};

const scheduleFor = (targetDate = growthDateAfterDays(90)): GrowthSchedule => {
  const startDate = dateString(new Date());
  const start = parseLocalDate(startDate)!;
  const target = parseLocalDate(targetDate);
  if (!target) throw new Error("目标日期格式不正确。");
  const totalDays = Math.round((target.getTime() - start.getTime()) / DAY_MS);
  if (totalDays < MIN_PLANNING_DAYS) throw new Error("目标日期至少需要设置在 7 天后。");
  if (totalDays > MAX_PLANNING_DAYS) throw new Error("成长计划最长支持 365 天，请缩短目标周期。");
  const stageCount = totalDays < 21 ? 2 : 3;
  const stageEnds = Array.from({ length: stageCount }, (_, index) => (
    index === stageCount - 1 ? totalDays : Math.max(1, Math.round((totalDays * (index + 1)) / stageCount))
  ));
  return {
    startDate,
    targetDate,
    totalDays,
    totalWeeks: Math.max(1, Math.ceil(totalDays / 7)),
    stageEnds,
  };
};

const dateAtScheduleDay = (schedule: GrowthSchedule, day: number) => {
  const start = parseLocalDate(schedule.startDate)!;
  start.setDate(start.getDate() + Math.max(1, day));
  return dateString(start);
};

const resourceCatalog: Array<{ pattern: RegExp; resources: GrowthResource[] }> = [
  {
    pattern: /用户研究|问卷|访谈|可用性|ux|调研/i,
    resources: [
      {
        title: "Google UX Design Professional Certificate",
        provider: "Google Career Certificates · Coursera",
        type: "course",
        url: "https://www.coursera.org/professional-certificates/google-ux-design/",
        note: "重点学习研究计划、用户访谈、可用性测试和研究结论综合，并沉淀作品集证据。",
      },
      {
        title: "用户研究中文课程检索",
        provider: "哔哩哔哩",
        type: "course",
        url: "https://search.bilibili.com/all?keyword=%E7%94%A8%E6%88%B7%E7%A0%94%E7%A9%B6%20%E8%AF%BE%E7%A8%8B",
        note: "结合播放列表、发布时间和评论筛选课程，完成访谈提纲与研究报告练习。",
      },
    ],
  },
  {
    pattern: /python|爬虫|脚本|自动化/i,
    resources: [
      {
        title: "Python 官方教程",
        provider: "Python Software Foundation",
        type: "documentation",
        url: "https://docs.python.org/zh-cn/3/tutorial/",
        note: "按章节完成练习，并保留可运行代码作为证据。",
      },
      {
        title: "聪明办法学 Python 第二版",
        provider: "Datawhale",
        type: "course",
        url: "https://datawhalechina.github.io/learn-python-the-smart-way-v2/",
        note: "使用中文课程、课后练习和直播录像建立面向AI开发的Python基础。",
      },
      {
        title: "Python 3 教程",
        provider: "菜鸟教程",
        type: "course",
        url: "https://www.runoob.com/python3/python3-tutorial.html",
        note: "用于快速查漏补缺和在线练习，成果以代码仓库为准。",
      },
      {
        title: "聪明办法学 Python 配套视频",
        provider: "哔哩哔哩 · Datawhale",
        type: "course",
        url: "https://www.bilibili.com/video/BV1bh4y1w7Co/",
        note: "配合Datawhale图文课程学习，并提交章节练习。",
      },
    ],
  },
  {
    pattern: /rag|检索增强|向量数据库|embedding|向量检索/i,
    resources: [
      {
        title: "All-in-RAG 技术全栈指南",
        provider: "Datawhale",
        type: "course",
        url: "https://datawhalechina.github.io/all-in-rag/",
        note: "覆盖数据处理、索引、混合检索、生成和评估，适合形成完整项目证据。",
      },
      {
        title: "Hugging Face LLM Course",
        provider: "Hugging Face",
        type: "course",
        url: "https://huggingface.co/learn/llm-course/zh-CN/chapter1/1",
        note: "补充Transformer、NLP工具链与模型应用基础。",
      },
      {
        title: "RAG 中文实战视频检索",
        provider: "哔哩哔哩",
        type: "course",
        url: "https://search.bilibili.com/all?keyword=Datawhale%20RAG%20%E6%95%99%E7%A8%8B",
        note: "优先选择包含代码仓库、数据集和评估过程的完整系列。",
      },
    ],
  },
  {
    pattern: /大模型|llm|nlp|transformer|自然语言处理|智能体|agent/i,
    resources: [
      {
        title: "Hugging Face LLM Course",
        provider: "Hugging Face",
        type: "course",
        url: "https://huggingface.co/learn/llm-course/zh-CN/chapter1/1",
        note: "优先学习与岗位缺口相关章节，并完成一个可演示实验。",
      },
      {
        title: "Happy-LLM：从零开始构建大模型",
        provider: "Datawhale",
        type: "course",
        url: "https://datawhalechina.github.io/happy-llm/",
        note: "使用中文材料理解模型原理、训练流程和RAG、Agent应用。",
      },
      {
        title: "大模型中文课程检索",
        provider: "哔哩哔哩",
        type: "course",
        url: "https://search.bilibili.com/all?keyword=Datawhale%20%E5%A4%A7%E6%A8%A1%E5%9E%8B%20%E8%AF%BE%E7%A8%8B",
        note: "优先选择Datawhale等开源社区发布且带配套代码的课程。",
      },
    ],
  },
  {
    pattern: /机器学习|深度学习|模型训练|算法|ai/i,
    resources: [
      {
        title: "机器学习速成课程",
        provider: "Google for Developers",
        type: "course",
        url: "https://developers.google.com/machine-learning/crash-course?hl=zh-cn",
        note: "学习核心概念并提交测验或实验结果。",
      },
      {
        title: "Datawhale AI学习路线",
        provider: "Datawhale",
        type: "course",
        url: "https://www.datawhale.cn/",
        note: "按机器学习、数据分析或NLP方向选择中文开源课程与组队学习。",
      },
      {
        title: "机器学习中文课程检索",
        provider: "哔哩哔哩",
        type: "course",
        url: "https://search.bilibili.com/all?keyword=Datawhale%20%E6%9C%BA%E5%99%A8%E5%AD%A6%E4%B9%A0%20%E8%AF%BE%E7%A8%8B",
        note: "选择有代码、作业和完整章节目录的课程并保留实验结果。",
      },
    ],
  },
  {
    pattern: /react|vue|前端|javascript|typescript|html|css|web/i,
    resources: [
      {
        title: "MDN Web 开发学习路径",
        provider: "MDN",
        type: "course",
        url: "https://developer.mozilla.org/zh-CN/docs/Learn_web_development",
        note: "完成对应模块与技能测试，并发布一个可访问页面。",
      },
      {
        title: "Web前端基础教程",
        provider: "菜鸟教程",
        type: "course",
        url: "https://www.runoob.com/html/html-tutorial.html",
        note: "快速补齐HTML、CSS和JavaScript基础，并以页面作品验收。",
      },
      {
        title: "前端系统课程检索",
        provider: "哔哩哔哩",
        type: "course",
        url: "https://search.bilibili.com/all?keyword=%E5%89%8D%E7%AB%AF%20%E7%B3%BB%E7%BB%9F%E8%AF%BE%E7%A8%8B%20%E9%A1%B9%E7%9B%AE%E5%AE%9E%E6%88%98",
        note: "选择含完整项目、源码和部署章节的系列课程。",
      },
    ],
  },
  {
    pattern: /sql|数据库|数据分析|数据开发/i,
    resources: [
      {
        title: "PostgreSQL 官方教程",
        provider: "PostgreSQL",
        type: "documentation",
        url: "https://www.postgresql.org/docs/current/tutorial.html",
        note: "完成查询、聚合与数据建模练习，保留 SQL 文件。",
      },
      {
        title: "SQL 教程",
        provider: "菜鸟教程",
        type: "course",
        url: "https://www.runoob.com/sql/sql-tutorial.html",
        note: "用于快速掌握SQL语法和在线练习，随后完成岗位相关数据分析案例。",
      },
      {
        title: "Wonderful SQL",
        provider: "Datawhale",
        type: "course",
        url: "https://github.com/datawhalechina/wonderful-sql",
        note: "通过中文组队学习材料完成SQL练习与数据分析任务。",
      },
    ],
  },
  {
    pattern: /docker|容器|部署|devops|云原生/i,
    resources: [
      {
        title: "Docker Get Started",
        provider: "Docker",
        type: "course",
        url: "https://docs.docker.com/get-started/",
        note: "将一个项目容器化并保存 Dockerfile 与运行截图。",
      },
      {
        title: "Docker 教程",
        provider: "菜鸟教程",
        type: "course",
        url: "https://www.runoob.com/docker/docker-tutorial.html",
        note: "使用中文示例补齐镜像、容器、Dockerfile和Compose基础。",
      },
      {
        title: "Docker项目实战视频检索",
        provider: "哔哩哔哩",
        type: "course",
        url: "https://search.bilibili.com/all?keyword=Docker%20%E9%A1%B9%E7%9B%AE%E5%AE%9E%E6%88%98%20%E9%83%A8%E7%BD%B2",
        note: "选择包含Dockerfile、Compose和真实部署过程的课程。",
      },
    ],
  },
  {
    pattern: /git|协作|版本控制/i,
    resources: [
      {
        title: "Pro Git 中文版",
        provider: "Git",
        type: "documentation",
        url: "https://git-scm.com/book/zh/v2",
        note: "使用分支、提交和合并完成一次规范协作记录。",
      },
      {
        title: "Git 教程",
        provider: "菜鸟教程",
        type: "course",
        url: "https://www.runoob.com/git/git-tutorial.html",
        note: "快速查阅常用命令，并用真实仓库提交记录作为学习证据。",
      },
    ],
  },
];

const coursesFor = (gapName: string): GrowthResource[] => resourceCatalog.find((item) => item.pattern.test(gapName))?.resources ?? [
  {
    title: `${gapName}中文课程检索`,
    provider: "哔哩哔哩",
    type: "course",
    url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${gapName} 系统课程`)}`,
    note: "优先选择有完整目录、配套资料和实践作业的课程，并记录来源。",
  },
  {
    title: `${gapName}开源学习资源`,
    provider: "Datawhale / 公开课程",
    type: "course",
    url: `https://www.bing.com/search?q=${encodeURIComponent(`site:datawhale.cn OR site:datawhalechina.github.io ${gapName} 课程`)}`,
    note: "优先选择开源社区、高校或技术厂商发布的材料。",
  },
];

const certificateFor = (job: Job, gapName: string): GrowthRecommendation => {
  const text = `${job.title} ${job.track} ${job.keywords.join(" ")} ${gapName}`;
  if (/云|docker|运维|devops|后端/i.test(text)) {
    return {
      id: "certificate-cloud",
      kind: "certificate",
      title: "云计算基础认证（按目标企业技术栈选考）",
      reason: "仅当岗位JD明确要求或学习预算允许时选考，项目交付证据优先。",
      url: "https://learn.microsoft.com/zh-cn/credentials/",
      provider: "Microsoft Learn",
    };
  }
  if (/数据|分析|sql|算法|ai|大模型/i.test(text)) {
    return {
      id: "certificate-data",
      kind: "certificate",
      title: "数据与AI技能凭证（非强制）",
      reason: "用于结构化检验知识掌握，不替代真实项目与岗位证据。",
      url: "https://learn.microsoft.com/zh-cn/credentials/",
      provider: "Microsoft Learn",
    };
  }
  return {
    id: "certificate-role",
    kind: "certificate",
    title: `${job.track || job.title}方向证书必要性核验`,
    reason: "先核对目标JD是否明确要求证书；没有要求时优先完成项目作品。",
    url: `https://www.bing.com/search?q=${encodeURIComponent(`${job.title} 官方 认证 证书`)}`,
    provider: "官方认证检索",
  };
};

const interviewGaps = (interview: InterviewGrowthSnapshot): GrowthGap[] => {
  const items = [
    ["表达与结构", interview.feedback.expression, "面试表达需要形成清晰的背景、行动和结果链路。"],
    ["岗位专业匹配", interview.feedback.professionalFit, "面试反馈显示岗位相关知识或证据仍需补强。"],
    ["逻辑与复盘", interview.feedback.logic, "回答需要加强问题拆解、验证过程和复盘结论。"],
  ] as const;
  return items
    .filter(([, score]) => score < 88)
    .sort((left, right) => left[1] - right[1])
    .slice(0, 2)
    .map(([name, score, reason]) => ({
      id: `interview-${slug(name)}`,
      name,
      source: "interview" as const,
      baselineScore: clamp(score),
      currentScore: clamp(score),
      targetScore: Math.max(85, clamp(score + 12)),
      reason,
    }));
};

const jobGaps = (matchResult: MatchResult): GrowthGap[] => {
  const ability = matchResult.dimensions.find((item) => item.name === "能力匹配")?.score ?? 60;
  return matchResult.missingKeywords.slice(0, 4).map((keyword, index) => ({
    id: `job-${slug(keyword)}-${index + 1}`,
    name: keyword,
    source: "job" as const,
    baselineScore: clamp(Math.min(ability, 48 + index * 4)),
    currentScore: clamp(Math.min(ability, 48 + index * 4)),
    targetScore: 82,
    reason: `目标岗位关键词中包含“${keyword}”，当前简历尚缺少可验证证据。`,
  }));
};

const buildGaps = (input: GrowthPlanInput) => {
  const gaps = [...jobGaps(input.matchResult), ...interviewGaps(input.interview)];
  if (gaps.length) return gaps.slice(0, 6);
  return [{
    id: "resume-evidence",
    name: "岗位证据表达",
    source: "resume" as const,
    baselineScore: input.matchResult.total,
    currentScore: input.matchResult.total,
    targetScore: Math.min(92, input.matchResult.total + 10),
    reason: "核心能力已基本覆盖，下一步重点是补充量化成果与可信项目证据。",
  }];
};

const task = (
  week: number,
  title: string,
  description: string,
  kind: GrowthTaskKind,
  gapIds: string[],
  evidenceRequirement: string,
  resources: GrowthResource[] = [],
  scoreGain = 1.2,
): GrowthTask => ({
  id: `week-${week}-${slug(title)}`,
  week,
  stageDays: 0,
  title,
  description,
  kind,
  priority: week === 1 ? "high" : week <= 4 ? "medium" : "normal",
  estimatedHours: kind === "project" ? 8 : kind === "course" ? 5 : 3,
  gapIds,
  evidenceRequirement,
  resources,
  scoreGain,
  completed: false,
  evidenceText: "",
  evidenceUrl: "",
  completedAt: null,
  dueDate: "",
});

const buildTaskTemplates = (gaps: GrowthGap[], job: Job, interview: InterviewGrowthSnapshot) => {
  const gapAt = (index: number) => gaps[index % gaps.length];
  const primary = gapAt(0);
  const secondary = gapAt(1);
  const tertiary = gapAt(2);
  const projectName = `${job.title}岗位能力验证项目`;
  const interviewWeakness = interview.feedback.improvements[0] || "补充岗位相关证据并使用 STAR 结构表达";
  return [
    task(1, `建立${primary.name}能力基线`, `完成${primary.name}核心知识梳理，并用一页笔记说明它在${job.title}中的使用场景。`, "course", [primary.id], "课程完成记录＋一页知识笔记", coursesFor(primary.name), 1.2),
    task(2, `补齐${secondary.name}基础`, `针对岗位要求学习${secondary.name}，完成至少两个练习或案例。`, "course", [secondary.id], "练习结果、代码仓库或案例文档", coursesFor(secondary.name), 1.2),
    task(3, `训练${tertiary.name}`, `把${tertiary.name}应用到简历中的一段真实经历，形成可验证的小实验。`, "course", [tertiary.id], "实验过程与结果截图或文档", coursesFor(tertiary.name), 1.3),
    task(4, `设计${projectName}`, `结合岗位职责“${job.responsibilities[0] || job.summary || "完成核心业务任务"}”，输出项目目标、范围、指标和两周实施计划。`, "project", [primary.id, secondary.id], "项目方案文档，包含目标、技术路线和验收指标", [], 1.5),
    task(5, `实现${projectName}核心版本`, "完成最小可运行版本，优先证明关键能力，不追求功能堆叠。", "project", [primary.id, secondary.id], "可运行仓库或演示链接＋README", [], 1.8),
    task(6, "完成一次阶段作品评审", `按${job.title}岗位要求检查项目的正确性、可解释性和交付质量。`, "project", [secondary.id, tertiary.id], "评审清单＋至少三项问题修复记录", [], 1.4),
    task(7, "修复面试主要短板", interviewWeakness, "interview", gaps.filter((item) => item.source === "interview").map((item) => item.id), "录音/文字回答＋自评与修改前后对比", [], 1.2),
    task(8, "更新简历岗位证据", `把学习和项目成果改写为与${job.title}职责对应的量化简历条目。`, "resume", gaps.map((item) => item.id), "新版简历条目＋对应成果链接", [], 1.5),
    task(9, "强化项目结果与边界", "补充数据规模、性能、用户价值、个人职责和失败复盘，形成可追问的项目说明。", "project", [primary.id], "项目复盘文档＋三个量化指标", [], 1.4),
    task(10, "完成证书必要性核验", "对照目标岗位JD判断证书是否必要；如不必要，使用同等时长完成一次技能测验。", "certificate", [secondary.id], "证书/测验结果，或不考证的岗位依据说明", [], 0.8),
    task(11, `完成${job.title}全真模拟面试`, "覆盖项目深挖、能力缺口和岗位动机，并对照上次面试报告复盘。", "interview", gaps.filter((item) => item.source === "interview").map((item) => item.id), "新面试评分＋两次面试差异总结", [], 1.4),
    task(12, "完成目标周期成果验收", "汇总课程、项目、证书/测验、简历和面试证据，重新执行人岗匹配评估。", "resume", gaps.map((item) => item.id), "成果索引页＋新版简历＋最终匹配报告", [], 1.8),
  ];
};

const selectTaskTemplates = (
  templates: GrowthTask[],
  desiredCount: number,
  gaps: GrowthGap[],
  job: Job,
) => {
  if (desiredCount <= templates.length) {
    if (desiredCount === 1) return [templates[templates.length - 1]];
    const indices = Array.from({ length: desiredCount }, (_, index) => (
      Math.round((index * (templates.length - 1)) / (desiredCount - 1))
    ));
    return indices.map((index) => templates[index]);
  }

  const reinforcementCount = desiredCount - templates.length;
  const reinforcement = Array.from({ length: reinforcementCount }, (_, index) => {
    const gap = gaps[index % gaps.length];
    const round = Math.floor(index / gaps.length) + 1;
    return task(
      0,
      `${gap.name}进阶实践${round > 1 ? `（第${round}轮）` : ""}`,
      `围绕${job.title}的真实职责继续练习${gap.name}，记录本周输入、实践结果和下一轮改进。`,
      index % 3 === 2 ? "project" : "course",
      [gap.id],
      "本周学习记录＋岗位场景实践成果＋复盘结论",
      coursesFor(gap.name).slice(0, 2),
      1,
    );
  });
  return [...templates.slice(0, -2), ...reinforcement, ...templates.slice(-2)];
};

const buildTasks = (
  gaps: GrowthGap[],
  job: Job,
  interview: InterviewGrowthSnapshot,
  schedule: GrowthSchedule,
) => {
  const templates = buildTaskTemplates(gaps, job, interview);
  const desiredCount = schedule.totalWeeks <= 6
    ? Math.min(templates.length, schedule.totalWeeks * 2)
    : Math.max(templates.length, schedule.totalWeeks);
  return selectTaskTemplates(templates, desiredCount, gaps, job).map((template, index, selected) => {
    const week = Math.min(
      schedule.totalWeeks,
      Math.max(1, Math.ceil(((index + 1) * schedule.totalWeeks) / selected.length)),
    );
    const dueDay = Math.min(
      schedule.totalDays,
      Math.max(1, Math.ceil((week * schedule.totalDays) / schedule.totalWeeks)),
    );
    const stageDays = schedule.stageEnds.find((endDay) => dueDay <= endDay)
      ?? schedule.stageEnds[schedule.stageEnds.length - 1];
    const priority: GrowthTask["priority"] = index === 0
      ? "high"
      : index < Math.ceil(selected.length / 3) ? "medium" : "normal";
    return {
      ...template,
      id: `task-${index + 1}-${slug(template.title)}`,
      week,
      stageDays,
      dueDate: dateAtScheduleDay(schedule, dueDay),
      priority,
    };
  });
};

const stageBlueprints = [
  {
    title: "基础补齐与项目立项",
    outcome: (job: Job) => `明确${job.title}能力缺口，完成核心知识学习并形成项目方案。`,
  },
  {
    title: "项目交付与表达强化",
    outcome: () => "交付可运行作品，将学习结果转化为简历和面试证据。",
  },
  {
    title: "岗位验证与投递准备",
    outcome: () => "完成成果验收、二次模拟面试和人岗匹配复评。",
  },
];

const buildStages = (job: Job, gaps: GrowthGap[], schedule: GrowthSchedule): GrowthStage[] => {
  const blueprints = schedule.stageEnds.length === 2
    ? [stageBlueprints[0], stageBlueprints[2]]
    : stageBlueprints;
  return schedule.stageEnds.map((days, index) => {
    const startDay = index === 0 ? 1 : schedule.stageEnds[index - 1] + 1;
    const goals = index === 0
      ? gaps.slice(0, 3).map((gap) => `建立${gap.name}的可验证基础`)
      : index === schedule.stageEnds.length - 1
        ? ["强化量化结果", "完成模拟面试复盘", "重新计算岗位匹配度"]
        : ["完成最小可运行项目", "修复面试主要短板", "更新岗位定制简历"];
    return {
      days,
      startDay,
      startDate: index === 0 ? schedule.startDate : dateAtScheduleDay(schedule, startDay - 1),
      endDate: dateAtScheduleDay(schedule, days),
      title: blueprints[index].title,
      outcome: blueprints[index].outcome(job),
      goals,
      unlocked: index === 0,
    };
  });
};

const recommendationsOf = (gaps: GrowthGap[], job: Job): GrowthRecommendation[] => {
  const courseRecommendations = gaps.slice(0, 3).flatMap((gap, gapIndex) =>
    coursesFor(gap.name).slice(0, 3).map((resource, resourceIndex) => ({
      id: `course-${gapIndex + 1}-${resourceIndex + 1}`,
      kind: "course" as const,
      title: resource.title,
      reason: `用于补齐“${gap.name}”能力，并产生可验证练习。`,
      url: resource.url,
      provider: resource.provider,
    })),
  );
  return [
    ...courseRecommendations,
    {
      id: "project-main",
      kind: "project" as const,
      title: `${job.title}岗位能力验证项目`,
      reason: `围绕“${job.responsibilities[0] || job.summary || job.track}”构建可运行成果，作为简历和面试共同证据。`,
    },
    certificateFor(job, gaps[0]?.name || job.track),
  ];
};

export const createGrowthPlan = (input: GrowthPlanInput): GrowthPlan => {
  const now = new Date().toISOString();
  const gaps = buildGaps(input);
  const schedule = scheduleFor(input.targetDate);
  const previousTasks = new Map(
    (input.previousPlan?.tasks ?? []).map((item) => [`${item.kind}:${item.title}`, item]),
  );
  const tasks = buildTasks(gaps, input.job, input.interview, schedule).map((item) => {
    const previous = previousTasks.get(`${item.kind}:${item.title}`);
    return previous ? {
      ...item,
      completed: previous.completed,
      evidenceText: previous.evidenceText,
      evidenceUrl: previous.evidenceUrl,
      completedAt: previous.completedAt,
    } : item;
  });
  const isRebuild = Boolean(input.previousPlan);
  const plan: GrowthPlan = {
    id: input.previousPlan?.id ?? `growth-${Date.now()}-${slug(input.job.id)}`,
    version: 1,
    targetJobId: input.job.id,
    targetJobTitle: input.job.title,
    targetJobTrack: input.job.track,
    targetDate: schedule.targetDate,
    scheduleStartDate: schedule.startDate,
    planningDays: schedule.totalDays,
    planningWeeks: schedule.totalWeeks,
    createdAt: input.previousPlan?.createdAt ?? now,
    updatedAt: now,
    revision: input.previousPlan ? input.previousPlan.revision + 1 : 1,
    baseMatchScore: input.matchResult.total,
    projectedMatchScore: input.matchResult.total,
    gaps,
    stages: buildStages(input.job, gaps, schedule),
    tasks,
    recommendations: recommendationsOf(gaps, input.job),
    adaptations: [
      ...(input.previousPlan?.adaptations ?? []),
      {
        id: isRebuild ? `schedule-${Date.now()}` : "plan-created",
        createdAt: now,
        message: isRebuild
          ? `已按目标日期 ${schedule.targetDate} 重新安排为 ${schedule.totalDays} 天（${schedule.totalWeeks} 周）计划，已完成任务及证据保持不变。`
          : `已结合${input.job.title}岗位要求、简历匹配结果和${input.interview.interviewType}报告生成 ${schedule.totalDays} 天（${schedule.totalWeeks} 周）动态计划。`,
      },
    ],
    interview: input.interview,
  };
  return tasks.some((item) => item.completed) ? recalculate(plan) : plan;
};

const stageProgress = (tasks: GrowthTask[], days: GrowthStageDays) => {
  const stageTasks = tasks.filter((item) => item.stageDays === days);
  const completed = stageTasks.filter((item) => item.completed).length;
  return stageTasks.length ? completed / stageTasks.length : 0;
};

const adaptPlan = (plan: GrowthPlan): GrowthPlan => {
  const adaptations: GrowthAdaptation[] = [...plan.adaptations];
  const stages = plan.stages.map((stage) => ({ ...stage }));
  const tasks = plan.tasks.map((item) => ({ ...item }));
  const now = new Date().toISOString();
  const unlock = (fromDays: GrowthStageDays, nextDays: GrowthStageDays) => {
    if (stageProgress(tasks, fromDays) < 0.75) return;
    const nextStage = stages.find((stage) => stage.days === nextDays);
    const eventId = `unlock-${nextDays}`;
    if (!nextStage) return;
    nextStage.unlocked = true;
    if (adaptations.some((item) => item.id === eventId)) return;
    const remainingGap = [...plan.gaps].sort((left, right) => (left.currentScore - left.targetScore) - (right.currentScore - right.targetScore))[0];
    const nextTask = tasks.find((item) => item.stageDays === nextDays && !item.completed && item.gapIds.includes(remainingGap?.id));
    if (nextTask) nextTask.priority = "high";
    adaptations.push({
      id: eventId,
      createdAt: now,
      message: `第${stages.find((item) => item.days === fromDays)?.startDay ?? 1}-${fromDays}天阶段已完成至少75%，已解锁第${nextStage.startDay}-${nextDays}天阶段${nextTask ? `，并将“${nextTask.title}”设为优先任务` : ""}。`,
    });
  };
  for (let index = 0; index < stages.length - 1; index += 1) {
    unlock(stages[index].days, stages[index + 1].days);
  }
  return {
    ...plan,
    stages,
    tasks,
    adaptations,
    revision: adaptations.length > plan.adaptations.length ? plan.revision + 1 : plan.revision,
  };
};

const recalculate = (plan: GrowthPlan): GrowthPlan => {
  const completedGain = plan.tasks.filter((item) => item.completed).reduce((sum, item) => sum + item.scoreGain, 0);
  const gaps = plan.gaps.map((gap) => {
    const linkedCompleted = plan.tasks.filter((item) => item.completed && item.gapIds.includes(gap.id)).length;
    return {
      ...gap,
      currentScore: Math.min(gap.targetScore, clamp(gap.baselineScore + linkedCompleted * 7)),
    };
  });
  return adaptPlan({
    ...plan,
    gaps,
    projectedMatchScore: Math.min(96, clamp(plan.baseMatchScore + completedGain)),
    updatedAt: new Date().toISOString(),
  });
};

export const updateGrowthTaskEvidence = (
  plan: GrowthPlan,
  taskId: string,
  evidenceText: string,
  evidenceUrl: string,
  completed: boolean,
) => {
  const normalizedText = evidenceText.trim();
  const normalizedUrl = evidenceUrl.trim();
  if (normalizedUrl && !/^https?:\/\/\S+$/i.test(normalizedUrl)) {
    throw new Error("证据链接必须是有效的 http 或 https 地址。");
  }
  if (completed && normalizedText.length < 10 && !normalizedUrl) {
    throw new Error("完成任务前请填写证据说明或证据链接。");
  }
  const taskToUpdate = plan.tasks.find((item) => item.id === taskId);
  const stage = plan.stages.find((item) => item.days === taskToUpdate?.stageDays);
  if (completed && stage && !stage.unlocked) {
    throw new Error("请先完成上一阶段至少75%的任务，再进入本阶段。");
  }
  return recalculate({
    ...plan,
    tasks: plan.tasks.map((item) => item.id === taskId ? {
      ...item,
      evidenceText: normalizedText.slice(0, 1200),
      evidenceUrl: normalizedUrl.slice(0, 800),
      completed,
      completedAt: completed ? new Date().toISOString() : null,
    } : item),
  });
};

export const updateGrowthTargetDate = (
  plan: GrowthPlan,
  input: Omit<GrowthPlanInput, "targetDate" | "previousPlan">,
  targetDate: string,
): GrowthPlan => createGrowthPlan({ ...input, targetDate, previousPlan: plan });

export const growthPlanProgress = (plan: GrowthPlan) => {
  const completed = plan.tasks.filter((item) => item.completed).length;
  return {
    completed,
    total: plan.tasks.length,
    percentage: plan.tasks.length ? Math.round((completed / plan.tasks.length) * 100) : 0,
  };
};
