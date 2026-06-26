# Automated VPS Backup (Self-Hosted Backup System)

Dokumentasi ini menjelaskan rancangan, cara kerja, dan instruksi penyiapan fitur **Backup Otomatis Lintas Cloud** untuk tumpukan (*stack*) self-hosted Readest Anda. 

Fitur ini mencadangkan database PostgreSQL Supabase (catatan membaca, progres, akun user) serta menyinkronkan seluruh berkas buku di MinIO S3 ke penyimpanan awan eksternal (Google Drive / Cloudflare R2).

---

## 1. Spesifikasi Teknis & Komponen

Sistem backup ini berjalan langsung di sistem operasi VPS Ubuntu Anda di latar belakang (*cron daemon*) dan mencakup komponen-komponen berikut:

* **pg_dumpall (Supabase Database Backup):** Mengambil cadangan snapshot mentah database PostgreSQL Supabase (`supabase-db` container) ke dalam file `.sql` terkompresi.
* **tar (Configuration Backup):** Mengemas file-file sensitif seperti `docker/.env` (berisi password JWT, DB, S3) dan `compose.yaml`.
* **rclone (Google Drive / Cloud Storage Sync):** Mengunggah backup database dan konfigurasi ke Google Drive gratis (kuota 15GB).
* **mc / rclone sync (Inkremental Buku):** Melakukan replikasi inkremental direktori volume MinIO S3 ke bucket eksternal (Google Drive atau Cloudflare R2 gratis 10GB). Hanya menyalin buku-buku baru yang belum pernah dicadangkan sebelumnya.

---

## 2. Struktur File di VPS

Penyimpanan backup lokal sementara di VPS diletakkan di direktori `/home/ubuntu/backups/`. Struktur direktori yang direncanakan:

```text
/home/ubuntu/
├── readest/               # Direktori utama tumpukan self-hosted
└── backups/               # Direktori penampungan backup lokal (dihapus setelah 7 hari)
    ├── db_backup_2026-06-26.sql.gz
    └── config_backup_2026-06-26.tar.gz
```

---

## 3. Script Otomatisasi (`backup.sh`)

Script utama diletakkan di `/home/ubuntu/backup.sh` dengan izin eksekusi (`chmod +x`). 

### Alur Kerja Script:
1. Melakukan dump database Supabase secara asinkron dari Docker.
2. Mengompresi file dump database menjadi format `.gz` untuk memperkecil ukuran (hingga 90%).
3. Mengompresi file konfigurasi Docker.
4. Mengunggah file database dan config ke folder `ReadestBackups` di Google Drive pribadi menggunakan Rclone.
5. Melakukan sinkronisasi inkremental dari volume lokal MinIO ke Google Drive menggunakan `rclone sync` (hanya mengunggah buku baru).
6. Menghapus file backup di disk lokal VPS yang berumur lebih dari 7 hari agar disk VPS tidak penuh.

---

## 4. Penjadwalan Kerja (Cron Job)

Backup dijadwalkan berjalan setiap hari pada pukul **02:00 dini hari** (saat aktivitas server rendah) menggunakan crontab:

```cron
0 2 * * * /bin/bash /home/ubuntu/backup.sh > /home/ubuntu/backups/backup.log 2>&1
```

---

## 5. Prosedur Pemulihan (*Restore/Recovery*)

Jika terjadi kerusakan server total, Anda dapat mendirikan kembali perpustakaan Anda dengan langkah berikut:

1. **Mendirikan VPS Baru & Unduh Docker Stack:** Clone repository Readest Anda ke VPS baru.
2. **Unduh Backup dari Google Drive:** Gunakan `rclone copy` untuk mengambil file `.tar.gz` dan `.sql.gz` terbaru.
3. **Restorasi Konfigurasi:** Ekstrak file konfigurasi docker ke root direktori `~/readest/`.
4. **Jalankan Docker Container:** Nyalakan seluruh service via `docker compose up -d`.
5. **Restorasi Database:** Impor kembali database PostgreSQL menggunakan command:
   ```bash
   gunzip -c db_backup_xxx.sql.gz | docker exec -i supabase-db psql -U supabase_admin -d postgres
   ```
6. **Restorasi Berkas Buku:** Unduh kembali file buku dari Google Drive ke folder volume MinIO (`docker/volumes/minio/`).
