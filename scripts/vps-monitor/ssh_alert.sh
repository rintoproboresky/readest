#!/bin/bash
# ==============================================================================
# SSH LOGIN ALERT FOR DISCORD
# ==============================================================================

DISCORD_WEBHOOK="https://discord.com/api/webhooks/1520000551335624716/h6GmBAfShLtYwJapGF14Wqu-fF_51Z5IjP7hSreo0Wa0cB4_Z5_Kpv5sXpd9_ucHqDiB"

# Hanya kirim notifikasi saat sesi dibuka
if [ "$PAM_TYPE" = "open_session" ]; then
    # Cari lokasi IP secara kasar (opsional, menggunakan ip-api.com)
    IP_INFO=$(curl -s "http://ip-api.com/json/$PAM_RHOST?fields=status,country,city,org")
    LOCATION="Unknown"
    ISP="Unknown"
    
    if echo "$IP_INFO" | grep -q '"status":"success"'; then
        CITY=$(echo "$IP_INFO" | grep -o '"city":"[^"]*' | cut -d'"' -f4)
        COUNTRY=$(echo "$IP_INFO" | grep -o '"country":"[^"]*' | cut -d'"' -f4)
        ORG=$(echo "$IP_INFO" | grep -o '"org":"[^"]*' | cut -d'"' -f4)
        LOCATION="$CITY, $COUNTRY"
        ISP="$ORG"
    fi

    # Buat deskripsi pesan
    MSG="🔒 **SSH Session Opened!**\n\n- **User:** \`$PAM_USER\`\n- **IP Address:** \`$PAM_RHOST\`\n- **Location:** $LOCATION\n- **ISP:** $ISP\n- **Host:** \`$(hostname)\`\n- **Time:** $(date -u +'%Y-%m-%d %H:%M:%S UTC')"

    # Escape JSON message string
    CLEAN_MSG=$(echo "$MSG" | sed 's/"/\\"/g')

    # Buat Payload JSON
    PAYLOAD=$(cat <<EOF
{
  "username": "VPS Security Shield",
  "avatar_url": "https://img.icons8.com/color/48/lock.png",
  "embeds": [
    {
      "title": "Security Alert: SSH Login",
      "description": "$CLEAN_MSG",
      "color": 15158332,
      "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    }
  ]
}
EOF
)

    curl -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$DISCORD_WEBHOOK" >/dev/null 2>&1
fi
