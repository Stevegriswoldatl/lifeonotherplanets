-- Life On Other Planets? — signed-in progress sync (magic-link accounts)
-- One row per signed-in player, holding their whole game state as JSON.
-- Anonymous play keeps working via localStorage; this only stores state for
-- players who choose "Save my progress" (Supabase Auth email magic link).
--
-- Run once in the Supabase SQL editor (safe / additive).

create table if not exists public.player_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_state enable row level security;

-- A signed-in user can only see and write THEIR OWN row.
drop policy if exists "player_state own select" on public.player_state;
create policy "player_state own select" on public.player_state
  for select using (auth.uid() = user_id);

drop policy if exists "player_state own insert" on public.player_state;
create policy "player_state own insert" on public.player_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "player_state own update" on public.player_state;
create policy "player_state own update" on public.player_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
