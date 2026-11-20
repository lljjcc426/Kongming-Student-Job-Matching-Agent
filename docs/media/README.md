# 演示素材

## 内容与来源

本目录的截图和视频由本仓库运行中的前端录制。简历、学校、企业与岗位均为虚构样例；模型和岗位接口由录制脚本提供固定响应。截图与视频保留“演示环境”标识，展示页面交互与结果呈现，不作为模型效果或真实招聘数据的验证。

| 文件 | 用途 |
| --- | --- |
| `banner.svg` | 项目横幅与功能概念示意，可直接编辑的 SVG。 |
| `workflow.svg` / `workflow.en.svg` | 中英文求职准备工作流图。 |
| `architecture.svg` / `architecture.en.svg` | 中英文技术架构图，涵盖模型适配、云端 / 本地模型与可选服务。 |
| `demo-preview.gif` | README 中自动播放的视频预览。 |
| [kongming-demo.mp4](kongming-demo.mp4) | 完整界面演示，无配音；覆盖登录动效、简历编辑、画像与岗位分析、文字面试、成长计划、助手问答及管理员控制台。 |
| `home.webp` / `editor.webp` | 求职工作台首页与简历编辑；使用当前青简标识和浅蓝、白、金主题。 |
| `resume.webp` / `jobs.webp` | 学生画像、匹配分析与岗位推荐。 |
| `interview.webp` / `assistant.webp` | 模拟面试与 AI 求职助手。 |
| `account.webp` / `growth.webp` | 流程动效登录页与成长计划；使用临时身份及虚构业务数据。 |
| `console.webp` / `users.webp` | 运行概览与用户管理；来自临时数据库的实际统计，页面标明演示环境。 |
| [sample-resume.md](sample-resume.md) | 可用于试用和录制的虚构简历。 |
| [demo-data.json](demo-data.json) | 录制专用的固定接口数据，不参与应用运行。 |

## 重新录制

需要项目依赖、Playwright 浏览器及 FFmpeg。将支持 H.264、WebP 和 GIF 编码的 FFmpeg 加入 PATH，或通过 `FFMPEG_PATH` 指定路径。先运行 `npm ci`，然后安装录制所需的浏览器工具：

```bash
npx playwright install chromium ffmpeg
```

构建当前前端并录制：

```bash
npm run build
node scripts/capture-showcase.cjs
```

脚本自行启动仅监听本机的服务，创建临时 SQLite 数据库和演示账号，按当前界面完成操作。结束后关闭服务并清理临时数据库，不使用本地开发数据库或线上账号。

脚本统一覆盖 `account`、`home`、`editor`、`resume`、`jobs`、`interview`、`growth`、`assistant`、`console`、`users` 十张 WebP，以及 GIF 预览和 MP4 视频。原始 PNG 与 WebM 保存到已被 Git 忽略的 `artifacts/showcase/`。视频包含登录流程动效、工作区恢复与管理员界面；录制使用文字面试，不启用摄像头，不调用外部模型、OCR 或招聘服务。

可选环境变量：

| 变量 | 用途 |
| --- | --- |
| `SHOWCASE_BROWSER_CHANNEL` | 例如 `chrome`，使用已安装的 Chrome；默认使用 Playwright Chromium。 |
| `FFMPEG_PATH` | FFmpeg 可执行文件路径；默认从 PATH 查找 `ffmpeg`。 |

维护 README 时，在同一提交中更新演示素材与说明，保持页面功能和展示内容一致。
