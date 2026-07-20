# 孔明职配 HarmonyOS 端

`harmony/` 是孔明职配的 HarmonyOS 6.1.1(24) Stage 模型工程。当前采用 Web 优先的混合迁移方案：现有 React/Vite 产品继续作为唯一界面与业务实现，HarmonyOS 端使用 ArkWeb 加载随 HAP 一起发布的本地 Web 资源，后续只为文件、分享、相机、通知等系统能力增加必要的原生桥接。

这种结构避免同时维护 Web 和 ArkUI 两套界面，也能最大限度保留现有的孔明机器人 IP、五个一级入口、简历解析、岗位推荐、模拟面试与 AI 助手交互。

## 当前能力

- 原版 UI 与素材本地打包，不依赖远程网页才能启动。
- 首页、简历解析、岗位推荐、模拟面试、AI 助手五个入口可在 ArkWeb 内运行。
- Vite 使用相对资源基址，孔明 IP、PDF.js、Live2D 和面试室素材均可从 HAP 内加载。
- `resfile` 只允许应用自己的资源目录参与本地跨域访问；ArkWeb 不加载远程壳页面。
- 适配手机竖屏，保留现有 Web 的响应式布局。
- 现有 `<input type="file">` 已在 API 24 模拟器触发鸿蒙系统的“图库 / 拍照 / 文件”选择面板。
- 模拟面试沿用原有 `getUserMedia`，用户点击“开启”后请求相机运行时权限；授权后可显示本机预览。
- `module.json5` 已注册联网权限和文本/链接分享入口，为后续原生桥接保留系统入口。

## 工程结构

```text
harmony/
├─ AppScope/                         应用级配置与图标
├─ entry/src/main/
│  ├─ ets/entryability/             UIAbility 启动入口
│  ├─ ets/pages/Index.ets           最小 ArkWeb 容器
│  ├─ resources/resfile/            由 Vite 构建同步的本地 Web 产物
│  └─ module.json5                  设备、权限与分享入口配置
├─ build-profile.json5              SDK 与产品构建配置
└─ oh-package.json5                 OHPM 工程信息
```

Web 源码仍位于仓库根目录的 `src/` 和 `public/`。不要直接修改 `resources/resfile/` 中的生成文件。

## 构建

在仓库根目录执行：

```powershell
npm run build:harmony
```

脚本会：

1. 运行 TypeScript 与 Vite 构建，使用 `./` 作为资源基址；
2. 将 `dist/` 精确同步到 `entry/src/main/resources/resfile/`；
3. 安装 OHPM 依赖；
4. 使用 DevEco Studio 自带的 Hvigor 构建 HAP；
5. 输出 HAP 的绝对路径、大小和 SHA-256。

默认 DevEco Studio 路径为 `E:\Program Files\Huawei\DevEco Studio`。构建产物：

```text
harmony/entry/build/default/outputs/default/entry-default-unsigned.hap
```

已创建 `KongMing_API24` 模拟器时，可继续执行：

```powershell
npm run run:harmony:emulator
```

该命令通过 DevEco Studio 自带的 Emulator 与 HDC 安装并启动 HAP，不依赖 IDE 图形操作。

本机联调真实岗位接口时，先保持 `npm run dev` 运行，再使用：

```powershell
npm run build:harmony:local
npm run run:harmony:emulator
```

本地构建只把 `http://127.0.0.1:5173/api/jobs` 和 `/api/ark` 写入当前 HAP；运行脚本通过 HDC reverse port 将模拟器的 5173 端口转发到电脑上的 Vite 服务，因此不依赖固定局域网 IP。正式 HAP 仍应在构建时配置公网 HTTPS 的 `VITE_JOBS_API_URL` 与 `VITE_ARK_API_URL`。

## DevEco Studio

若使用 IDE，只需打开本目录 `harmony/`。从仓库根目录修改 Web 源码后，先执行：

```powershell
npm run sync:harmony:web
```

再在 DevEco Studio 中构建，确保 `resfile` 与最新 Web 源码一致。

## 当前边界

- HAP 目前未配置发布签名；模拟器可安装，比赛提交前需使用团队的开发者证书与 Profile。
- 系统分享入口已声明，但分享内容传入 Web 状态的 JS/native 桥接尚未完成。
- ArkWeb 文件上传已验证能打开系统选择面板；仍需用实际 PDF/图片验证读取、解析和取消选择回调。
- 当前只为用户主动开启的面试摄像头申请相机权限；麦克风和通知等能力要按实际功能逐项接入，不提前申请无关权限。
- AI 请求仍依赖仓库的 `/api/ark` 服务和服务端 `ARK_API_KEY`。构建 HAP 时通过 `VITE_ARK_API_URL` 注入公开 HTTPS 代理地址；未配置时页面会立即说明模型服务不可用，密钥不会打入 HAP。
- 真实岗位请求依赖 `/api/jobs`；本机模拟器可使用 `build:harmony:local`，真机或比赛安装包需要配置可访问的公网 HTTPS `VITE_JOBS_API_URL`。
- `setPathAllowingUniversalAccess` 只传入本应用的 `resourceDir`，用于本地 ES module、样式与资源加载。
