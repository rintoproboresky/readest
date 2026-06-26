#!/bin/bash
# ==============================================================================
# VPS DOCKER CONTAINER MONITOR FOR DISCORD
# ==============================================================================

DISCORD_WEBHOOK="https://discord.com/api/webhooks/1520000551335624716/h6GmBAfShLtYwJapGF14Wqu-fF_51Z5IjP7hSreo0Wa0cB4_Z5_Kpv5sXpd9_ucHqDiB"

# List of critical containers to monitor
CONTAINERS=("supabase-db" "supabase-kong" "supabase-auth" "supabase-rest" "readest-minio" "readest-client")
STATE_FILE="/tmp/container_states.json"

# Read previous states
if [ -f "$STATE_FILE" ]; then
    PREV_STATES=$(cat "$STATE_FILE")
else
    PREV_STATES="{}"
fi

NEW_STATES="{"
FIRST=1
ALERT_MSG=""
RESOLVED_MSG=""
HAS_ALERT=0

for CONTAINER in "${CONTAINERS[@]}"; do
    # Check if container is running
    STATUS=$(docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null)
    
    if [ "$STATUS" = "true" ]; then
        CURRENT_STATE="up"
    else
        CURRENT_STATE="down"
    fi
    
    # Append to new states JSON
    if [ $FIRST -eq 1 ]; then
        NEW_STATES="$NEW_STATES \"$CONTAINER\": \"$CURRENT_STATE\""
        FIRST=0
    else
        NEW_STATES="$NEW_STATES, \"$CONTAINER\": \"$CURRENT_STATE\""
    fi
    
    # Get previous state
    PREV_STATE=$(echo "$PREV_STATES" | grep -o "\"$CONTAINER\": \"[^\"]*\"" | cut -d'"' -f4)
    [ -z "$PREV_STATE" ] && PREV_STATE="up" # Default to up if not recorded before
    
    if [ "$CURRENT_STATE" = "down" ]; then
        if [ "$PREV_STATE" = "up" ]; then
            # Just went down!
            ALERT_MSG="$ALERT_MSG❌ **$CONTAINER** is offline!\n"
            HAS_ALERT=1
        fi
    elif [ "$CURRENT_STATE" = "up" ]; then
        if [ "$PREV_STATE" = "down" ]; then
            # Just came back up!
            RESOLVED_MSG="$RESOLVED_MSG✅ **$CONTAINER** is back online!\n"
            HAS_ALERT=1
        fi
    fi
done

NEW_STATES="$NEW_STATES }"
echo "$NEW_STATES" > "$STATE_FILE"

if [ $HAS_ALERT -eq 1 ]; then
    MSG=""
    TITLE="Docker Service Alert"
    COLOR=15158332 # Red
    AVATAR="https://img.icons8.com/color/48/docker.png"
    
    if [ -n "$ALERT_MSG" ]; then
        MSG="$MSG$ALERT_MSG"
    fi
    
    if [ -n "$RESOLVED_MSG" ]; then
        if [ -n "$MSG" ]; then
            MSG="$MSG\n"
        fi
        MSG="$MSG$RESOLVED_MSG"
        if [ -z "$ALERT_MSG" ]; then
            TITLE="Docker Service Resolved"
            COLOR=3066993 # Green
        fi
    fi
    
    CLEAN_MSG=$(echo "$MSG" | sed 's/"/\\"/g')
    
    PAYLOAD=$(cat <<EOF
{
  "username": "VPS Container Guard",
  "avatar_url": "$AVATAR",
  "embeds": [
    {
      "title": "$TITLE",
      "description": "$CLEAN_MSG",
      "color": $COLOR,
      "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    }
  ]
}
EOF
)
    curl -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$DISCORD_WEBHOOK" >/dev/null 2>&1
fi
