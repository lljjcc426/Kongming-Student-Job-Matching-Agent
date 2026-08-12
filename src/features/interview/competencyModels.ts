import type { Job } from "../../data";
import type { InterviewCompetencyTrack, InterviewQuestionIntent } from "../../types/interview";

export type CompetencyLevelAnchor = {
  level: 1 | 3 | 5;
  label: string;
  behavior: string;
};

export type CompetencyQuestionSet = Record<Exclude<InterviewQuestionIntent, "switch">, string>;

export type CompetencyDimension = {
  id: string;
  name: string;
  weight: number;
  definition: string;
  positiveSignals: string[];
  riskSignals: string[];
  anchors: CompetencyLevelAnchor[];
  questions: CompetencyQuestionSet;
};

export type JobCompetencyModel = {
  track: InterviewCompetencyTrack;
  name: string;
  description: string;
  dimensions: CompetencyDimension[];
};

type DimensionSeed = Omit<CompetencyDimension, "anchors"> & {
  anchors: [string, string, string];
};

const dimension = (seed: DimensionSeed): CompetencyDimension => ({
  ...seed,
  anchors: [
    { level: 1, label: "认知基础", behavior: seed.anchors[0] },
    { level: 3, label: "独立胜任", behavior: seed.anchors[1] },
    { level: 5, label: "复杂场景", behavior: seed.anchors[2] },
  ],
});

const MODELS: Record<InterviewCompetencyTrack, JobCompetencyModel> = {
  ai_algorithm: {
    track: "ai_algorithm",
    name: "AI算法工程师胜任力模型",
    description: "覆盖算法原理、数据实验、模型优化、工程部署、问题诊断和业务协同。",
    dimensions: [
      dimension({
        id: "algorithm-foundation", name: "算法与数学基础", weight: 20,
        definition: "理解核心算法、损失函数、优化方法及其适用边界。",
        positiveSignals: ["算法", "损失函数", "梯度", "复杂度", "假设", "原理", "推导", "泛化"],
        riskSignals: ["只会调用", "没有了解", "不清楚原理"],
        anchors: ["能复述概念但无法解释原理与适用条件。", "能独立解释算法选择并完成常见问题分析。", "能比较替代方案、推导边界并处理复杂约束。"],
        questions: {
          opening: "请选一个你真正理解的算法，结合项目说明它解决了什么问题、为什么适合该场景。",
          clarify: "你提到了算法或模型名称，请具体说明输入、目标函数以及你本人完成的部分。",
          deepen: "这个方案背后的关键假设是什么？如果假设不成立，会出现什么现象？",
          challenge: "如果不能使用当前算法，你会选择什么替代方案？请比较效果、复杂度和风险。",
        },
      }),
      dimension({
        id: "data-experiment", name: "数据与实验设计", weight: 18,
        definition: "能够完成数据理解、清洗、切分、指标设计和可信实验。",
        positiveSignals: ["数据", "样本", "特征", "清洗", "标注", "训练集", "验证集", "指标", "消融", "A/B"],
        riskSignals: ["直接训练", "只看准确率", "没有验证"],
        anchors: ["能完成基础数据处理，但缺少泄漏和偏差意识。", "能设计数据切分、指标和对照实验。", "能识别偏差、泄漏与分布变化并构造可靠验证。"],
        questions: {
          opening: "请讲一次你负责的数据或实验设计，说明样本来源、数据处理、评价指标和验证结论。",
          clarify: "这些数据由谁处理？请具体说明你的清洗规则、切分方式和最终数据规模。",
          deepen: "你如何排除数据泄漏、类别不平衡或指标选择造成的虚假提升？",
          challenge: "如果线上数据分布突然变化，而离线指标仍然很好，你会如何定位并重新设计实验？",
        },
      }),
      dimension({
        id: "model-optimization", name: "建模与效果优化", weight: 20,
        definition: "能够建立基线、定位瓶颈并通过实验闭环改善模型效果。",
        positiveSignals: ["基线", "调参", "误差分析", "消融", "召回率", "精确率", "F1", "提升", "对比"],
        riskSignals: ["反复调参", "凭感觉", "只报最好结果"],
        anchors: ["能训练现成模型并报告单一指标。", "能建立基线、做误差分析并验证优化。", "能系统定位瓶颈并平衡多目标、成本与鲁棒性。"],
        questions: {
          opening: "请讲一次模型效果优化经历，从初始基线、问题定位到最终指标变化完整说明。",
          clarify: "你所说的效果提升具体对应什么指标、数据集和对照基线？",
          deepen: "哪一类样本贡献了主要误差？你如何证明优化动作而不是随机波动带来了提升？",
          challenge: "如果准确率提升但推理成本翻倍，你会怎样判断这个方案是否值得上线？",
        },
      }),
      dimension({
        id: "ml-engineering", name: "工程化与部署", weight: 17,
        definition: "能够将模型转化为稳定、可观测、可维护的服务。",
        positiveSignals: ["部署", "服务", "接口", "延迟", "吞吐", "显存", "监控", "灰度", "回滚", "容器"],
        riskSignals: ["只在本地运行", "没有上线", "交给后端"],
        anchors: ["模型仅能在实验环境运行。", "能完成服务化、测试和基础性能优化。", "能设计灰度、监控、回滚和资源成本方案。"],
        questions: {
          opening: "请说明你如何把一个模型从实验代码变成可交付服务，重点讲接口、性能和稳定性。",
          clarify: "这个项目实际运行在哪里？请说明部署方式、调用链路和你负责的工程环节。",
          deepen: "你监控哪些线上指标？出现超时、显存不足或结果漂移时如何处理？",
          challenge: "若资源预算削减一半且延迟要求提高，你会从模型、推理和系统层分别怎样取舍？",
        },
      }),
      dimension({
        id: "diagnosis-research", name: "诊断与研究能力", weight: 15,
        definition: "面对未知问题能提出假设、设计验证并形成可复用结论。",
        positiveSignals: ["假设", "排查", "日志", "复现", "验证", "根因", "论文", "复盘", "失败"],
        riskSignals: ["重跑就好了", "不知道原因", "换模型解决"],
        anchors: ["依赖他人定位问题，缺少验证过程。", "能通过日志、实验和对照定位常见根因。", "能处理未知问题并形成系统化诊断方法。"],
        questions: {
          opening: "请讲一次结果异常或实验失败的经历，你如何提出假设、排查并找到根因？",
          clarify: "当时具体出现了什么异常？请区分你观察到的事实和最初猜测。",
          deepen: "你按什么顺序验证各个假设？有哪些证据推翻了错误方向？",
          challenge: "如果问题无法稳定复现且日志不完整，你会怎样缩小范围并控制排查成本？",
        },
      }),
      dimension({
        id: "ai-business-collaboration", name: "业务理解与协作", weight: 10,
        definition: "能把模型目标与用户价值、业务约束和跨团队协作连接起来。",
        positiveSignals: ["业务", "用户", "需求", "价值", "成本", "沟通", "产品", "协作", "交付"],
        riskSignals: ["只负责模型", "需求不重要", "指标越高越好"],
        anchors: ["只关注离线技术指标。", "能理解需求并与产品研发完成交付。", "能定义价值指标并推动复杂跨团队取舍。"],
        questions: {
          opening: "请讲一次你把算法指标转化为业务或用户价值的经历，你如何与产品、研发协作？",
          clarify: "这个需求真正要解决的用户问题是什么？你如何确认它不是伪需求？",
          deepen: "技术指标和业务指标之间有什么关系？你们如何定义上线验收标准？",
          challenge: "如果业务方坚持上线但模型在关键人群上表现不稳定，你会如何沟通和决策？",
        },
      }),
    ],
  },
  frontend: {
    track: "frontend",
    name: "前端开发工程师胜任力模型",
    description: "覆盖语言基础、框架设计、浏览器机制、工程质量、性能体验和产品协作。",
    dimensions: [
      dimension({
        id: "frontend-language", name: "JavaScript与TypeScript", weight: 18,
        definition: "掌握语言机制、类型系统、异步模型与常见边界。",
        positiveSignals: ["JavaScript", "TypeScript", "闭包", "原型", "事件循环", "Promise", "类型", "异步"],
        riskSignals: ["只会语法", "复制代码", "不清楚运行机制"],
        anchors: ["能使用基础语法完成页面功能。", "能解释异步、作用域和类型设计并处理常见问题。", "能分析运行时边界并设计可靠抽象。"],
        questions: {
          opening: "请结合真实代码讲一个JavaScript或TypeScript难点，以及你为什么采用当前实现。",
          clarify: "请把你负责的代码边界说清楚，并解释其中最关键的语言机制。",
          deepen: "这个实现涉及哪些异步、作用域或类型推断问题？错误会在何时暴露？",
          challenge: "如果数据规模和并发交互增加十倍，你当前的实现可能在哪些地方失效？",
        },
      }),
      dimension({
        id: "frontend-framework", name: "框架与组件设计", weight: 18,
        definition: "能够进行组件拆分、状态管理、渲染优化和可维护架构设计。",
        positiveSignals: ["React", "Vue", "组件", "状态", "Hooks", "响应式", "复用", "渲染", "架构"],
        riskSignals: ["全部写在一个组件", "滥用全局状态", "依赖模板"],
        anchors: ["能使用框架完成业务页面。", "能合理拆分组件、状态和数据流。", "能设计跨模块架构并控制复杂度与性能。"],
        questions: {
          opening: "请选一个复杂页面，说明你如何拆分组件、组织状态并控制数据流。",
          clarify: "哪些组件和状态是你设计的？请说明拆分依据而不是只描述页面功能。",
          deepen: "哪些状态应本地保存、跨组件共享或来自服务端？错误设计会造成什么问题？",
          challenge: "如果该页面要支持多人协作和持续扩展一年，你会怎样调整目录、边界与测试策略？",
        },
      }),
      dimension({
        id: "browser-network", name: "浏览器与网络机制", weight: 16,
        definition: "理解渲染、事件、缓存、安全和网络请求链路。",
        positiveSignals: ["浏览器", "渲染", "DOM", "事件", "HTTP", "缓存", "跨域", "安全", "网络"],
        riskSignals: ["刷新解决", "只会调用接口", "不了解缓存"],
        anchors: ["能使用浏览器API和发起请求。", "能解释渲染与网络链路并定位常见问题。", "能处理缓存、安全、弱网和复杂兼容边界。"],
        questions: {
          opening: "请讲一次浏览器渲染或网络请求问题的排查经历，说明现象、工具和根因。",
          clarify: "问题发生在请求、缓存、脚本执行还是渲染阶段？你有什么证据？",
          deepen: "从输入URL到页面可交互，这个问题涉及的关键链路是什么？",
          challenge: "如果问题只在部分用户的弱网旧设备上出现，你会如何观测、复现和降级？",
        },
      }),
      dimension({
        id: "frontend-quality", name: "前端工程质量", weight: 17,
        definition: "具备构建、测试、规范、可观测性和持续交付能力。",
        positiveSignals: ["测试", "构建", "CI", "Lint", "监控", "错误边界", "发布", "回滚", "规范"],
        riskSignals: ["手工测试", "直接上线", "没有监控"],
        anchors: ["能按流程提交和发布代码。", "能建立测试、规范和基础监控。", "能设计质量门禁、灰度发布和故障恢复。"],
        questions: {
          opening: "请说明你在一个前端项目中如何保障代码质量和发布可靠性。",
          clarify: "你实际编写了哪些测试或工程配置？它们阻止过什么问题？",
          deepen: "单元、组件和端到端测试分别覆盖什么风险？你如何决定投入比例？",
          challenge: "如果发布后核心页面白屏但本地和测试环境都正常，你会如何止损和定位？",
        },
      }),
      dimension({
        id: "frontend-performance", name: "性能与体验优化", weight: 16,
        definition: "能以指标驱动加载、渲染、交互和兼容性优化。",
        positiveSignals: ["性能", "LCP", "CLS", "INP", "首屏", "懒加载", "缓存", "包体", "兼容"],
        riskSignals: ["感觉更快", "压缩图片就行", "没有测量"],
        anchors: ["知道常见优化手段但缺少度量。", "能用性能指标定位并验证优化。", "能在真实用户、设备和业务约束下系统治理性能。"],
        questions: {
          opening: "请讲一次有数据支撑的前端性能优化，从指标、瓶颈到验证结果说明。",
          clarify: "优化前后使用了什么指标、采样环境和对照方式？",
          deepen: "瓶颈来自网络、主线程、渲染还是资源加载？你如何证明？",
          challenge: "如果性能优化会降低可维护性或影响业务埋点，你如何做取舍？",
        },
      }),
      dimension({
        id: "frontend-product", name: "用户体验与协作", weight: 15,
        definition: "理解用户任务、可访问性和跨职能交付。",
        positiveSignals: ["用户", "体验", "可访问性", "设计", "产品", "沟通", "验收", "反馈"],
        riskSignals: ["照设计稿", "需求说什么做什么", "不管用户"],
        anchors: ["能按需求还原页面。", "能识别交互风险并与产品设计完成验收。", "能用用户反馈推动体验和交付流程改进。"],
        questions: {
          opening: "请讲一次你发现并推动解决用户体验问题的经历，说明如何与产品和设计协作。",
          clarify: "这个问题影响了哪些用户任务？你如何确认而不是主观判断？",
          deepen: "你提出了哪些方案，最终选择当前方案的依据是什么？",
          challenge: "如果设计效果与可访问性、性能或交付周期冲突，你会如何沟通取舍？",
        },
      }),
    ],
  },
  backend: {
    track: "backend",
    name: "后端开发工程师胜任力模型",
    description: "覆盖语言框架、数据存储、接口架构、可靠性、工程交付和安全排障。",
    dimensions: [
      dimension({
        id: "backend-language", name: "语言与框架基础", weight: 17,
        definition: "掌握主力语言、运行时、框架机制和代码设计。",
        positiveSignals: ["Java", "Go", "Python", "Spring", "并发", "内存", "线程", "框架", "设计模式"],
        riskSignals: ["只会注解", "照着框架写", "不清楚底层"],
        anchors: ["能使用框架完成常规接口。", "能解释核心机制并设计可维护代码。", "能处理运行时、并发和复杂框架边界。"],
        questions: {
          opening: "请结合一个后端项目说明你使用的语言和框架，重点讲最关键的机制与设计选择。",
          clarify: "哪些核心模块由你实现？请说明调用链和关键代码边界。",
          deepen: "框架在这里替你完成了什么？如果出现并发或生命周期问题，你如何分析？",
          challenge: "如果移除当前框架的一项核心能力，你会如何实现替代方案并控制复杂度？",
        },
      }),
      dimension({
        id: "database-cache", name: "数据库与缓存", weight: 17,
        definition: "能够进行数据建模、查询优化、事务和缓存一致性设计。",
        positiveSignals: ["数据库", "SQL", "索引", "事务", "锁", "缓存", "Redis", "一致性", "慢查询"],
        riskSignals: ["加索引就行", "全部放缓存", "不知道事务"],
        anchors: ["能完成基本表设计和CRUD。", "能处理索引、事务、缓存和常见性能问题。", "能在高并发与一致性约束下设计数据方案。"],
        questions: {
          opening: "请讲一次数据库或缓存方案设计，说明数据模型、访问模式和关键取舍。",
          clarify: "实际数据量、读写比例和查询条件是什么？你负责了哪些设计？",
          deepen: "索引为什么有效？事务隔离、缓存更新和异常回滚如何处理？",
          challenge: "如果缓存与数据库出现短暂不一致并引发重复扣减，你会如何止损、修复和预防？",
        },
      }),
      dimension({
        id: "backend-architecture", name: "接口与系统设计", weight: 18,
        definition: "能够设计清晰接口、服务边界、数据流和扩展方案。",
        positiveSignals: ["接口", "API", "服务", "架构", "领域", "消息队列", "幂等", "扩展", "限流"],
        riskSignals: ["一个服务处理全部", "接口随便定义", "没有幂等"],
        anchors: ["能实现常规接口。", "能设计边界清晰、可扩展的服务和接口。", "能处理分布式约束、演进和复杂故障模式。"],
        questions: {
          opening: "请设计或复盘一个你熟悉的后端系统，说明服务边界、核心接口和数据流。",
          clarify: "请明确系统规模、调用方和你实际负责的模块。",
          deepen: "接口如何保证幂等、兼容演进和异常语义一致？",
          challenge: "如果流量突增十倍且下游不稳定，你会如何保护系统并保证关键链路？",
        },
      }),
      dimension({
        id: "reliability-concurrency", name: "并发与可靠性", weight: 18,
        definition: "能够处理并发控制、容错、可观测性和容量问题。",
        positiveSignals: ["并发", "锁", "超时", "重试", "熔断", "降级", "监控", "容量", "故障"],
        riskSignals: ["无限重试", "重启服务", "不会出错"],
        anchors: ["能处理单机常见异常。", "能设计超时重试、监控和基础容错。", "能在分布式故障与容量约束下保障核心SLA。"],
        questions: {
          opening: "请讲一次并发、稳定性或线上故障处理经历，说明影响、定位和恢复过程。",
          clarify: "故障的时间线、影响范围和你采取的第一个动作是什么？",
          deepen: "超时、重试、幂等、熔断之间如何配合？你的方案有什么副作用？",
          challenge: "如果故障同时伴随监控延迟和下游抖动，你如何确定优先级并避免扩大影响？",
        },
      }),
      dimension({
        id: "backend-delivery", name: "工程质量与交付", weight: 15,
        definition: "具备测试、代码审查、CI/CD、配置和发布治理能力。",
        positiveSignals: ["单元测试", "集成测试", "代码审查", "CI", "发布", "灰度", "回滚", "配置"],
        riskSignals: ["手工发布", "没有测试", "线上验证"],
        anchors: ["能遵循团队开发流程。", "能建立测试和自动化发布保障。", "能设计变更治理、灰度验证和快速恢复机制。"],
        questions: {
          opening: "请说明你如何保障一个后端功能从开发、测试到发布的质量。",
          clarify: "你实际写了哪些测试和流水线配置？它们覆盖了什么风险？",
          deepen: "涉及数据库变更时，如何实现向前兼容、灰度和安全回滚？",
          challenge: "如果紧急需求必须当天上线但测试时间不足，你会怎样划定最低质量门槛？",
        },
      }),
      dimension({
        id: "backend-security-diagnosis", name: "安全与问题诊断", weight: 15,
        definition: "能够使用日志、指标、链路和安全原则定位复杂问题。",
        positiveSignals: ["日志", "链路", "指标", "根因", "复现", "权限", "鉴权", "注入", "漏洞", "审计"],
        riskSignals: ["看日志猜", "默认可信", "关闭校验"],
        anchors: ["能根据错误日志处理常见问题。", "能系统排查调用链并落实基础安全控制。", "能处理难复现故障和高风险安全边界。"],
        questions: {
          opening: "请讲一次复杂问题定位或安全风险修复，说明证据链、根因和预防措施。",
          clarify: "你看到了哪些日志、指标或请求证据？如何排除其他可能？",
          deepen: "身份、权限、输入校验和审计分别在哪一层实现？",
          challenge: "如果日志中含敏感数据且攻击仍在持续，你如何兼顾止损、取证和合规？",
        },
      }),
    ],
  },
  product: {
    track: "product",
    name: "产品经理胜任力模型",
    description: "覆盖用户洞察、需求决策、方案设计、数据验证、项目推进和商业复盘。",
    dimensions: [
      dimension({
        id: "user-insight", name: "用户与问题洞察", weight: 20,
        definition: "能够识别目标用户、真实场景、核心问题和证据。",
        positiveSignals: ["用户", "场景", "访谈", "调研", "痛点", "样本", "观察", "问题", "证据"],
        riskSignals: ["我觉得", "所有用户", "老板说"],
        anchors: ["能描述需求但缺少用户证据。", "能通过调研识别目标用户和核心问题。", "能发现隐性需求并验证问题价值与适用边界。"],
        questions: {
          opening: "请讲一个你真正研究过的用户问题，说明目标用户、场景、证据和最终洞察。",
          clarify: "这个结论来自多少用户、什么样本和哪些原始行为，而不是你的主观判断？",
          deepen: "表层诉求和真正问题有什么区别？你如何排除样本偏差？",
          challenge: "如果核心用户明确反对你的方案，但业务数据短期上升，你如何重新判断问题？",
        },
      }),
      dimension({
        id: "requirement-priority", name: "需求分析与优先级", weight: 18,
        definition: "能够拆解需求、评估价值成本并做有依据的取舍。",
        positiveSignals: ["需求", "目标", "优先级", "价值", "成本", "范围", "取舍", "验证", "MVP"],
        riskSignals: ["都很重要", "领导决定", "功能越多越好"],
        anchors: ["能整理需求清单。", "能按目标、价值和成本确定优先级。", "能在冲突约束下制定策略并管理机会成本。"],
        questions: {
          opening: "请讲一次需求取舍，你如何定义目标、比较方案并确定优先级？",
          clarify: "有哪些竞争需求？请给出你使用的具体评价依据。",
          deepen: "你如何划定MVP范围，并证明被砍掉的功能可以延后？",
          challenge: "如果最大客户的定制需求与长期产品方向冲突，你会如何决策和沟通？",
        },
      }),
      dimension({
        id: "product-solution", name: "产品方案与体验设计", weight: 16,
        definition: "能够将问题转化为流程、原型、规则和可验收方案。",
        positiveSignals: ["方案", "流程", "原型", "交互", "规则", "异常", "验收", "可用性"],
        riskSignals: ["画原型", "照竞品", "只考虑正常流程"],
        anchors: ["能产出基础原型和文档。", "能设计完整主流程、异常与验收标准。", "能统筹复杂规则、体验一致性和系统约束。"],
        questions: {
          opening: "请选一个产品方案，说明从问题到流程、原型和验收标准的完整设计。",
          clarify: "你具体负责哪些决策？请讲一个关键页面或规则背后的依据。",
          deepen: "异常流程、权限、空状态和用户误操作如何处理？",
          challenge: "如果研发成本超出预期一倍，你如何保持核心价值并重构方案？",
        },
      }),
      dimension({
        id: "product-data", name: "数据分析与实验", weight: 16,
        definition: "能够建立指标体系、分析数据并设计有效实验。",
        positiveSignals: ["指标", "漏斗", "留存", "转化", "数据", "实验", "A/B", "埋点", "显著性"],
        riskSignals: ["看PV", "数据涨了", "没有对照"],
        anchors: ["能阅读常见业务数据。", "能定义指标、埋点和实验验证方案。", "能识别归因偏差并建立完整决策证据。"],
        questions: {
          opening: "请讲一次你用数据影响产品决策的经历，说明指标、分析过程和结论。",
          clarify: "指标口径、时间窗口、样本规模和对照基线分别是什么？",
          deepen: "你如何判断相关性不是因果性，并排除同期活动等干扰？",
          challenge: "如果核心指标上涨但用户投诉和长期留存恶化，你会如何解释并决策？",
        },
      }),
      dimension({
        id: "product-delivery", name: "项目推进与协作", weight: 15,
        definition: "能够对齐目标、管理风险并推动跨团队交付。",
        positiveSignals: ["推进", "协作", "研发", "设计", "排期", "风险", "沟通", "共识", "交付"],
        riskSignals: ["催进度", "研发不配合", "交给别人"],
        anchors: ["能跟进任务和同步信息。", "能识别依赖、管理风险并推动按期交付。", "能在多方冲突和不确定性中建立共识。"],
        questions: {
          opening: "请讲一次跨团队推进困难的项目，你如何处理分歧、依赖和延期风险？",
          clarify: "你的具体职责和决策权限是什么？当时各方分歧在哪里？",
          deepen: "你使用什么机制让风险提前暴露，并验证各方真正达成共识？",
          challenge: "如果关键研发资源临时被抽走且发布日期不变，你如何重新制定承诺？",
        },
      }),
      dimension({
        id: "business-retrospective", name: "商业理解与复盘", weight: 15,
        definition: "理解商业目标、竞争环境并能从成败中修正判断。",
        positiveSignals: ["商业", "收入", "成本", "市场", "竞品", "战略", "复盘", "失败", "迭代"],
        riskSignals: ["只看功能", "竞品有我们也要有", "没有失败"],
        anchors: ["了解基础商业和竞品信息。", "能连接用户价值、业务目标并完成复盘。", "能在市场变化中校正战略和资源配置。"],
        questions: {
          opening: "请讲一次产品结果未达预期或方向调整，你如何复盘用户、产品和商业原因？",
          clarify: "原目标、实际结果和你当时的关键判断分别是什么？",
          deepen: "哪些是假设错误，哪些是执行问题？你用什么证据区分？",
          challenge: "如果继续投入可能成功但机会成本很高，你会依据什么决定坚持、转向或停止？",
        },
      }),
    ],
  },
  fullstack: {
    track: "fullstack",
    name: "全栈开发工程师胜任力模型",
    description: "覆盖前端交互、后端服务、数据存储、系统架构、工程交付和产品闭环。",
    dimensions: [
      dimension({
        id: "fullstack-frontend", name: "前端实现与体验", weight: 16,
        definition: "能够完成可靠的界面、状态管理和用户体验实现。",
        positiveSignals: ["React", "Vue", "组件", "状态", "交互", "浏览器", "性能", "体验"],
        riskSignals: ["只会套模板", "没有状态设计", "不考虑体验"],
        anchors: ["能实现常规页面。", "能设计组件、状态和基础性能方案。", "能处理复杂交互、性能与可访问性约束。"],
        questions: {
          opening: "请从一个全栈项目中选择最复杂的前端部分，说明组件、状态和交互设计。",
          clarify: "这部分有哪些代码由你独立完成？数据和状态如何流动？",
          deepen: "你如何处理加载、错误、并发请求和边界状态？",
          challenge: "如果页面在弱网和低端设备上明显卡顿，你会如何测量、定位和降级？",
        },
      }),
      dimension({
        id: "fullstack-backend", name: "后端服务与接口", weight: 16,
        definition: "能够设计接口、业务逻辑、鉴权和服务边界。",
        positiveSignals: ["API", "接口", "服务", "鉴权", "业务逻辑", "幂等", "异常", "并发"],
        riskSignals: ["前端直连数据库", "没有鉴权", "只处理成功情况"],
        anchors: ["能实现基础CRUD接口。", "能设计清晰服务边界、鉴权和异常处理。", "能处理高并发、演进与分布式约束。"],
        questions: {
          opening: "请说明全栈项目的后端接口和服务设计，重点讲边界、鉴权和异常处理。",
          clarify: "请选一个核心接口，说明请求、校验、业务逻辑和数据写入链路。",
          deepen: "这个接口如何保证幂等、安全和向后兼容？",
          challenge: "如果客户端重复提交且下游超时，你怎样避免重复数据和错误状态？",
        },
      }),
      dimension({
        id: "fullstack-data", name: "数据建模与存储", weight: 14,
        definition: "能够选择存储方案并处理模型、查询、事务和缓存。",
        positiveSignals: ["数据模型", "数据库", "SQL", "索引", "事务", "缓存", "迁移", "一致性"],
        riskSignals: ["一张大表", "没有索引", "缓存所有数据"],
        anchors: ["能设计基础表结构。", "能根据访问模式设计索引、事务和缓存。", "能处理数据演进、一致性和规模化问题。"],
        questions: {
          opening: "请讲一个核心数据模型，说明表结构、关系、查询方式和设计取舍。",
          clarify: "实际数据量和最常见查询是什么？为什么这样设计字段与索引？",
          deepen: "事务边界、缓存一致性和数据迁移如何处理？",
          challenge: "如果数据量增长百倍且必须不停机迁移，你会如何演进模型？",
        },
      }),
      dimension({
        id: "fullstack-architecture", name: "端到端系统架构", weight: 18,
        definition: "能够贯通客户端、服务端、数据、部署和非功能需求。",
        positiveSignals: ["架构", "链路", "边界", "扩展", "性能", "安全", "部署", "可观测"],
        riskSignals: ["所有代码放一起", "只考虑功能", "没有架构"],
        anchors: ["能串联前后端完成小型应用。", "能设计清晰分层和关键非功能方案。", "能在复杂约束下完成可扩展架构取舍。"],
        questions: {
          opening: "请画面式描述一个全栈项目从用户操作到数据落库的完整链路及关键设计。",
          clarify: "系统边界、部署单元和外部依赖分别是什么？",
          deepen: "性能、安全、可观测性和扩展性在哪些层处理？",
          challenge: "如果其中一个外部服务频繁超时，你如何避免前后端同时出现不可控状态？",
        },
      }),
      dimension({
        id: "fullstack-delivery", name: "工程质量与交付", weight: 18,
        definition: "能够完成测试、版本控制、CI/CD、部署与线上保障。",
        positiveSignals: ["测试", "Git", "CI", "Docker", "部署", "监控", "灰度", "回滚", "文档"],
        riskSignals: ["本地能跑", "手动上传", "没有测试"],
        anchors: ["能把项目部署运行。", "能建立自动测试、部署和监控。", "能治理跨端质量、变更风险和故障恢复。"],
        questions: {
          opening: "请说明你如何让一个全栈项目从本地开发走到可持续部署和维护。",
          clarify: "哪些测试、容器、流水线和监控由你配置？",
          deepen: "前后端版本不一致、数据库迁移和配置差异如何安全处理？",
          challenge: "如果上线后发现数据结构不兼容，你如何回滚同时避免用户数据丢失？",
        },
      }),
      dimension({
        id: "fullstack-product", name: "产品闭环与协作", weight: 18,
        definition: "能从用户问题出发定义范围、交付价值并根据反馈迭代。",
        positiveSignals: ["用户", "需求", "MVP", "反馈", "指标", "迭代", "协作", "价值"],
        riskSignals: ["为了练技术", "功能越多越好", "没有用户"],
        anchors: ["能按要求完成产品功能。", "能定义MVP并根据用户反馈迭代。", "能统筹价值、技术债务和多方协作持续演进。"],
        questions: {
          opening: "请讲一个从需求到上线反馈的完整项目闭环，你如何定义MVP和成功指标？",
          clarify: "真实用户是谁、核心问题是什么、哪些功能由你主动取舍？",
          deepen: "上线后你收到了什么数据或反馈，它如何改变下一版计划？",
          challenge: "如果用户最想要的功能会显著增加技术债务，你如何做短期交付与长期架构的取舍？",
        },
      }),
    ],
  },
};

const TRACK_TERMS: Record<InterviewCompetencyTrack, RegExp> = {
  ai_algorithm: /算法|机器学习|深度学习|模型训练|计算机视觉|自然语言|NLP|CV|推荐系统|数据挖掘|大模型算法/i,
  frontend: /前端|web前端|网页开发|react|vue|javascript|typescript|小程序/i,
  backend: /后端|服务端|java开发|golang|go开发|spring|微服务|数据库开发/i,
  product: /产品经理|产品实习|产品运营|AI产品|用户产品|商业产品|用户研究/i,
  fullstack: /全栈|full.?stack|AI应用开发|大模型应用开发/i,
};

export const competencyModels = MODELS;

export const detectCompetencyTrack = (job: Job): InterviewCompetencyTrack => {
  const title = `${job.title} ${job.track}`;
  const details = [job.summary, ...job.keywords, ...job.requirements].join(" ");
  const scores = (Object.keys(TRACK_TERMS) as InterviewCompetencyTrack[]).map((track) => ({
    track,
    score: (TRACK_TERMS[track].test(title) ? 6 : 0) + (TRACK_TERMS[track].test(details) ? 2 : 0),
  }));
  const explicitFullstack = scores.find((item) => item.track === "fullstack")!;
  if (explicitFullstack.score >= 6) return "fullstack";
  const best = [...scores].sort((left, right) => right.score - left.score)[0];
  return best.score > 0 ? best.track : "product";
};

export const getCompetencyModel = (job: Job) => MODELS[detectCompetencyTrack(job)];

export const validateCompetencyModels = () => (Object.values(MODELS).map((model) => ({
  track: model.track,
  dimensionCount: model.dimensions.length,
  totalWeight: model.dimensions.reduce((sum, item) => sum + item.weight, 0),
  validAnchors: model.dimensions.every((item) => item.anchors.map((anchor) => anchor.level).join(",") === "1,3,5"),
  validQuestions: model.dimensions.every((item) => Object.values(item.questions).every((question) => question.length >= 16)),
})));
