-- Life On Other Planets? — SECURITY PHASE 2 (finish the lockdown)
-- ==========================================================================
-- Context: phase2_device_key.sql created the ensure_explorer() function
-- successfully, but its two `drop policy` statements did not take effect
-- (the SQL editor appears to have run only part of the script — the $$…$$
-- function body can cause that). Live testing confirmed device_key was still
-- readable afterward.
--
-- This block removes EVERY policy on the explorers table (regardless of name),
-- so anonymous clients can no longer read or insert it directly. The
-- ensure_explorer() SECURITY DEFINER function stays the only way in, and the
-- explorer_stats / project_health VIEWS keep working (they run as owner).
--
-- ⚠ RUN THIS ONLY AFTER the updated lop-sync.js (RPC path) is live, so the game
--   keeps creating explorers via the RPC. Idempotent — safe to run more than once.
-- ==========================================================================

alter table explorers enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'explorers'
  loop
    execute format('drop policy if exists %I on explorers', p.policyname);
  end loop;
end $$;

-- ---- verify (optional) ----
-- Run as anon via the REST API afterward — should now return NOTHING:
--   GET /rest/v1/explorers?select=device_key
-- And the game path should still work:
--   select public.ensure_explorer('verify_key_1234','Verify','astronaut','#7fb2ff');  -- returns a uuid
