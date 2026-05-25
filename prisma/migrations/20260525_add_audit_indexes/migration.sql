-- Add audit log table and lookup indexes.
-- Safe to apply after existing initial schema migration.

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL DEFAULT '',
  "actor_name" TEXT NOT NULL DEFAULT '',
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL DEFAULT '',
  "before" JSONB,
  "after" JSONB,
  "ip" TEXT NOT NULL DEFAULT '',
  "user_agent" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nhan_vien_quyen_idx" ON "nhan_vien"("quyen");
CREATE INDEX IF NOT EXISTS "nhan_vien_active_idx" ON "nhan_vien"("active");

CREATE INDEX IF NOT EXISTS "suppliers_code_idx" ON "suppliers"("code");
CREATE INDEX IF NOT EXISTS "suppliers_name_idx" ON "suppliers"("name");
CREATE INDEX IF NOT EXISTS "suppliers_is_active_idx" ON "suppliers"("is_active");

CREATE INDEX IF NOT EXISTS "supplier_logs_supplier_id_idx" ON "supplier_logs"("supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_logs_warranty_id_idx" ON "supplier_logs"("warranty_id");
CREATE INDEX IF NOT EXISTS "supplier_logs_action_idx" ON "supplier_logs"("action");
CREATE INDEX IF NOT EXISTS "supplier_logs_created_at_idx" ON "supplier_logs"("created_at");

CREATE INDEX IF NOT EXISTS "warranties_trang_thai_idx" ON "warranties"("trang_thai");
CREATE INDEX IF NOT EXISTS "warranties_ma_nhan_vien_idx" ON "warranties"("ma_nhan_vien");
CREATE INDEX IF NOT EXISTS "warranties_ngay_nhan_idx" ON "warranties"("ngay_nhan");
CREATE INDEX IF NOT EXISTS "warranties_ngay_hen_tra_idx" ON "warranties"("ngay_hen_tra");
CREATE INDEX IF NOT EXISTS "warranties_supplier_status_idx" ON "warranties"("supplier_status");
CREATE INDEX IF NOT EXISTS "warranties_supplier_id_current_idx" ON "warranties"("supplier_id_current");
CREATE INDEX IF NOT EXISTS "warranties_deleted_at_idx" ON "warranties"("deleted_at");
CREATE INDEX IF NOT EXISTS "warranties_updated_at_idx" ON "warranties"("updated_at");

CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs"("entity");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
