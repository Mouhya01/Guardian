# Guardian

Guardian is an AI-powered security auditing platform. Developers, security engineers and
DevOps teams drop in source code, infrastructure-as-code (Terraform, Docker, Kubernetes,
Nginx, CI/CD pipelines) or environment files, and Guardian runs an in-depth security
analysis — powered by Google Gemini Flash — to surface OWASP Top 10 vulnerabilities,
misconfigurations, exposed secrets and architectural risks, then returns an interactive,
categorized remediation report with fixed code snippets.

## Monorepo layout

```
guardian/
├── backend/   # NestJS API — file ingestion, AI orchestration, report generation
├── frontend/  # Next.js (App Router) — upload UI, Monaco-based report viewer
└── README.md
```

The backend and frontend are kept as independent, deployable applications rather than a
single package — each has its own lifecycle, dependency graph and deployment target
(the API is typically containerized and horizontally scaled, while the frontend is
deployed to an edge/CDN platform). Separating them at the root avoids coupling their
build tooling while keeping both under one repository for atomic, cross-cutting commits
during early development.

## Tech stack

- **Package manager:** pnpm
- **Backend:** NestJS, `@nestjs/swagger` (OpenAPI docs), `@nestjs/config`, Helmet,
  class-validator/class-transformer, express-rate-limit, Node.js `cluster` for
  multi-core utilization
- **Frontend:** Next.js (App Router), Tailwind CSS, Framer Motion, `@monaco-editor/react`
- **AI:** Google Gemini Flash API

## Getting started

```bash
# Backend
cd backend
cp .env.example .env   # fill in your Gemini API key
pnpm install
pnpm run start:dev      # http://localhost:3000 — Swagger docs at /api/docs

# Frontend
cd frontend
pnpm install
pnpm run dev             # http://localhost:3001
```

## Project status

This repository is being built in phases. See commit history and branches for progress.
Phase 1 covers workspace initialization only — no business logic yet.
