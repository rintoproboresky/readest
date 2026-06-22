# Readest Fork

## Project
Fork dari [readest/readest](https://github.com/readest/readest) — cross-platform ebook reader (Next.js 16 + Tauri v2, pnpm monorepo). Source utama di `apps/readest-app/`.

## Development Approach
- Improvisasi sesuai kebutuhan. Tidak ada roadmap fixed.
- Perubahan minimal, modular, dan upstream-friendly.
- Hindari modifikasi sync system, backend APIs, subscription/premium logic.
- Lihat `SESSION-HISTORY.md` untuk riwayat lengkap tiap sesi.

## Deployment (Self-hosted Oracle VPS)
- VPS: `168.110.216.156`
- SSH: `ssh -i "D:\Oracle_Cloud\SSH_Key\ssh-key-2025-12-27.key" ubuntu@168.110.216.156`
- Stack: Supabase DB + GoTrue Auth + PostgREST + Kong API (`:8000`) + MinIO S3 (`:9000`) + client (`:3000`)
- Build & deploy: `docker compose -f docker/compose.yaml -f docker/compose.build.yaml up -d --build client`
- DB migration: `cat migration.sql | docker exec -i supabase-db psql -U supabase_admin -d postgres`

## Git Workflow (Windows)
- `git commit --no-verify` — skip pre-commit hooks (CRLF biome formatter errors)
- `git push origin main --no-verify` — skip pre-push hooks
- Semua perubahan di-commit ke branch `main`, push ke `origin/main`

## Server API Proxy
Beberapa fitur butuh server-side proxy untuk bypass CORS:
- `/api/llm/translate` — proxy untuk LLM translation (OpenAI-compatible)
- Pola yang sama bisa ditambah untuk kebutuhan lain

## Referensi
- `apps/readest-app/AGENTS.md` — project overview, commands, source layout dari upstream
- `SESSION-HISTORY.md` — catatan tiap sesi
