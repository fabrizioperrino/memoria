-- Ejecutar en el SQL Editor de Supabase
-- Sprint Comisión: rastrear mazos clonados desde un grupo (evita duplicados)

ALTER TABLE documents ADD COLUMN IF NOT EXISTS cloned_from UUID;

CREATE INDEX IF NOT EXISTS idx_documents_cloned_from
    ON documents (user_id, cloned_from) WHERE cloned_from IS NOT NULL;
