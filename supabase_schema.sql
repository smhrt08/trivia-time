-- Sessions table
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  host_code text not null,
  created_at timestamptz default now()
);

-- Round state: one row per session controlling timer and scores
create table if not exists round_state (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  start_seconds int default 60,
  timer_value int default 60,
  timer_running boolean default false,
  last_tick timestamptz,
  team1_score int default 0,
  team2_score int default 0,
  saved_team1 int,
  saved_team2 int,
  active_team int default 1,
  chunks int default 5,
  created_at timestamptz default now()
);

-- Index to quickly find round_state by session
create index if not exists idx_round_state_session ON round_state(session_id);
