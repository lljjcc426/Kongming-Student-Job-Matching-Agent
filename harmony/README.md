# 孔明职配 HarmonyOS 工程

本目录是 HarmonyOS 6.1.1(24) Stage 模型工程。当前采用混合架构：ArkUI/ArkTS 管理应用生命周期、权限和系统能力，ArkWeb 加载随 HAP 发布的本地 React/Vite 业务包。

这是一种迁移与交付架构，不把 Web 壳本身当作创新点。核心产品价值来自真实岗位分层、证据匹配、事实约束改写、简历版本与投递闭环；HarmonyOS 系统能力负责降低输入、分享和桌面触达成本。

## 工程结构

```text
harmony/
├─ AppScope/                              应用级配置与图标
├─ entry/src/main/
│  ├─ ets/entryability/                  UIAbility 入口
│  ├─ ets/pages/Index.ets                ArkWeb 容器、权限和 JSBridge
│  ├─ ets/common/CareerFormStore.ets     服务卡片本机数据
│  ├─ ets/applicationformability/        Form Extension
│  ├─ ets/applicationform/pages/         卡片 UI
│  ├─ resources/base/profile/            页面和卡片配置
│  ├─ resources/resfile/                 Vite 自动同步的本地业务包
│  └─ module.json5                       Ability、权限、分享和 Form 配置
├─ build-profile.json5                   SDK、产品和签名配置
└─ oh-package.json5                      OHPM 工程信息
```

不要手工修改 `resources/resfile/`；它由根目录的 Web 构建同步生成。

## 原生桥接

Web 端通过 `src/harmonyBridge.ts` 访问受控桥接方法：

| 能力 | ArkTS 实现 | 数据边界 |
| --- | --- | --- |
| 华为账号 | `Index.ets` 账号授权 | 仅向 Web 返回必要身份结果；本机提示只保存登录布尔值与 OpenID 尾部。 |
| OCR | Core Vision `textRecognition` | 图片在本机识别；能力不可用时由 Web 提示粘贴文本或在同意后使用外部模型。 |
| 分享 | Share Kit | 只分享用户主动生成的报告文本或链接。 |
| TTS | Core Speech `textToSpeech` | 原生失败时尝试浏览器语音合成；仍失败则保持文本模式。 |
| STT | Core Speech `speechRecognizer` + AudioCapturer | 最长 15 秒；原生启动失败时尝试浏览器语音识别，否则回退文字输入。 |
| 服务卡片 | Form Kit | 只保存岗位数、待办数、下一行动、岗位名称和更新时间，不保存简历正文。 |

Bridge 方法由应用内本地页面使用，不向任意远程网页开放。`setPathAllowingUniversalAccess` 只传入本应用 `resourceDir`，用于本地模块和媒体加载。

## 构建

默认 DevEco Studio 根目录：

```text
E:\Program Files\Huawei\DevEco Studio
```

普通 HAP 构建：

```powershell
npm run build:harmony
```

脚本依次执行：

1. TypeScript 检查和 Vite 相对路径构建；
2. 精确同步 `dist/` 到 `resources/resfile/`；
3. 安装 OHPM 依赖；
4. 调用 DevEco Studio 内置 Hvigor；
5. 输出 HAP 路径、大小和 SHA-256。

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
http://127.0.0.1:5173/api/jobs
http://127.0.0.1:5173/api/ark
http://127.0.0.1:5173/api/health
```

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

本轮安装和两次启动证据见 [构建与运行证据](../docs/RELEASE_EVIDENCE_20260722.md)。

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
| unsigned HAP 模拟器安装 | 已通过 |
| 首次启动 | 已通过 |
| 强制停止后二次启动 | 已通过 |
| 最新首页截图 | 已取得 |
| Form Extension 注册 | `bm dump` 已确认 |
| 服务卡片桌面动态刷新 | 待人工添加卡片和杀进程验证 |
| 华为账号 | 待正式签名/真机 |
| OCR、分享、语音 | 已编译；待支持对应能力的真机完成交互验收 |
| 正式 HTTPS 岗位/模型链路 | 待部署公网服务 |
| 发布签名 | 未配置 |

## 权限

- `ohos.permission.INTERNET`：岗位、模型和健康检查。
- `ohos.permission.CAMERA`：用户主动选择拍照或开启面试预览时申请。
- `ohos.permission.MICROPHONE`：用户主动开始语音回答时申请。

应用不会在启动时一次性请求相机和麦克风权限。权限拒绝必须回退到文件、粘贴文本或键盘输入。
