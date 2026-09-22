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
| 当前构建与运行证据 | `docs/RELEASE_EVIDENCE_20260920.md` | 环境、自动化、HAP 哈希、原生入口、OCR 文件选择、原生 AI 面试和可信降级 | 已补充 |
| 当前原生 HAP 构建证据 | `docs/RELEASE_EVIDENCE_20260920.md` | D 盘 DevEco、ASCII staging、ArkTS 编译、HAP 哈希和当前限制 | 已补充 |

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
| 上一版原生 HarmonyOS 开场动效 | `docs/evidence-screenshots/harmony-native-intro-20260920.jpeg` | ArkUI/ArkTS 原生品牌开场的上一版视觉证据 | 历史材料 |
| 上一版原生 HarmonyOS 模拟器首页 | `docs/evidence-screenshots/harmony-native-emulator-home-20260920.jpeg` | 前端成熟化前的原生首页，用于界面对比 | 历史材料 |
| 当前原生开场动效 | `docs/evidence-screenshots/harmony-native-intro-mature-20260921.jpeg` | 保留蓝青机器人品牌画风，移除面向用户的技术实现文案 | 已补充 |
| 当前原生今日工作台 | `docs/evidence-screenshots/harmony-native-home-mature-20260921.jpeg` | 今日重点前置、三项关键指标、岗位证据和求职主线进入首屏 | 已补充 |
| 当前原生首次任务 | `docs/evidence-screenshots/harmony-native-first-task-20260922.jpeg` | 简历经历为空时，“今日重点”优先引导建立求职画像，并将该步骤纳入待处理计数 | 已补充 |
| 当前原生跨页任务连续性 | `docs/evidence-screenshots/harmony-native-task-continuity-20260922.jpeg` | 非主任务页面顶部持续显示真实下一行动，点击“继续”可精准返回目标页面 | 已补充 |
| 当前原生显示适配 | `docs/evidence-screenshots/harmony-native-display-adaptation-20260921.jpeg` | 亮色模式下内容避让系统状态栏与手势区，底部导航保持完整可操作 | 已补充 |
| 当前原生深色模式 | `docs/evidence-screenshots/harmony-native-dark-mode-20260921.jpeg` | 系统深色模式通过资源限定目录切换语义色，蓝青品牌层级与信息辨识度保持一致 | 已补充 |
| 当前原生宽屏布局 | `docs/evidence-screenshots/harmony-native-wide-layout-20260921.jpeg` | 2688 x 1216 横屏下切换左侧导航轨，内容限制最大宽度并利用横向空间 | 已补充 |
| 当前原生系统大字体 | `docs/evidence-screenshots/harmony-native-large-font-20260921.jpeg` | 系统“特大”字号下标题、指标、按钮和底部导航均可读，页面内容可完整滚动访问 | 已补充 |
| 当前原生数据与隐私中心 | `docs/evidence-screenshots/harmony-native-data-center-20260922.jpeg` | 本机简历版本、追踪岗位、投递事件和有效证据计数，以及实际数据边界说明 | 已补充 |
| 当前原生账号与数据操作 | `docs/evidence-screenshots/harmony-native-data-privacy-actions-20260922.jpeg` | 华为账号状态、系统分享入口与本机工作区清除入口在深色特大字号下完整可访问 | 已补充 |
| 当前原生清除确认 | `docs/evidence-screenshots/harmony-native-clear-data-confirmation-20260922.jpeg` | 原生危险操作确认明确删除范围、不可撤销性，以及账号登录状态和系统权限不受影响 | 已补充 |
| 当前原生简历与画像 | `docs/evidence-screenshots/harmony-native-resume-mature-20260921.jpeg` | 紧凑标题栏、统一输入控件、导入操作和简历版本入口 | 已补充 |
| 当前原生字段即时校验 | `docs/evidence-screenshots/harmony-native-validation-errors-20260921.jpeg` | 空简历经历提交后同步显示红色边框、字段原因和页面级纠正提示 | 已补充 |
| 当前原生全局操作反馈 | `docs/evidence-screenshots/harmony-native-global-feedback-20260922.jpeg` | 深色模式与系统“特大”字号下，关键保存、校验和状态操作使用原生语义横幅反馈；支持手动关闭并自动消失，且不遮挡底部导航 | 已补充 |
| 当前原生键盘避让 | `docs/evidence-screenshots/harmony-native-keyboard-avoid-20260921.jpeg` | ArkUI `RESIZE` 模式下焦点输入框、底部导航和系统软键盘均保持可见 | 已补充 |
| 当前原生未保存离开保护 | `docs/evidence-screenshots/harmony-native-unsaved-dialog-20260921.jpeg` | 简历草稿变更后切换页面会显示原生确认对话框，并明确恢复上次保存内容 | 已补充 |
| 当前原生岗位中心 | `docs/evidence-screenshots/harmony-native-jobs-mature-20260921.jpeg` | 官方岗位搜索、本机岗位与证据指标采用统一层级和状态色 | 已补充 |
| 当前原生岗位空状态 | `docs/evidence-screenshots/harmony-native-jobs-empty-mature-20260921.jpeg` | 官方岗位无结果时显示完整空状态，并引导调整条件或继续本机录入 | 已补充 |
| 当前原生岗位服务状态 | `docs/evidence-screenshots/harmony-native-job-service-state-20260922.jpeg` | 在线岗位服务未连接时显示独立失败态，不误报为搜索无结果，并继续衔接本机真实岗位录入 | 已补充 |
| 当前原生面试训练 | `docs/evidence-screenshots/harmony-native-interview-mature-20260921.jpeg` | 面试模式分段选择、会话授权、问题与回答入口的原生页面 | 已补充 |
| 当前原生成长计划 | `docs/evidence-screenshots/harmony-native-growth-mature-20260921.jpeg` | 当前覆盖、完成后预测、有效证据和待办任务的统一工作流 | 已补充 |
| 当前原生真实岗位录入 | `docs/evidence-screenshots/harmony-native-job-tracking-20260920.jpeg` | 岗位、公司、来源链接和 JD 由 ArkUI 原生表单录入并保存到本机 | 已补充 |
| 当前原生岗位字段校验 | `docs/evidence-screenshots/harmony-native-job-validation-20260920.jpeg` | 空提交显示明确错误，不生成虚构岗位数据 | 已补充 |
| 当前原生官方岗位列表 | `docs/evidence-screenshots/harmony-native-official-jobs-20260920.jpeg` | Network Kit 读取官方招聘源并按目标岗位严格筛选，保留来源状态和验证标签 | 已补充 |
| 当前原生岗位详情 | `docs/evidence-screenshots/harmony-native-job-detail-20260920.jpeg` | ArkUI 原生详情展示来源、JD、保存追踪和系统官方投递入口 | 已补充 |
| 当前原生岗位离线降级 | `docs/evidence-screenshots/harmony-native-job-offline-fallback-20260920.jpeg` | 服务不可用时明确提示并保留本机真实岗位录入，不展示伪造岗位 | 已补充 |
| 当前原生投递阶段 | `docs/evidence-screenshots/harmony-native-application-stage-20260921.jpeg` | ArkUI 原生六阶段投递看板、截止/面试日程和阶段化下一行动 | 已补充 |
| 当前原生投递时间线 | `docs/evidence-screenshots/harmony-native-application-timeline-20260921.jpeg` | 阶段变更追加本机事件，并已验证强制停止后二次启动恢复 | 已补充 |
| Calendar Kit 系统提醒 | `docs/evidence-screenshots/harmony-native-calendar-editor-20260921.jpeg` | 模拟器打开系统新建日程编辑器，正确预填测试岗位、18:00–18:30、提前 1 天/1 小时提醒和下一行动；随后选择放弃，未保存事件 | 已补充 |
| Form Kit 参数路由辅助证据 | `docs/evidence-screenshots/harmony-native-form-route-growth-20260921.jpeg` | 以卡片同结构的 `page=growth` Ability 参数验证前台路由接收和成长页切换 | 已补充 |
| Form Kit 桌面卡片 | `docs/evidence-screenshots/harmony-native-form-desktop-20260921.jpeg` | 动态卡片在桌面显示下一行动、成长证据 `1/3` 和实证覆盖 `51%`；覆盖安装和应用进程终止后仍保留 | 已补充 |
| Form Kit 冷启动精准路由 | `docs/evidence-screenshots/harmony-native-form-coldstart-growth-20260921.jpeg` | 应用被强制停止后真实点击桌面卡片，系统触发 `RouterEvent`，冷启动并直接进入成长页 | 已补充 |
| 当前原生投递版本门禁 | `docs/evidence-screenshots/harmony-native-application-version-gate-20260921.jpeg` | 未绑定当前岗位的实际简历版本时，原生看板阻止进入已投递、面试和 Offer | 已补充 |
| 当前原生简历版本绑定 | `docs/evidence-screenshots/harmony-native-resume-version-binding-20260921.jpeg` | ArkUI 原生保存两版完整简历、展示差异摘要、切换绑定并保护当前绑定版本 | 已补充 |
| 当前原生 AI 会话授权 | `docs/evidence-screenshots/harmony-native-ai-consent-20260921.jpeg` | 外部模型默认未授权；授权说明包含发送前脱敏和服务端密钥边界 | 已补充 |
| 当前原生 AI 面试开始 | `docs/evidence-screenshots/harmony-native-ai-started-20260921.jpeg` | 授权后由本机首题开始，页面显示题型、轮次和回答入口 | 已补充 |
| 当前原生 AI 可信降级 | `docs/evidence-screenshots/harmony-native-ai-fallback-20260921.jpeg` | 无 `ARK_API_KEY` 时进入本机第 2 轮并明确提示模型不可用，首轮回答保留 | 已补充 |
| 当前原生 AI 本机反馈 | `docs/evidence-screenshots/harmony-native-ai-feedback-20260921.jpeg` | 本机反馈明确给出证据状态、主要缺口和下一轮行动 | 已补充 |
| 当前原生 AI 成长任务 | `docs/evidence-screenshots/harmony-native-ai-growth-task-20260921.jpeg` | 面试反馈生成 STAR 复盘任务并进入原生成长驾驶舱 | 已补充 |
| 当前原生 AI 重启恢复 | `docs/evidence-screenshots/harmony-native-ai-restored-20260921.jpeg` | 强制停止并启动后恢复第 2 轮问题和 1 轮回答，同时会话授权按设计重置 | 已补充 |
| 当前原生成长证据账本 | `docs/evidence-screenshots/harmony-native-evidence-ledger-20260921.jpeg` | HTTPS 来源、用户确认、内容指纹和有效/已撤销记录；强制停止后有效记录与 `51%` 实证覆盖恢复 | 已补充 |
| 当前原生成长证据撤销 | `docs/evidence-screenshots/harmony-native-evidence-revoked-20260921.jpeg` | 撤销后覆盖率回退到 `42%`，账本保留指纹、提交时间、撤销时间和审计记录 | 已补充 |
| 当前原生成长来源核验 | `docs/evidence-screenshots/harmony-native-evidence-source-verified-20260921.jpeg` | Network Kit 对公开 GitHub HTTPS 来源执行 HEAD 并返回 `HTTP 200`，页面保存主机、方法、状态码和核验时间；强制停止后恢复。流式 Range GET 降级已编译并覆盖安装，待限制 HEAD 的公开站点补充成功截图 | 部分补充 |
| 当前简历版本管理 | `docs/evidence-screenshots/resume-version-manager-20260722.png` | 保存两版、差异摘要、恢复、删除以及已绑定版本保护 | 已补充 |
| 当前投递版本绑定 | `docs/evidence-screenshots/application-version-binding-20260722.png` | 具体简历版本与“已投递”阶段绑定 | 已补充 |

> 2026-07-08 的岗位评分、能力雷达和简历优化截图属于历史界面，只能用于说明 UI 沿革。当前原生构建和模拟器运行证据以 `docs/RELEASE_EVIDENCE_20260920.md` 及上方原生首页截图为准。

## 4. 性能测试证据

| 测试项 | 结果来源 | 状态 |
| --- | --- | --- |
| 构建验证 | `npm run build` | 已通过，2026-07-22 |
| 核心可信性 | `npm run verify:evidence` | 已通过，含 20 组对抗样例和版本绑定测试 |
| 旧评分退出检查 | `npm run verify:claims` | 已通过，同时扫描源码与 HAP 静态资源 |
| UI 验证 | `npm run verify:ui` | 已通过，含版本保存、投递绑定和刷新恢复 |
| HAP 构建 | `npm run build:harmony` | 已通过，2026-09-22，SHA-256 已记录 |
| HAP 模拟器安装/启动 | `npm run run:harmony:emulator` | 本轮已通过，HAP 安装成功，`EntryAbility` 进入前台，五个主页面与开场动效完成视觉回归 |
| 真实模型调用耗时 | `docs/REAL_MODEL_CALL_EVIDENCE.md`；`docs/PERFORMANCE_TEST_REPORT.md` | 已补充 Gitee AI 控制台记录 |
| 模型调用成功率 | `docs/REAL_MODEL_CALL_EVIDENCE.md`；`docs/PERFORMANCE_TEST_REPORT.md` | 已补充 200 状态调用记录 |

## 5. 真实调用日志证据

| 日志 | 路径 | 状态 |
| --- | --- | --- |
| 脱敏模型调用日志 | `docs/REAL_MODEL_CALL_EVIDENCE.md` | 已补充 |
| Gitee AI 调用记录截图 | `docs/evidence-screenshots/gitee-ai-real-call-record-20260708.png` | 已补充，未包含访问令牌 |
| 部署平台函数日志截图 | 后续补充 | 可选 |
| 日志字段说明 | `docs/RUNTIME_LOG_GUIDE.md` | 已有 |

> 既有 Gitee AI 日志证明历史 Web/服务端链路曾成功调用模型，不等同于 2026-09-21 原生 HAP 的模型成功调用证据。本次原生验证环境未配置 `ARK_API_KEY`，只证明 Network Kit 链路已实现、编译通过并能可信降级。

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
