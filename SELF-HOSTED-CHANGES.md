# Self-Hosted Fork Changes

Daftar lengkap modifikasi fork `rintoproboresky/readest` di atas upstream `readest/readest`.

## 1. AI Insight (Multi-Provider LLM Word/Phrase Explanation)

Fitur utama fork — menjelaskan kata/frasa/kalimat via LLM dengan dukungan banyak provider.

| File | Perubahan |
|------|-----------|
| `src/services/llm/aiInsight.ts` | Service utama AI Insight: multi-provider, context-aware prompt, fallback |
| `src/components/settings/llm/AIInsightPanel.tsx` | Settings panel dengan 12+ LLM provider |
| `src/components/settings/llm/LLMProviderSelect.tsx` | Komponen selector provider |
| `src/app/reader/components/annotator/AIInsightPopup.tsx` | Popup hasil AI Insight (auto-height, edit mode, regenerate) |
| `src/app/reader/components/annotator/AIInsightNotePopup.tsx` | Note editor untuk hasil AI Insight |
| `src/app/reader/components/annotator/TranslatorPopup.tsx` | Translation popup (fork modified) |
| `src/app/reader/components/annotator/Annotator.tsx` | Integrasi AI Insight flow di reader |
| `src/app/reader/components/sidebar/Content.tsx` | Vocabulary tab di sidebar |
| `src/pages/api/llm/translate.ts` | Server-side proxy untuk LLM API |
| `src/services/constants.ts` | `DEFAULT_AI_SETTINGS` default config |
| `src/types/book.ts` | `aiInsight` field di `BookNote` |
| `src/services/sync/syncCategories.ts` | AI settings sync via `aiSettings.llm` fields |
| `src/utils/transform.ts` | `aiInsight` mapping di `transformBookNoteToDB` |
| `src/__tests__/services/aiInsight.test.ts` | Test suite AI Insight |

## 2. Credentials Sync ON by Default

| File | Perubahan |
|------|-----------|
| `src/services/sync/syncCategories.ts:60` | `DEFAULT_OFF_CATEGORIES` dari `['credentials']` → `[]` |

Upstream: credentials sync opt-in (OFF default). Fork: ON default untuk self-hosted.

## 3. Self-Hosted Infrastructure

### Docker & Deployment
| File | Perubahan |
|------|-----------|
| `docker/` | Full Supabase-compatible stack + MinIO S3 + Kong API gateway |
| `docker/compose.yaml` | Service definitions untuk self-hosted |
| `docker/compose.build.yaml` | Build config |
| `docker/volumes/api/kong.yml` | Kong routing + CORS plugin untuk APK |
| `start.mjs` | Compression proxy (gzip for static chunks) |
| `Dockerfile` | Multi-stage build |
| `Cargo.toml` | Dependency adjustments |
| `Cargo.lock` | Lock file updates |
| `pnpm-lock.yaml` | Lock file updates |

### No Quota/Batch/Plan Limitations
| File | Perubahan |
|------|-----------|
| Multiple files | Hapus semua batasan quota, batch, plan untuk self-hosted |
| `795553a6` | Commit: "self-hosted: remove all quota/batch/plan limitations" |
| `cfda26af` | Commit: "self-hosted: remove upgrade prompts and unlimited labels" |

### Android APK Build
| File | Perubahan |
|------|-----------|
| `.github/workflows/build-apk.yml` | CI workflow build APK |
| `src-tauri/Cargo.toml` | Tauri config untuk Android |
| `src-tauri/gen/android/` | Android-specific build config |
| `.env.tauri` | Self-hosted Supabase credentials (base64) |

## 4. Sync Encryption Middleware

| File | Perubahan |
|------|-----------|
| `src/services/sync/replicaCryptoMiddleware.ts` | Middleware encrypt/decrypt untuk sync |
| `src/services/sync/session.ts` | `encryptField`/`decryptField` helpers |
| `src/services/sync/syncCategories.ts` | Integrasi credential gating |
| Test files | Test suite untuk encryption |

## 5. LLM Translation Proxy

| File | Perubahan |
|------|-----------|
| `src/pages/api/llm/translate.ts` | API route proxy ke OpenAI-compatible LLM |
| `src/services/llm/` | LLM service layer |
| `src/components/settings/llm/LLMTranslationPanel.tsx` | Settings UI |

## 6. Translation & Annotation Enhancements

| File | Perubahan |
|------|-----------|
| `src/app/reader/components/annotator/TranslatorPopup.tsx` | Inline translation popup |
| `src/app/reader/components/annotator/TranslationStylePicker.tsx` | Style/color picker |
| `src/app/reader/components/annotator/AIInsightNotePopup.tsx` | Translation note editor |
| `src/app/reader/components/sidebar/Content.tsx` | Vocabulary tab |

## 7. Underline Thickness Customization

| File | Perubahan |
|------|-----------|
| `src/app/reader/components/annotator/Annotator.tsx` | Underline thickness setting |
| `src/types/settings.ts` | Config type |
| `ea6d52d5` | Commit: "underline thickness customization" |

## 8. VPS Monitoring

| File | Perubahan |
|------|-----------|
| `.github/workflows/docker-image.yml` | VPS deploy workflow |
| VPS scripts | fail2ban config, discord bot, monitoring suite |
| `self-hosted-backup.md` | Backup documentation |

## 9. Security Fixes

| File | Perubahan |
|------|-----------|
| Multiple files | Security audit fixes (commit `1a3ee13c`) |

## 10. Other Minor Changes

| Change | Detail |
|--------|--------|
| `AGENTS.md` | Fork context, deployment guide, security rules |
| `SESSION-HISTORY.md` | Riwayat lengkap tiap sesi |
| `.gitignore` | Tambahan ignore patterns |
| `NODE_OPTIONS=--max-old-space-size=4096` | Build OOM fix |
| Submodules | `foliate-js` patch, custom Tauri plugins |
| `apps/readest-app/package.json` | Version, dependencies |

---

## Known Test Failures (Expected, Not Regression)

| Test | Reason |
|------|--------|
| `replicaSettingsSync.test.ts` | Credentials sync ON by default (upstream expect OFF) |
| `updater.test.ts` | SyntaxError — vitest environment issue (Windows) |

## Merge Checklist

Setelah `git merge upstream/main`:
1. `git submodule update --init --recursive`
2. `pnpm lint` (abaikan `noExplicitAny` di fork code)
3. `pnpm test` (2 failure expected — lihat tabel di atas)
4. `git commit --no-verify -m "Merge remote-tracking branch 'upstream/main'"`
