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
│  ├─ ets/common/NativeJobRecommendationService.ets 本机岗位证据评分与排序
│  ├─ ets/common/NativeJobMaterialService.ets 岗位独立材料、本人确认与投递检查
│  ├─ ets/common/NativeResumeLayoutService.ets A4 简历换行、分页与共享预览版式
│  ├─ ets/common/NativeResumePdfService.ets TaskPool 离线 PDF 生成与私有缓存
│  ├─ ets/components/NativeResumePdfPreview.ets ArkUI Canvas 预览、缩放和系统保存
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
| AI 面试 | Network Kit 请求统一 `/api/gateway` | 只有本次会话明确授权后才发送；手机号、邮箱、身份证号和详细地址在请求前脱敏，供应商端点与模型密钥只在服务端保存。 |
| 证据来源 | Network Kit DNS 公网校验、`HEAD` 优先、流式 Range GET 降级 | 只核验不含账号信息且解析结果均为公网地址的最终 HTTPS 地址；阻止本机、内网、自定义端口和自动重定向，保存主机、实际方法、HTTP 状态和核验时间，不判断内容归属。 |
| 日历提醒 | Calendar Kit `editEvent` | 只把用户已填写的岗位、公司、截止/面试时间和下一行动预填到系统事件编辑器，由用户确认保存；应用不直接申请日历读写权限。 |
| 正式简历 PDF | ArkTS TaskPool + `pdf-lib`/`fontkit`，ArkUI Canvas，Core File Kit 文档选择器 | 全程本机生成，预览读取与 PDF 相同的排版数据，不是 PDF 解析器。只导出本人确认且与绑定版本一致的正式正文；项目故事和面试原回答仅在独立 TXT 准备材料中导出。退出预览或冷启动清理私有临时文件。 |
| 服务卡片 | Form Kit `postCardAction` + `AppStorage` 路由 | 动态卡片保存岗位数、投递阶段、待办数、下一行动、成长任务计数、实证覆盖率、岗位名称、更新时间和目标页面，不保存简历正文；写入前清洗文本、数值、路由和 Form ID，后台失败不覆盖主工作区保存结果。 |

系统能力由 ArkTS 原生页面调用，不向远程网页开放；Web 端的 `src/harmonyBridge.ts` 不属于默认 HarmonyOS 主入口。

当前原生演示链路为：保存简历画像 → 使用关键词、优先企业和城市检索国内官方岗位 → 在本机按目标方向、技能证据、硬性条件和国内头部企业优先级重新排序 → 追踪岗位并查看证据缺口 → 冻结并绑定当前岗位的实际投递版本 → 更新投递阶段与日程 → 通过 Calendar Kit 编辑系统提醒 → 查看追加式时间线 → 原生模拟面试 → 会话级外部模型授权 → Core Speech 朗读/语音输入 → 生成反馈和成长任务 → Network Kit 核验公开 HTTPS 证据来源 → 写入本机摘要、主机、HTTP 状态、核验时间和内容指纹 → 更新实证覆盖率与 Form Kit 服务卡片 → 点击卡片进入对应原生任务页面 → 撤销验证并保留审计记录。岗位接口只接收检索词、企业、城市、市场范围和条数，简历正文不随岗位检索上传；岗位地点须命中国内地点或明确标记为待确认，且服务端和设备端都会再次排除海外地点。BOSS 直聘仅作为系统浏览器中的第三方补充入口，不抓取、不混入官方岗位排序。未授权或服务不可用时，面试保持本机规则并明确显示来源；没有绑定当前岗位版本时，已投递、面试和 Offer 阶段会被原生门禁阻止。账号登录和进展分享也从原生页面直接调用 Account Kit 与 Share Kit。

## 构建

当前 DevEco Studio 根目录：

```text
D:\DevEco Studio
```

构建 staging、`TEMP`、`TMP` 和 Hvigor 用户目录均固定在 D 盘；Hvigor 使用内存优先和非并行模式，降低模拟器占用内存时 ArkTS 编译失败的概率。构建前若系统可提交内存不足，应先停止模拟器再编译。

普通 HAP 构建：

```powershell
npm run build:harmony
```

原生数字人使用 ArkGraphics3D 加载 GLB。默认 v5 来自 MIT 授权的 Microsoft Rocketbox `Business_Female_04`，由 ArkTS 面试状态机实时驱动 15 个 viseme、眨眼和表情目标。更新源模型、纹理或形变映射后，先重新生成最终资源：

```powershell
npm run build:avatar:rocketbox
```

管线会把 175 个源形变裁剪为产品使用的 28 个运行时目标，嵌入 1K 纹理，并为缺少形变法线/切线的模型补充共享零增量数据和基础切线。v5 最终 GLB 为 8.52 MB、8,270 三角面、15/15 viseme；旧 v3/v4 仅作为本机开发素材保留并在 staging 阶段排除，不进入 HAP。Rocketbox 源文件、MIT 许可证和来源记录位于 `scripts/assets/rocketbox-business-female-04/`。构建脚本接受 `AvatarId` 与 `OutputName` 参数，后续可沿用同一原生管线更换人物。

脚本默认执行原生 HAP 构建：

构建开始时先将离线 PDF 引擎打包为带 ArkTS 类型声明的 JS 模块，并收集依赖许可证；需要先在仓库根目录安装 npm 依赖。使用 JS 计算模块不引入 WebView 或网页运行时。当前模拟器不提供 PDFKit 的文档生成实现，因此不依赖 PDFKit 可用性。

1. 检查服务地址和发布参数；
2. 清理旧的 Web 兼容资源目录；
3. 安装 OHPM 依赖；
4. 调用 DevEco Studio 内置 Hvigor；
5. 输出 HAP 路径、大小和 SHA-256。

由于当前仓库路径包含中文目录，Hvigor 直接从原路径编译会触发路径规则错误。脚本默认使用 `D:\KongMing-Harmony-Build` 作为临时 ASCII staging 目录，使用 `D:\KongMing-Harmony-Temp` 保存临时文件，并将 `USERPROFILE/HOME` 重定向到 `D:\KongMing-Harmony-User`；构建成功后只把 HAP 回写到原工程，staging 目录会被清理。可通过 `-AsciiBuildRoot`、`-TempRoot` 和 `-UserHomeRoot` 覆盖这些目录，但必须放在 D 盘，staging 不能指向源码目录。

只有 `build:harmony:web-compat` 才会同步 Web 资源；后续新增功能必须优先进入 ArkTS/ArkUI 原生模块。

PDF 行为验证：从测试设备读取可用中文字体到 D 盘，然后运行 `node scripts/verify-resume-pdf.cjs <字体路径>`。脚本在 `tmp/pdfs/native-resume/` 生成匿名多页样本，仍需用 PDF 渲染工具检查实际页面。`npm run verify:materials` 覆盖本人确认失效、旧版拦截和分页边界，不依赖本机字体。

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
http://10.0.2.2:5173/api/gateway
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

真机和比赛安装包不能依赖开发机 `127.0.0.1`。需要部署唯一的 `/api/gateway`，然后注入公网 HTTPS 地址：

```powershell
npm run build:harmony:release -- `
  -PublicApiBaseUrl https://your-domain.example
```

或直接指定完整网关地址：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-harmony.ps1 `
  -GatewayApiUrl https://your-domain.example/api/gateway `
  -RequireOnlineServices
```

Release 模式会拒绝非 HTTPS 地址。`IFLYTEK_SPARK_API_PASSWORD`、`IFLYTEK_SPARK_APP_ID/API_KEY/API_SECRET` 或 `ARK_API_KEY` 只能配置在服务端环境变量，禁止打入 HAP。

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
| Network Kit 官方岗位与证据核验 | 默认 `market=cn`，结构化来源仅调用国内市场源；结果地点须命中国内地点白名单或标记为待确认，东京、迪拜、帕罗奥多、阿姆斯特丹等海外地点会在服务端和设备端双重排除；原生页提供腾讯、字节、网易、百度、华为、阿里快捷企业筛选，头部企业排序优先级不会改变简历证据匹配分；BOSS 直聘为第三方补充跳转，不混入官方结果 |
| 原生岗位个性化排序证据 | API 24 模拟器使用已导入简历实测：`11/12` 个官方来源可用、收集 668 条并筛选展示 10 条；标题方向优先后，Game AI 实习与广告算法岗位排在全栈/系统岗位之前。截图见 `harmony-native-job-ranking-20260923.jpeg`、`harmony-native-job-evidence-detail-20260923.jpeg` |
| Network Kit 原生 AI 面试 | `/api/gateway?operation=model` 已支持讯飞星火 APIPassword 和 APPID/APIKey/APISecret 两种服务端鉴权；原生请求、会话授权、敏感字段脱敏、岗位化首题与追问、按 10/15/20 分钟执行 3/4/5 轮问答和结构化反馈已实现。API 24 模拟器已真实完成首题、基于上一轮回答的第 2 轮追问和结构化评分报告 |
| 原生数字人口型 | 默认使用 Microsoft Rocketbox `Business_Female_04` 女性商务面试官；ArkGraphics3D 原生 GLB 渲染、28 个运行时 Morph Target、15/15 viseme、眨眼、表情、基础切线及形变法线/切线已接入。API 24 模拟器已验证材质、构图和原生加载，正式状态机按 30 FPS 写入自然幅度口型；证据见 `harmony-native-avatar-rocketbox-v5-20260926.jpeg` |
| 产品与服务边界 | 面试页只展示“标准题库/个性化追问”、数据用途和可执行结果，不展示供应商、模型名称、网关状态或配置诊断。公共模型响应只返回业务内容；供应商信息仅保留在服务端配置、日志与技术验证中 |
| 面试提前结束保护 | 无合格回答时可确认退出且不生成记录；已有合格回答但当前草稿不足 20 字时，会忽略未完成草稿并使用已提交回答生成反馈，不再被字段校验锁在横屏会话中 |
| 原生 AI 面试证据 | `harmony-native-ai-consent-20260921.jpeg`、`harmony-native-ai-fallback-20260921.jpeg`、`harmony-native-ai-feedback-20260921.jpeg`、`harmony-native-ai-restored-20260921.jpeg` 已归档 |
| 原生成长证据账本 | Network Kit `HEAD` 优先、流式 Range GET 降级、私网地址拦截、用户确认、`KM-XXXXXXXX` 本机内容指纹、有效/已撤销状态和撤销时间已实现；模拟器已验证 GitHub HEAD `HTTP 200`、覆盖率 `42% → 51% → 42%` 和重启恢复，GET 降级仍待限制 HEAD 的公开站点补充运行截图 |
| 原生成长账本证据 | `harmony-native-evidence-ledger-20260921.jpeg`、`harmony-native-evidence-revoked-20260921.jpeg`、`harmony-native-evidence-source-verified-20260921.jpeg` 已归档 |
| Form Kit 桌面证据 | `harmony-native-form-desktop-20260921.jpeg`、`harmony-native-form-coldstart-growth-20260921.jpeg` 已归档 |
| 原生投递闭环 | 六阶段切换、截止/面试日程、双版本冻结与切换、绑定门禁、追加式时间线和杀进程恢复均已通过模拟器验证 |
| 原生投递工作区 | “发现岗位”和“我的投递”分离；本机公司/岗位/JD 搜索、六阶段筛选、进行中/Offer/已结束计数、日程/最近更新/公司排序、独立详情及对比入口已通过 API 24 模拟器验证。详情返回保留筛选，首页投递事项直达当前岗位；旧截止不作为已投递岗位的待办 |
| 原生面试记录中心 | 面试练习与记录分离；搜索全部本机存档（最多 30 次），支持岗位与面试类型筛选、完整逐题回答、综合反馈及历史训练资料。最多选择同一岗位的两次训练，只有训练条件与评分规则一致时显示分数变化；再次练习使用当前岗位资料与简历版本，资料已移除时禁用。搜索、计数刷新、长文本末尾、返回路径和版本边界已在 API 24 模拟器验证；录像播放沿用原逻辑，本轮未重新实测 |
| 原生版本证据 | `harmony-native-application-version-gate-20260921.jpeg`、`harmony-native-resume-version-binding-20260921.jpeg` 已归档 |
| 正式 HTTPS 岗位/模型链路 | 待部署公网服务；当前原生 HAP 尚未取得真实模型成功调用证据 |
| 发布签名 | 未配置 |

## 权限

- `ohos.permission.INTERNET`：官网岗位搜索、个性化追问与来源核验。
- `ohos.permission.CAMERA`：用户主动选择拍照或开启面试预览时申请。
- `ohos.permission.MICROPHONE`：用户主动开始语音回答时申请。

应用不会在启动时一次性请求相机和麦克风权限。权限拒绝必须回退到文件、粘贴文本或键盘输入。
