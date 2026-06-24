# Readest Fork

## Project
Fork dari [readest/readest](https://github.com/readest/readest) — cross-platform ebook reader (Next.js 16 + Tauri v2, pnpm monorepo). Source utama di `apps/readest-app/`.

## Development Approach
- Improvisasi sesuai kebutuhan. Tidak ada roadmap fixed.
- Perubahan minimal, modular, dan upstream-friendly.
- Lihat `SESSION-HISTORY.md` untuk riwayat lengkap tiap sesi.
- IMPORTANT!, after edit, build/check/test local first, then ask user to push or deploy to vps and build apk and do not do that by yourself.

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
- **JANGAN commit file `.env`**, `.env.tauri`, atau file credentials lainnya — sudah di `.gitignore`, tapi pastikan `git add` pilih-pilih file yang aman

## Security Rules (WAJIB dipatuhi agent)
- `.env`, `.env.tauri`, dan `docker/.env` mengandung secrets — JANGAN pernah commit atau expose
- `SERVICE_ROLE_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` hanya ada di `docker/.env` — jangan pernah pindahin ke file yang trackable
- Kalo ada file baru yang mengandung credentials, langsung tambah ke `.gitignore` sebelum commit
- `git status` selalu dicek sebelum `git add` untuk memastikan ga ada file sensitif yang ke-stage

## Compression Proxy (start.mjs)
- Next.js 16 tidak lagi include built-in `compress` middleware di standalone output
- `start.mjs` adalah compression proxy yang membungkus Next.js server — internal server di `:3100`, proxy publik di `:3000`
- Jangan forward `Accept-Encoding` header ke internal server (Next.js masih compress sendiri)
- Jika modifikasi `start.mjs`, hanya production stage Docker yang perlu rebuild (tapi `COPY . .` invalidasi cache build stage juga)

## CORS & Kong Routing
- `docker/volumes/api/kong.yml` HARUS punya service `readest-app` dengan route `/api/` → `client:3000` + plugin `cors`. Tanpa ini, request `/api/*` dari Tauri APK kena CORS error.
- `docker/compose.yaml` jangan set `entrypoint` untuk service `client` — biar `start.mjs` yang jalan (dari Dockerfile). Entrypoint override bypass compression proxy dan CORS header.

## Android APK Build (Self-hosted Supabase)
- Android APK (Tauri static export) HARUS pakai kredensial Supabase dari VPS sendiri, BUKAN upstream default di `.env`
- Kredensial ada di `~/readest/docker/.env` di VPS — ambil lewat SSH: `cat ~/readest/docker/.env | grep -E "^(ANON_KEY|SUPABASE_PUBLIC_URL)"`
- Update `.env.tauri`:
  - `NEXT_PUBLIC_DEFAULT_SUPABASE_URL_BASE64` = base64(`https://api.readest-cloud.my.id`)
  - `NEXT_PUBLIC_DEFAULT_SUPABASE_KEY_BASE64` = base64(`<ANON_KEY dari VPS>`)
- JANGAN copy dari `.env` — itu punya upstream Readest, bukan self-hosted
- Build APK: `pnpm build` → Gradle → sign
- Icon: regenerate dengan `pnpm tauri icon public/icon.png`, lalu copy ke `gen/android/app/src/main/res/`

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
