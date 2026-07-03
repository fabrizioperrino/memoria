-- ============================================================
--  memorIA — Schema de Supabase
--  Ejecutá esto en el SQL Editor de tu proyecto de Supabase
-- ============================================================

-- Habilitar la extensión UUID (ya viene activada en Supabase)
create extension if not exists "uuid-ossp";

-- ─── Tabla principal de documentos ───────────────────────────────────────────
create table if not exists documents (
    id            uuid primary key default uuid_generate_v4(),

    -- Dueño del documento (FK a auth.users de Supabase)
    user_id       uuid not null references auth.users(id) on delete cascade,

    title         text not null,
    file_name     text,
    file_type     text check (file_type in ('pdf', 'image')),
    status        text not null default 'processing' check (status in ('processing', 'ready', 'error')),

    -- Texto extraído del documento (para RAG / chat)
    content       text,

    -- Contenido generado por IA (JSON)
    summary       text,
    flashcards    jsonb default '[]'::jsonb,
    exam_questions jsonb default '[]'::jsonb,
    key_concepts  jsonb default '[]'::jsonb,

    -- Metadata
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- ─── Índices para performance ─────────────────────────────────────────────────
create index if not exists idx_documents_user_id   on documents (user_id);
create index if not exists idx_documents_created_at on documents (created_at desc);
create index if not exists idx_documents_status    on documents (status);

-- ─── Trigger: actualizar updated_at automáticamente ──────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger documents_updated_at
    before update on documents
    for each row execute function update_updated_at();

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
alter table documents enable row level security;

-- Cada usuario solo ve y modifica sus propios documentos
drop policy if exists "Acceso público a documentos" on documents;
drop policy if exists "Users own documents"          on documents;

create policy "Users own documents"
    on documents for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ─── Tabla de resultados de quiz ─────────────────────────────────────────────
create table if not exists quiz_results (
    id          uuid primary key default uuid_generate_v4(),

    -- Dueño del resultado
    user_id     uuid not null references auth.users(id) on delete cascade,

    doc_id      uuid not null references documents(id) on delete cascade,
    score       int  not null,
    total       int  not null,
    percentage  int  not null,
    answers     jsonb not null default '[]'::jsonb,
    created_at  timestamptz not null default now()
);

create index if not exists idx_quiz_results_user_id   on quiz_results (user_id);
create index if not exists idx_quiz_results_doc_id    on quiz_results (doc_id);
create index if not exists idx_quiz_results_created_at on quiz_results (created_at desc);

alter table quiz_results enable row level security;

drop policy if exists "Acceso público a quiz_results" on quiz_results;
drop policy if exists "Users own quiz results"         on quiz_results;

create policy "Users own quiz results"
    on quiz_results for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ─── Vista útil para ver el resumen de cada documento ────────────────────────
create or replace view documents_summary as
select
    id,
    user_id,
    title,
    file_type,
    status,
    jsonb_array_length(flashcards)    as flashcard_count,
    jsonb_array_length(exam_questions) as question_count,
    jsonb_array_length(key_concepts)  as concept_count,
    created_at
from documents
order by created_at desc;

-- ─── Migración: agregar user_id si la tabla ya existe ────────────────────────
-- (Si ya ejecutaste el schema anterior, corré solo este bloque)
--
-- alter table documents   add column if not exists user_id uuid references auth.users(id) on delete cascade;
-- alter table quiz_results add column if not exists user_id uuid references auth.users(id) on delete cascade;
-- create index if not exists idx_documents_user_id    on documents   (user_id);
-- create index if not exists idx_quiz_results_user_id on quiz_results (user_id);
