-- Ejecutar en el SQL Editor de Supabase
-- Gamificación: XP, logros, grupos y rankings

-- ── Eventos de XP ─────────────────────────────────────────────────────────────
-- Cada acción de estudio genera un evento. El total de XP y el nivel se derivan de acá.
CREATE TABLE IF NOT EXISTS xp_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    kind        TEXT        NOT NULL,            -- upload | quiz | review | exam | streak_bonus
    amount      INTEGER     NOT NULL,
    doc_id      UUID,                            -- opcional: documento asociado
    meta        JSONB,                           -- extra: {percentage, rating, score...}
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xp_events_user_created_idx
    ON xp_events (user_id, created_at DESC);

ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve sus propios eventos de xp"
    ON xp_events FOR SELECT
    USING (auth.uid() = user_id);

-- ── Logros desbloqueados ──────────────────────────────────────────────────────
-- El catálogo de logros vive en el backend; acá solo se registra el desbloqueo.
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id        UUID        NOT NULL,
    achievement_id TEXT        NOT NULL,
    unlocked_at    TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve sus propios logros"
    ON user_achievements FOR SELECT
    USING (auth.uid() = user_id);

-- ── Grupos de estudio ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    code        TEXT        UNIQUE NOT NULL,     -- código de invitación (6 chars)
    created_by  UUID        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id     UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL,
    display_name TEXT,                           -- snapshot del nombre para el ranking
    joined_at    TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_user_idx
    ON group_members (user_id);

ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Helper SECURITY DEFINER para evitar recursión infinita en las policies
-- (una policy de group_members no puede consultar group_members directamente)
CREATE OR REPLACE FUNCTION is_group_member(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = gid AND user_id = auth.uid()
    );
$$;

-- Miembros ven el grupo y a sus compañeros
CREATE POLICY "miembros ven su grupo"
    ON groups FOR SELECT
    USING (is_group_member(id));

CREATE POLICY "miembros ven a sus companeros"
    ON group_members FOR SELECT
    USING (is_group_member(group_id));
