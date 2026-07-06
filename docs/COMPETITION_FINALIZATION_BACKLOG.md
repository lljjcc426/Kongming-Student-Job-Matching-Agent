# 比赛最终提交收尾清单

本文档用于集中管理 Kongming Student Job Matching Agent 参赛提交前的最后收尾工作。后续维护者或智能体应优先在现有 Markdown 文件中补充真实链接、截图路径、测试数据、脱敏日志和平台提交信息，不再重复新增大量说明文档。

## 1. 当前文档体系状态

| 文档 | 用途 | 当前状态 | 后续动作 |
| --- | --- | --- | --- |
| `README.md` | 项目总览和快速入口 | 已有 | 后续只补 Demo 链接、截图路径、最终模型说明 |
| `docs/PROJECT_ARCHITECTURE_AND_UNDERSTANDING.md` | 项目架构理解 | 已有 | 后续只在架构变化时更新 |
| `docs/TECHNICAL_DESIGN.md` | 技术说明 | 已有 | 后续只补模型 Provider 或算力适配说明 |
| `docs/DEPLOYMENT_GUIDE.md` | 部署指南 | 已有 | 后续只补最终部署链接和环境变量截图说明 |
| `docs/SUBMISSION_CHECKLIST.md` | 比赛提交清单 | 已有 | 后续按完成情况勾选 |
| `docs/DEMO_AND_EVIDENCE_GUIDE.md` | 演示材料说明 | 已有 | 后续补视频链接和截图路径 |
| `docs/PERFORMANCE_TEST_REPORT.md` | 性能测试报告模板 | 已有 | 后续填真实测试数据 |
| `docs/RUNTIME_LOG_GUIDE.md` | 真实调用日志说明 | 已有 | 后续填脱敏日志路径 |
| `docs/OPEN_SOURCE_ATTRIBUTION.md` | 开源来源说明 | 已有 | 后续补素材和 License 确认 |
| `docs/CREATIVE_PLAN_STAGE1.md` | 创意规划 PPT 骨架 | 已有 | 后续据此制作 PPT |
| `docs/FINAL_SUBMISSION_PACKAGE.md` | 最终提交材料统一索引 | 本轮新增 | 后续补 GitLink 地址、最终 commit 和材料链接 |
| `docs/EVIDENCE_INDEX.md` | Demo、截图、日志、性能测试证据索引 | 本轮新增 | 后续集中补真实证据路径 |
| `docs/CODEX_QA_PROCESS.md` | Codex QA 过程记录 | 本轮新增 | 后续记录每轮问题、回答和 commit |
| `docs/THIRD_PARTY_LICENSES.md` | 第三方依赖与素材 License 汇总 | 本轮新增 | 后续核对依赖、素材和运行时资源授权 |

## 2. 后续只需填充的材料

| 材料 | 后续填入位置 | 填写内容 | 是否需要新增文档 |
| --- | --- | --- | --- |
| Demo 视频链接 | `README.md`；`docs/DEMO_AND_EVIDENCE_GUIDE.md`；`docs/FINAL_SUBMISSION_PACKAGE.md` | 视频 URL、时长、展示流程 | 否 |
| 运行截图 | `docs/DEMO_AND_EVIDENCE_GUIDE.md`；`docs/EVIDENCE_INDEX.md` | 截图路径、说明、是否脱敏 | 否 |
| 性能测试数据 | `docs/PERFORMANCE_TEST_REPORT.md` | 测试环境、样本数、耗时、成功率 | 否 |
| 真实调用日志 | `docs/RUNTIME_LOG_GUIDE.md`；`docs/EVIDENCE_INDEX.md` | 脱敏日志路径、字段说明 | 否 |
| GitLink 仓库地址 | `README.md`；`docs/FINAL_SUBMISSION_PACKAGE.md` | GitLink 公开仓库 URL | 否 |
| GitHub commit 记录 | `docs/CODEX_QA_PROCESS.md`；`docs/FINAL_SUBMISSION_PACKAGE.md` | commit hash、message、验证结果 | 否 |
| 模型与算力适配证据 | `README.md`；`docs/TECHNICAL_DESIGN.md`；`docs/PERFORMANCE_TEST_REPORT.md` | 模型名、平台、调用证据、日志 | 否 |
| 第三方 License | `docs/THIRD_PARTY_LICENSES.md`；`docs/OPEN_SOURCE_ATTRIBUTION.md` | 依赖、素材、授权状态 | 否 |

## 3. 不需要再新增大量文档的说明

后续完成比赛材料时，优先在已有文档中填充真实内容，不再新建大量说明文档。

推荐填充顺序：

1. `docs/FINAL_SUBMISSION_PACKAGE.md`
2. `docs/EVIDENCE_INDEX.md`
3. `docs/DEMO_AND_EVIDENCE_GUIDE.md`
4. `docs/PERFORMANCE_TEST_REPORT.md`
5. `docs/RUNTIME_LOG_GUIDE.md`
6. `docs/CODEX_QA_PROCESS.md`
7. `README.md`

如果后续确实发生代码架构变化、模型 Provider 变化或部署方式变化，再同步更新：

1. `docs/PROJECT_ARCHITECTURE_AND_UNDERSTANDING.md`
2. `docs/TECHNICAL_DESIGN.md`
3. `docs/DEPLOYMENT_GUIDE.md`

## 4. 最终提交前检查表

- [ ] GitLink 公开仓库地址已补充
- [ ] GitHub commit 历史可查看
- [ ] README 已补最终 Demo 链接
- [ ] Demo 视频链接可访问
- [ ] 运行截图已脱敏
- [ ] 性能测试数据来自真实环境
- [ ] 真实调用日志已脱敏
- [ ] 模型与算力环境说明真实
- [ ] Gitee.AI / 沐曦适配要求已确认
- [ ] 第三方依赖 License 已核对
- [ ] 素材来源已核对
- [ ] Codex QA 过程记录已更新
- [ ] 文档中不存在虚假链接和虚假数据

## 5. 后续任务入口

后续每完成一项材料，只需要更新以下对应文件：

| 后续动作 | 更新文件 |
| --- | --- |
| 上传 Demo 视频 | `README.md`；`docs/DEMO_AND_EVIDENCE_GUIDE.md`；`docs/FINAL_SUBMISSION_PACKAGE.md` |
| 生成截图 | `docs/DEMO_AND_EVIDENCE_GUIDE.md`；`docs/EVIDENCE_INDEX.md` |
| 完成性能测试 | `docs/PERFORMANCE_TEST_REPORT.md`；`docs/EVIDENCE_INDEX.md` |
| 整理真实调用日志 | `docs/RUNTIME_LOG_GUIDE.md`；`docs/EVIDENCE_INDEX.md` |
| 同步 GitLink 仓库 | `README.md`；`docs/FINAL_SUBMISSION_PACKAGE.md` |
| 确认模型平台 | `README.md`；`docs/TECHNICAL_DESIGN.md`；`docs/PERFORMANCE_TEST_REPORT.md` |
| 核对 License | `docs/THIRD_PARTY_LICENSES.md`；`docs/OPEN_SOURCE_ATTRIBUTION.md` |
| 完成一轮 Codex 修改 | `docs/CODEX_QA_PROCESS.md` |

## 6. 不在本轮处理的事项

以下事项不应在本文档中伪造成已完成：

- Demo 视频链接：提交前补充。
- 运行截图路径：提交前补充。
- 真实性能测试结果：待真实环境验证。
- 真实模型调用日志：待脱敏整理。
- GitLink Issue：当前为可选补充项，如比赛平台最终强制要求再创建。
- Gitee.AI / 沐曦适配：待维护者确认最终比赛环境和接口要求。
- 第三方素材授权：待维护者逐项核对。
