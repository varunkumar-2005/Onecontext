CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, password_hash text NOT NULL, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id), name text NOT NULL, description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS project_members (project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('owner','editor','viewer')), PRIMARY KEY (project_id, user_id));
CREATE TABLE IF NOT EXISTS sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, type text NOT NULL CHECK (type IN ('github','document','chat_export','notes')), name text NOT NULL, origin_url text, status text NOT NULL DEFAULT 'pending', content text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), last_indexed_at timestamptz);
CREATE TABLE IF NOT EXISTS chunks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, content text NOT NULL, heading text NOT NULL DEFAULT 'Document', token_count integer NOT NULL DEFAULT 0, embedding vector(1536), version integer NOT NULL DEFAULT 1, is_current boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title text NOT NULL, rationale text NOT NULL, source_chunk_id uuid REFERENCES chunks(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS project_settings (project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE, index_github boolean NOT NULL DEFAULT true, index_documents boolean NOT NULL DEFAULT true, index_notes boolean NOT NULL DEFAULT true, index_chat_exports boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS team_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, team_code text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS activity_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id) ON DELETE SET NULL, agent text NOT NULL DEFAULT 'generic', event_type text NOT NULL, prompt text, answer text, summary text NOT NULL DEFAULT '', file_paths jsonb NOT NULL DEFAULT '[]'::jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS project_goal text NOT NULL DEFAULT '';
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS current_sprint text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS sources_project_status_idx ON sources(project_id, status);
CREATE INDEX IF NOT EXISTS chunks_project_current_idx ON chunks(project_id, is_current);
CREATE INDEX IF NOT EXISTS decisions_project_created_idx ON decisions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS team_sessions_project_idx ON team_sessions(project_id);
CREATE INDEX IF NOT EXISTS activity_events_project_created_idx ON activity_events(project_id, created_at DESC);

-- Structured, provider-agnostic memory extracted from project conversations.
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  client_conversation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, provider, client_conversation_id)
);
CREATE TABLE IF NOT EXISTS conversation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  turn_key text NOT NULL,
  prompt text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_key)
);
CREATE TABLE IF NOT EXISTS memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('decision','task','constraint','file_reference','conversation_summary')),
  title text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','archived')),
  importance smallint NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source_turn_id uuid REFERENCES conversation_turns(id) ON DELETE SET NULL,
  superseded_by uuid REFERENCES memory_items(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, type, title, status)
);
CREATE TABLE IF NOT EXISTS memory_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_item_id uuid NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  to_item_id uuid NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK (relation IN ('blocks','depends_on','supersedes','relates_to','implements','derived_from')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_item_id, to_item_id, relation)
);
CREATE INDEX IF NOT EXISTS conversation_sessions_project_idx ON conversation_sessions(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversation_turns_session_idx ON conversation_turns(session_id, created_at);
CREATE INDEX IF NOT EXISTS memory_items_project_status_idx ON memory_items(project_id, status, importance DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS memory_relationships_from_idx ON memory_relationships(from_item_id);
