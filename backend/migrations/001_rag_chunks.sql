-- Ejecutar en el SQL Editor de Supabase

-- Habilitar pgvector (ya viene habilitado en todos los proyectos Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de chunks con embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id       UUID    NOT NULL,
    chunk_index   INTEGER NOT NULL,
    content       TEXT    NOT NULL,
    embedding     vector(1536),   -- text-embedding-3-small de OpenAI
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Índice HNSW para búsqueda por similitud de coseno (más rápido que IVFFlat para datasets pequeños)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops);

-- RLS: solo el dueño del documento puede ver sus chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve sus propios chunks"
    ON document_chunks FOR SELECT
    USING (auth.uid() = user_id);

-- Función de similarity search (llamada desde el backend)
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding  vector(1536),
    match_document_id UUID,
    match_count      INT DEFAULT 5
)
RETURNS TABLE (
    id          UUID,
    content     TEXT,
    chunk_index INTEGER,
    similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.chunk_index,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE dc.document_id = match_document_id
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
