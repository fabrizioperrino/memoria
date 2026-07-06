-- Ejecutar en el SQL Editor de Supabase
-- Mesa de Final: historial de simulacros orales

CREATE TABLE IF NOT EXISTS oral_sessions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL,
    doc_id           UUID        REFERENCES documents(id) ON DELETE CASCADE,
    doc_title        TEXT,                    -- snapshot por si se borra el doc
    professor        TEXT        NOT NULL DEFAULT 'clasico',
    avg_score        NUMERIC(3,1) NOT NULL,   -- promedio 1.0–10.0
    passed           BOOLEAN     NOT NULL,    -- >= 4 aprueba (mesa argentina)
    questions_count  INTEGER     NOT NULL,
    duration_seconds INTEGER     NOT NULL DEFAULT 0,
    results          JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{question, transcript, score, feedback, is_follow_up}]
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oral_sessions_user_doc_idx
    ON oral_sessions (user_id, doc_id, created_at DESC);

ALTER TABLE oral_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve sus propias mesas"
    ON oral_sessions FOR SELECT
    USING (auth.uid() = user_id);

GRANT ALL ON TABLE oral_sessions TO service_role;
GRANT SELECT ON TABLE oral_sessions TO authenticated;
