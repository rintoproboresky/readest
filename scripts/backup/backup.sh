#!/bin/bash
# ==============================================================================
# READEST SELF-HOSTED AUTOMATED VPS BACKUP SCRIPT WITH DISCORD NOTIFICATION
# ==============================================================================
# Deskripsi: Mengambil backup database Supabase PostgreSQL, konfigurasi Docker, 
#            dan melakukan sinkronisasi inkremental buku MinIO S3 ke Google Drive,
#            serta mengirimkan notifikasi status ke Discord Webhook.
# ==============================================================================

# Konfigurasi Direktori
READEST_DIR="/home/ubuntu/readest"
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$BACKUP_DIR/backup.log"

# Konfigurasi Rclone Remote
RCLONE_REMOTE="rclone-gdrive"
RCLONE_DEST_FOLDER="ReadestBackups"

# Konfigurasi Discord Webhook
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1520000551335624716/h6GmBAfShLtYwJapGF14Wqu-fF_51Z5IjP7hSreo0Wa0cB4_Z5_Kpv5sXpd9_ucHqDiB"

# Tracker Status Error
HAS_ERROR=0
ERROR_MSG=""

# Buat folder backup lokal jika belum ada
mkdir -p "$BACKUP_DIR"

# Fungsi untuk Mengirim Notifikasi ke Discord
send_discord_notification() {
    local status="$1"
    local message="$2"
    local color=3066993 # Hijau (Success)
    
    if [ "$status" = "error" ]; then
        color=15158332 # Merah (Failure)
    fi

    # Escape JSON message string
    local clean_msg=$(echo "$message" | sed 's/"/\\"/g')

    # Buat Payload JSON
    local payload=$(cat <<EOF
{
  "embeds": [
    {
      "title": "🛡️ Readest Backup Monitor",
      "description": "$clean_msg",
      "color": $color,
      "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
      "footer": {
        "text": "VPS Backup Engine"
      }
    }
  ]
}
EOF
)

    curl -H "Content-Type: application/json" -X POST -d "$payload" "$DISCORD_WEBHOOK" >/dev/null 2>&1
}

echo "==============================================================================" >> "$LOG_FILE"
echo "MULAI PROSES BACKUP: $(date)" >> "$LOG_FILE"
echo "==============================================================================" >> "$LOG_FILE"

# 1. Backup Database Supabase (PostgreSQL Dumpall)
echo "[1/4] Mengekspor database Supabase PostgreSQL..." >> "$LOG_FILE"
SQL_TEMP_FILE="$BACKUP_DIR/db_dump_$TIMESTAMP.sql"
SQL_GZ_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

docker exec supabase-db pg_dumpall -U supabase_admin > "$SQL_TEMP_FILE" 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
    echo " -> Ekspor database berhasil. Mengompresi file dump..." >> "$LOG_FILE"
    gzip -c "$SQL_TEMP_FILE" > "$SQL_GZ_FILE"
    rm -f "$SQL_TEMP_FILE"
    echo " -> Kompresi database selesai: $(basename $SQL_GZ_FILE)" >> "$LOG_FILE"
else
    echo " -> [ERROR] Ekspor database gagal!" >> "$LOG_FILE"
    HAS_ERROR=1
    ERROR_MSG="Database dump failed. check supabase-db container."
fi

# 2. Backup Konfigurasi Docker (.env, compose.yaml, kong.yml)
if [ $HAS_ERROR -eq 0 ]; then
    echo "[2/4] Mengompresi file konfigurasi Readest..." >> "$LOG_FILE"
    CONFIG_TAR_FILE="$BACKUP_DIR/config_backup_$TIMESTAMP.tar.gz"

    tar -czf "$CONFIG_TAR_FILE" -C "$READEST_DIR" \
        docker/compose.yaml \
        docker/compose.build.yaml \
        docker/.env \
        docker/volumes/api/kong.yml 2>> "$LOG_FILE"

    if [ $? -eq 0 ]; then
        echo " -> Kompresi konfigurasi berhasil: $(basename $CONFIG_TAR_FILE)" >> "$LOG_FILE"
    else
        echo " -> [ERROR] Kompresi file konfigurasi gagal!" >> "$LOG_FILE"
        HAS_ERROR=1
        ERROR_MSG="Config compression failed."
    fi
fi

# 3. Unggah File Backup Database & Config ke Google Drive via Rclone
if [ $HAS_ERROR -eq 0 ]; then
    echo "[3/4] Mengunggah file database dan konfigurasi ke Google Drive..." >> "$LOG_FILE"
    rclone move "$BACKUP_DIR/" "$RCLONE_REMOTE:$RCLONE_DEST_FOLDER/" \
        --include "db_backup_*.sql.gz" \
        --include "config_backup_*.tar.gz" \
        --log-file="$LOG_FILE" --log-level INFO

    if [ $? -eq 0 ]; then
        echo " -> Pengunggahan file backup ke Google Drive berhasil." >> "$LOG_FILE"
    else
        echo " -> [ERROR] Pengunggahan file backup ke Google Drive gagal!" >> "$LOG_FILE"
        HAS_ERROR=1
        ERROR_MSG="Rclone move database and config files to Google Drive failed."
    fi
fi

# 4. Sinkronisasi Inkremental Direktori Buku MinIO S3 ke Google Drive
if [ $HAS_ERROR -eq 0 ]; then
    echo "[4/4] Menyinkronkan file buku MinIO S3 secara inkremental ke Google Drive..." >> "$LOG_FILE"
    MINIO_TEMP_DIR="$BACKUP_DIR/minio-temp"

    if [ "$(docker ps -q -f name=readest-minio)" ]; then
        echo " -> Menyalin data buku dari container readest-minio..." >> "$LOG_FILE"
        mkdir -p "$MINIO_TEMP_DIR"
        docker cp readest-minio:/data/. "$MINIO_TEMP_DIR/" 2>> "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            rclone sync "$MINIO_TEMP_DIR" "$RCLONE_REMOTE:$RCLONE_DEST_FOLDER/books-mirror" \
                --log-file="$LOG_FILE" --log-level INFO
            if [ $? -eq 0 ]; then
                echo " -> Sinkronisasi file buku selesai." >> "$LOG_FILE"
            else
                echo " -> [ERROR] Sinkronisasi file buku gagal!" >> "$LOG_FILE"
                HAS_ERROR=1
                ERROR_MSG="Rclone sync minio files to Google Drive failed."
            fi
        else
            echo " -> [ERROR] Penyalinan data dari container readest-minio gagal!" >> "$LOG_FILE"
            HAS_ERROR=1
            ERROR_MSG="Docker cp data from readest-minio container failed."
        fi
        rm -rf "$MINIO_TEMP_DIR"
    else
        echo " -> [WARNING] Container readest-minio tidak aktif. Lewati langkah ini." >> "$LOG_FILE"
        HAS_ERROR=1
        ERROR_MSG="Container readest-minio is offline."
    fi
fi

# 5. Pembersihan File Backup Lokal Berusia Lebih dari 7 Hari
echo "Membersihkan file log lama..." >> "$LOG_FILE"
find "$BACKUP_DIR" -type f -name "*.log" -mtime +7 -delete

# Menghapus file backup lama di Google Drive (Retensi 30 Hari)
echo "Membersihkan backup lama di Google Drive (Retensi 30 Hari)..." >> "$LOG_FILE"
rclone delete --min-age 30d "$RCLONE_REMOTE:$RCLONE_DEST_FOLDER/" \
    --include "db_backup_*.sql.gz" \
    --include "config_backup_*.tar.gz" \
    --log-file="$LOG_FILE" --log-level INFO

# Kosongkan Trash Google Drive agar kuota tetap bersih
echo "Mengosongkan Trash Google Drive..." >> "$LOG_FILE"
rclone cleanup "$RCLONE_REMOTE:" >> "$LOG_FILE" 2>&1

echo "==============================================================================" >> "$LOG_FILE"
echo "PROSES BACKUP SELESAI: $(date)" >> "$LOG_FILE"
echo "==============================================================================" >> "$LOG_FILE"

# 6. Kirim Notifikasi Status ke Discord Webhook dan Simpan State
if [ $HAS_ERROR -eq 0 ]; then
    echo "{\"status\": \"success\", \"time\": \"$(date -u +'%Y-%m-%d %H:%M:%S UTC')\"}" > /tmp/last_backup_status.json
    send_discord_notification "success" "✅ **Backup Readest Sukses!**\n\n- **Database:** db_backup_$TIMESTAMP.sql.gz\n- **Config:** config_backup_$TIMESTAMP.tar.gz\n- **Buku:** Sinkronisasi MinIO berhasil diunggah secara inkremental ke Google Drive (\`$RCLONE_DEST_FOLDER/books-mirror\`)."
else
    echo "{\"status\": \"failed\", \"time\": \"$(date -u +'%Y-%m-%d %H:%M:%S UTC')\"}" > /tmp/last_backup_status.json
    send_discord_notification "error" "❌ **Backup Readest Gagal!**\n\n- **Detail Masalah:** $ERROR_MSG\n- **Lokasi Log VPS:** \`/home/ubuntu/backups/backup.log\`\n\nSilakan cek status server/koneksi VPS Anda."
fi
