# Skill、MCP 与部署准备

## 本项目可用 Skill

| Skill | 使用阶段 | 用途 | 当前决策 |
| --- | --- | --- | --- |
| GitHub | 全程 | 远端同步、PR、Issue、仓库状态检查 | 使用；所有操作限定在 `lljjcc426/Kongming-Student-Job-Matching-Agent` |
| Vercel deployments-cicd | 部署阶段 | 预览部署、生产部署、部署状态检查 | 使用；首选 Vercel 作为公网 Demo 托管 |
| vercel:react-best-practices | 前端完成后 | 检查 React 组件结构、状态管理和可维护性 | 开发阶段使用 |
| vercel:agent-browser-verify / vercel:verification | 本地或部署后 | 验证页面是否可访问、交互是否完整 | 验证阶段使用 |
| playwright | 本地验证 | 浏览器截图、交互流检查、响应式检查 | 验证阶段使用 |
| openai-docs | 接入模型时 | 查询 OpenAI API 官方最新用法 | 仅在接入 OpenAI API 时使用 |

## MCP / Connector 准备

| 能力 | 用途 | 当前状态 | 决策 |
| --- | --- | --- | --- |
| GitHub Connector | 仓库、PR、Issue 等结构化操作 | 当前曾出现连接器启动失败；本地 Git 命令可用 | 优先本地 Git；连接器可用时再辅助使用 |
| 本地 Shell | Git、依赖安装、构建、测试、部署 CLI | 可用 | 作为主要工程执行入口 |
| Browser / Playwright | 本地与公网页面验证 | 可用 | Demo 开发完成后使用 |
| LinkedIn Jobs MCP 等求职类 MCP | 搜索真实岗位 | 需要额外安装，且多涉及爬取或平台规则 | 首版不接入，避免合规和稳定性风险 |
| Resume/Job Parser MCP | 简历或 JD 解析 | 多为第三方服务，可能涉及隐私或付费 | 首版不用；后续如需要再评估 |

## 部署路线

首版公网 Demo 推荐走 Vercel：

1. GitHub 仓库作为唯一代码源。
2. 本地完成开发和构建验证。
3. 推送到 GitHub。
4. Vercel 连接 GitHub 仓库并部署。
5. 部署后使用浏览器验证页面加载、核心交互和响应式表现。

## 认证与安全约定

- 不在聊天、代码、文档中记录 GitHub token、Vercel token、OpenAI API Key 等敏感凭据。
- 本地 Git 提交身份固定为：`lljjcc426 <204199163+lljjcc426@users.noreply.github.com>`。
- 如后续接入模型 API，使用 `.env.local` 保存本地密钥，并通过 `.gitignore` 排除。
- Demo 首版可以使用内置模拟 AI 输出，确保没有 API Key 时也能完整演示。

## 当前不立即部署额外 MCP 的原因

求职类 MCP 主要价值在真实岗位搜索和外部平台连接，但首版作业评分重点是产品设计、功能完整度、交互体验和落地可行性。直接接入外部求职平台会带来以下问题：

- 平台规则和稳定性不可控。
- 可能涉及账号登录、Cookie 或爬取限制。
- 评审演示中不一定需要真实岗位源，内置岗位样例更稳定。

因此首版先实现可解释匹配与简历优化闭环；真实岗位搜索作为后续增强模块。

