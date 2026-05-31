# 多智能体与多模态架构设计

## 参考框架结论

本项目参考了几类开源多智能体框架的设计思想，但不直接引入重型运行时：

| 框架 | 可借鉴点 | 本项目采用方式 |
| --- | --- | --- |
| CrewAI | 以角色、目标、任务组织智能体，适合业务流程编排 | 将求职流程拆成简历解析、岗位发现、匹配评估、简历优化、模拟面试等角色 |
| AutoGen | 多智能体通过会话协作，强调 agent-to-agent 交互 | 采用统一消息与产物结构，让每个智能体消费上游结果并输出结构化结论 |
| LangGraph | 用图结构表达流程、分支、循环与共享状态 | 使用“输入层 -> 编排层 -> 智能体层 -> 产物层 -> 展示层”的分层结构 |
| MetaGPT | 用标准流程和共享消息池降低角色混乱 | 为每个智能体定义输入、输出、证据和下一步动作，避免只做自由聊天 |

## 设计原则

1. 先做稳定可演示的确定性智能体，再预留真实模型和联网工具接入点。
2. 每个智能体必须有清晰职责、输入、输出和证据来源。
3. 多智能体不是简单并列卡片，而是围绕同一份求职上下文共享状态、传递产物。
4. 多模态能力采用渐进式设计：首版支持文本简历和文本 JD，后续扩展 PDF、图片简历、作品集链接和语音面试。
5. 所有输出都应辅助学生决策，不承诺真实筛选结果。

## 分层架构

```text
输入层
  - 简历文本
  - 简历文件
  - 岗位 JD
  - 岗位样例库
  - 模拟面试回答

编排层
  - Workflow Orchestrator
  - 共享上下文 AgentContext
  - 事件流 AgentEvent
  - 产物列表 AgentArtifact

智能体层
  - Resume Intake Agent
  - Job Discovery Agent
  - Match Reasoning Agent
  - Resume Strategy Agent
  - Interview Coach Agent
  - Supervisor Agent

产物层
  - 学生画像摘要
  - 岗位搜索计划
  - 匹配评分与证据
  - 简历优化稿
  - 面试问题与反馈
  - Markdown 分析报告

展示层
  - 多智能体协作台
  - 岗位匹配工作台
  - 初筛优化建议
  - 模拟面试交互
```

## 智能体职责

| 智能体 | 输入 | 输出 | 作用 |
| --- | --- | --- | --- |
| Resume Intake Agent | 简历文本、文件内容、学生样例画像 | 能力信号、经历证据、信息缺口 | 将原始简历转成结构化画像 |
| Job Discovery Agent | 求职方向、城市偏好、岗位库、JD | 检索词、搜索入口、候选岗位排序 | 模拟联网岗位发现流程，后续可接真实搜索 API |
| Match Reasoning Agent | 学生画像、候选岗位、关键词 | 多维评分、优势、风险、证据 | 解释为什么匹配或不匹配 |
| Resume Strategy Agent | 匹配结果、缺口关键词 | 简历改写建议、优化稿、行动清单 | 提升材料表达质量 |
| Interview Coach Agent | 目标岗位、匹配风险、用户回答 | 面试问题、回答评分、改进建议 | 形成求职准备闭环 |
| Supervisor Agent | 所有智能体产物 | 最终结论、下一步优先级、风险提示 | 做统一协调和输出收敛 |

## 多模态扩展路线

首版：

- 文本简历粘贴。
- 文本文件上传。
- 文本 JD 粘贴。
- 模拟面试文本回答。

增强版：

- PDF / DOCX 简历解析。
- 图片简历 OCR。
- 作品集链接解析。
- 语音模拟面试转写与反馈。
- 联网岗位搜索与岗位去重。

## 当前实现策略

当前代码采用轻量运行时：

- `agentRuntime.ts`：定义智能体、共享上下文、事件和产物协议。
- `agents.ts`：实现适配求职工作流的智能体团队。
- `matchEngine.ts`：提供可解释评分能力。
- `resumeOptimizer.ts`：生成简历优化稿。
- `jobParser.ts`：解析自定义岗位 JD。

这样做的好处是：没有外部密钥时 Demo 仍可完整运行；后续接入模型、搜索 API 或 OCR 时，只需要替换单个智能体的执行函数，不需要重写页面。

## 参考链接

- CrewAI: https://docs.crewai.com/introduction
- AutoGen: https://microsoft.github.io/autogen/docs/Use-Cases/agent_chat/
- LangGraph Multi-agent: https://langchain-ai.github.io/langgraph/tutorials/multi_agent/multi-agent-collaboration/
- MetaGPT: https://github.com/FoundationAgents/MetaGPT

