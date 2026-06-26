#!/bin/bash
# ==============================================================================
# VPS BOOT ALERT FOR DISCORD
# ==============================================================================

DISCORD_WEBHOOK="https://discord.com/api/webhooks/1520000551335624716/h6GmBAfShLtYwJapGF14Wqu-fF_51Z5IjP7hSreo0Wa0cB4_Z5_Kpv5sXpd9_ucHqDiB"

# Get Public IP address
PUBLIC_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null)
[ -z "$PUBLIC_IP" ] && PUBLIC_IP="Unknown"

# Construct message
MSG="🚀 **VPS System Started/Rebooted!**\n\n- **Host:** \`$(hostname)\`\n- **Public IP:** \`$PUBLIC_IP\`\n- **Uptime:** $(uptime -p)\n- **Time:** $(date -u +'%Y-%m-%d %H:%M:%S UTC')"

CLEAN_MSG=$(echo "$MSG" | sed 's/"/\\"/g')

PAYLOAD=$(cat <<EOF
{
  "username": "VPS System Shield",
  "avatar_url": "https://img.icons8.com/color/48/restart.png",
  "embeds": [
    {
      "title": "System Alert: Reboot",
      "description": "$CLEAN_MSG",
      "color": 3447003,
      "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    }
  ]
}
EOF
)

curl -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$DISCORD_WEBHOOK" >/dev/null 2>&1
