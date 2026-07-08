# 第三方依赖与素材 License 汇总

## 1. 说明

本文用于记录项目依赖、静态素材、运行时资源和参考项目的 License 情况。当前文档用于公开发布前核对，不代表所有授权已经最终确认。

公开发布前，应结合 `package-lock.json`、公开素材来源、运行时资源来源和参考项目说明逐项确认授权边界。

## 2. npm 依赖

| 名称 | 用途 | License | 是否打包进生产产物 | 状态 |
| --- | --- | --- | --- | --- |
| `react` | 前端框架 | 待确认 | 是 | 公开前核对 |
| `react-dom` | 前端渲染 | 待确认 | 是 | 公开前核对 |
| `vite` | 构建工具 | 待确认 | 否 / 构建期 | 公开前核对 |
| `typescript` | 类型检查 | 待确认 | 否 / 构建期 | 公开前核对 |
| `pdfjs-dist` | PDF 解析 | 待确认 | 是 | 公开前核对 |
| `react-markdown` | Markdown 渲染 | 待确认 | 是 | 公开前核对 |
| `remark-gfm` | GFM Markdown 支持 | 待确认 | 是 | 公开前核对 |
| `recharts` | 图表展示 | 待确认 | 是 | 公开前核对 |
| `pixi.js` | Live2D 渲染依赖 | 待确认 | 是 | 公开前核对 |
| `pixi-live2d-display` | Live2D 展示 | 待确认 | 是 | 公开前核对 |
| `@hazart-pkg/live2d-core` | Live2D runtime | 待确认 | 是 | 公开前核对 |
| `three` | 3D 视觉展示 | 待确认 | 是 | 公开前核对 |
| `@react-three/fiber` | React Three.js 集成 | 待确认 | 是 | 公开前核对 |
| `@react-three/drei` | Three.js 辅助组件 | 待确认 | 是 | 公开前核对 |
| `gsap` | 动效 | 待确认 | 是 | 公开前核对 |
| `animejs` | 动效 | 待确认 | 是 | 公开前核对 |
| `lucide-react` | 图标 | 待确认 | 是 | 公开前核对 |
| Font Awesome | 图标 | 待确认 | 是 | 公开前核对 |
| `playwright` | UI 验证 | 待确认 | 否 / 测试期 | 公开前核对 |

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

## 5. 公开前核对项

- [ ] 核对 `package-lock.json` 中所有生产依赖 License。
- [ ] 确认所有图片和视频素材来源。
- [ ] 确认 Live2D 模型授权边界。
- [ ] 确认 PDF.js CMap 资源 License。
- [ ] 确认公开仓库中没有未授权素材。
- [ ] 如最终使用外部素材，补充素材名称、来源链接和授权说明。
- [ ] 如 License 存在不兼容风险，替换素材或补充授权证明。
