-- Ejecutar en el SQL Editor de Supabase
-- Sprint 3: mazos compartidos con el grupo + duelos semanales

-- ── Mazos compartidos ─────────────────────────────────────────────────────────
-- Un miembro comparte uno de sus documentos con el grupo; el resto lo puede estudiar.
CREATE TABLE IF NOT EXISTS group_shares (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    doc_id      UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    shared_by   UUID        NOT NULL,
    title       TEXT        NOT NULL,           -- snapshot del título al compartir
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (group_id, doc_id)
);

CREATE INDEX IF NOT EXISTS group_shares_group_idx ON group_shares (group_id);

-- ── Duelos ────────────────────────────────────────────────────────────────────
-- Mismas preguntas para todo el grupo. Cada miembro juega una vez.
CREATE TABLE IF NOT EXISTS duels (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    doc_id      UUID,                            -- referencia informativa (puede borrarse el doc)
    title       TEXT        NOT NULL,
    questions   JSONB       NOT NULL,            -- snapshot: [{question, options, correct_answer, explanation}]
    created_by  UUID        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS duels_group_idx ON duels (group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS duel_attempts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    duel_id      UUID        NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL,
    display_name TEXT,
    score        INTEGER     NOT NULL,
    total        INTEGER     NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (duel_id, user_id)
);

CREATE INDEX IF NOT EXISTS duel_attempts_duel_idx ON duel_attempts (duel_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE group_shares  ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_attempts ENABLE ROW LEVEL SECURITY;

-- is_group_member() ya existe (migración 002)
CREATE POLICY "miembros ven mazos del grupo"
    ON group_shares FOR SELECT
    USING (is_group_member(group_id));

CREATE POLICY "miembros ven duelos del grupo"
    ON duels FOR SELECT
    USING (is_group_member(group_id));

CREATE POLICY "miembros ven intentos de sus duelos"
    ON duel_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM duels d
            WHERE d.id = duel_attempts.duel_id AND is_group_member(d.group_id)
        )
    );

-- Grants (idempotentes; en Supabase local las migraciones no corren como postgres)
GRANT ALL ON TABLE group_shares, duels, duel_attempts TO service_role;
GRANT SELECT ON TABLE group_shares, duels, duel_attempts TO authenticated;
