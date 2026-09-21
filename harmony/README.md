# 孔明职配 HarmonyOS 工程

本目录是 HarmonyOS 6.1.1(24) Stage 模型工程。当前主工作台采用 ArkUI/ArkTS 原生实现：`NativeIndex.ets` 直接渲染首页、简历画像、岗位证据、投递闭环、模拟面试和成长任务，并使用 ArkData Preferences 保存本机状态。原有 React/Vite 页面只保留在仓库中作为 Web 产品和迁移参考，不进入默认原生 HAP。

这是一种迁移与交付架构，不把 Web 壳本身当作创新点。核心产品价值来自真实岗位分层、证据匹配、事实约束改写、简历版本与投递闭环；HarmonyOS 系统能力负责降低输入、分享和桌面触达成本。

## 工程结构

```text
harmony/
├─ AppScope/                              应用级配置与图标
├─ entry/src/main/
│  ├─ ets/entryability/                  UIAbility 入口
│  ├─ ets/pages/NativeIndex.ets          ArkUI 原生主工作台与本机成长状态
│  ├─ ets/components/NativeApplicationTracker.ets 原生投递阶段、日程和时间线
│  ├─ ets/components/NativeResumeVersionPanel.ets 原生简历版本冻结、绑定和管理
│  ├─ ets/components/NativeEvidenceLedger.ets 原生成长证据提交、指纹和撤销账本
│  ├─ ets/common/CareerFormStore.ets     服务卡片本机数据
│  ├─ ets/common/NativeWorkspaceModel.ets 成长任务、岗位证据、简历版本与投递事件模型
│  ├─ ets/common/NativeCapabilityService.ets 账号、分享、OCR、语音等原生能力
│  ├─ ets/common/NativeEvidenceService.ets Network Kit 公开证据来源核验与私网地址拦截
│  ├─ ets/common/NativeJobService.ets     Network Kit 官方岗位服务与降级
│  ├─ ets/common/NativeAiService.ets      Network Kit 模型代理、脱敏与可信降级
│  ├─ ets/applicationformability/        Form Extension
│  ├─ ets/applicationform/pages/         卡片 UI
│  ├─ resources/base/profile/            页面和卡片配置
│  ├─ resources/base/                    原生颜色、字符串和服务卡片配置
│  └─ module.json5                       Ability、权限、分享和 Form 配置
├─ build-profile.json5                   SDK、产品和签名配置
└─ oh-package.json5                      OHPM 工程信息
```

默认原生构建不包含 `resources/resfile/`。如需临时构建旧 Web 兼容包，使用根目录的 `npm run build:harmony:web-compat`。

## 原生桥接

原生页面通过 `NativeCapabilityService.ets` 直接访问受控系统能力：

| 能力 | ArkTS 实现 | 数据边界 |
| --- | --- | --- |
| 华为账号 | `NativeCapabilityService.ets` | 仅保存登录布尔值与 OpenID 尾部，不保存密码或访问令牌。 |
| OCR | Core Vision `textRecognition` | 图片在本机识别；能力不可用时由原生页面提示粘贴文本或外部模型授权。 |
| 分享 | Share Kit | 只分享用户主动生成的报告文本或链接。 |
| TTS | Core Speech `textToSpeech` | 原生失败时保持文本模式。 |
| STT | Core Speech `speechRecognizer` + AudioCapturer | 最长 15 秒；原生启动失败时回退文字输入。 |
| AI 面试 | Network Kit 请求 `/api/ark` | 只有本次会话明确授权后才发送；手机号、邮箱、身份证号和详细地址在请求前脱敏，模型密钥只在服务端保存。 |
| 证据来源 | Network Kit DNS 公网校验、`HEAD` 优先、流式 Range GET 降级 | 只核验不含账号信息且解析结果均为公网地址的最终 HTTPS 地址；阻止本机、内网、自定义端口和自动重定向，保存主机、实际方法、HTTP 状态和核验时间，不判断内容归属。 |
| 日历提醒 | Calendar Kit `editEvent` | 只把用户已填写的岗位、公司、截止/面试时间和下一行动预填到系统事件编辑器，由用户确认保存；应用不直接申请日历读写权限。 |
| 服务卡片 | Form Kit `postCardAction` + `AppStorage` 路由 | 动态卡片保存岗位数、投递阶段、待办数、下一行动、成长任务计数、实证覆盖率、岗位名称、更新时间和目标页面，不保存简历正文；写入前清洗文本、数值、路由和 Form ID，后台失败不覆盖主工作区保存结果。 |

系统能力由 ArkTS 原生页面调用，不向远程网页开放；Web 端的 `src/harmonyBridge.ts` 不属于默认 HarmonyOS 主入口。

当前原生演示链路为：保存简历画像 → 搜索并追踪官方岗位 → 冻结并绑定当前岗位的实际投递版本 → 更新投递阶段与日程 → 通过 Calendar Kit 编辑系统提醒 → 查看追加式时间线 → 原生模拟面试 → 会话级外部模型授权 → Core Speech 朗读/语音输入 → 生成反馈和成长任务 → Network Kit 核验公开 HTTPS 证据来源 → 写入本机摘要、主机、HTTP 状态、核验时间和内容指纹 → 更新实证覆盖率与 Form Kit 服务卡片 → 点击卡片进入对应原生任务页面 → 撤销验证并保留审计记录。未授权或服务不可用时，面试保持本机规则并明确显示来源；没有绑定当前岗位版本时，已投递、面试和 Offer 阶段会被原生门禁阻止。账号登录和进展分享也从原生页面直接调用 Account Kit 与 Share Kit。

## 构建

当前 DevEco Studio 根目录：

```text
D:\DevEco Studio
```

构建 staging、`TEMP` 和 `TMP` 均固定在 D 盘；Hvigor 使用内存优先和非并行模式，降低模拟器占用内存时 ArkTS 编译失败的概率。构建前若系统可提交内存不足，应先停止模拟器再编译。

普通 HAP 构建：

```powershell
npm run build:harmony
```

脚本默认执行原生 HAP 构建：

1. 检查服务地址和发布参数；
2. 清理旧的 Web 兼容资源目录；
3. 安装 OHPM 依赖；
4. 调用 DevEco Studio 内置 Hvigor；
5. 输出 HAP 路径、大小和 SHA-256。

由于当前仓库路径包含中文目录，Hvigor 直接从原路径编译会触发路径规则错误。脚本默认使用 `D:\KongMing-Harmony-Build` 作为临时 ASCII staging 目录；构建成功后只把 HAP 回写到原工程，staging 目录会被清理。可通过 `-AsciiBuildRoot` 覆盖 staging 位置，但必须放在 D 盘且不能指向源码目录。

只有 `build:harmony:web-compat` 才会同步 Web 资源；后续新增功能必须优先进入 ArkTS/ArkUI 原生模块。

产物：

```text
harmony/entry/build/default/outputs/default/entry-default-unsigned.hap
```

当前 `build-profile.json5` 没有签名配置，所以产物仅用于模拟器和开发验证。

## 模拟器本地联调

终端一：

```powershell
npm run dev -- --port 5173 --strictPort
```

终端二：

```powershell
npm run build:harmony:local
npm run run:harmony:emulator
```

本地构建注入：

```text
http://10.0.2.2:5173/api/jobs
http://10.0.2.2:5173/api/ark
http://10.0.2.2:5173/api/health
```

`10.0.2.2` 是 HarmonyOS 模拟器访问宿主机的开发网关。本地构建显式允许该 HTTP 地址；发布构建仍要求公网 HTTPS。

运行脚本完成以下动作：

- 启动 `KongMing_API24`；
- 检测并恢复 HDC；
- 默认使用冷启动，避免快照启动后 HDC Offline；
- 配置 5173 反向端口；
- 覆盖安装 HAP；
- 启动 `EntryAbility`。

可覆盖参数：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-harmony-emulator.ps1 `
  -EmulatorName KongMing_API24 `
  -BootMode coldboot `
  -HdcPort 15555
```

本轮安装、启动和 OCR 文件选择证据见 [构建与运行证据](../docs/RELEASE_EVIDENCE_20260920.md)。

## 正式联网构建

真机和比赛安装包不能依赖开发机 `127.0.0.1`。需要部署 `/api/jobs`、`/api/ark` 和 `/api/health`，然后注入公网 HTTPS 地址：

```powershell
npm run build:harmony:release -- `
  -PublicApiBaseUrl https://your-domain.example/api
```

或直接调用脚本分别指定：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-harmony.ps1 `
  -JobsApiUrl https://your-domain.example/api/jobs `
  -ArkApiUrl https://your-domain.example/api/ark `
  -HealthApiUrl https://your-domain.example/api/health `
  -RequireOnlineServices
```

Release 模式会拒绝非 HTTPS 地址。`ARK_API_KEY` 只能配置在服务端环境变量，禁止打入 HAP。

## DevEco Studio

如使用 IDE，只打开本目录 `harmony/`。修改根目录 Web 源码后，先执行：

```powershell
npm run sync:harmony:web
```

然后再在 DevEco Studio 构建，避免 HAP 携带旧静态资源。

## 当前验证状态

| 项目 | 状态 |
| --- | --- |
| ArkTS 编译和 HAP 打包 | 已通过 |
| unsigned HAP 模拟器安装 | 已通过，覆盖安装成功 |
| 首次启动 | 已通过，`EntryAbility` 进入前台 |
| 强制停止后二次启动 | 已通过，`EntryAbility` 可再次进入前台 |
| 最新首页截图 | 已归档至 `docs/evidence-screenshots/harmony-native-home-mature-20260921.jpeg` |
| 核心页面视觉回归 | 开场、首页、简历、岗位、面试和成长页均已在 API 24 模拟器检查；系统 Symbol 正常，无文字重叠和底栏遮挡 |
| Form Extension 注册 | `bm dump` 已确认 |
| 服务卡片成长摘要与精准路由 | 已通过；数据边界、Form ID 去重/限量、后台 Promise 拒绝和主保存失败隔离均有静态断言；模拟器已验证桌面添加、应用内数据刷新、覆盖安装保留、强制停止后存续，以及真实点击动态卡片冷启动并精准进入成长页 |
| Calendar Kit 系统提醒 | 模拟器已打开系统事件编辑器并核对标题、时间、截止双提醒与说明，取消路径显示“未保存日历事件”；真机保存和不支持路径待验收 |
| 华为账号 | 待正式签名/真机 |
| OCR、分享、语音 | OCR 图库/文件选择和 URI 读取已在模拟器验证；Core Vision 识别、分享和语音仍需支持对应能力的真机完成交互验收 |
| Network Kit 官方岗位与证据核验 | 本机 API 已完成原生搜索、严格意图筛选、详情、系统投递入口和服务失败降级验收；证据来源采用 HEAD 优先、流式 Range GET 降级并记录实际核验方式 |
| Network Kit 原生 AI 面试 | `/api/ark` 原生请求、会话授权、敏感字段脱敏、最多三轮问答和反馈协议已实现并通过编译；无 `ARK_API_KEY` 环境已验证明确回退、本机反馈、成长任务和强制停止后记录恢复 |
| 原生 AI 面试证据 | `harmony-native-ai-consent-20260921.jpeg`、`harmony-native-ai-fallback-20260921.jpeg`、`harmony-native-ai-feedback-20260921.jpeg`、`harmony-native-ai-restored-20260921.jpeg` 已归档 |
| 原生成长证据账本 | Network Kit `HEAD` 优先、流式 Range GET 降级、私网地址拦截、用户确认、`KM-XXXXXXXX` 本机内容指纹、有效/已撤销状态和撤销时间已实现；模拟器已验证 GitHub HEAD `HTTP 200`、覆盖率 `42% → 51% → 42%` 和重启恢复，GET 降级仍待限制 HEAD 的公开站点补充运行截图 |
| 原生成长账本证据 | `harmony-native-evidence-ledger-20260921.jpeg`、`harmony-native-evidence-revoked-20260921.jpeg`、`harmony-native-evidence-source-verified-20260921.jpeg` 已归档 |
| Form Kit 桌面证据 | `harmony-native-form-desktop-20260921.jpeg`、`harmony-native-form-coldstart-growth-20260921.jpeg` 已归档 |
| 原生投递闭环 | 六阶段切换、截止/面试日程、双版本冻结与切换、绑定门禁、追加式时间线和杀进程恢复均已通过模拟器验证 |
| 原生版本证据 | `harmony-native-application-version-gate-20260921.jpeg`、`harmony-native-resume-version-binding-20260921.jpeg` 已归档 |
| 正式 HTTPS 岗位/模型链路 | 待部署公网服务；当前原生 HAP 尚未取得真实模型成功调用证据 |
| 发布签名 | 未配置 |

## 权限

- `ohos.permission.INTERNET`：岗位、模型和健康检查。
- `ohos.permission.CAMERA`：用户主动选择拍照或开启面试预览时申请。
- `ohos.permission.MICROPHONE`：用户主动开始语音回答时申请。

应用不会在启动时一次性请求相机和麦克风权限。权限拒绝必须回退到文件、粘贴文本或键盘输入。
