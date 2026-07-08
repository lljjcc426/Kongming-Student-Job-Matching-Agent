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

## 4. 参考项目

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
