#!/usr/bin/env python3
"""
fetch_frontier.py — pull REAL, still-OPEN TESS candidates for first-look review.

Unlike fetch_lightcurves.py (the known-answer TRAINING deck), these are genuine
"planet candidate" TOIs from the NASA Exoplanet Archive that have NOT been
confirmed or ruled out — there is no answer key. Explorers do a real first-look
review; their votes feed the community consensus (the card_votes table).

Mixed-deck model (agreed with Steve): frontier cards are shown ALONGSIDE the
known-answer controls. Scoring/streaks come only from the controls; frontier
cards carry NO truth label and reward "you're among the first to review this".

Run (from the project root, with the venv):
    .venv/bin/python scripts/fetch_frontier.py [--max 12] [--pool 80]

Writes outputs/frontier_curves.json  (the Data Lab / game read this).
Pure real data. These cards intentionally have truth=null.
"""

import json, os, sys, csv, io, argparse, warnings, math
warnings.filterwarnings("ignore")
import urllib.request, urllib.parse
import numpy as np

# reuse the proven pipeline from the training-deck script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_lightcurves import fetch_one, to_flux, fold_bin, star_meta, depth_ppm, NBINS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "outputs", "frontier_curves.json")
TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"


def query_open_tois(pool):
    """Recent OPEN (planet-candidate) TOIs with a period and a reviewable depth."""
    adql = (
        "select top {n} toi,tid,tfopwg_disp,pl_orbper,pl_trandep,pl_rade,st_rad,toi_created "
        "from toi where tfopwg_disp='PC' and pl_orbper is not null "
        "and pl_trandep between 400 and 60000 "  # visible by eye, not an obvious deep EB
        "order by toi_created desc"
    ).format(n=int(pool))
    url = TAP + "?" + urllib.parse.urlencode({"query": adql, "format": "csv"})
    req = urllib.request.Request(url, headers={"User-Agent": "LifeOnOtherPlanets/1.0"})
    data = urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")
    return list(csv.DictReader(io.StringIO(data)))


# ---------- objective false-positive checks (Candidate check, layer A) ----------
# These are cheap, reliable numeric tests we run on the light curve + star data —
# the same red flags a professional looks for. No AI needed. Each returns a dict
# {test, flag, note}; flag=True means "this looks like a false positive."

def check_secondary_eclipse(curve):
    """A dip halfway between transits (phase 0.5) is the hallmark of an eclipsing binary.
    The curve is folded with the primary dip centered at the middle, so a secondary
    lands near the edges."""
    c = np.asarray(curve, float)
    quarter = np.concatenate([c[30:90], c[150:210]])          # out-of-eclipse baseline
    base = float(np.median(quarter)); sd = float(np.std(quarter)) or 1e-6
    prim = base - float(np.min(c[108:132]))                   # primary at center
    sec = base - float(np.min(np.concatenate([c[:16], c[-16:]])))  # phase 0.5 at edges
    flag = (sec > 3.5 * sd) and (prim > 0) and (sec > 0.2 * prim)
    return {"test": "Secondary eclipse", "flag": bool(flag),
            "note": (f"A secondary dip (~{int(sec*1e6)} ppm) appears halfway between transits — a sign of an eclipsing binary."
                     if flag else "No secondary eclipse — consistent with a planet.")}


def check_odd_even(t, f, period):
    """Eclipsing binaries often show alternating deep/shallow eclipses. Fold the
    even- and odd-numbered cycles separately and compare their depths."""
    try:
        cyc = np.floor((t - np.min(t)) / period).astype(int)
        even = (cyc % 2 == 0)
        fe = fold_bin(t[even], f[even], period)
        fo = fold_bin(t[~even], f[~even], period)
        if fe is None or fo is None:
            return None
        de = depth_ppm(fe)[0]; do = depth_ppm(fo)[0]
        if de <= 0 or do <= 0:
            return None
        ratio = min(de, do) / max(de, do)
        flag = (ratio < 0.6) and (max(de, do) > 300)
        return {"test": "Odd–even depth", "flag": bool(flag),
                "note": (f"Odd vs even transits differ ({int(min(de,do))} vs {int(max(de,do))} ppm) — a sign of an eclipsing binary."
                         if flag else "Odd and even transits match — consistent with a planet.")}
    except Exception:
        return None


def check_implied_size(depth_ppm_val, st_rad, pl_rade):
    """transit depth ≈ (planet radius / star radius)^2, so planet size = star size * sqrt(depth).
    If the implied size is bigger than ~2 Jupiters (~22 Earth radii), it's physically a star."""
    rp = None
    if st_rad and st_rad > 0:
        rp = float(st_rad) * 109.2 * math.sqrt(max(depth_ppm_val, 0) / 1e6)   # in Earth radii
    elif pl_rade and pl_rade > 0:
        rp = float(pl_rade)
    if rp is None:
        return None
    flag = rp > 22.0
    return {"test": "Implied size", "flag": bool(flag),
            "note": (f"The dip implies a ~{rp:.0f} Earth-radii object — too big to be a planet (likely a star)."
                     if flag else f"Implied size ~{rp:.1f} Earth radii — within the planet range.")}


def frontier_card(toi, tid, period, disp, curve, meta, sector, t, f, st_rad, pl_rade):
    d_ppm, base = depth_ppm(curve)
    checks = [c for c in (
        check_secondary_eclipse(curve),
        check_odd_even(t, f, period),
        check_implied_size(d_ppm, st_rad, pl_rade),
    ) if c]
    flags = sum(1 for c in checks if c["flag"])
    return {
        "id": f"TOI-{toi}",
        "name": f"TOI-{toi}",
        "kind": "candidate",
        "truth": None,                     # <-- NO answer key: this is a real open candidate
        "frontier": True,
        "disposition": disp,               # 'PC' = planet candidate (still open)
        "why": ("A real, still-open TESS planet candidate — the professionals haven't "
                "confirmed or ruled it out yet. There's no answer key here: your read is "
                "a genuine first look, and it joins the community's consensus."),
        "difficulty": "unknown",
        "tic": meta.get("tic") or f"TIC {tid}",
        "constellation": meta.get("constellation"),
        "distance_ly": meta.get("distance_ly"),
        "teff": meta.get("teff"),
        "source": f"Real TESS data · open candidate (TOI {toi}) · {sector}",
        "depth_ppm": int(round(d_ppm)),
        "period_days": round(float(period), 4),
        "checks": checks,                  # objective red-flag tests (Candidate check A)
        "flag_count": flags,
        "f": [round(float(x), 6) for x in curve],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=12, help="how many frontier cards to build")
    ap.add_argument("--pool", type=int, default=80, help="how many recent TOIs to try")
    ap.add_argument("--append", action="store_true", help="add NEW candidates to the existing deck (dedupe by TOI) instead of overwriting")
    ap.add_argument("--out", default=None, help="output json path (default: outputs/frontier_curves.json)")
    args = ap.parse_args()
    if args.out:
        globals()["OUT"] = os.path.abspath(args.out)

    existing, existing_ids = [], set()
    if args.append and os.path.exists(OUT):
        try:
            existing = json.load(open(OUT)) or []
            existing_ids = {c.get("id") for c in existing}
            print(f"== Append mode: {len(existing)} existing cards; adding up to {args.max} NEW ones ==")
        except Exception:
            existing, existing_ids = [], set()

    print(f"== Fetching up to {args.pool} recent OPEN TOIs from the NASA Exoplanet Archive ==")
    try:
        rows = query_open_tois(args.pool)
    except Exception as e:
        print("! TOI query failed:", e); sys.exit(1)
    print(f"  got {len(rows)} candidate rows; building up to {args.max} cards\n")

    cards = []
    for r in rows:
        if len(cards) >= args.max:
            break
        toi = (r.get("toi") or "").strip().strip('"')
        tid = (r.get("tid") or "").strip()
        if args.append and f"TOI-{toi}" in existing_ids:
            continue                                    # already in the deck — fetch a genuinely new one
        try:
            period = float(r.get("pl_orbper"))
        except (TypeError, ValueError):
            continue
        if not tid or period <= 0:
            continue
        print(f"- TOI {toi} (TIC {tid}, P={period:.3f}d)")
        got = fetch_one(f"TIC {tid}")
        if not got:
            continue
        lc, sector, author = got
        t, f = to_flux(lc.flatten(window_length=401))
        curve = fold_bin(t, f, period)
        if curve is None:
            print("  ! fold failed — skip"); continue
        d_ppm, base = depth_ppm(curve)
        sd = np.std(np.concatenate([curve[:40], curve[-40:]]))
        if (base - np.min(curve)) < 2.0 * sd:
            print(f"  ! no visible dip ({d_ppm:.0f}ppm vs noise {sd*1e6:.0f}ppm) — skip"); continue
        meta = star_meta(f"TIC {tid}")
        def _fnum(x):
            try: return float(x)
            except (TypeError, ValueError): return None
        st_rad, pl_rade = _fnum(r.get("st_rad")), _fnum(r.get("pl_rade"))
        c = frontier_card(toi, tid, period, r.get("tfopwg_disp", "PC"), curve, meta, sector, t, f, st_rad, pl_rade)
        cards.append(c)
        fl = c["flag_count"]
        print(f"  ✓ dip {d_ppm:.0f}ppm · {meta.get('constellation')} · {meta.get('distance_ly')} ly · "
              f"{fl} red-flag{'s' if fl!=1 else ''}" + (" ⚠" if fl else ""))

    merged = existing + cards
    seen, out_cards = set(), []
    for c in merged:
        cid = c.get("id")
        if cid in seen:
            continue
        seen.add(cid); out_cards.append(c)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(out_cards, fh)
    print(f"\nWROTE {len(out_cards)} frontier cards → {os.path.relpath(OUT)} "
          f"(+{len(cards)} new this run; all truth=null, open candidates)")
    if not out_cards:
        print("WARNING: no frontier cards built — check network / relax --pool."); sys.exit(2)


if __name__ == "__main__":
    main()
