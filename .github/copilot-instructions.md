# GHCP-UI — Copilot Instructions

## Project Overview
Web UI for GitHub Copilot SDK, hosted on Azure Container Apps with Azure AI Foundry (BYOK).

## Tech Stack
- **Client:** React 19, Vite, Tailwind CSS, TypeScript
- **Server:** Express 5 (ESM), TypeScript, `@github/copilot-sdk`
- **Infra:** Azure Container Apps, Azure Files, Bicep, AZD
- **Tests:** Playwright e2e (30 tests)

## Critical Rules

### 🔴 ALWAYS Test Locally Before Deploying
1. `npm run build` — must succeed
2. Start production server locally and verify `/api/healthz` returns 200
3. `npx playwright test` — all tests must pass
4. Only THEN run `azd deploy`
5. After deploy, verify the live app responds (health check + revision Running state)

**Rationale:** Alpine containers have different native dep support. Packages that work locally on Windows may crash the container silently (no logs, stuck in "Activating" forever).

### Known Broken Packages on Alpine + Express 5
- `helmet` — incompatible with Express 5
- `compression` — native binding issues
- `applicationinsights` — heavy OpenTelemetry native deps fail

When adding server dependencies, verify the Docker image builds and starts.

### Azure CLI Isolation
Always set `AZURE_CONFIG_DIR` before any `az` or `azd` command. See the `azure-tenant-isolation` skill. This project uses the `me-mngenv` tenant.

```powershell
$env:AZURE_CONFIG_DIR = "C:\Users\ricchi\.azure-tenants\me-mngenv"
$env:AZD_CONFIG_DIR = "C:\Users\ricchi\.azd-tenants\me-mngenv"
```

## Code Conventions
- Server is ESM (`"type": "module"`) — use `.js` extensions in imports
- Workspaces: `src/client` and `src/server`
- Run commands from repo root: `npm run build`, `npm run dev`
- Client uses `/api` proxy in dev (Vite config)

## Deployment
- `azd provision` for infrastructure changes
- `azd deploy` for code deploys
- After ACA recreation: re-enable EasyAuth + set minReplicas:1
