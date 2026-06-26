#!/bin/bash
# ==============================================================================
# VPS DAILY HEALTH REPORT FOR DISCORD
# ==============================================================================

DISCORD_WEBHOOK="https://discord.com/api/webhooks/1520000551335624716/h6GmBAfShLtYwJapGF14Wqu-fF_51Z5IjP7hSreo0Wa0cB4_Z5_Kpv5sXpd9_ucHqDiB"

# 1. Uptime
UPTIME_VAL=$(uptime -p 2>/dev/null)
[ -z "$UPTIME_VAL" ] && UPTIME_VAL=$(uptime | awk -F', ' '{print $1}')

# 2. CPU Load
CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}' | xargs)

# 3. RAM Usage
RAM_TOTAL_GB=$(free -h | awk '/Mem:/ {print $2}')
RAM_USED_GB=$(free -h | awk '/Mem:/ {print $3}')
RAM_PERCENT=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
RAM_VAL="$RAM_USED_GB / $RAM_TOTAL_GB ($RAM_PERCENT%)"

# 4. Disk Usage (SSD)
DISK_TOTAL=$(df -h / | tail -1 | awk '{print $2}')
DISK_USED=$(df -h / | tail -1 | awk '{print $3}')
DISK_PERCENT=$(df / | tail -1 | awk '{print $5}')
DISK_VAL="$DISK_USED / $DISK_TOTAL ($DISK_PERCENT)"

# 5. Docker Containers Status
CONTAINERS=("supabase-db" "supabase-kong" "supabase-auth" "supabase-rest" "readest-minio" "readest-client")
RUNNING_CONTAINERS=0
TOTAL_CONTAINERS=${#CONTAINERS[@]}

for CONTAINER in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null)
    if [ "$STATUS" = "true" ]; then
        ((RUNNING_CONTAINERS++))
    fi
done

if [ $RUNNING_CONTAINERS -eq $TOTAL_CONTAINERS ]; then
    DOCKER_VAL="🟢 $RUNNING_CONTAINERS / $TOTAL_CONTAINERS Running"
else
    DOCKER_VAL="🔴 $RUNNING_CONTAINERS / $TOTAL_CONTAINERS Running"
fi

# 6. Last Backup Status
BACKUP_STATUS_FILE="/tmp/last_backup_status.json"
if [ -f "$BACKUP_STATUS_FILE" ]; then
    B_STATUS=$(grep -o '"status": "[^"]*"' "$BACKUP_STATUS_FILE" | cut -d'"' -f4)
    B_TIME=$(grep -o '"time": "[^"]*"' "$BACKUP_STATUS_FILE" | cut -d'"' -f4)
    if [ "$B_STATUS" = "success" ]; then
        BACKUP_VAL="🟢 Success ($B_TIME)"
    else
        BACKUP_VAL="🔴 Failed ($B_TIME)"
    fi
else
    BACKUP_VAL="⚪ Unknown (No run recorded)"
fi

# Prepare Payload JSON
PAYLOAD=$(cat <<EOF
{
  "username": "VPS Daily Reporter",
  "avatar_url": "https://img.icons8.com/color/48/system-report.png",
  "embeds": [
    {
      "title": "📊 VPS Daily Health Report",
      "description": "Daily status report for host: \`$(hostname)\`",
      "color": 3447003,
      "fields": [
        { "name": "⏱️ Uptime", "value": "$UPTIME_VAL", "inline": true },
        { "name": "🧠 CPU Load", "value": "$CPU_LOAD", "inline": true },
        { "name": "💾 Memory (RAM)", "value": "$RAM_VAL", "inline": true },
        { "name": "💽 Disk (SSD)", "value": "$DISK_VAL", "inline": true },
        { "name": "🐳 Docker Status", "value": "$DOCKER_VAL", "inline": true },
        { "name": "🛡️ Last Backup", "value": "$BACKUP_VAL", "inline": true }
      ],
      "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    }
  ]
}
EOF
)

curl -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$DISCORD_WEBHOOK" >/dev/null 2>&1
