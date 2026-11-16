# 参与贡献

欢迎提交问题复现、交互改进、文档修正和功能实现。提交较大改动前，建议先通过 Issue 说明使用场景、现有行为与预期结果。

## 本地开发

按[安装与运行](docs/getting-started.md)准备 Node.js 24.x、依赖和所需服务。开发分支使用 `feature/`、`fix/` 或 `docs/` 前缀，提交信息说明变更目的。

```bash
git switch -c docs/your-change
npm ci
node --env-file=.env --run dev
```

个人提交使用贡献者自己的 Git 身份；维护者在本仓库内使用 `lljjcc426 <3115250840@qq.com>`。

## 变更约定

- 产品文案准确、克制，明确区分已实现能力、示例数据和规划功能。
- 将业务流程放在 `src/features/`，页面放在 `src/pages/`，服务能力放在 `server/`。
- 不提交 API Key、真实个人简历、本地数据集、模型缓存或构建产物。
- 新增、修改、移动、删除文件需在 Pull Request 中说明；涉及路径调整时同步更新链接。
- 使用截图说明可见界面变更，演示简历与岗位信息应使用虚构或获得授权的数据。

## 验证

按改动范围运行必要检查：

| 变更范围 | 建议检查 |
| --- | --- |
| 文档、演示素材 | 检查本地链接、GitHub 渲染与素材说明。 |
| TypeScript / 前端逻辑 | `npm run build`，并查看受影响的页面。 |
| 解析逻辑 | `npm run verify:parsers`。 |
| OCR / 简历处理 | 按所需依赖运行 `npm run verify:resume-processing`。 |
| 岗位检索 | 按本地数据与模型环境运行 `verify:job-db`、`verify:job-rag` 或 `verify:job-rerank`。 |

原有部分验证脚本包含 Windows / D 盘约定，执行前先查看脚本参数。无需为单纯文档变更运行所有模型、OCR 与检索验证。

## Pull Request

说明解决的问题、最终行为、受影响文件与验证结果。若存在运行限制或需要额外配置，提供可操作的说明。贡献代码遵循仓库的 [Apache-2.0 许可证](LICENSE)。
