-- Housing Stability Guide — Phase 2 schema.
-- Apply with: npm run db:init  (or: psql "$DATABASE_URL" < server/database/schema.sql)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  provider TEXT,
  google_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Sessions: maps an opaque session id -> user. Persisted so logins survive a
-- server restart (the frontend keeps the session id in localStorage).
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Plans
-- NOTE: user_id is NULLABLE. The current frontend generates plans anonymously
-- (it does not send a userId), so a NOT NULL constraint would break the
-- existing /plans/generate contract. Plans associate to a user when one is
-- provided; this is a non-breaking superset of the doc's schema.
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  legacy_id TEXT,
  name TEXT NOT NULL,
  goal TEXT,
  risk_level TEXT,
  urgency TEXT,
  summary TEXT,
  estimated_timeline TEXT,
  next_best_action TEXT,
  situation JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- legacy_id lets the frontend request stable demo IDs like "plan-2" while the
-- DB keys on UUID internally. ALTER covers databases created before this column
-- existed. The UNIQUE index permits many NULLs (real generated plans).
ALTER TABLE plans ADD COLUMN IF NOT EXISTS legacy_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_legacy_id ON plans(legacy_id);

-- Plan tasks
CREATE TABLE IF NOT EXISTS plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT,
  status TEXT DEFAULT 'pending',
  due_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Resources (static reference data)
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT,
  description TEXT,
  phone TEXT,
  website TEXT,
  eligibility TEXT,
  support TEXT,
  data JSONB
);

-- data holds the full UI-shaped resource (metadata, eligibility list,
-- howToApply, contact, etc.) so the API returns exactly what the frontend
-- renders. Flat columns above remain for search/filter SQL.
ALTER TABLE resources ADD COLUMN IF NOT EXISTS data JSONB;

-- Saved resources (user -> resource many-to-many)
CREATE TABLE IF NOT EXISTS saved_resources (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, resource_id)
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recommended resources for plans
CREATE TABLE IF NOT EXISTS plan_recommendations (
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  match_score INTEGER,
  reason TEXT,
  PRIMARY KEY (plan_id, resource_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_plan_id ON plan_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_resources_user_id ON saved_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
