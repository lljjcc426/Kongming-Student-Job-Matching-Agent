# HarmonyOS 原生构建证据（2026-09-20）

补充验证日期：2026-09-21（原生投递闭环、简历版本绑定门禁、原生 AI 面试可信降级、成长证据账本、Calendar Kit 提醒、Form Kit 动态卡片端到端路由、可靠性加固、前端成熟化及构建内存策略）。

## 构建环境

| 项目 | 结果 |
| --- | --- |
| DevEco Studio | 6.1.1.290，安装目录 `D:\DevEco Studio` |
| HarmonyOS SDK | `D:\DevEco Studio\sdk` |
| Hvigor | `D:\DevEco Studio\tools\hvigor\bin\hvigorw.bat` |
| OHPM | `D:\DevEco Studio\tools\ohpm\bin\ohpm.bat` |
| 项目模型 | HarmonyOS Stage，ArkUI/ArkTS 原生主入口 |
| 目标 SDK | HarmonyOS 6.1.1(24) |

## 构建命令

```powershell
npm run build:harmony
npm run dev -- --port 5173 --strictPort
npm run build:harmony:local
```

源码路径包含中文目录，Hvigor 直接从原路径执行会触发 `00306003 Specification Limit Violation`。构建脚本因此将 `harmony/` 临时复制到 D 盘 ASCII staging 目录 `D:\KongMing-Harmony-Build`，并把 `TEMP/TMP` 固定到 `D:\KongMing-Harmony-Temp`。Hvigor 使用内存优先和非并行模式；模拟器运行导致系统可提交内存不足时，先停止模拟器再编译。成功后 HAP 回写原工程并清理 staging 目录。本机服务版调试 HAP 通过字符串资源注入 `http://10.0.2.2:5173/api/jobs`、`http://10.0.2.2:5173/api/ark` 和 `http://10.0.2.2:5173/api/health`，源码资源保持空值；正式构建仍只接受 HTTPS 服务地址。

## 构建结果

| 项目 | 结果 |
| --- | --- |
| HAP | `harmony/entry/build/default/outputs/default/entry-default-unsigned.hap` |
| 大小 | `1,708,891` bytes（2026-09-21 原生前端第二轮成熟化 HAP） |
| SHA-256 | `B0EBC9B2745C6852F55B867CF6D5CD9451C439104C24BD2A407F9D65E205393B` |
| ArkTS 编译 | 通过 |
| HAP 打包 | 通过 |
| 签名 | unsigned；项目尚未配置 `signingConfigs` |
| Web 资源 | 未打包 `resources/resfile`；HAP 内共 15 个条目，未发现 `resfile` 或 `index.html` |

## 模拟器运行结果

| 项目 | 结果 |
| --- | --- |
| 模拟器实例 | `KongMing_API24`，Mate 70，HarmonyOS 6.1.1(24) |
| 实例与镜像目录 | `D:\HarmonyOS-Emulator\instances`、`D:\HarmonyOS-Emulator\images` |
| HDC 目标 | `127.0.0.1:5555`，TCP Connected |
| HAP 安装 | 通过，`install bundle successfully` |
| 原生入口启动 | 通过，`EntryAbility` 进入 `FOREGROUND` |
| 最新包烟测 | 2026-09-21 前端成熟化 HAP 覆盖安装并启动成功，`EntryAbility` 为 `FOREGROUND`；五个底部页签均可切换，系统 Symbol 正常显示 |
| 原生开场动效截图 | 已归档至 `docs/evidence-screenshots/harmony-native-intro-mature-20260921.jpeg` |
| 原生首页截图 | 已归档至 `docs/evidence-screenshots/harmony-native-home-mature-20260921.jpeg` |
| 核心页面截图 | `docs/evidence-screenshots/harmony-native-resume-mature-20260921.jpeg`、`harmony-native-jobs-mature-20260921.jpeg`、`harmony-native-interview-mature-20260921.jpeg`、`harmony-native-growth-mature-20260921.jpeg` |
| 岗位空状态截图 | `docs/evidence-screenshots/harmony-native-jobs-empty-mature-20260921.jpeg`，官方岗位无结果时明确说明并继续提供本机录入路径 |
| 原生视觉回归 | 保留蓝青机器人开场；统一语义色、8vp 卡片、紧凑品牌栏、固定字段标签、语义化状态提示和系统 Symbol 图标导航；首页将“今日重点”提升为第一操作位；五个主页面未发现文字重叠、底栏遮挡或异常换行 |
| 真实岗位录入 | 原生岗位页支持岗位、公司、来源链接和 JD 本机保存；空提交会显示字段校验，不生成虚构企业或招聘信息 |
| 岗位页截图 | `docs/evidence-screenshots/harmony-native-job-tracking-20260920.jpeg`、`docs/evidence-screenshots/harmony-native-job-validation-20260920.jpeg` |
| 官方岗位网络链路 | `@kit.NetworkKit` 原生 HTTP 客户端读取 `/api/jobs`；本机 API 经模拟器宿主网关 `10.0.2.2` 联调成功，截图时 11/12 个官方来源可用、收集 647 条，严格意图筛选后展示 1 条 |
| 原生岗位列表与详情 | `docs/evidence-screenshots/harmony-native-official-jobs-20260920.jpeg`、`docs/evidence-screenshots/harmony-native-job-detail-20260920.jpeg` |
| 网络失败降级 | 服务不可用时不生成替代岗位，保留本机真实岗位录入；证据见 `docs/evidence-screenshots/harmony-native-job-offline-fallback-20260920.jpeg` |
| 原生投递阶段 | 同一真实岗位支持已收藏、准备中、已投递、面试中、Offer、已结束六阶段；证据见 `docs/evidence-screenshots/harmony-native-application-stage-20260921.jpeg` |
| 原生投递时间线 | 阶段变更追加本机事件；强制停止 `EntryAbility` 后再次启动可恢复阶段和历史；证据见 `docs/evidence-screenshots/harmony-native-application-timeline-20260921.jpeg` |
| 原生版本门禁 | 未绑定当前岗位的实际简历版本时，已投递、面试和 Offer 均被阻止；证据见 `docs/evidence-screenshots/harmony-native-application-version-gate-20260921.jpeg` |
| 原生版本管理 | 已验证保存两版完整简历、生成长度差异摘要、切换绑定、禁止删除当前绑定版本；强制停止后两版、绑定 ID 和已投递阶段均恢复；证据见 `docs/evidence-screenshots/harmony-native-resume-version-binding-20260921.jpeg` |
| 原生投递日程 | 可保存投递截止和下一场面试时间，阶段化下一行动同步到首页与 Form Kit 数据存储 |
| Calendar Kit 提醒 | 模拟器已打开 `com.huawei.hmos.calendardata/EditorUIExtensionAbility`，正确预填测试岗位、18:00–18:30、提前 1 天/1 小时提醒与下一行动；随后选择放弃并返回“未保存日历事件”，未写入测试日程。截图见 `docs/evidence-screenshots/harmony-native-calendar-editor-20260921.jpeg` |
| Form Kit 成长摘要 | 服务卡片新增成长证据完成数、实证覆盖率与进度条；工作区加载和保存时同步卡片数据，不包含简历正文；数值、文本、覆盖率、路由与 Form ID 在持久化和绑定前统一清洗 |
| Form Kit 精准路由 | 动态卡片根据当前下一行动传递 `resume/jobs/interview/growth/home`，点击通过官方 `postCardAction` 发送 `router` 事件；`EntryAbility` 解析系统封装的 `want.parameters.params`、执行白名单校验并通过唯一 `AppStorage` 请求驱动原生页签。API 24 模拟器已验证应用内刷新、覆盖安装保留、强制停止后桌面存续，以及真实点击冷启动直接进入成长页。证据见 `docs/evidence-screenshots/harmony-native-form-desktop-20260921.jpeg`、`docs/evidence-screenshots/harmony-native-form-coldstart-growth-20260921.jpeg`；参数路由辅助截图见 `docs/evidence-screenshots/harmony-native-form-route-growth-20260921.jpeg` |
| Form Kit 失败隔离 | `ApplicationFormAbility` 的添加、更新和移除后台任务统一捕获 Promise 拒绝；卡片准备或更新失败只记录错误并返回更新数，不再把已成功的主工作区保存误报为失败 |
| 原生 AI 面试链路 | `@kit.NetworkKit` POST `/api/ark`，复用 `career-chat` 协议；包含会话级授权、发送前敏感字段脱敏、最多三轮问答和最终反馈，模型密钥不进入客户端 |
| 原生 AI 无密钥降级 | 当前宿主服务未配置 `ARK_API_KEY`；提交首轮回答后页面明确提示模型不可用，使用本机规则进入第 2 轮，不伪装为模型结果；证据见 `docs/evidence-screenshots/harmony-native-ai-fallback-20260921.jpeg` |
| 原生 AI 反馈与成长 | 已验证本机反馈生成、STAR 复盘任务和原生成长驾驶舱跳转；证据见 `docs/evidence-screenshots/harmony-native-ai-feedback-20260921.jpeg`、`harmony-native-ai-growth-task-20260921.jpeg` |
| 原生 AI 本机恢复 | 强制停止 `cn.kongming.jobmatch` 后重新启动，恢复第 2 轮问题、首轮回答和反馈；外部模型授权按会话边界重置；证据见 `docs/evidence-screenshots/harmony-native-ai-restored-20260921.jpeg` |
| 原生 AI 调用结论 | 链路已实现并通过 ArkTS 编译，可信降级已在模拟器验收；本次环境没有真实模型成功调用证据，不能宣称原生 HAP 已完成真实模型端到端验收 |
| 原生成长来源拦截 | `https://127.0.0.1/evidence` 被公开地址策略拒绝，任务保持 `+9%` 待提交状态，实证覆盖保持 `42%`，账本有效记录保持 `0` |
| 原生成长证据提交 | Network Kit 对公开 GitHub 来源执行 `HEAD` 核验并返回 `HTTP 200`；经用户真实性确认后生成 `KM-543A7715` 本机内容指纹，任务变为“证据已通过”，实证覆盖即时从 `42%` 更新为 `51%` |
| 来源核验兼容性 | 当前源码与 HAP 先通过 Network Kit DNS 查询拒绝非公网解析结果和自动重定向，再在 HEAD 失败或 `400/403/405/406/501` 时使用流式 `GET` + `Range: bytes=0-0` 降级，并在账本保存实际方法；本轮尚未形成限制 HEAD 站点的模拟器成功截图 |
| 原生成长账本恢复 | 强制停止并重新启动后，`51%`、证据摘要、来源、指纹和有效记录均恢复；账本截图见 `docs/evidence-screenshots/harmony-native-evidence-ledger-20260921.jpeg` |
| 原生成长证据撤销 | 撤销后任务即时恢复 `+9%` 待提交状态，实证覆盖回退到 `42%`；账本保留提交时间、指纹、撤销时间和“已撤销”状态，第二次强制停止后仍恢复；截图见 `docs/evidence-screenshots/harmony-native-evidence-revoked-20260921.jpeg` |
| 原生成长来源恢复 | 强制停止并重新启动后，最新有效记录恢复 `github.com`、`HTTP 200` 和核验时间；证据见 `docs/evidence-screenshots/harmony-native-evidence-source-verified-20260921.jpeg` |
| OCR 图片入口 | 图库 `PhotoViewPicker` 和文件 `DocumentViewPicker` 均由原生 ArkTS 页面拉起；文件选择器能显示并返回测试简历图片 |
| OCR 文件读取 | 已通过模拟器文件选择器返回 URI，并由 `fileIo.open/stat/read/close` 读取；图片数据不自动提交外部模型 |
| OCR 能力状态 | 模拟器未提供 `@kit.CoreVisionKit` OCR 实现，页面稳定降级为文字输入提示；需在支持 Core Vision 的鸿蒙真机完成识别结果验收 |
| OCR 证据截图 | `docs/evidence-screenshots/harmony-ocr-photo-picker-20260920.jpeg`、`harmony-ocr-file-picker-device-20260920.jpeg`、`harmony-ocr-native-fallback-20260920.jpeg` |

## 编译提示

- ArkTS 编译输出了 `preferences` 异常处理建议，未形成编译错误。
- Account Kit、Core Vision、Share Kit、Core Speech 和部分 API 输出设备能力覆盖提示，未形成编译错误。
- Network Kit 岗位请求、服务地址资源注入、官方链接系统打开和 ArkUI 详情页均通过 ArkTS 编译。
- Network Kit 模型请求、会话授权、发送前脱敏、超时处理、追问/反馈解析和本机回退均通过 ArkTS 编译；当前仅完成无密钥降级运行验证。
- 原生成长证据摘要、Network Kit 公开 HTTPS 可访问性核验、私网地址拦截、用户确认、内容指纹、撤销审计、覆盖率即时刷新和 ArkData 恢复均通过 ArkTS 编译及模拟器运行验证；HTTP 成功和本机指纹不代表内容归属或第三方真实性认证。
- 原生投递阶段、日程、Calendar Kit 事件编辑器、简历版本冻结与绑定门禁、时间线、ArkData 恢复以及 Form Kit 成长摘要、数据清洗、异步失败隔离和精准路由均通过 ArkTS 编译；Calendar Kit 预填和取消路径、动态卡片桌面刷新、覆盖安装保留、进程终止后存续和真实点击冷启动精准路由已在模拟器验收，真机日历保存和服务卡片差异仍待验收。
- DevEco Studio 报告 unsigned HAP 跳过签名；该产物仅用于开发/模拟器验证，不代表可发布安装包。

## 尚未完成

- 尚未完成真机验收；模拟器安装、原生入口启动和文件选择链路已通过，Core Vision OCR 识别结果仍需在支持该能力的鸿蒙真机验收。
- 尚未配置比赛或正式发布所需的签名、App ID、证书和 Profile。
- 官方岗位已完成本机 API 到模拟器的端到端验证；尚未使用公网 HTTPS 服务地址完成正式环境验证。
- 原生 AI 面试尚未在配置真实 `ARK_API_KEY`、`ARK_BASE_URL` 和 `ARK_MODEL` 的服务端环境取得成功调用证据。
