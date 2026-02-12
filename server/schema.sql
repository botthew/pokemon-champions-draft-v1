-- Minimal schema for Quad Badge Draft League app

CREATE TABLE IF NOT EXISTS draft_picks (
  id           SERIAL PRIMARY KEY,
  pick_no      INTEGER NOT NULL UNIQUE,
  coach        TEXT NOT NULL,
  pokemon_dex  INTEGER NOT NULL UNIQUE,
  points       INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_results (
  match_key  TEXT PRIMARY KEY,
  a_wins     INTEGER NOT NULL,
  b_wins     INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Draft state (seed order + lock)
CREATE TABLE IF NOT EXISTS draft_state (
  id         INTEGER PRIMARY KEY,
  base_order JSONB NOT NULL,
  locked     BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
