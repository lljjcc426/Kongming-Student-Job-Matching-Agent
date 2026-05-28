# Git 协作规范

## 仓库命名建议

推荐远端仓库名：`offer-catcher-ai`

该名称与课题“Offer 捕手”保持一致，简洁、清晰，适合 GitHub 仓库和部署项目使用。

## 分支策略

- `main`：稳定分支，用于可提交版本和最终部署。
- `dev`：日常开发分支。
- `feature/*`：具体功能开发分支，例如 `feature/match-engine`、`feature/resume-workbench`。

首版 Demo 开发可以先使用 `main` 小步提交；功能复杂后再拆分 `dev` 和 `feature/*`。

## 提交规范

使用清晰的 Conventional Commits 风格：

- `docs: add project preparation docs`
- `feat: add resume matching workspace`
- `feat: add job recommendation panel`
- `fix: correct match score calculation`
- `chore: configure deployment`

## 变更说明要求

每次阶段总结需要说明：

- 新增文件。
- 修改文件。
- 删除文件。
- 已验证的命令或页面。
- 未完成或待确认事项。

## 远端同步流程

用户在 GitHub 创建仓库 `offer-catcher-ai` 后，执行或由我协助执行：

```powershell
git remote add origin <GitHub 仓库地址>
git branch -M main
git push -u origin main
```

后续每个阶段以小步提交方式同步，避免大批量不可回溯变更。

