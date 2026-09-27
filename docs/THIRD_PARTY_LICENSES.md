# 第三方依赖与素材 License 汇总

## 1. 说明

本文用于记录项目依赖、静态素材、运行时资源和参考项目的 License 情况。npm 依赖许可证依据当前 `package-lock.json` 中对应包的 `license` 字段整理；静态素材和运行时资源仍需结合实际来源继续核对。

本仓库当前公开发布目的为本次竞赛提交、评审展示、可复现检查和学习参考。原创代码按 Apache License 2.0 开源；项目名称、截图、文档、PPT、演示材料、品牌标识和非代码素材不因代码开源而自动放弃署名权或其他未明确授予的权利。

## 2. npm 依赖

| 名称 | 用途 | License | 是否打包进生产产物 | 状态 |
| --- | --- | --- | --- | --- |
| `react` | 前端框架 | MIT | 是 | 已按 lockfile 记录 |
| `react-dom` | 前端渲染 | MIT | 是 | 已按 lockfile 记录 |
| `vite` | 构建工具 | MIT | 否 / 构建期 | 已按 lockfile 记录 |
| `@vitejs/plugin-react` | Vite React 插件 | MIT | 否 / 构建期 | 已按 lockfile 记录 |
| `typescript` | 类型检查 | Apache-2.0 | 否 / 构建期 | 已按 lockfile 记录 |
| `pdfjs-dist` | PDF 解析 | Apache-2.0 | 是 | 已按 lockfile 记录 |
| `pdf-lib` | 鸿蒙端离线生成正式简历 PDF | MIT | 是，构建时打包至原生 JS 模块 | 正文许可随 HAP 分发 |
| `@pdf-lib/fontkit` | 中文字体测量与子集嵌入 | MIT | 是，构建时打包至原生 JS 模块 | npm 与上游 README 声明 MIT，但未提供独立许可文件；保留真实作者元数据和 README 链接，未补造版权声明 |
| `react-markdown` | Markdown 渲染 | MIT | 是 | 已按 lockfile 记录 |
| `remark-gfm` | GFM Markdown 支持 | MIT | 是 | 已按 lockfile 记录 |
| `recharts` | 图表展示 | MIT | 是 | 已按 lockfile 记录 |
| `pixi.js` | Live2D 渲染依赖 | MIT | 是 | 已按 lockfile 记录 |
| `pixi-live2d-display` | Live2D 展示 | MIT | 是 | 已按 lockfile 记录 |
| `@hazart-pkg/live2d-core` | Live2D runtime | ISC | 是 | 已按 lockfile 记录 |
| `three` | 3D 视觉展示 | MIT | 是 | 已按 lockfile 记录 |
| `@react-three/fiber` | React Three.js 集成 | MIT | 是 | 已按 lockfile 记录 |
| `@react-three/drei` | Three.js 辅助组件 | MIT | 是 | 已按 lockfile 记录 |
| `gsap` | 动效 | Standard no-charge license | 是 | 需按 GSAP 标准许可核对商业边界 |
| `animejs` | 动效 | MIT | 是 | 已按 lockfile 记录 |
| `lucide-react` | 图标 | ISC | 是 | 已按 lockfile 记录 |
| `@fortawesome/fontawesome-svg-core` | 图标核心库 | MIT | 是 | 已按 lockfile 记录 |
| `@fortawesome/free-solid-svg-icons` | 图标资源 | CC-BY-4.0 AND MIT | 是 | 已按 lockfile 记录，需保留图标署名要求 |
| `playwright` | UI 验证 | Apache-2.0 | 否 / 测试期 | 已按 lockfile 记录 |
| `@types/react` | React 类型声明 | MIT | 否 / 构建期 | 已按 lockfile 记录 |
| `@types/react-dom` | React DOM 类型声明 | MIT | 否 / 构建期 | 已按 lockfile 记录 |

## 3. 静态素材

| 路径 | 类型 | 来源 | 授权状态 | 后续动作 |
| --- | --- | --- | --- | --- |
| `public/kongming-ip.png` | 图片 | 待确认 | 待确认 | 公开前补充来源 |
| `src/assets/*.png` | 图片 | 待确认 | 待确认 | 公开前补充来源 |
| `src/assets/*.mp4` | 视频 | 待确认 | 待确认 | 公开前补充来源 |
| `public/avatars/interviewer-2d/interviewer.png` | 面试官图片 | 待确认 | 待确认 | 公开前补充来源 |
| `public/avatars/interviewer-live2d/*` | Live2D 模型 | 待确认 | 待确认 | 公开前补充来源 |
| `public/vendor/pdfjs/cmaps/*` | PDF.js CMap | 待确认 | 待确认 | 公开前核对 License |
| `public/vendor/live2d/live2dcubismcore.min.js` | Live2D runtime | 待确认 | 待确认 | 公开前核对 License |
| `harmony/entry/src/main/resources/base/media/interviewOfficeV3.jpg` | 原生模拟面试办公室背景 | Wikimedia Commons 上的 [Leather chairs in meeting room](https://commons.wikimedia.org/wiki/File:Leather_chairs_in_meeting_room_(Unsplash).jpg)，作者 Breather | CC0 1.0，无需署名 | 已裁切、降饱和和调色；来源与许可证已确认 |
| `harmony/entry/src/main/resources/rawfile/avatar/professional-interviewer-v5.glb` | 原生女性商务面试官 | Microsoft Rocketbox `Business_Female_04`，commit `0943055db6ec570bcef9f2c8b41c9e5467c808f9` | MIT | 许可证与来源记录保存在 `scripts/assets/rocketbox-business-female-04/`；项目仅保留 28 个运行时面部目标并嵌入 1K 纹理 |

## 4. 参考项目

原生 PDF 引擎及其 `@pdf-lib/standard-fonts`、`@pdf-lib/upng`、`pako`、`tslib` 依赖的许可和版权说明由 `scripts/build-resume-pdf-engine.cjs` 收集到 `harmony/entry/src/main/resources/rawfile/licenses/resume-pdf.txt`。`@pdf-lib/fontkit` 的补充来源说明存于 `scripts/assets/licenses/pdf-lib-fontkit.txt`；生成的 JS 保留依赖内嵌许可注释。

简历生成读取设备系统 `/system/fonts/HarmonyOS_Sans_SC.ttf`，不将系统字体打包或提交至仓库，只向用户 PDF 嵌入使用到的字形子集。本轮模拟器字体的 OS/2 `fsType` 标记允许可编辑嵌入与子集化；其他设备版本的字体可用性和授权仍需复核。

参考项目与原创性说明见：

- `docs/OPEN_SOURCE_ATTRIBUTION.md`

## 5. NOTICE 与再分发要求

根目录 `NOTICE` 记录本项目原始仓库、版权主体和项目贡献者署名。重新分发或修改版本应保留 `NOTICE` 和 Apache License 2.0 正文，并在修改文件或说明中标注修改来源。

## 6. 公开前核对项

- [x] 核对 `package-lock.json` 中直接生产依赖和开发依赖 License 摘要。
- [ ] 确认所有图片和视频素材来源。
- [ ] 确认 Live2D 模型授权边界。
- [ ] 确认 PDF.js CMap 资源 License。
- [ ] 确认公开仓库中没有未授权素材。
- [ ] 如最终使用外部素材，补充素材名称、来源链接和授权说明。
- [ ] 如 License 存在不兼容风险，替换素材或补充授权证明。
