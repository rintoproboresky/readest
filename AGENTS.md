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
- Domain Publik (HTTPS via Cloudflare Tunnel):
  - Web Client: `https://readest-cloud.my.id`
  - API Gateway: `https://api.readest-cloud.my.id`
  - MinIO S3 Storage: `https://s3.readest-cloud.my.id`
- Cloudflare Tunnel:
  - Berjalan sebagai service Systemd (`cloudflared.service`) di VPS.
  - Cek status service: `sudo systemctl status cloudflared`
- Build & Deploy:
  - VPS memiliki RAM 6GB + Swap 4GB, sehingga **aman** untuk melakukan build langsung di VPS:
    `docker compose -f docker/compose.yaml -f docker/compose.build.yaml up -d --build client`
  - Jika ingin melakukan build lokal dan push:
    ```bash
    docker build -t ghcr.io/readest/readest:latest .
    docker push ghcr.io/readest/readest:latest
    ssh ubuntu@168.110.216.156 "cd ~/readest && docker compose pull client && docker compose up -d client"
    ```
- DB migration: `cat migration.sql | docker exec -i supabase-db psql -U supabase_admin -d postgres`

## Git Workflow (Windows)
- `git commit --no-verify` — skip pre-commit hooks (CRLF biome formatter errors)
- `git push origin main --no-verify` — skip pre-push hooks
- Semua perubahan di-commit ke branch `main`, push ke `origin/main`

## Compression Proxy (start.mjs)
- Next.js 16 tidak lagi include built-in `compress` middleware di standalone output
- `start.mjs` adalah compression proxy yang membungkus Next.js server — internal server di `:3100`, proxy publik di `:3000`
- Jangan forward `Accept-Encoding` header ke internal server (Next.js masih compress sendiri)
- Jika modifikasi `start.mjs`, hanya production stage Docker yang perlu rebuild (tapi `COPY . .` invalidasi cache build stage juga)

## Critical Context
- `config.booknotes` is optional — always use `?? []` or destructure with default
- `saveConfig` requires 4 args: `(envConfig, bookKey, updatedConfig, settings)`
- `HintInfo` render di pojok kanan header, bukan di dekat text — desain bawaan
- `eventDispatcher.dispatch('hint', ...)` harus include `bookKey` agar HintInfo menampilkan toast

## Server API Proxy
Beberapa fitur butuh server-side proxy untuk bypass CORS:
- `/api/llm/translate` — proxy untuk LLM translation (OpenAI-compatible)
- Pola yang sama bisa ditambah untuk kebutuhan lain

## Referensi
- `apps/readest-app/AGENTS.md` — project overview, commands, source layout dari upstream
- `SESSION-HISTORY.md` — catatan tiap sesi
