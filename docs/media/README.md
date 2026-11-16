# 演示素材

## 内容与来源

本目录的截图和视频由本仓库运行中的前端录制。简历、学校、企业与岗位均为虚构样例；模型和岗位接口由录制脚本提供固定响应。截图与视频保留“演示环境”标识，展示页面交互与结果呈现，不作为模型效果或真实招聘数据的验证。

| 文件 | 用途 |
| --- | --- |
| `banner.svg` | 项目首页横幅，可直接编辑的 SVG。 |
| `demo-preview.gif` | README 中自动播放的视频预览。 |
| [kongming-demo.mp4](kongming-demo.mp4) | 完整界面演示，无配音；覆盖简历导入、解析、岗位分析、文字模拟面试与助手问答。 |
| `home.webp` / `editor.webp` | 首页与简历编辑工作台。 |
| `resume.webp` / `jobs.webp` | 学生画像、匹配分析与岗位推荐。 |
| `interview.webp` / `assistant.webp` | 模拟面试与 AI 求职助手。 |
| [sample-resume.md](sample-resume.md) | 可用于试用和录制的虚构简历。 |
| [demo-data.json](demo-data.json) | 录制专用的固定接口数据，不参与应用运行。 |

## 重新录制

需要项目依赖、Playwright 浏览器及 FFmpeg。先运行 `npm ci`，然后安装录制所需的浏览器工具：

```bash
npx playwright install chromium ffmpeg
```

在一个终端中启动前端。仅录制界面时，可跳过知识库预热：

```bash
JOB_RAG_SKIP_WARMUP=true npm run dev
```

PowerShell 中先执行 `$env:JOB_RAG_SKIP_WARMUP="true"`，再执行 `npm run dev`。

另一个终端运行：

```bash
node scripts/capture-showcase.cjs
```

脚本从 `http://127.0.0.1:5173` 录制实际交互，并覆盖本目录中生成的 WebP、GIF 与 MP4。原始截图和 WebM 保存到已被 Git 忽略的 `artifacts/showcase/`。录制使用文字面试，关闭浏览器语音合成，不启用摄像头；不调用外部模型、OCR 或招聘服务，也不修改应用代码。

可选环境变量：

| 变量 | 用途 |
| --- | --- |
| `SHOWCASE_URL` | 开发服务地址。 |
| `SHOWCASE_BROWSER_CHANNEL` | 例如 `chrome`，使用已安装的 Chrome；默认使用 Playwright Chromium。 |
| `FFMPEG_PATH` | FFmpeg 可执行文件路径；默认从 PATH 查找 `ffmpeg`。 |

维护 README 时，在同一提交中更新演示素材与说明，保持页面功能和展示内容一致。
