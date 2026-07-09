-- Life On Other Planets? — SECURITY HARDENING for the original schema.sql tables
-- ==========================================================================
-- WHY: schema.sql created explorers/targets/classifications/claims/discoveries
-- but only DESCRIBED row-level security in a comment — it was never turned on.
-- Live testing with the public anon key confirmed anonymous visitors can READ,
-- UPDATE, and DELETE these tables (HTTP 204 on delete/patch). That means anyone
-- could wipe or rewrite every explorer, classification, claim, and discovery.
--
-- WHAT THIS DOES (Phase 1 — safe, no app code change required):
--   * Turns RLS ON for all five tables.
--   * Re-grants exactly what the game actually does today: SELECT + INSERT.
--   * Grants NO update/delete policy -> rows become tamper-proof and
--     un-deletable by anonymous users (same protection card_votes already has).
--   * Locks `targets` down entirely so the secret `truth_label` answer key can
--     never be read by the public (the game does not read this table directly).
--
-- Paste this WHOLE block into the Supabase SQL editor and click Run. Idempotent
-- (safe to run more than once). Nothing existing is dropped or altered in shape.
-- ==========================================================================

-- ---- explorers ---------------------------------------------------------
alter table explorers enable row level security;
drop policy if exists "anon read explorers"   on explorers;
drop policy if exists "anon insert explorers" on explorers;
create policy "anon read explorers"   on explorers for select to anon using (true);
create policy "anon insert explorers" on explorers for insert to anon with check (true);
-- NOTE (Phase 2): `device_key` is still world-readable here, which allows
-- impersonation of another explorer. Closing that requires a security-definer
-- RPC for the returning-player lookup + a small edit to lop-sync.js. Tracked
-- separately; this Phase-1 block stops the catastrophic delete/tamper exposure.

-- ---- classifications ---------------------------------------------------
alter table classifications enable row level security;
drop policy if exists "anon read classifications"   on classifications;
drop policy if exists "anon insert classifications" on classifications;
create policy "anon read classifications"   on classifications for select to anon using (true);
create policy "anon insert classifications" on classifications for insert to anon with check (true);

-- ---- claims ------------------------------------------------------------
alter table claims enable row level security;
drop policy if exists "anon read claims"   on claims;
drop policy if exists "anon insert claims" on claims;
create policy "anon read claims"   on claims for select to anon using (true);
create policy "anon insert claims" on claims for insert to anon with check (true);

-- ---- discoveries -------------------------------------------------------
alter table discoveries enable row level security;
drop policy if exists "anon read discoveries"   on discoveries;
drop policy if exists "anon insert discoveries" on discoveries;
create policy "anon read discoveries"   on discoveries for select to anon using (true);
create policy "anon insert discoveries" on discoveries for insert to anon with check (true);

-- ---- targets (secret answer key) ---------------------------------------
-- RLS ON with NO anon policy => anonymous users cannot read or write this table
-- at all, so truth_label (the hidden 'planet'/'not' answer for control cards)
-- stays secret. The game reads candidates from frontier_curves.json, not here.
alter table targets enable row level security;
drop policy if exists "anon read targets"   on targets;
drop policy if exists "anon insert targets" on targets;
-- (intentionally no policies)

-- ---- verify (optional): run after, should all show rowsecurity = true -----
-- select relname, relrowsecurity from pg_class
-- where relname in ('explorers','targets','classifications','claims','discoveries');
