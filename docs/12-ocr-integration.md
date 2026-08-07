# 简历 OCR 坐标识别

## 数据流

1. PDF.js 优先读取 PDF 文字层。
2. 当文字层为空或质量不足时，浏览器逐页渲染 PDF。
3. 页面图片发送到同源 `/api/ocr`。
4. OCR 返回每行文字、四点坐标和置信度。
5. OCR 文本进入现有结构化简历流程，坐标只用于原简历字段高亮。
6. OCR 置信度过低时，通过 Gitee AI / 沐曦资源包中的视觉模型完成语义识别兜底。

## 本地 RapidOCR

Windows 默认使用：

```text
D:\conda_envs\kongming-ocr\python.exe
```

安装或修复环境：

```powershell
npm run setup:ocr
```

可通过服务端环境变量覆盖路径：

```text
OCR_PROVIDER=local
OCR_PYTHON_PATH=D:\conda_envs\kongming-ocr\python.exe
OCR_MODEL_CACHE=D:\ai_models\kongming-ocr\modelscope
```

## 可选外部 OCR

比赛默认路径为本地 RapidOCR 加沐曦视觉模型，不依赖其他外部 OCR。现有代码仍保留火山多语种 OCR 作为非竞赛部署的可选兼容路径：

```text
OCR_PROVIDER=volcengine
VOLC_OCR_ACCESS_KEY=由部署平台安全注入
VOLC_OCR_SECRET_KEY=由部署平台安全注入
VOLC_OCR_SESSION_TOKEN=可选的临时安全令牌
```

凭据只能配置在服务端或部署平台，不得写入前端变量、代码、文档或 Git。
