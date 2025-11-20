```sql
-- Create sessions table to store session data (JSON columns)
create table if not exists sessions (
  id text primary key,
  host_active boolean default true,
  current jsonb,
  questions jsonb,
  teams jsonb,
  chase jsonb,
  last_update timestamptz,
  created_at timestamptz default now()
);

-- Create buzzers table to log buzzer events (ordered by timestamp)
create table if not exists buzzers (
  id bigserial primary key,
  session_id text references sessions(id) on delete cascade,
  team_id text,
  ts timestamptz default now()
);

-- Optional: allow public select on sessions and buzzers during prototyping
-- (Remove or restrict this in production)
grant select on sessions to anon;
grant select on buzzers to anon;
```