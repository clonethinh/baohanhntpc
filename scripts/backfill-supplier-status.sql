-- scripts/backfill-supplier-status.sql
-- One-time backfill: derive supplierStatus + supplierIdCurrent from latest supplier_log
-- cho các phiếu cũ bị miss khi migrate từ db.json → PostgreSQL.
--
-- Khi nào chạy:
-- - Sau khi nghi ngờ có data inconsistency (chạy audit-supplier-status-integrity.sh trước)
-- - Sau khi restore DB từ backup cũ
-- - KHÔNG cần chạy cho data mới (current code đã set đúng supplierStatus/supplierIdCurrent)
--
-- Logic:
-- 1. latest_logs: lấy log mới nhất theo created_at cho mỗi warranty
-- 2. latest_sent: lấy 'sent' log mới nhất (cho expectedReturnSupplierAt)
-- 3. UPDATE: set supplier_status, supplier_id_current, expected_return_supplier_at
-- 4. Filter: chỉ update phiếu chưa set (status='none' + idCurrent IS NULL) VÀ supplier vẫn tồn tại, không soft-delete
-- 5. Backup TRƯỚC khi chạy
--
-- Rollback: nếu cần, restore từ pg_dump backup. Không có backup tự động.

BEGIN;

WITH latest_logs AS (
  SELECT DISTINCT ON (sl.warranty_id)
    sl.warranty_id,
    sl.action AS latest_action,
    sl.supplier_id AS latest_supplier_id
  FROM supplier_logs sl
  WHERE sl.action IN ('sent', 'returned')
  ORDER BY sl.warranty_id, sl.created_at DESC
),
latest_sent AS (
  SELECT DISTINCT ON (sl.warranty_id)
    sl.warranty_id,
    sl.expected_return_at
  FROM supplier_logs sl
  WHERE sl.action = 'sent'
  ORDER BY sl.warranty_id, sl.created_at DESC
)
UPDATE warranties w
SET supplier_status = ll.latest_action,
    supplier_id_current = ll.latest_supplier_id,
    expected_return_supplier_at = COALESCE(lsl.expected_return_at, w.expected_return_supplier_at)
FROM latest_logs ll
LEFT JOIN latest_sent lsl ON lsl.warranty_id = ll.warranty_id
WHERE w.id = ll.warranty_id
  AND w.deleted_at = ''
  AND w.supplier_status = 'none'
  AND w.supplier_id_current IS NULL
  AND EXISTS (
    SELECT 1 FROM suppliers s
    WHERE s.id = ll.latest_supplier_id
      AND s.deleted_at IS NULL
  );

-- Verify
SELECT 'After backfill:' AS info, COUNT(*) AS remaining_inconsistent
FROM warranties w
WHERE w.deleted_at = ''
  AND w.supplier_status = 'none'
  AND w.supplier_id_current IS NULL
  AND EXISTS (SELECT 1 FROM supplier_logs sl WHERE sl.warranty_id = w.id);

COMMIT;
