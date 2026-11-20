<p align="center">
  <img src="docs/media/banner.svg" alt="Kongming · Student career workspace" width="100%">
</p>

<h1 align="center">Kongming · 孔明职配</h1>
<p align="center"><strong>Understand your resume. Explore the fit. Prepare your next step.</strong></p>
<p align="center">An AI workspace for student job seekers, connecting resumes, job analysis, interview practice and growth plans.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-5277ea?style=flat-square" alt="Apache-2.0"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-24.x-43853d?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 24.x"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/React-19-149eca?style=flat-square&amp;logo=react&amp;logoColor=white" alt="React 19"></a>
  <a href="tsconfig.json"><img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <strong>English</strong><br>
  <a href="#product-tour">Product tour</a> · <a href="#capabilities">Capabilities</a> · <a href="#quick-start">Quick start</a> · <a href="#architecture">Architecture</a> · <a href="docs/README.md">Documentation</a> · <a href="CONTRIBUTING.md">Contributing</a>
</p>

## Overview

Kongming brings a student's resume and target job into one workflow. It structures education, skills and experience, explains how the available evidence relates to job requirements, suggests resume improvements and provides interview practice for the selected role.

The application uses React and TypeScript with server-side adapters for OpenAI, Claude and OpenAI-compatible services, including local models through Ollama. OCR and a local job knowledge base are optional. User and administrator workspaces share a server with SQLite persistence for accounts, career workspaces, interview records, growth plans and operational metrics. The interface and detailed documentation are primarily in Chinese.

![From resume import to growth and review](docs/media/workflow.en.svg)

## Product tour

[![Kongming product tour](docs/media/demo-preview.gif)](docs/media/kongming-demo.mp4?raw=true)

**[Watch the full demo](docs/media/kongming-demo.mp4?raw=true)** · [Media and recording notes](docs/media/README.md)

The recording shows the running frontend with a fictional resume and fixed API responses. It demonstrates interactions and presentation; model quality and live retrieval require the corresponding services.

<table>
  <tr>
    <td width="50%"><a href="docs/media/account.webp"><img src="docs/media/account.webp" alt="Sign-in with the animated workflow illustration"></a><br><strong>01 · Sign in or register</strong><br>Continue with an account or try an independent guest session.</td>
    <td width="50%"><a href="docs/media/home.webp"><img src="docs/media/home.webp" alt="Career workspace home and navigation"></a><br><strong>02 · Open the workspace</strong><br>Navigate to resumes, jobs, interviews and the assistant.</td>
  </tr>
  <tr>
    <td><a href="docs/media/editor.webp"><img src="docs/media/editor.webp" alt="Resume source text and editable structured fields"></a><br><strong>03 · Import and edit a resume</strong><br>Upload DOCX, PDF, images or text, or fill in fields and generate recommendations.</td>
    <td><a href="docs/media/resume.webp"><img src="docs/media/resume.webp" alt="Student profile, matching dimensions and resume suggestions"></a><br><strong>04 · Review matching evidence</strong><br>Check education, skills and experience alongside improvement suggestions.</td>
  </tr>
  <tr>
    <td><a href="docs/media/jobs.webp"><img src="docs/media/jobs.webp" alt="Recommended roles, ability evidence and custom JD analysis"></a><br><strong>05 · Analyze a target role</strong><br>Compare requirements with resume evidence and analyze a custom JD.</td>
    <td><a href="docs/media/interview.webp"><img src="docs/media/interview.webp" alt="Interview avatar, competencies and text follow-up"></a><br><strong>06 · Practice interviews</strong><br>Answer questions, discuss follow-ups and generate a review report.</td>
  </tr>
  <tr>
    <td><a href="docs/media/growth.webp"><img src="docs/media/growth.webp" alt="Growth plan with skill gaps, practice tasks and evidence progress"></a><br><strong>07 · Plan further practice</strong><br>Turn gaps into tasks, submit evidence and schedule reassessment.</td>
    <td><a href="docs/media/assistant.webp"><img src="docs/media/assistant.webp" alt="Career assistant using resume, job and conversation context"></a><br><strong>08 · Discuss next steps</strong><br>Ask follow-up questions with your resume, role and conversation history.</td>
  </tr>
  <tr>
    <td><a href="docs/media/console.webp"><img src="docs/media/console.webp" alt="Administrator console with requests, usage and service status"></a><br><strong>09 · Monitor the service</strong><br>Review requests, usage, configuration, resources and backups.</td>
    <td><a href="docs/media/users.webp"><img src="docs/media/users.webp" alt="Account roles, status and session management"></a><br><strong>10 · Manage accounts</strong><br>Disable or restore users, revoke sessions and review audit events.</td>
  </tr>
</table>

## Capabilities

| Area | Available functionality |
| --- | --- |
| Resume parsing | DOCX, PDF, images, TXT / Markdown and direct field entry. PDF text extraction runs first; OCR can provide text and coordinates for scans. Convert legacy DOC files before uploading. |
| Profiles and explanations | Education, skills and experience organized into a student profile, with five matching dimensions. |
| Job recommendations | Custom JD analysis; optional vector + BM25 retrieval with source links and verification timestamps. |
| Resume improvement | Keyword gaps, evidence and action suggestions; copy an improvement draft or download a Markdown analysis report. |
| Interview practice | General, technical and HR modes with text answers. Speech and camera features depend on browser support and permissions. |
| Career assistant | Multi-turn conversations grounded in resume, role, history and feedback, with saved messages and feedback. |
| Accounts and workspaces | Account sign-in or independent guest sessions; resume text, structured fields, recommendations, JD drafts and role selection are saved per account and restored after refresh. |
| Service console | Request trends, success rate, average / P95 latency, reported model tokens, service configuration, resources, backups, account status and audit events. |
| Interview review and growth plans | Evidence by competency, stage or formal reports, practice tasks and comparisons with later assessments. |

Match scores use the project's heuristic rules. They have not been calibrated against hiring outcomes and do not represent acceptance probabilities. If the local knowledge base is unavailable, the interface reports this and attempts model-generated role suggestions.

## Quick start

### Install

You need **Node.js 24.x** and npm.

```bash
git clone https://github.com/lljjcc426/Kongming-Student-Job-Matching-Agent.git
cd Kongming-Student-Job-Matching-Agent
npm ci
```

### Configure a model

Copy [`.env.example`](.env.example) to `.env`. Self-hosted installations use your own API credentials or your own model server.

| Service | `MODEL_PROVIDER` | Protocol |
| --- | --- | --- |
| OpenAI | `openai` | Chat Completions |
| Claude | `anthropic` | Native Anthropic Messages |
| Custom cloud / local endpoint | `openai-compatible` | OpenAI-compatible Chat Completions; e.g. DeepSeek, Qwen, vLLM or LM Studio |
| Ollama | `ollama` | Local OpenAI-compatible API |

**OpenAI example:**

```dotenv
MODEL_PROVIDER=openai
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=your_openai_api_key
MODEL_TEXT_MODEL=gpt-4.1-mini
MODEL_VISION_MODEL=gpt-4.1-mini
```

<details>
<summary><strong>Claude configuration</strong></summary>

```dotenv
MODEL_PROVIDER=anthropic
MODEL_BASE_URL=https://api.anthropic.com/v1
MODEL_API_KEY=your_claude_api_key
MODEL_TEXT_MODEL=claude-sonnet-4-6
MODEL_VISION_MODEL=claude-sonnet-4-6
```

The backend uses the native Messages API, including system prompts and image inputs.

</details>

<details>
<summary><strong>Local models with Ollama</strong></summary>

Install and start [Ollama](https://ollama.com/), then download a vision model:

```bash
ollama pull qwen3-vl:8b
```

Configure `.env`:

```dotenv
MODEL_PROVIDER=ollama
MODEL_BASE_URL=http://127.0.0.1:11434/v1
MODEL_API_KEY=
MODEL_TEXT_MODEL=qwen3-vl:8b
MODEL_VISION_MODEL=qwen3-vl:8b
MODEL_REQUEST_TIMEOUT_MS=180000
```

Choose a model that fits your available memory and compute.

</details>

Text and vision models are configured separately. Vision models must support image input. Leave `MODEL_VISION_MODEL` empty for a text-only setup and use OCR for scans and images. Use model IDs available to your account or local runtime.

See the [configuration guide](docs/configuration.md#模型接入) for API key setup, custom endpoints, timeouts and troubleshooting.

### Run

```bash
node --env-file=.env --run dev
```

Open the local address printed in the terminal, usually **http://localhost:5173**. Register and sign in, or select “访客体验” (guest access). In “简历编辑” (resume editor), upload a file or fill in fields. After manual entry, select “生成岗位推荐” (generate recommendations), then review your profile, compare roles, practice interviews and build a growth plan.

The workspace saves automatically; registered users can continue after signing in again. PDF and image resumes restore as text. Upload the original again to restore its file preview.

For a UI-only visit, `npm run dev` works without model credentials. Resume structuring, JD analysis and model conversations require a valid connection. The Node.js `--env-file` option loads server variables into the process.

New accounts have the user role. Administrators are granted through a server command and enter `/console` after sign-in. See [administrator setup and metric definitions](docs/deployment.md#管理员与服务控制台).

### Optional services

| Integration | Requirements | Guide |
| --- | --- | --- |
| OCR | Python with RapidOCR, or Volcengine OCR credentials | [OCR integration](docs/12-ocr-integration.md) |
| Job knowledge base | Python 3.11, job JSONL, embeddings and a Qdrant local index | [Setup](docs/getting-started.md) · [Retrieval design](docs/14-job-rag-knowledge-base.md) |

Existing `setup:ocr`, `setup:rag` and `build:job-index` scripts target Windows / PowerShell with D-drive defaults. See the [setup guide](docs/getting-started.md) for macOS / Linux instructions. Job datasets, indexes and model weights are supplied separately.

## Architecture

![Kongming architecture: frontend, server adapters, cloud and local models, OCR and retrieval](docs/media/architecture.en.svg)

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Recharts and Three.js / React Three Fiber. |
| Workflow | Business hooks and model adapters for resume processing, job analysis, interviews and chat. |
| Documents | Mammoth for DOCX text, PDF.js for PDFs, and RapidOCR / Volcengine OCR for scans and images. |
| Model services | Node.js reads server credentials, adapts OpenAI / Claude protocols and routes text or vision tasks through same-origin APIs. |
| Accounts and operations | SQLite WAL, versioned migrations, server-side role checks, isolated workspaces, conversations, interviews, growth plans, request metadata, audit events and online backups. |
| Optional retrieval | Python, LlamaIndex, BGE, Qdrant, BM25, RRF fusion and optional reranking. |

The job knowledge base requires Python, job data and persistent indexes. After building, run `node --env-file=.env --run start` to serve both the UI and API; `npm run preview` only serves static output. See [model configuration](docs/configuration.md) and [server deployment](docs/deployment.md).

## Repository layout

```text
src/        Frontend pages, components, workflows and adapters
server/     Accounts, authorization, metrics, model proxy, OCR and retrieval
api/        Model and OCR HTTP entry points
scripts/    Setup, job collection and verification tools
public/     Avatars, PDF character maps and static assets
docs/       Guides, design documents and demo media
.github/    Issue and pull request templates
```

## Documentation and contributions

[Documentation index](docs/README.md) · [Getting started](docs/getting-started.md) · [Configuration](docs/configuration.md) · [Contributing](CONTRIBUTING.md) · [Report an issue](https://github.com/lljjcc426/Kongming-Student-Job-Matching-Agent/issues/new/choose)

The documentation index groups usage guides, implementation notes and earlier design material. Planned capabilities in design documents should be read alongside the current implementation.

## License

Licensed under [Apache License 2.0](LICENSE). Third-party dependencies and bundled resources retain their respective license notices.
