#!/usr/bin/env python3
"""
fetch_lightcurves.py — pull REAL TESS light curves for the Data Lab vetting deck.

For a curated list of well-known targets it:
  1. downloads a real TESS light curve (lightkurve / MAST),
  2. cleans + normalizes it, folds planets/EBs on their known period, bins to a
     compact ~240-point curve, and CENTERS the dip,
  3. VERIFIES the expected signal from the data itself (a planet card must show a
     real dip; a quiet card must be flat) so we never mislabel a card,
  4. looks up the star's real distance + constellation from the TESS Input Catalog,
  5. builds injection cards (real quiet-star noise + a faint injected transit) — a
     legitimate injection-recovery test on real data,
  6. writes outputs/real_curves.json (the Data Lab embeds/reads this).

Run (from the project root, with the venv):
    .venv/bin/python scripts/fetch_lightcurves.py

Pure real data. Truth labels are gated by data-verification, not by memory.
"""

import json, os, sys, warnings, math
warnings.filterwarnings("ignore")

import numpy as np

try:
    import lightkurve as lk
    from astropy.coordinates import SkyCoord, get_constellation
    import astropy.units as u
    from astroquery.mast import Catalogs
except Exception as e:
    print("MISSING DEPS:", e); sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "outputs", "real_curves.json")
NBINS = 240
PC_TO_LY = 3.261563777

# --- curated targets. period in days (established literature) for folding. -----
# blurb = the "why" shown after the reveal. difficulty: easy|medium|hard.
CONFIRMED_PLANETS = [
    ("WASP-18 b",  0.941452, "easy",   "A massive 'hot Jupiter' — its deep, obvious, evenly-spaced dips are the textbook look of a big planet crossing its star."),
    ("WASP-121 b", 1.274925, "easy",   "An ultra-hot Jupiter. Deep, clean, repeating transits — one of the easiest kinds of planet to confirm by eye."),
    ("LHS 3844 b", 0.462929, "medium", "A rocky world with an 11-hour year around a small red star. The dip is shallow but repeats like clockwork."),
    ("GJ 357 b",   3.930720, "medium", "A nearby transiting super-Earth. A modest, regular dip — real, but you have to look."),
    ("Pi Mensae c",6.267852, "hard",   "TESS's very first new planet — a mini-Neptune. The dip is tiny (~300 parts per million); catching faint ones like this is exactly where humans beat the software."),
    ("AU Mic b",   8.463000, "hard",   "An infant planet around a 23-million-year-old star. The young star's flares and spots make the real transit hard to pick out — a genuine challenge."),
]
# Bright, well-studied eclipsing binaries — the #1 planet impostor. Verified from data.
EB_CANDIDATES = [
    ("Algol",       2.867320, "Two stars eclipsing each other. Notice the V-shape and the shallower SECOND dip halfway between — planets don't do that. This is the most common false alarm."),
    ("RZ Cassiopeiae",1.195247,"An Algol-type eclipsing binary. The dip is deep and V-shaped — far too deep for a planet, which barely dims its star."),
    ("U Cephei",    2.492861, "Two stars taking turns blocking each other. A deep primary eclipse plus a secondary dip — the fingerprint of a binary, not a planet."),
    ("delta Librae",2.327354, "A bright eclipsing binary. The eclipse is enormous compared to any planet transit — a clear impostor."),
    ("beta Aurigae",3.960421, "A bright eclipsing binary: two nearly-equal stars, so you see two similar deep dips per cycle — a dead giveaway it isn't a planet."),
]
# Quiet stars: real TESS noise, no transiting planet. Truth = not a planet.
QUIET_STARS = ["Vega", "61 Cygni A", "Sigma Draconis", "Delta Pavonis",
               "82 Eridani", "Fomalhaut", "Procyon", "Tau Ceti", "HD 219134"]


def fetch_one(name):
    """Download one good TESS light curve for a target; return (LightCurve, sector, author) or None."""
    try:
        sr = lk.search_lightcurve(name, mission="TESS")
    except Exception as e:
        print(f"  ! search failed for {name}: {e}"); return None
    if sr is None or len(sr) == 0:
        print(f"  ! no TESS light curves for {name}"); return None
    tbl = sr.table
    pref = {"SPOC": 0, "TESS-SPOC": 1, "QLP": 2}
    order = sorted(range(len(sr)),
                   key=lambda i: (pref.get(str(tbl["author"][i]), 9),
                                  float(tbl["exptime"][i]) if "exptime" in tbl.colnames else 9999))
    for i in order[:4]:
        try:
            lc = sr[int(i)].download()
            if lc is not None and len(lc.remove_nans()) > 500:
                sec = tbl["mission"][i] if "mission" in tbl.colnames else "TESS"
                return lc, str(sec), str(tbl["author"][i])
        except Exception as e:
            print(f"    . download attempt failed ({name}): {e}")
    return None


def to_flux(lc):
    lc = lc.remove_nans().normalize()
    f = np.asarray(lc.flux.value, dtype=float)
    t = np.asarray(lc.time.value, dtype=float)
    # clip wild outliers (cosmic rays) at 6 sigma so binning isn't wrecked
    med, sd = np.nanmedian(f), np.nanstd(f)
    good = np.abs(f - med) < 6 * sd
    return t[good], f[good]


def fold_bin(t, f, period, nbins=NBINS):
    phase = ((t / period) % 1.0)
    edges = np.linspace(0, 1, nbins + 1)
    idx = np.clip(np.digitize(phase, edges) - 1, 0, nbins - 1)
    out = np.full(nbins, np.nan)
    for b in range(nbins):
        m = f[idx == b]
        if len(m): out[b] = np.median(m)
    # fill gaps by interpolation
    good = ~np.isnan(out)
    if good.sum() < nbins * 0.6:
        return None
    out = np.interp(np.arange(nbins), np.flatnonzero(good), out[good])
    # center the deepest point
    shift = nbins // 2 - int(np.argmin(out))
    return np.roll(out, shift)


def segment(t, f, nbins=NBINS):
    """A clean contiguous downsample for quiet stars (real noise, no folding)."""
    if len(f) < nbins: return None
    # take the longest gap-free-ish middle chunk, bin down
    n = len(f)
    lo = n // 4
    chunk = f[lo: lo + max(nbins, (n - lo) // 2)]
    edges = np.linspace(0, len(chunk), nbins + 1).astype(int)
    out = np.array([np.median(chunk[edges[b]:edges[b+1]]) if edges[b+1] > edges[b] else np.nan
                    for b in range(nbins)])
    good = ~np.isnan(out)
    if good.sum() < nbins * 0.8: return None
    return np.interp(np.arange(nbins), np.flatnonzero(good), out[good])


def depth_ppm(curve):
    base = np.median(np.concatenate([curve[:40], curve[-40:]]))
    return (base - np.min(curve)) * 1e6, base


def star_meta(name):
    """Real distance + constellation from the TESS Input Catalog (Gaia-based)."""
    meta = {"distance_ly": None, "constellation": None, "teff": None, "tic": None}
    try:
        cat = Catalogs.query_object(name, catalog="TIC", radius=0.02)
        if cat is None or len(cat) == 0: return meta
        cat.sort("dstArcSec")
        row = cat[0]
        meta["tic"] = str(row["ID"])
        ra, dec = float(row["ra"]), float(row["dec"])
        meta["constellation"] = get_constellation(SkyCoord(ra * u.deg, dec * u.deg))
        d = row["d"]
        if d is not None and np.isfinite(float(d)):
            meta["distance_ly"] = round(float(d) * PC_TO_LY, 1)
        te = row["Teff"]
        if te is not None and np.isfinite(float(te)):
            meta["teff"] = int(round(float(te)))
    except Exception as e:
        print(f"    . TIC lookup failed ({name}): {e}")
    return meta


def card(name, kind, truth, why, curve, difficulty, meta, sector, source_extra=""):
    d_ppm, base = depth_ppm(curve)
    return {
        "id": name.replace(" ", "_"),
        "name": name,
        "kind": kind, "truth": truth, "why": why, "difficulty": difficulty,
        "tic": meta.get("tic"), "constellation": meta.get("constellation"),
        "distance_ly": meta.get("distance_ly"), "teff": meta.get("teff"),
        "source": f"Real TESS data · {sector}{source_extra}",
        "depth_ppm": int(round(d_ppm)),
        "f": [round(float(x), 6) for x in curve],
    }


def main():
    cards, quiet_curves = [], []
    print("== Confirmed planets ==")
    for name, period, diff, why in CONFIRMED_PLANETS:
        print(f"- {name}")
        got = fetch_one(name)
        if not got: continue
        lc, sector, author = got
        t, f = to_flux(lc.flatten(window_length=401) if True else lc)
        curve = fold_bin(t, f, period)
        if curve is None: print(f"  ! fold failed {name}"); continue
        d_ppm, base = depth_ppm(curve)
        sd = np.std(np.concatenate([curve[:40], curve[-40:]]))
        if (base - np.min(curve)) < 2.5 * sd:
            print(f"  ! no clear dip for {name} (depth {d_ppm:.0f}ppm, noise {sd*1e6:.0f}ppm) — skipping"); continue
        meta = star_meta(name)
        cards.append(card(name, "transit", "planet", why, curve, diff, meta, sector))
        print(f"  ✓ dip {d_ppm:.0f}ppm · {meta.get('constellation')} · {meta.get('distance_ly')} ly")

    print("== Eclipsing binaries (verified) ==")
    for name, period, why in EB_CANDIDATES:
        print(f"- {name}")
        got = fetch_one(name)
        if not got: continue
        lc, sector, author = got
        t, f = to_flux(lc)
        curve = fold_bin(t, f, period)
        if curve is None: print(f"  ! fold failed {name}"); continue
        d_ppm, base = depth_ppm(curve)
        # EB must show a DEEP eclipse
        if d_ppm < 4000:
            print(f"  ! eclipse too shallow for {name} ({d_ppm:.0f}ppm) — skipping"); continue
        meta = star_meta(name)
        cards.append(card(name, "eb", "not", why, curve, "medium", meta, sector))
        print(f"  ✓ eclipse {d_ppm:.0f}ppm · {meta.get('constellation')}")

    print("== Quiet stars (real noise, not a planet) ==")
    for name in QUIET_STARS:
        print(f"- {name}")
        got = fetch_one(name)
        if not got: continue
        lc, sector, author = got
        t, f = to_flux(lc.flatten(window_length=401))
        curve = segment(t, f)
        if curve is None: print(f"  ! segment failed {name}"); continue
        d_ppm, base = depth_ppm(curve)
        sd = np.std(curve)
        if (base - np.min(curve)) > 4 * sd:  # unexpected deep dip -> don't call it quiet
            print(f"  ! unexpected dip in {name} — skipping as quiet"); continue
        meta = star_meta(name)
        why = "No repeating dip — just the star's natural flicker and measurement noise. Correctly saying 'no planet' matters as much as finding one."
        cards.append(card(name, "noise", "not", why, curve, "easy", meta, sector))
        quiet_curves.append((name, curve, meta, sector))
        print(f"  ✓ flat · noise {sd*1e6:.0f}ppm · {meta.get('constellation')}")

    print("== Injection cards (real noise + faint injected transit) ==")
    for i, (name, curve, meta, sector) in enumerate(quiet_curves[:3]):
        inj = np.array(curve, dtype=float)
        depth = 0.0008 + 0.0005 * i              # subtle: ~800-1800 ppm, needs a careful eye
        c = NBINS // 2; half = 6
        inj[c - half:c + half] -= depth          # a centered box transit
        why = ("A faint transit we injected into this real star's real noise on purpose. "
               "Catching these is how we measure the crowd's sensitivity to small, Earth-like planets — an injection-recovery test.")
        cards.append({
            "id": f"inject_{i}", "name": f"{name} (with injected planet)",
            "kind": "injection", "truth": "planet", "why": why, "difficulty": "hard",
            "tic": meta.get("tic"), "constellation": meta.get("constellation"),
            "distance_ly": meta.get("distance_ly"), "teff": meta.get("teff"),
            "source": f"Real TESS data · {sector} + injected signal",
            "depth_ppm": int(depth * 1e6),
            "f": [round(float(x), 6) for x in inj],
        })
        print(f"  ✓ injected {depth*1e6:.0f}ppm into {name}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(cards, fh)
    planets = sum(1 for c in cards if c["truth"] == "planet")
    print(f"\nWROTE {len(cards)} cards → {os.path.relpath(OUT)}  ({planets} planet / {len(cards)-planets} not)")
    if len(cards) < 6:
        print("WARNING: thin deck — check network / target names."); sys.exit(2)


if __name__ == "__main__":
    main()
