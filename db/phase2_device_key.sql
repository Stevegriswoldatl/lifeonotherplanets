-- Life On Other Planets? — SECURITY PHASE 2: close the device_key impersonation gap
-- ==========================================================================
-- WHY: after Phase 1 (rls_hardening.sql) the explorers table can no longer be
-- deleted/tampered, but anon could still READ it — including every player's
-- device_key, the token that identifies them. Anyone could scrape those and act
-- as another explorer. This closes that.
--
-- WHAT: replace direct table access with a SECURITY DEFINER function that looks
-- up (or creates) an explorer by device_key and returns ONLY the id — never the
-- device_key. Then remove anon's direct read/insert on the table, so device_keys
-- are no longer exposed. Leaderboards keep working (they read the explorer_stats
-- / project_health VIEWS, which run as owner and bypass this).
--
-- ORDER OF OPERATIONS: deploy the updated lop-sync.js FIRST (it tries this RPC,
-- then falls back to the old path), THEN run this. Safe / idempotent.
-- Paste the whole block into the Supabase SQL editor and Run.
-- ==========================================================================

-- 1) look-up-or-create by device_key, returns only the explorer id
create or replace function public.ensure_explorer(
  p_device_key text,
  p_name       text default 'Explorer',
  p_avatar     text default 'astronaut',
  p_color      text default '#7fb2ff'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_device_key is null or length(p_device_key) < 4 then
    return null;
  end if;
  select id into v_id from explorers where device_key = p_device_key;
  if v_id is null then
    insert into explorers (device_key, display_name, avatar, avatar_color)
    values (p_device_key,
            coalesce(nullif(p_name,''),   'Explorer'),
            coalesce(nullif(p_avatar,''), 'astronaut'),
            coalesce(nullif(p_color,''),  '#7fb2ff'))
    on conflict (device_key) do update set device_key = excluded.device_key
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

grant execute on function public.ensure_explorer(text,text,text,text) to anon;

-- 2) stop exposing the explorers table (and its device_keys) to anon.
--    The RPC above is now the only way in; it never returns device_key.
drop policy if exists "anon read explorers"   on explorers;
drop policy if exists "anon insert explorers" on explorers;

-- ---- verify (optional) ----
-- select public.ensure_explorer('verify_key_123','Verify','astronaut','#7fb2ff'); -- returns a uuid
-- select id from explorers limit 1;  -- run as anon: should now be blocked / empty
