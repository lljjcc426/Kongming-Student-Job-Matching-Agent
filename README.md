# Kongming Student Job Matching Agent

孔明职配是面向学生求职场景的 AI 岗位匹配与简历优化智能体 Demo。项目通过简历解析、岗位推荐、JD 分析、匹配解释、简历优化建议、模拟面试和 AI 求职助手，帮助学生完成从“理解自身画像”到“准备投递材料”的求职分析闭环。

## 项目简介

学生在求职过程中常见的问题不是缺少岗位信息，而是难以判断岗位与自身经历是否匹配，也缺少面向目标 JD 的具体简历优化建议。孔明职配将简历、岗位 JD、面试回答和用户追问统一到一个求职上下文中，使用轻量多智能体流程和模型代理生成可解释结果。

当前仓库已实现 Web Demo，主要面向以下场景：

- 学生上传或粘贴 PDF、图片、文本简历。
- 系统结构化提取学生画像、经历证据、技能和求职方向。
- 系统生成岗位推荐，并给出匹配评分、关键词覆盖、风险和行动建议。
- 用户粘贴目标 JD 后进行二次分析。
- 用户进入模拟面试，获得面试追问和反馈。
- 用户通过 AI 助手进行连续求职问答。

## 核心功能

| 功能 | 当前实现 |
| --- | --- |
| 简历输入 | 支持文本文件、PDF、图片简历；PDF 优先读取文本层，质量不足时转视觉识别。 |
| 简历结构化 | 通过模型任务 `resume-structure` 提取姓名、学历、经历、技能、求职方向等字段。 |
| 岗位推荐 | 通过并行岗位发现子任务生成候选岗位，并在前端去重、排序。 |
| 本地匹配评分 | `src/matchEngine.ts` 基于能力、经历、关键词、兴趣和成长潜力生成可解释评分。 |
| JD 分析 | 支持用户输入岗位名称和 JD，生成岗位结构、投递优先级、优势、风险和行动建议。 |
| 简历优化 | 根据目标岗位和匹配差距生成个人总结、项目经历改写和技能关键词建议。 |
| 模拟面试 | 支持综合面、技术面、HR 面三种模式，包含语音输入、TTS 播报、Live2D/PNG 面试官兜底。 |
| AI 求职助手 | 支持多轮对话，带入简历、岗位和匹配结果上下文。 |
| 报告导出 | 可导出 Markdown 分析报告。 |

## 使用的模型与算力环境

当前代码中的模型调用由后端代理统一封装：

- 前端调用：`src/arkClient.ts`
- 开发环境代理：`vite.config.ts` 中的 `/api/ark`
- Vercel API：`api/ark.js`
- 核心模型调用：`server/arkCore.js`

当前默认配置为 Ark 兼容接口：

```text
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_API_KEY=your_model_api_key
ARK_REQUEST_TIMEOUT_MS=65000
```

默认模型常量为 `doubao-seed-2-0-lite-260215`。仓库目前未发现已经完成的 Gitee.AI/沐曦资源包 API 专用适配代码。若用于需要国产 GPU 算力真实调用的提交，提交前应完成 Gitee.AI/沐曦接口适配、真实调用验证、脱敏日志和性能数据补充。

## 仓库结构

```text
.
├── api/                         Vercel API 入口，转发模型请求
├── docs/                        项目方案、架构、部署、提交材料文档
├── public/                      静态资源、Live2D/2D 面试官、PDF.js CMap
├── scripts/                     解析器与 UI 验证脚本
├── server/                      服务端模型代理核心逻辑
├── src/                         React 前端、智能体、解析器、页面和样式
├── index.html                   Vite HTML 入口
├── package.json                 Node 依赖和脚本
├── vite.config.ts               Vite 配置和本地 API 代理
├── vercel.json                  Vercel 安全头配置
└── tsconfig.json                TypeScript 配置
```

更完整的结构说明见 [项目架构与理解文档](docs/PROJECT_ARCHITECTURE_AND_UNDERSTANDING.md)。

## 快速开始

环境要求：

- Node.js 版本建议使用当前 Vite 7 可兼容版本，推荐 Node.js 20 或更新版本。
- npm。

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

浏览器访问 Vite 输出的本地地址，默认通常为：

```text
http://localhost:5173
```

构建：

```bash
npm run build
```

预览构建产物：

```bash
npm run preview
```

## 配置说明

| 配置项 | 是否必填 | 用途 | 示例 |
| --- | --- | --- | --- |
| `ARK_API_KEY` | 模型能力必填 | 服务端模型代理鉴权 | `your_model_api_key` |
| `ARK_BASE_URL` | 否 | 覆盖默认 Ark 兼容接口地址 | `https://ark.cn-beijing.volces.com/api/v3` |
| `ARK_REQUEST_TIMEOUT_MS` | 否 | 服务端模型请求超时时间 | `65000` |
| `VITE_ARK_API_URL` | 否 | 前端覆盖模型代理地址 | `/api/ark` |
| `VITE_AVATAR_MODE` | 否 | 数字人模式标记 | `static` |

不要将真实 API Key、token、cookie 或账号密码提交到仓库。建议本地使用 `.env.local`，生产环境使用部署平台的环境变量管理功能。

## 示例输入输出

### 示例一：简历上传与岗位推荐

输入：

```text
姓名：陈雨
华东师范大学 心理学 本科
求职意向：用户研究实习生 / 心理测评产品实习生
项目经历：完成大学生压力与睡眠质量调查项目，使用 SPSS 分析 286 份问卷。
技能：SPSS、问卷设计、访谈、数据分析。
```

预期输出：

- 学生画像：学历、经历、技能、目标岗位。
- 推荐岗位：岗位名称、方向、职责、要求、关键词和优先级。
- 匹配分析：总分、五维评分、已覆盖关键词、待补强关键词、简历优化动作。

### 示例二：目标 JD 分析

输入：

```text
岗位名称：用户研究实习生
岗位 JD：负责用户访谈、问卷设计、需求洞察和调研报告输出，要求具备数据分析能力。
```

预期输出：

- 岗位结构化信息。
- 投递优先级。
- 与当前简历匹配的优势和风险。
- 面向该 JD 的简历补强动作。

## 部署方法

当前项目包含 Vercel API 入口和 `vercel.json` 安全头配置，适合部署到 Vercel。

基本流程：

1. 在部署平台连接仓库。
2. 配置构建命令：`npm run build`。
3. 配置输出目录：`dist`。
4. 在部署平台配置 `ARK_API_KEY` 等环境变量。
5. 部署后访问公网链接并验证简历上传、岗位推荐、JD 分析和模拟面试流程。

详细步骤见 [部署指南](docs/DEPLOYMENT_GUIDE.md)。

## 演示材料

当前仓库未包含正式 Demo 视频链接和运行截图目录。提交前需要补充：

- Demo 演示视频链接。
- 核心页面运行截图。
- 模型真实调用日志的脱敏样例。
- 性能测试报告中的真实测试结果。

整理方式见 [演示材料与证据指南](docs/DEMO_AND_EVIDENCE_GUIDE.md)。

## 性能测试与运行日志

仓库当前包含：

- `scripts/verify-parsers.cjs`：解析器验证脚本。
- `scripts/verify-ui.cjs`：Playwright UI 验证脚本，使用 Mock `/api/ark` 响应。

仓库当前未包含可公开的真实性能测试结果和真实模型调用日志。相关模板见：

- [性能测试报告](docs/PERFORMANCE_TEST_REPORT.md)
- [真实调用日志说明](docs/RUNTIME_LOG_GUIDE.md)

## 开源代码参考来源

项目已有开源参考调研，详见：

- [开源项目参考与能力对比](docs/01-open-source-benchmark.md)
- [开源项目能力选择矩阵](docs/05-open-source-selection-matrix.md)
- [开源来源说明](docs/OPEN_SOURCE_ATTRIBUTION.md)

当前仓库根目录包含 Apache-2.0 许可证。提交前应再次确认第三方素材、Live2D 资源、PDF.js CMap、前端依赖和参考项目的 License 说明完整。

## 安全边界

- 前端不直接保存或展示模型密钥。
- 模型请求通过 `/api/ark` 后端代理转发。
- API 响应设置 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`。
- `.gitignore` 已排除 `.env`、`.env.*`、日志文件和构建产物。
- 用户简历内容当前主要保存在浏览器运行状态中，仓库未实现数据库持久化。
- 公开演示和日志提交前需要对姓名、手机号、邮箱、学校、证件号、API Key 等信息脱敏。

## 文档索引

- [项目架构与理解文档](docs/PROJECT_ARCHITECTURE_AND_UNDERSTANDING.md)
- [技术说明文档](docs/TECHNICAL_DESIGN.md)
- [部署指南](docs/DEPLOYMENT_GUIDE.md)
- [比赛提交材料清单](docs/SUBMISSION_CHECKLIST.md)
- [开源来源说明](docs/OPEN_SOURCE_ATTRIBUTION.md)
- [演示材料与证据指南](docs/DEMO_AND_EVIDENCE_GUIDE.md)
- [性能测试报告](docs/PERFORMANCE_TEST_REPORT.md)
- [真实调用日志说明](docs/RUNTIME_LOG_GUIDE.md)
- [创意规划 PPT 内容骨架](docs/CREATIVE_PLAN_STAGE1.md)
- [Issue 开发记录建议](docs/ISSUE_RECORD_GUIDE.md)
- [项目任务书](docs/00-project-charter.md)
- [多智能体与多模态架构设计](docs/08-multi-agent-multimodal-architecture.md)
