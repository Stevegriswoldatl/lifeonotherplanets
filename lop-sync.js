// Life On Other Planets? — shared Supabase sync helper
//
// Included by game.html and vet.html. Requires (loaded before this file):
//   1) https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2   (window.supabase)
//   2) supabase-config.js                                     (window.LOP_SUPABASE)
//
// If no anon key is configured, every method is a safe no-op and the pages
// fall back to local-only storage — nothing breaks.

(function () {
  const cfg = (window.LOP_SUPABASE || {});
  let client = null;
  let explorerId = null;
  let explorerPromise = null;

  if (cfg.url && cfg.anonKey && window.supabase && window.supabase.createClient) {
    try { client = window.supabase.createClient(cfg.url, cfg.anonKey); }
    catch (e) { console.warn("LOP sync: init failed", e); }
  }

  // client-side courtesy throttle: stops accidental/casual floods of rows.
  // (Server-side Supabase rate limits + RLS remain the real backstop.)
  const _thr = {
    classifications: { last: 0, count: 0, minGap: 700,  cap: 3000 },
    claims:          { last: 0, count: 0, minGap: 1500, cap: 800  },
    discoveries:     { last: 0, count: 0, minGap: 1500, cap: 400  },
    votes:           { last: 0, count: 0, minGap: 500,  cap: 4000 },
    dossiers:        { last: 0, count: 0, minGap: 1500, cap: 300  },
    dvotes:          { last: 0, count: 0, minGap: 500,  cap: 2000 },
    sectors:         { last: 0, count: 0, minGap: 1200, cap: 1500 }
  };
  function allow(kind) {
    const t = _thr[kind], now = Date.now();
    if (!t) return true;
    if (t.count >= t.cap) { console.warn("LOP sync: session cap reached for " + kind); return false; }
    if (now - t.last < t.minGap) return false;   // too fast — drop this one
    t.last = now; t.count++; return true;
  }

  function deviceKey() {
    let k = localStorage.getItem("lop_device_key");
    if (!k) {
      k = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("lop_device_key", k);
    }
    return k;
  }

  async function ensureExplorer(name, avatar, color) {
    if (!client) return null;
    if (explorerId) return explorerId;
    if (explorerPromise) return explorerPromise;
    explorerPromise = (async () => {
      const dk = deviceKey();
      // Preferred path: a SECURITY DEFINER function that looks up/creates the explorer
      // and returns ONLY the id — so the explorers table (and everyone's device_key)
      // never needs to be readable by anon. See db/phase2_device_key.sql.
      try {
        const r = await client.rpc("ensure_explorer", { p_device_key: dk, p_name: name || "Explorer", p_avatar: avatar || "astronaut", p_color: color || "#7fb2ff" });
        if (!r.error && r.data) { explorerId = (typeof r.data === "string") ? r.data : (r.data.id || r.data); return explorerId; }
      } catch (e) { /* RPC not installed yet — fall back below */ }
      // Fallback (used only until the RPC above is installed): direct table access.
      try {
        const sel = await client.from("explorers").select("id").eq("device_key", dk).limit(1);
        if (sel.data && sel.data.length) { explorerId = sel.data[0].id; return explorerId; }
        const ins = await client.from("explorers")
          .insert({ device_key: dk, display_name: name || "Explorer", avatar: avatar || "astronaut", avatar_color: color || "#7fb2ff" })
          .select("id").limit(1);
        if (ins.data && ins.data.length) explorerId = ins.data[0].id;
      } catch (e) { console.warn("LOP sync: ensureExplorer", e); }
      return explorerId;
    })();
    return explorerPromise;
  }

  const api = {
    get enabled() { return !!client; },
    ensureExplorer,
    async logClassification(verdict, isCorrect) {
      if (!client) return;
      if (!allow("classifications")) return;
      try { await client.from("classifications").insert({ explorer_id: explorerId, verdict: verdict, is_correct: isCorrect }); }
      catch (e) { console.warn("LOP sync: logClassification", e); }
    },
    async logClaim(systemName, color) {
      if (!client) return;
      if (!allow("claims")) return;
      try { await client.from("claims").insert({ explorer_id: explorerId, system_name: systemName, avatar_color: color }); }
      catch (e) { console.warn("LOP sync: logClaim", e); }
    },
    async logDiscovery(nickname, planetName) {
      if (!client) return;
      if (!allow("discoveries")) return;
      try { await client.from("discoveries").insert({ named_by: explorerId, nickname: nickname, planet_name: planetName, status: "candidate" }); }
      catch (e) { console.warn("LOP sync: logDiscovery", e); }
    },
    async projectHealth() {
      if (!client) return null;
      try { const r = await client.from("project_health").select("*").limit(1); return r.data && r.data[0]; }
      catch (e) { return null; }
    },
    // ---- co-op verification: per-card community votes + consensus ----
    async logVote(cardId, verdict) {
      if (!client || !cardId) return;
      if (!allow("votes")) return;
      try { await client.from("card_votes").insert({ card_id: String(cardId), explorer_id: explorerId, verdict: verdict }); }
      catch (e) { console.warn("LOP sync: logVote", e); }
    },
    async getConsensus(cardId) {
      if (!client || !cardId) return null;
      try { const r = await client.from("card_consensus").select("*").eq("card_id", String(cardId)).limit(1); return (r.data && r.data[0]) || null; }
      catch (e) { return null; }
    },
    // ---- AI Lab community wall: shared dossiers + validation ----
    async saveDossier(planet, mode, model, payload) {
      if (!client || !planet) return null;
      if (!allow("dossiers")) return null;
      try {
        const r = await client.from("ai_dossiers")
          .insert({ planet: String(planet), mode: String(mode), model: String(model), payload: payload, explorer_id: explorerId })
          .select("id").limit(1);
        return (r.data && r.data[0] && r.data[0].id) || null;
      } catch (e) { console.warn("LOP sync: saveDossier", e); return null; }
    },
    async getDossiers(planet, mode) {
      if (!client || !planet) return [];
      try {
        const r = await client.from("ai_dossiers").select("id,model,payload,created_at")
          .eq("planet", String(planet)).eq("mode", String(mode))
          .order("created_at", { ascending: false }).limit(50);
        return r.data || [];
      } catch (e) { return []; }
    },
    async voteDossier(dossierId, verdict) {
      if (!client || !dossierId) return;
      if (!allow("dvotes")) return;
      try { await client.from("ai_dossier_votes").insert({ dossier_id: dossierId, explorer_id: explorerId, verdict: verdict }); }
      catch (e) { console.warn("LOP sync: voteDossier", e); }
    },
    async getDossierConsensus(dossierId) {
      if (!client || !dossierId) return null;
      try { const r = await client.from("ai_dossier_consensus").select("*").eq("dossier_id", dossierId).limit(1); return (r.data && r.data[0]) || null; }
      catch (e) { return null; }
    },
    // ---- Candidate check (research ladder): findings per open candidate ----
    // reuses ai_dossiers; mode is 'check:<question>' so no new table is needed.
    async getCandidateFindings(planet) {
      if (!client || !planet) return [];
      try {
        const r = await client.from("ai_dossiers").select("id,mode,model,payload,created_at")
          .eq("planet", String(planet)).like("mode", "check:%")
          .order("created_at", { ascending: false }).limit(200);
        return r.data || [];
      } catch (e) { return []; }
    },
    // ---- territory: sector claims + shared galaxy map ----
    async logSectorWork(sectorId, color) {
      if (!client || sectorId == null) return;
      if (!allow("sectors")) return;
      try { await client.from("sector_claims").insert({ explorer_id: explorerId, sector_id: sectorId, kind: "work", color: color }); }
      catch (e) { console.warn("LOP sync: logSectorWork", e); }
    },
    async claimHome(sectorId, color) {
      if (!client || sectorId == null) return;
      try { await client.from("sector_claims").insert({ explorer_id: explorerId, sector_id: sectorId, kind: "home", color: color }); }
      catch (e) { console.warn("LOP sync: claimHome", e); }
    },
    async getClaimedHomes() {
      if (!client) return [];
      try { const r = await client.from("sector_claims").select("sector_id").eq("kind", "home"); return (r.data || []).map(x => x.sector_id); }
      catch (e) { return []; }
    },
    async getMyClaims() {
      if (!client || !explorerId) return [];
      try { const r = await client.from("sector_claims").select("sector_id,kind").eq("explorer_id", explorerId).limit(500); return r.data || []; }
      catch (e) { return []; }
    },
    async getSectorMap() {
      if (!client) return [];
      try { const r = await client.from("sector_map").select("*"); return r.data || []; }
      catch (e) { return []; }
    },
    // ---- accounts: optional magic-link sign-in + cross-device progress sync ----
    async currentUser() {
      if (!client) return null;
      try { const r = await client.auth.getUser(); return (r.data && r.data.user) || null; }
      catch (e) { return null; }
    },
    async signInEmail(email) {
      if (!client) return { error: "offline" };
      try {
        const redirect = location.origin + location.pathname;
        const r = await client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect } });
        return { error: r.error && r.error.message };
      } catch (e) { return { error: String(e) }; }
    },
    async signOut() {
      if (!client) return;
      try { await client.auth.signOut(); } catch (e) {}
    },
    onAuth(cb) {
      if (!client) return;
      try { client.auth.onAuthStateChange(function (_evt, session) { cb((session && session.user) || null); }); }
      catch (e) {}
    },
    async saveState(state) {
      if (!client) return;
      try {
        const u = await api.currentUser();
        if (!u) return;
        await client.from("player_state").upsert({ user_id: u.id, state: state, updated_at: new Date().toISOString() });
      } catch (e) { console.warn("LOP sync: saveState", e); }
    },
    async loadState() {
      if (!client) return null;
      try {
        const u = await api.currentUser();
        if (!u) return null;
        const r = await client.from("player_state").select("state").eq("user_id", u.id).limit(1);
        return (r.data && r.data[0] && r.data[0].state) || null;
      } catch (e) { return null; }
    }
  };

  window.LOPSync = api;
})();
