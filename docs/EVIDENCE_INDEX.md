# 证据材料索引

本文档集中记录 Demo、PPT、截图、性能测试、真实调用日志和开发记录证据，避免 README、部署指南、性能报告和日志说明中重复维护大量路径。当前文件只保留真实材料和待补充项，不包含虚假链接、虚假截图路径或虚假日志路径。

## 1. Demo 视频

| 项 | 内容 |
| --- | --- |
| 视频链接 | [百度网盘分享](https://pan.baidu.com/s/1u9xx_ODpfSq4vFZOGi6qlA?pwd=48mf)，提取码：`48mf` |
| 视频文件 | `6月12日.mp4` |
| 视频时长 | 以网盘文件为准 |
| 展示功能 | 简历解析、岗位推荐、JD 分析、简历优化、模拟面试、AI 助手 |
| 是否脱敏 | 已使用网盘链接提交，公开展示前再次确认 |

## 2. 文档材料

| 材料 | 路径 | 说明 | 状态 |
| --- | --- | --- | --- |
| 项目展示 PPT | `docs/materials/kongming.pptx` | 项目场景、功能设计、架构与效果展示 | 已补充 |
| 本轮构建与运行证据 | `docs/RELEASE_EVIDENCE_20260722.md` | 环境、自动化、HAP 哈希、安装和两次启动 | 已补充 |

## 3. 运行截图

| 截图 | 路径 | 说明 | 状态 |
| --- | --- | --- | --- |
| 历史版首页 - 岗位推荐展示 | `docs/evidence-screenshots/app-home-job-matching-20260708.png` | 旧首页和岗位推荐卡片，仅作 UI 沿革 | 历史材料 |
| 历史版首页 - 能力图谱展示 | `docs/evidence-screenshots/app-home-ability-radar-20260708.png` | 旧能力图谱已废弃，仅作 UI 沿革 | 历史材料 |
| 简历解析 | `docs/evidence-screenshots/app-resume-analysis-summary-20260708.png` | 学生画像、识别进度和模型增强结果 | 已补充 |
| 简历优化建议 | `docs/evidence-screenshots/app-resume-optimization-suggestions-20260708.png` | 经历结构化、优化简历片段和投递清单 | 已补充 |
| 历史版岗位推荐列表 | `docs/evidence-screenshots/app-job-recommendation-cards-20260708.png` | 旧推荐列表，仅作 UI 沿革，不作为当前匹配逻辑证据 | 历史材料 |
| 历史版岗位详情 | `docs/evidence-screenshots/app-job-detail-match-score-20260708.png` | 仅用于 UI 沿革；旧五维评分已废弃，不作为当前业务证据 | 历史材料 |
| 模拟面试 | `docs/evidence-screenshots/app-interview-simulation-20260708.png` | AI 数字人面试官、面试模式和回答输入 | 已补充 |
| AI 助手 | `docs/evidence-screenshots/app-ai-assistant-20260708.png` | 多轮求职问答入口和智能体上下文 | 已补充 |
| HarmonyOS 模拟器首页 | `docs/evidence-screenshots/harmony-emulator-home-20260722.jpeg` | API 24 模拟器安装并二次启动后的当前首页 | 已补充 |
| 当前简历版本管理 | `docs/evidence-screenshots/resume-version-manager-20260722.png` | 保存两版、差异摘要、恢复、删除以及已绑定版本保护 | 已补充 |
| 当前投递版本绑定 | `docs/evidence-screenshots/application-version-binding-20260722.png` | 具体简历版本与“已投递”阶段绑定 | 已补充 |

> 2026-07-08 的岗位评分、能力雷达和简历优化截图属于历史界面，只能用于说明 UI 沿革。当前业务证据以 2026-07-22 自动化输出、HAP 运行截图和新版录屏为准。

## 4. 性能测试证据

| 测试项 | 结果来源 | 状态 |
| --- | --- | --- |
| 构建验证 | `npm run build` | 已通过，2026-07-22 |
| 核心可信性 | `npm run verify:evidence` | 已通过，含 20 组对抗样例和版本绑定测试 |
| 旧评分退出检查 | `npm run verify:claims` | 已通过，同时扫描源码与 HAP 静态资源 |
| UI 验证 | `npm run verify:ui` | 已通过，含版本保存、投递绑定和刷新恢复 |
| HAP 构建 | `npm run build:harmony:local` | 已通过，SHA-256 已记录 |
| HAP 模拟器安装/启动 | `npm run run:harmony:emulator` | 冷启动后安装、首次启动和二次启动通过 |
| 真实模型调用耗时 | `docs/REAL_MODEL_CALL_EVIDENCE.md`；`docs/PERFORMANCE_TEST_REPORT.md` | 已补充 Gitee AI 控制台记录 |
| 模型调用成功率 | `docs/REAL_MODEL_CALL_EVIDENCE.md`；`docs/PERFORMANCE_TEST_REPORT.md` | 已补充 200 状态调用记录 |

## 5. 真实调用日志证据

| 日志 | 路径 | 状态 |
| --- | --- | --- |
| 脱敏模型调用日志 | `docs/REAL_MODEL_CALL_EVIDENCE.md` | 已补充 |
| Gitee AI 调用记录截图 | `docs/evidence-screenshots/gitee-ai-real-call-record-20260708.png` | 已补充，未包含访问令牌 |
| 部署平台函数日志截图 | 后续补充 | 可选 |
| 日志字段说明 | `docs/RUNTIME_LOG_GUIDE.md` | 已有 |

## 6. 开发过程证据

| 证据 | 位置 | 状态 |
| --- | --- | --- |
| Git commit 历史 | `git log` | 已有 |
| 构建验证结果 | `docs/PERFORMANCE_TEST_REPORT.md` | 已记录 |
| 模型调用记录 | `docs/REAL_MODEL_CALL_EVIDENCE.md` | 已记录 |

## 7. 证据脱敏要求

整理证据材料时，需要确认：

- 截图中不包含真实 API Key、账号密码、Cookie 或完整密钥片段。
- 简历样例不包含真实学生姓名、手机号、邮箱、身份证号或学校内部敏感信息。
- 日志不包含完整请求头、Authorization、原始简历全文或可识别个人身份的信息。
- Demo 视频中不展示浏览器 DevTools 中的敏感请求。
- 如使用部署平台日志截图，需要遮挡密钥、项目内部 token 和未公开账号信息。
