-- Sincroniza schema.sql con columnas que existían en producción pero no estaban versionadas.
-- (En la base de producción ya existen: este script es idempotente.)

ALTER TABLE documents ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE;

-- El check original solo permitía pdf/image; el código también inserta text y url
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_file_type_check
    CHECK (file_type IN ('pdf', 'image', 'text', 'url'));

CREATE INDEX IF NOT EXISTS idx_documents_subject ON documents (subject) WHERE subject IS NOT NULL;

-- Grants explícitos: en Supabase local las migraciones no corren como el rol postgres,
-- así que las tablas creadas no heredan los privilegios por defecto. Idempotente en prod
-- (donde el SQL Editor ya los otorgó).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
