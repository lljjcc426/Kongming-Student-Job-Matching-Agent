当前目录用于模拟面试页的 Live2D 面试官模型。

- 前端优先加载 `/avatars/interviewer-live2d/interviewer.model3.json`。
- `interviewer.model3.json` 是稳定入口，当前指向 `interviewer_live2d_v1.moc3` 和对应纹理。
- 原始导出入口 `/avatars/interviewer-live2d/interviewer_live2d_v1.model3.json` 仍保留，组件也会自动兜底到该文件。
- Live2D 加载失败时，页面会回退到 `/avatars/interviewer-2d/interviewer.png`。
- 模型大小和位置在 `src/components/interview/Live2DInterviewerAvatar.tsx` 的 `fitModelToContainer` 中调整。
- 嘴巴张合频率在 `Live2DInterviewerAvatar.tsx` 中 `setInterval(..., 130)` 处调整。
