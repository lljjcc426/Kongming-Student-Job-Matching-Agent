# 前端模块化拆分

## 目标

本阶段在不改变现有产品功能和视觉表现的前提下，降低 `App.tsx` 的组件密度，并建立可继续演进的模块边界。

## 当前目录职责

```text
src/
├─ app/
│  └─ types.ts                       页面、流程与异步状态类型
├─ components/
│  ├─ brand/                         品牌视觉组件
│  ├─ jobs/                          岗位领域组件
│  ├─ layout/                        应用级布局和导航
│  ├─ model/                         模型结果展示组件
│  ├─ shared/                        无业务状态的通用 UI
│  └─ status/                        简历与 JD 流程状态
├─ features/
│  ├─ assistant/
│  │  └─ useCareerChat.ts             AI 助手消息、语音输入和请求状态
│  ├─ jobs/
│  │  ├─ recommendationSupervisor.ts  推荐任务拆分、岗位去重与结果裁剪
│  │  └─ useJobWorkspace.ts           JD 分析、岗位选择、排序与匹配状态
│  ├─ matching/
│  │  └─ useMatchInsights.ts          优化稿、运营评估、复制与报告下载
│  └─ resume/
│     ├─ documentProcessing.ts        图片/PDF 识别策略、结果契约与兜底
│     ├─ fileProcessing.ts            上传限制、文本可用性和图片压缩
│     ├─ resumeVision.ts              单页及多页简历视觉识别
│     ├─ types.ts                     原简历预览等领域类型
│     └─ useResumeProcessing.ts       上传、OCR、结构化和推荐岗位状态机
├─ pages/
│  ├─ HomePage.tsx
│  ├─ ResumeEditorPage.tsx
│  ├─ MatchingWorkspacePage.tsx      简历画像、岗位匹配和优化建议工作台
│  ├─ InterviewPage.tsx
│  └─ AIAssistantPage.tsx
└─ App.tsx                           跨页面共享状态、主流程编排与页面装配
```

## 模块边界

- `App.tsx` 保留跨页面共享状态、简历与岗位主流程编排和页面装配。
- 页面文件负责组织一个完整业务页面，不直接管理其他页面状态。
- `components/shared` 只接收展示数据和回调，不调用模型或修改全局状态。
- `components/status` 只负责流程状态可视化。
- `components/jobs` 只负责岗位领域展示。
- `features` 负责可复用的业务状态、浏览器能力封装和模型调用服务。
- 页面通过动态导入加载，首页、匹配工作台、模拟面试和 AI 助手形成独立构建块。

## 已完成拆分

### 第一阶段：页面与展示组件

- 抽出应用导航、岗位卡片、状态展示、通用内容组件和品牌组件。
- 抽出匹配工作台页面，首页、匹配工作台、模拟面试和 AI 助手改为动态导入。
- 移除 `App.tsx` 中不再渲染的旧首页动画、旧助手面板和旧面试处理代码。

### 第二阶段：业务功能模块

- AI 助手的消息、滚动、语音转写和对话请求迁移到 `useCareerChat`。
- 图片压缩、上传大小限制和简历文本可用性判断迁移到 `fileProcessing`。
- 单图及 PDF 多页视觉识别、并发限制和进度回调迁移到 `resumeVision`。
- 岗位发现任务拆分、模型岗位去重、字段裁剪和唯一 ID 生成迁移到 `recommendationSupervisor`。

### 第三阶段：简历处理状态机

- 将原简历预览、OCR 坐标、结构化简历、模型岗位、上传提示和流水线状态统一迁移到 `useResumeProcessing`。
- 将图片、PDF、文本三类上传分支及 OCR/视觉模型兜底流程从 `App.tsx` 移出。
- 将增强匹配分析纳入简历处理模块，避免页面装配层直接修改模型流水线状态。
- 将 `OriginalResumePreview` 下沉为简历领域类型，消除业务模块对页面组件的反向依赖。

### 第四阶段：岗位工作区状态

- 将 JD 输入、分析流程状态和自定义岗位列表迁移到 `useJobWorkspace`。
- 将岗位选择、删除、模型岗位与自定义岗位合并排序迁移到岗位模块。
- 将当前岗位与匹配结果作为岗位 Hook 的派生状态，页面装配层不再直接调用匹配引擎。
- 简历 Hook 改为通过上传上下文接收可选 JD 文本，消除简历模块与岗位模块之间的循环状态依赖。

### 第五阶段：匹配洞察与输出动作

- 将优化简历草稿和求职运营评估的派生计算迁移到 `useMatchInsights`。
- 将 Markdown 分析报告生成、下载和优化稿剪贴板复制迁移到匹配模块。
- 为复制状态的延时恢复增加卸载清理，避免页面生命周期结束后继续更新状态。
- 简历 Hook 直接返回派生学生画像，`App.tsx` 不再依赖结构化简历解析器。
- `App.tsx` 从拆分前的 2212 行缩减到 178 行。

### 第六阶段：简历文档处理服务

- 将图片 OCR、低置信度视觉交叉识别和纯视觉兜底迁移到 `documentProcessing`。
- 将 PDF 文本层、页面 OCR、视觉模型、文本层兜底和失败结果统一为同一结果契约。
- 处理服务通过依赖注入接收图片压缩、PDF 读取、OCR 和视觉识别实现，可在无浏览器、无真实 API 的情况下测试。
- `useResumeProcessing` 只负责上传状态、处理结果应用和后续结构化/推荐流水线，由 361 行缩减到 246 行。
- 新增 `npm run verify:resume-processing`，覆盖图片、PDF、交叉识别、进度回调和失败路径。

## 后续拆分建议

1. 将结构化简历和岗位推荐模型流水线继续下沉为可测试服务。
2. 为岗位监督、匹配衍生数据和模型返回错误补充更多单元测试。
3. 评估是否需要统一的应用状态容器和持久化层；当前 Hook 边界已能满足页面间共享。
4. 按页面拆分 `styles.css`，建立页面样式、领域组件样式和通用样式三层结构。
