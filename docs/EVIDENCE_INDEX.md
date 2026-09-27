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
| 当前原生导航与待办角标 | `docs/evidence-screenshots/harmony-native-navigation-polish-20260922.jpeg` | 五个主入口使用原生按钮语义，下一行动所在页签显示动态待办角标；深色模式与系统“特大”字号下选中态、图标、标签和角标均保持完整 | 已补充 |
| 当前原生成熟工作台 | `docs/evidence-screenshots/harmony-native-workbench-polish-20260922.jpeg` | 中性灰底、克制靛蓝与多语义状态色组成新的原生视觉体系；首页下一行动、指标、岗位快照和求职主线形成紧凑工作台层级 | 已补充 |
| 当前原生成熟岗位页 | `docs/evidence-screenshots/harmony-native-jobs-polish-20260922.jpeg` | 岗位中心统一使用紧凑页面标题、专业表单层级、轻量卡片边界和顶部指示式导航，浅色标准字号下无裁切或重叠 | 已补充 |
| 当前原生简历资料中心 | `docs/evidence-screenshots/harmony-native-resume-workspace-polish-20260922.jpeg` | 资料完整度、基础画像和经历证据分组清晰，输入控件与本机保存状态可在首屏快速扫描 | 已补充 |
| 当前原生岗位工作流 | `docs/evidence-screenshots/harmony-native-jobs-workflow-polish-20260922.jpeg` | 搜索来源、保存追踪、核对证据三步主线前置，官方岗位搜索与本机证据区层级明确 | 已补充 |
| 当前原生面试设置页 | `docs/evidence-screenshots/harmony-native-interview-setup-polish-20260922.jpeg` | 面试类型、目标岗位、追问强度和时长先于数字人预览展示；岗位、画像和真实语音试听状态集中反馈 | 已补充 |
| 当前原生面试启动区 | `docs/evidence-screenshots/harmony-native-interview-launch-polish-20260922.jpeg` | 浏览数字人、语音状态和智能增强开关时，固定启动栏持续展示当前配置与开始按钮，且不遮挡底部导航 | 已补充 |
| 当前原生成长行动队列 | `docs/evidence-screenshots/harmony-native-growth-queue-polish-20260922.jpeg` | 覆盖率、行动进度、任务状态和验证摘要按优先级组织，长证据文本收敛为可扫描摘要 | 已补充 |
| 当前原生草稿状态条 | `docs/evidence-screenshots/harmony-native-draft-status-20260922.jpeg` | 简历、岗位或投递日程出现真实修改时，页面顶部显示未保存范围与就地保存按钮；深色模式和系统“特大”字号下完整可读 | 已补充 |
| 当前原生键盘避让 | `docs/evidence-screenshots/harmony-native-keyboard-avoid-20260921.jpeg` | ArkUI `RESIZE` 模式下焦点输入框、底部导航和系统软键盘均保持可见 | 已补充 |
| 当前原生未保存离开保护 | `docs/evidence-screenshots/harmony-native-unsaved-dialog-20260921.jpeg` | 简历草稿变更后切换页面会显示原生确认对话框，并明确恢复上次保存内容 | 已补充 |
| 当前原生岗位中心 | `docs/evidence-screenshots/harmony-native-jobs-mature-20260921.jpeg` | 官方岗位搜索、本机岗位与证据指标采用统一层级和状态色 | 已补充 |
| 当前原生岗位空状态 | `docs/evidence-screenshots/harmony-native-jobs-empty-mature-20260921.jpeg` | 官方岗位无结果时显示完整空状态，并引导调整条件或继续本机录入 | 已补充 |
| 当前原生岗位服务状态 | `docs/evidence-screenshots/harmony-native-job-service-state-20260922.jpeg` | 在线岗位服务未连接时显示独立失败态，不误报为搜索无结果，并继续衔接本机真实岗位录入 | 已补充 |
| 当前原生面试训练 | `docs/evidence-screenshots/harmony-native-interview-mature-20260921.jpeg` | 面试模式分段选择、会话授权、问题与回答入口的原生页面 | 已补充 |
| 当前原生 3D 数字面试官 | `docs/evidence-screenshots/harmony-native-digital-interviewer-20260922.jpeg` | ArkGraphics3D 原生加载可替换 GLB，办公室场景中展示职业面试官，并由 Core Speech 状态驱动动作 | 已补充 |
| 当前 Rocketbox 女性商务面试官 | `docs/evidence-screenshots/harmony-native-avatar-rocketbox-v5-20260926.jpeg` | 默认人物切换为 Microsoft Rocketbox `Business_Female_04`；ArkGraphics3D 原生渲染 8.52 MB GLB，15/15 viseme 与运行时表情目标完整，中性灯光、横屏办公室构图和覆盖安装已通过 API 24 模拟器验证 | 已补充 |
| 当前原生面试办公室 V3 | `docs/evidence-screenshots/harmony-native-interview-office-v3-20260925.jpeg` | CC0 真实办公室背景按 20:9 原生舞台裁切调色，中央人物安全区、两侧景深和桌面前景叠层已通过 API 24 模拟器验证 | 已补充 |
| 当前原生语音异常收口 | `docs/evidence-screenshots/harmony-native-digital-interviewer-recovery-20260922.jpeg` | 模拟器无可用麦克风输入时退出聆听态，人物回到待机并明确提供重试或文字输入路径 | 已补充 |
| 当前原生面试会话配置 | `docs/evidence-screenshots/harmony-native-interview-session-setup-20260922.jpeg` | 面试类型、追问强度、训练时长、岗位上下文、语音状态和智能增强授权集中配置 | 已补充 |
| 当前原生面试会话控制 | `docs/evidence-screenshots/harmony-native-interview-session-active-20260922.jpeg` | 手机宽度下展示轮次、已用时、时长进度、暂停与提前结束控制，无文字或按钮重叠 | 已补充 |
| 当前原生面试暂停态 | `docs/evidence-screenshots/harmony-native-interview-session-paused-20260922.jpeg` | 暂停后计时与语音停止，回答草稿保留，可继续当前问题或提前结束 | 已补充 |
| 当前原生面试暂停恢复 | `docs/evidence-screenshots/harmony-native-interview-session-recovery-20260922.jpeg` | 强制停止应用并重新启动后恢复暂停状态、当前轮次、已用时和回答入口 | 已补充 |
| 当前原生横屏全屏面试 | `docs/evidence-screenshots/harmony-native-interview-landscape-active-20260922.jpeg` | 正式会话自动进入横屏沉浸模式，系统栏、品牌栏和底部导航隐藏；数字人、问题、回答与四项操作均在首屏完整可见 | 已补充 |
| 当前岗位驱动横屏面试 | `docs/evidence-screenshots/harmony-native-job-driven-interview-20260927.jpeg` | 面试准备页采用技术面推荐方案后进入横屏第 1/4 轮，首题直接核验“算法与 AI 实践”，岗位、类型和核验重点贯通 | 已补充 |
| 当前原生横屏作答控制 | `docs/evidence-screenshots/harmony-native-interview-controls-20260922.jpeg` | 朗读与语音采用固定尺寸原生 Symbol，提交本轮和结束复盘保留明确命令；四项操作在横屏首屏完整显示且无文字截断 | 已补充 |
| 当前原生横屏回答专注模式 | `docs/evidence-screenshots/harmony-native-interview-keyboard-focus-20260922.jpeg` | 系统软键盘弹出后仅保留问题、字数、回答框和完成按钮；关闭键盘恢复双栏，系统返回键不会误触发结束面试 | 已补充 |
| 当前原生横屏暂停态 | `docs/evidence-screenshots/harmony-native-interview-landscape-paused-20260922.jpeg` | 横屏全屏暂停遮罩提供继续和结束入口，背景会话上下文保留且无控件裁切 | 已补充 |
| 当前原生横屏恢复 | `docs/evidence-screenshots/harmony-native-interview-landscape-recovery-20260922.jpeg` | 强制停止并重新启动后自动恢复横屏暂停态、轮次、计时和回答入口 | 已补充 |
| 当前原生反馈竖屏回退 | `docs/evidence-screenshots/harmony-native-interview-feedback-portrait-20260922.jpeg` | 横屏正式会话输入有效回答并生成本机反馈后，自动恢复竖屏完成页与标准应用导航 | 已补充 |
| 当前原生结构化面试报告 | `docs/evidence-screenshots/harmony-native-interview-report-20260922.jpeg` | 完成态直接展示本机训练总分与结构、证据、岗位关联、表达四维分析，并明确评分边界 | 已补充 |
| 当前原生面试复盘详情 | `docs/evidence-screenshots/harmony-native-interview-report-detail-20260922.jpeg` | 本轮诊断、岗位化反馈和逐轮问答记录按复盘顺序呈现，问答可展开收起并衔接成长任务或重新训练 | 已补充 |
| 当前原生面试历史趋势 | `docs/evidence-screenshots/harmony-native-p0-history-20260922.jpeg` | 已完成会话自动归档，展示最近得分、同岗位前后变化、四维评分、用时、反馈与改进项；本机最多保留 30 次 | 已补充 |
| 当前原生候选人镜头入口 | `docs/evidence-screenshots/harmony-native-p0-camera-preview-20260922.jpeg` | 横屏会话提供候选人画中画入口，默认关闭，需用户主动开启；录像同样必须由用户主动触发 | 已补充 |
| 当前原生相机权限确认 | `docs/evidence-screenshots/harmony-native-p0-camera-state-20260922.jpeg` | 首次开启候选人镜头时由系统弹出相机权限确认，拒绝后仍可继续文字或语音面试 | 已补充 |
| 当前原生候选人实时预览 | `docs/evidence-screenshots/harmony-native-p0-camera-result-20260922.jpeg` | Camera Kit 前置摄像头通过原生 `XComponent` 显示实时画面；退出、暂停或结束会话时释放相机资源 | 已补充 |
| 当前原生录像可信降级 | `docs/evidence-screenshots/harmony-native-p0-camera-recording-fallback-20260923.jpeg` | API 24 模拟器的 `AVRecorder.prepare` 返回 I/O 错误后，候选人实时画面继续工作并显示“录像不可用 · 预览正常”，失败输出文件已清理；截图中的候选人画面已作隐私遮挡 | 已补充 |
| 当前原生成长计划 | `docs/evidence-screenshots/harmony-native-growth-mature-20260921.jpeg` | 当前覆盖、完成后预测、有效证据和待办任务的统一工作流 | 已补充 |
| 当前原生真实岗位录入 | `docs/evidence-screenshots/harmony-native-job-tracking-20260920.jpeg` | 岗位、公司、来源链接和 JD 由 ArkUI 原生表单录入并保存到本机 | 已补充 |
| 当前原生岗位字段校验 | `docs/evidence-screenshots/harmony-native-job-validation-20260920.jpeg` | 空提交显示明确错误，不生成虚构岗位数据 | 已补充 |
| 当前原生官方岗位列表 | `docs/evidence-screenshots/harmony-native-official-jobs-20260920.jpeg` | Network Kit 读取官方招聘源并按目标岗位严格筛选，保留来源状态和验证标签 | 已补充 |
| 当前原生岗位详情 | `docs/evidence-screenshots/harmony-native-job-detail-20260920.jpeg` | ArkUI 原生详情展示来源、JD、保存追踪和系统官方投递入口 | 已补充 |
| 当前岗位推荐 2.0 | `docs/evidence-screenshots/harmony-native-job-recommendation-v2-20260927.jpeg` | compact 手机展示期望城市、求职阶段、毕业年份、月薪、行业和企业偏好；偏好与岗位反馈只保存在本机并参与排序 | 已补充 |
| 当前原生岗位准备清单 | `docs/evidence-screenshots/harmony-native-job-readiness-20260927.jpeg` | 当前岗位按真实 JD、简历画像、冻结版本、岗位面试和关键日程显示 `x/5` 离散状态，首个未完成项提供直接行动入口，不表示录用概率 | 已补充 |
| 当前原生多岗位对比 | `docs/evidence-screenshots/harmony-native-job-comparison-20260927.jpeg` | 最多选择 3 个本机岗位，并排核对阶段、准备项、版本、面试次数、关键节点和下一行动；支持切换当前岗位与岗位驱动面试，不生成录用概率 | 已补充 |
| 当前原生岗位发现工作区 | `docs/evidence-screenshots/harmony-native-job-discovery-workspace-20260927.jpeg` | 搜索与投递管理分离；企业/关键词/城市和搜索命令优先展示，偏好编辑默认收起，删除内部配置状态徽标 | 已补充 |
| 当前原生投递管理列表 | `docs/evidence-screenshots/harmony-native-application-workspace-20260927.jpeg` | 六阶段筛选、公司/岗位/JD 搜索、分组计数、日程排序和过期日程提示；截图为六条匿名测试记录，不是企业实际招聘或个人投递证据 | 已补充 |
| 当前原生独立投递详情 | `docs/evidence-screenshots/harmony-native-application-detail-20260927.jpeg` | 当前岗位版本、准备清单与材料入口独立于列表；模拟器验证返回保留搜索/筛选，未保存修改先确认 | 已补充 |
| 当前原生投递材料草稿 | `docs/evidence-screenshots/harmony-native-job-materials-resume-20260927.jpeg` | 岗位独立简历草稿、相对起始正文的段落增删和冻结版本绑定；修改不覆盖通用简历画像 | 已补充 |
| 当前原生岗位项目案例 | `docs/evidence-screenshots/harmony-native-job-materials-stories-20260927.jpeg` | 案例关联岗位要求，保留同岗位面试原问题/原回答，STAR 与支持证据由用户编辑；填写数量不表示真实性核验 | 已补充 |
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
| 历史原生服务联调截图 | `docs/evidence-screenshots/harmony-native-spark-consent-on-20260923.jpeg` | 仅用于证明 2026-09-23 的服务联调结果；其中供应商就绪提示已从当前产品界面移除，不作为现行 UI 证据 | 历史留档 |
| 当前原生动态轮次设置 | `docs/evidence-screenshots/harmony-native-spark-setup-20260923.jpeg` | 20 分钟训练明确显示计划 5 轮；源码同时覆盖 10/15/20 分钟对应 3/4/5 轮 | 已补充 |
| 当前原生星火首题 | `docs/evidence-screenshots/harmony-native-spark-first-question-20260923.jpeg` | 横屏原生面试由讯飞星火 `4.0Ultra` 生成第 1/5 轮岗位化问题，客户端不含模型密钥 | 已补充 |
| 当前原生星火追问 | `docs/evidence-screenshots/harmony-native-spark-followup-20260923.jpeg` | 提交测试回答后，讯飞星火基于可用性测试和错误追踪内容生成第 2/5 轮证据追问 | 已补充 |
| 当前原生星火评分报告 | `docs/evidence-screenshots/harmony-native-spark-report-20260923.jpeg` | 结束训练后解析严格 JSON，显示总分、四维分数与证据化改进建议；当前产品不展示供应商来源 | 已补充 |
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
| HAP 构建 | `npm run build:harmony:local` | 已通过，2026-09-27，16,435,818 bytes，SHA-256 `8F3A76B49BB247C3B5A69E39A6B94D77D7830FE2F24B165181598E6E6BA831E0`；原生 unsigned 调试包 |
| HAP 模拟器安装/启动 | `npm run run:harmony:emulator` | 本轮已通过，HAP 安装成功，`EntryAbility` 进入前台；面试历史趋势、候选人实时预览、结构化评估回退和实时转写状态完成回归 |
| 原生多尺寸适配 | `docs/competition/02_TEST_PLAN_AND_REPORT.md`；`docs/evidence-screenshots/harmony-native-responsive-*-20260927.jpeg` | compact、medium、expanded 三档模拟尺寸与运行时旋转通过，5 份布局树可见节点均未越界；真实平板和 2in1 仍待真机复核 |
| 原生岗位材料 | `npm run verify:materials`；`docs/competition/02_TEST_PLAN_AND_REPORT.md` | 草稿隔离、存储默认值、段落差异、原回答来源与文本格式行为测试通过；模拟器验证保存、重复操作、案例编辑和冷启动恢复，系统导出文件正文回读待真机复核 |
| 原生正式简历 PDF | `docs/competition/02_TEST_PLAN_AND_REPORT.md`；`scripts/verify-resume-pdf.cjs` | 匿名 2033 字正文生成 3 页 PDF，全文和 A4 边界核对、逐页渲染、后台生成、原生缩放滚动、系统保存与取消通过；共享目录文件外部读取/分享待真机复核 |
| 原生投递工作区 | `npm run verify:applications`；`docs/competition/02_TEST_PLAN_AND_REPORT.md` | 搜索、计数、阶段筛选、稳定排序、非法日期与旧日程排除行为测试通过；模拟器验证详情/对比/材料往返、草稿保护、冷启动恢复与空列表；原数据双 Preferences 哈希已恢复 |
| 原生面试记录中心 | `npm run verify:interview-history`；`docs/competition/02_TEST_PLAN_AND_REPORT.md` | 完整存档搜索、同岗位选择、评分/日期校验和对比边界行为测试通过；API 24 模拟器验证超过八条记录的检索、完整长回答/改写、历史资料与当前重练版本隔离、筛选计数和返回路径。录像播放与真实在线评分不属于本轮验证 |
| 投递前检查与预览 | `docs/evidence-screenshots/harmony-native-resume-preflight-*-20260927.jpeg`；`docs/evidence-screenshots/harmony-native-resume-pdf-*-20260927.*` | 本人确认、旧版本拦截、原生预览/多页滚动及实际 PDF 渲染均有匿名截图 |
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

2026-09-27 公开提交检查：compact 首页截图中的个人姓名，以及旧面试状态/相机结果/录像回退截图中的相机画面已使用不透明区域遮蔽并注明。其余界面与测试结论未修改；未遮蔽原图仅保存在 D 盘忽略目录 `tmp/public-screenshot-originals/`，不随 GitHub 提交公开。

整理证据材料时，需要确认：

- 截图中不包含真实 API Key、账号密码、Cookie 或完整密钥片段。
- 简历样例不包含真实学生姓名、手机号、邮箱、身份证号或学校内部敏感信息。
- 日志不包含完整请求头、Authorization、原始简历全文或可识别个人身份的信息。
- Demo 视频中不展示浏览器 DevTools 中的敏感请求。
- 如使用部署平台日志截图，需要遮挡密钥、项目内部 token 和未公开账号信息。
