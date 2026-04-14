#!/usr/bin/env bash
# FeatureVault — Maintenance tasks
# Usage: bash infra/scripts/maintenance.sh [backup|logs|status|update]

set -euo pipefail
cd /home/ec2-user/featurevault

case "${1:-status}" in
  status)
    echo "=== Container status ==="
    docker compose -f docker-compose.prod.yml ps
    echo ""
    echo "=== Disk usage ==="
    df -h /
    echo ""
    echo "=== Memory usage ==="
    free -m
    echo ""
    echo "=== API health ==="
    curl -s http://localhost:4000/health | python3 -m json.tool
    ;;

  logs)
    SERVICE="${2:-api}"
    docker compose -f docker-compose.prod.yml logs --tail=100 -f "$SERVICE"
    ;;

  backup)
    echo "=== Postgres backup ==="
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"
    source .env.production
    docker compose -f docker-compose.prod.yml exec -T postgres \
      pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "/tmp/${BACKUP_FILE}"
    echo "✓  Backup saved to /tmp/${BACKUP_FILE}"
    echo "   Size: $(du -sh /tmp/${BACKUP_FILE} | cut -f1)"
    ;;

  update)
    echo "=== Pulling latest code ==="
    git pull origin main
    echo "=== Rebuilding and restarting ==="
    docker compose -f docker-compose.prod.yml build --no-cache
    docker compose -f docker-compose.prod.yml up -d --remove-orphans
    docker image prune -f
    echo "✓  Update complete"
    ;;

  *)
    echo "Usage: $0 [status|logs <service>|backup|update]"
    exit 1
    ;;
esac
