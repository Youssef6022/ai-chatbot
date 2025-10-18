#!/bin/bash

LOG_FILE="./logs/api-debug.log"

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Effacer le fichier de log existant
echo "=== API Debug Log Started at $(date -Iseconds) ===" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

echo "📋 Watching API debug logs in real-time..."
echo "Log file: $LOG_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Suivre le fichier en temps réel
tail -f "$LOG_FILE"
