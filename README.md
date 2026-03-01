# GHCP UI — GitHub Copilot Web Interface

A modern web UI for [GitHub Copilot SDK](https://github.com/github/copilot-sdk), hosted on Azure Container Apps and powered by Azure AI Foundry.

> **Why?** Copilot CLI is incredible, but it's terminal-only. This project brings the same agentic power to any device with a browser — desktop, tablet, or phone.

![Architecture](https://img.shields.io/badge/React-19-blue) ![Azure](https://img.shields.io/badge/Azure-Container%20Apps-0078D4) ![Copilot](https://img.shields.io/badge/GitHub-Copilot%20SDK-8B5CF6)

## Features

- 🤖 **Full Copilot SDK** — agentic chat sessions via `@github/copilot-sdk` with SSE streaming
- 📱 **Mobile-first** — responsive drawer sidebar, safe-area-inset, 44px touch targets, `dvh` viewport
- 🧩 **Model selector** — choose between GPT-4.1, GPT-5, Claude Sonnet 4.5, Claude Opus 4.5
- 📂 **Workspace files** — per-user file storage (Azure Blob Storage), drag-drop upload, AI can read/write
- 🔌 **MCP servers** — add remote MCP servers (HTTP/SSE) per session; filesystem MCP auto-mounted
- 📋 **Code copy** — per-code-block copy buttons with language labels in markdown output
- ⚙️ **Settings drawer** — MCP config, model info, workspace path
- 🏗️ **Azure-ready** — full Bicep infrastructure, azd deployment, CI/CD pipeline

## Architecture

```
┌─────────────────┐    SSE/REST     ┌──────────────────┐    JSON-RPC    ┌─────────────┐
│  React Frontend │ ◄────────────► │  Express Backend  │ ◄──────────► │ Copilot CLI  │
│  (Vite+Tailwind)│                 │  (@github/sdk)    │               │ (server mode)│
└─────────────────┘                 └──────────────────┘               └──────────────┘
                                            │                                  │
                                            │ BYOK (API Key)                   │ MCP Servers
                                            ▼                                  ▼
                                   ┌──────────────────┐          ┌──────────────────┐
                                   │ Azure AI Foundry  │          │ Remote MCP (HTTP) │
                                   │ (GPT-4.1 / etc.) │          │ Filesystem MCP    │
                                   └──────────────────┘          └──────────────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ Azure Blob Storage│
                                   │ (workspace files) │
                                   └──────────────────┘
```

## Tech Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| **Frontend**   | React 19, Vite 6, TypeScript 5.7, Tailwind CSS 4              |
| **Backend**    | Express.js 5, TypeScript, `@github/copilot-sdk`               |
| **Streaming**  | Server-Sent Events (SSE)                                      |
| **Storage**    | Azure Blob Storage (per-user workspace files)                  |
| **Infra**      | Azure Container Apps, AI Foundry, ACR, Key Vault, Storage      |
| **IaC**        | Bicep (azd-compatible)                                         |
| **CI/CD**      | GitHub Actions with federated OIDC auth                        |

## Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) — `copilot` must be in PATH
- [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd) — for deployment
- A [GitHub Copilot subscription](https://github.com/features/copilot) (or use BYOK with Azure AI Foundry)

## Quick Start — Local Development

```bash
# Clone and install
git clone <repo-url> && cd ghcp-ui
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Azure AI Foundry endpoint + key (or use GitHub auth)

# Run both frontend + backend in dev mode
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- Vite proxies `/api/*` calls to the backend automatically.

## Workspace (Personal Home Folder)

GHCP UI supports a per-user workspace that gives the AI access to your files:

1. **Upload files** via the 📂 Workspace panel (header button)
2. Files are stored in **Azure Blob Storage** (or local temp dir in dev mode)
3. A **Filesystem MCP server** is auto-mounted, so the AI can read/write files
4. Add **remote MCP servers** (GitHub MCP, custom tools) via the ⚙️ Settings drawer

### Environment Variables for Workspace

```bash
# Azure Blob Storage (optional — falls back to local temp dir)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_CONTAINER_NAME=workspaces   # default
```

## Deploy to Azure

### One-command deployment

```bash
# Login to Azure
azd auth login

# Initialize environment
azd init

# Provision infrastructure + deploy app
azd up
```

This provisions:
- **Resource Group** with all resources
- **Azure Container Registry** for Docker images
- **Azure OpenAI** (AI Foundry) with GPT-4.1 deployment
- **Key Vault** for secrets management
- **Azure Storage Account** for workspace files (with RBAC)
- **Log Analytics** for monitoring
- **Container Apps Environment** with the app

### Environment Variables

Set these in `.env` for local dev or as azd environment variables:

| Variable                          | Description                          | Required |
| --------------------------------- | ------------------------------------ | -------- |
| `AZURE_FOUNDRY_ENDPOINT`          | Azure OpenAI endpoint URL            | For BYOK |
| `AZURE_FOUNDRY_API_KEY`           | Azure OpenAI API key                 | For BYOK |
| `AZURE_FOUNDRY_MODEL`             | Model name (default: `gpt-4.1`)     | No       |
| `PORT`                            | Server port (default: `3001`)        | No       |
| `COPILOT_GITHUB_TOKEN`            | GitHub token (alternative to BYOK)   | No       |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage connection string       | No       |
| `AZURE_STORAGE_ACCOUNT_NAME`      | Storage account name                 | No       |
| `AZURE_STORAGE_CONTAINER_NAME`    | Blob container name                  | No       |

## Project Structure

```
ghcp-ui/
├── src/
│   ├── client/              # React frontend
│   │   ├── src/
│   │   │   ├── components/  # UI (Chat, Sidebar, Workspace, Settings, etc.)
│   │   │   ├── hooks/       # React hooks (useChat, useSessions)
│   │   │   └── types/       # TypeScript types
│   │   └── vite.config.ts
│   └── server/              # Express backend
│       └── src/
│           ├── services/    # CopilotService, WorkspaceService
│           ├── routes/      # API routes (chat, sessions, workspace, health)
│           └── middleware/  # Error handling
├── infra/                   # Bicep infrastructure
│   ├── main.bicep           # Entry point
│   └── modules/             # ACR, ACA, AI, KV, Storage, etc.
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # Local container testing
├── azure.yaml               # azd configuration
└── .github/workflows/ci.yml # CI/CD pipeline
```

## API Endpoints

| Method   | Path                              | Description                |
| -------- | --------------------------------- | -------------------------- |
| `GET`    | `/api/healthz`                    | Health check               |
| `GET`    | `/api/readyz`                     | Readiness check            |
| `GET`    | `/api/sessions`                   | List all sessions          |
| `POST`   | `/api/sessions`                   | Create a new session       |
| `GET`    | `/api/sessions/:id/messages`      | Get session messages       |
| `DELETE` | `/api/sessions/:id`               | Delete a session           |
| `POST`   | `/api/chat/:sessionId`            | Send message (SSE stream)  |
| `POST`   | `/api/chat/:sessionId/sync`       | Send message (sync)        |
| `GET`    | `/api/workspace/:userId/files`    | List workspace files       |
| `POST`   | `/api/workspace/:userId/files`    | Upload file (multipart)    |
| `GET`    | `/api/workspace/:userId/files/*`  | Download file              |
| `DELETE` | `/api/workspace/:userId/files/*`  | Delete file                |

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes
4. Push and open a PR

## License

[MIT](LICENSE)
