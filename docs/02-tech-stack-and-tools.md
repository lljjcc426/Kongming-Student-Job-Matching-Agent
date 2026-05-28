# 技术方案与工具准备

## 推荐技术路线

首版 Demo 推荐采用轻量 Web 应用形式，优先保证公网访问、演示稳定和功能闭环。

### 前端

- React + TypeScript + Vite
- Tailwind CSS
- Recharts 或 Tremor 风格图表
- lucide-react 图标

### AI 与匹配逻辑

首版采用两层结构：

1. 本地可解释评分引擎：关键词覆盖、能力维度、经历相关度、兴趣偏好、成长潜力。
2. AI 文案生成层：用于输出简历优化建议、项目经历改写建议、投递行动清单。

这样即使没有可用 API Key，Demo 仍可通过模拟 AI 输出完整运行；接入模型后可以替换生成层，不影响主体交互。

### 数据

- 内置岗位样例：产品、运营、前端、后端、算法、数据分析、人力资源等。
- 内置学生样例：不同专业、不同年级、不同经历强项。
- 用户输入：支持粘贴简历文本和岗位 JD。

### 部署

推荐使用 Vercel 或 Netlify。

- Vercel：适合 React/Vite/Next.js 项目，GitHub 集成简单。
- Netlify：同样适合静态前端 Demo，配置轻量。

本项目首选 Vercel，原因是 GitHub 连接和预览部署流程清晰，适合快速公开演示。

## 可用 Skill

| Skill | 用途 | 当前状态 |
| --- | --- | --- |
| GitHub | 远端仓库、提交、PR、同步流程 | 已纳入工作流 |
| Vercel deployments-cicd | 部署到 Vercel、预览链接、生产发布 | 已纳入工作流 |
| vercel:react-best-practices | 多个 React 组件完成后做质量检查 | 开发阶段使用 |
| vercel:agent-browser-verify / vercel:verification | Demo 启动或部署后做页面验证 | 验证阶段使用 |
| playwright | 本地浏览器验证、截图、交互测试 | 验证阶段使用 |
| openai-docs | 若接入 OpenAI API，查官方最新文档 | 接入模型时使用 |

## 可用 MCP / Connector

| MCP / Connector | 用途 | 当前状态 |
| --- | --- | --- |
| GitHub Connector | 查看/管理 GitHub 仓库、PR、Issue | 已可用，远端仓库创建后使用 |
| 本地 Shell | Git、依赖安装、构建、测试 | 已可用 |
| Browser / Playwright 相关能力 | 验证页面加载、交互与截图 | 开发后使用 |

## 暂不采用的能力

- 自动投递 Agent：不作为首版功能，避免平台合规和账号安全问题。
- 大型后端数据库：首版 Demo 用内置样例和浏览器状态即可满足演示。
- 复杂向量数据库：可作为后续增强，首版用轻量语义/关键词混合评分更稳。

## 后续可升级方向

- 接入 PDF/DOCX 简历解析。
- 接入真实岗位抓取或导入。
- 增加向量检索，支持“从岗位库中自动推荐最适合岗位”。
- 接入 LLM API，生成更自然的简历优化建议和面试准备清单。

