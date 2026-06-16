#!/usr/bin/env bash
# scripts/audit-supplier-status-integrity.sh
# Phát hiện warranties có supplier_log nhưng thiếu supplierStatus/supplierIdCurrent.
# Dùng để audit sau khi migrate data hoặc sau khi nghi ngờ có data inconsistency.
#
# Usage:
#   bash scripts/audit-supplier-status-integrity.sh
#   bash scripts/audit-supplier-status-integrity.sh --fix  # Tự chạy backfill (cần confirm)
#
# Backfill SQL xem: scripts/backfill-supplier-status.sql

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

run_psql() {
  docker compose exec -T postgres-db psql -U ntpc_user -d ntpc_warranty "$@"
}

echo "=== Audit: warranties có supplier_log nhưng supplierStatus='none' + supplierIdCurrent IS NULL ==="
echo ""
INCONSISTENT=$(run_psql -t -c "SELECT COUNT(*) FROM warranties w WHERE w.deleted_at = '' AND w.supplier_status = 'none' AND w.supplier_id_current IS NULL AND EXISTS (SELECT 1 FROM supplier_logs sl WHERE sl.warranty_id = w.id)" | tr -d ' ')
echo "Inconsistent records: $INCONSISTENT"
if [ "$INCONSISTENT" -gt 0 ]; then
  echo ""
  echo "Sample (10):"
  run_psql -c "SELECT w.so_chung_tu, w.trang_thai, w.sent_supplier_at, (SELECT sl.action FROM supplier_logs sl WHERE sl.warranty_id = w.id ORDER BY sl.created_at DESC LIMIT 1) AS latest_log, s.code AS supplier_code, s.name AS supplier_name FROM warranties w LEFT JOIN suppliers s ON s.id = (SELECT sl.supplier_id FROM supplier_logs sl WHERE sl.warranty_id = w.id ORDER BY sl.created_at DESC LIMIT 1) WHERE w.deleted_at = '' AND w.supplier_status = 'none' AND w.supplier_id_current IS NULL AND EXISTS (SELECT 1 FROM supplier_logs sl WHERE sl.warranty_id = w.id) LIMIT 10;"
fi

echo ""
echo "=== Orphans: supplier_logs reference non-existent supplier_id ==="
ORPHAN_LOGS=$(run_psql -t -c "SELECT COUNT(*) FROM supplier_logs sl WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = sl.supplier_id)" | tr -d ' ')
echo "Orphan supplier_logs: $ORPHAN_LOGS"

echo ""
echo "=== Sanity: warranties có supplierIdCurrent set nhưng supplierIdCurrent không tồn tại ==="
ORPHAN_FK=$(run_psql -t -c "SELECT COUNT(*) FROM warranties w WHERE w.deleted_at = '' AND w.supplier_id_current IS NOT NULL AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = w.supplier_id_current)" | tr -d ' ')
echo "Orphan supplier_id_current FK: $ORPHAN_FK"

if [ "${1:-}" = "--fix" ]; then
  if [ "$INCONSISTENT" = "0" ]; then
    echo ""
    echo "  ✓ Nothing to fix."
    exit 0
  fi
  echo ""
  echo "=== Backfill mode (--fix) ==="
  echo "  Will run the backfill SQL. Backup recommended first:"
  echo "    pg_dump -U ntpc_user -d ntpc_warranty > backup-$(date +%Y%m%d-%H%M%S).sql"
  echo ""
  read -p "  Continue? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Aborted."
    exit 1
  fi
  bash "$SCRIPT_DIR/backfill-supplier-status.sql"
fi
