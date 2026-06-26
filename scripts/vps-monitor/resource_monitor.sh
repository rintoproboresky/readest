#!/bin/bash
# ==============================================================================
# VPS RESOURCE MONITOR FOR DISCORD
# ==============================================================================

DISCORD_WEBHOOK="https://discord.com/api/webhooks/1520000551335624716/h6GmBAfShLtYwJapGF14Wqu-fF_51Z5IjP7hSreo0Wa0cB4_Z5_Kpv5sXpd9_ucHqDiB"

# Thresholds
DISK_THRESHOLD=85
RAM_THRESHOLD=90

# Ambil status penggunaan disk (root partition)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
# Ambil status penggunaan memori (RAM)
RAM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')

ALERT=0
MSG=""

if [ "$DISK_USAGE" -gt "$DISK_THRESHOLD" ]; then
    ALERT=1
    MSG="$MSG⚠️ **Disk Usage Warning!**\n- Penggunaan SSD saat ini berada di angka \`$DISK_USAGE%\` (Batas Aman: $DISK_THRESHOLD%).\n"
fi

if [ "$RAM_USAGE" -gt "$RAM_THRESHOLD" ]; then
    ALERT=1
    MSG="$MSG⚠️ **RAM Usage Warning!**\n- Penggunaan Memori RAM saat ini berada di angka \`$RAM_USAGE%\` (Batas Aman: $RAM_THRESHOLD%).\n"
fi

if [ $ALERT -eq 1 ]; then
    MSG="$MSG\nSilakan cek status server menggunakan command \`htop\` atau bersihkan file sampah."
    
    # Escape JSON message string
    CLEAN_MSG=$(echo "$MSG" | sed 's/"/\\"/g')
    
    PAYLOAD=$(cat <<EOF
{
  "username": "VPS Resource Guard",
  "avatar_url": "https://img.icons8.com/color/48/warning-shield.png",
  "embeds": [
    {
      "title": "Resource Warning Alert",
      "description": "$CLEAN_MSG",
      "color": 16753920,
      "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    }
  ]
}
EOF
)

    curl -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$DISCORD_WEBHOOK" >/dev/null 2>&1
fi
