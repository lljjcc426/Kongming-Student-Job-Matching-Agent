# 比赛提交材料清单

本文用于整理 Kongming Student Job Matching Agent 参赛提交材料。勾选状态应由维护者在最终提交前根据实际材料更新。

## 一、GitLink 仓库

- [ ] 完整智能体代码  
  当前对应路径：`src/agentRuntime.ts`、`src/agents.ts`、`src/App.tsx`、`src/pages/InterviewPage.tsx`、`server/arkCore.js`。

- [ ] 模型接口调用代码  
  当前对应路径：`src/arkClient.ts`、`api/ark.js`、`server/arkCore.js`、`vite.config.ts`。  
  待确认：若提交要求必须使用 Gitee.AI/沐曦资源包 API，需要补充或替换当前 Ark 兼容调用。

- [ ] 配置文件与依赖清单  
  当前对应路径：`package.json`、`package-lock.json`、`vite.config.ts`、`vercel.json`、`tsconfig.json`。  
  待补充：如需公开环境变量模板，可新增 `.env.example`，但不能包含真实密钥。

## 二、文档材料

- [ ] README 完整文档  
  当前对应路径：`README.md`。

- [ ] 创意规划 PPT（阶段一）  
  当前内容骨架：`docs/CREATIVE_PLAN_STAGE1.md`。  
  待补充：正式 PPT 文件或在线链接。

- [ ] 技术说明文档  
  当前对应路径：`docs/TECHNICAL_DESIGN.md`。

- [ ] 部署指南  
  当前对应路径：`docs/DEPLOYMENT_GUIDE.md`。

- [ ] 项目架构与理解文档  
  当前对应路径：`docs/PROJECT_ARCHITECTURE_AND_UNDERSTANDING.md`。

## 三、演示材料

- [ ] Demo 演示视频链接  
  当前状态：待提交前补充。  
  整理说明：`docs/DEMO_AND_EVIDENCE_GUIDE.md`。

- [ ] 运行截图  
  当前状态：待提交前补充。  
  可通过 `npm run verify:ui` 生成验证截图，但提交前需要筛选和脱敏。

- [ ] 性能测试报告  
  当前模板：`docs/PERFORMANCE_TEST_REPORT.md`。  
  待补充：最终运行环境下的真实测试数据。

- [ ] 真实调用日志  
  当前说明：`docs/RUNTIME_LOG_GUIDE.md`。  
  待补充：目标模型和算力环境的脱敏调用日志。

## 四、开发记录

- [ ] Issue 记录  
  当前建议模板：`docs/ISSUE_RECORD_GUIDE.md`。  
  待补充：GitLink 平台真实 Issue。

- [ ] Commit 历史  
  当前仓库已有 Git commit 历史。提交平台应以仓库历史为准。

- [ ] 功能开发记录  
  当前已有部分文档：`docs/00-project-charter.md` 至 `docs/10-solution-brief.md`。  
  待补充：GitLink Issue 中按功能模块整理开发记录。

## 五、开源代码使用与原创说明

- [ ] README 中已说明参考来源  
  当前对应章节：`README.md` 的“开源代码参考来源”。

- [ ] 已说明功能扩展或场景改造  
  当前对应路径：`docs/OPEN_SOURCE_ATTRIBUTION.md`、`docs/01-open-source-benchmark.md`、`docs/05-open-source-selection-matrix.md`。

- [ ] 未直接复制已有项目作为参赛作品  
  当前说明：本项目采用自研 React/Vite 工作台、轻量智能体运行时和求职匹配流程，参考开源项目仅用于能力设计对比。

## 六、提交前人工检查

- [ ] 公网 Demo 链接可访问。
- [ ] 模型接口已在目标算力环境完成真实调用。
- [ ] 调用日志已脱敏。
- [ ] 性能数据来自真实测试，不使用估算数字。
- [ ] 演示视频链接有效。
- [ ] 运行截图不包含真实隐私或密钥。
- [ ] README 与实际代码一致。
- [ ] 文档未把后续规划写成已完成功能。
- [ ] GitLink 仓库权限、License 和开源来源说明完整。
