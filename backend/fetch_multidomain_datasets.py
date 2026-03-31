"""
OGD India — Multi-Domain Dataset Fetcher
=========================================
Domains  : Finance, Census, Education, Health, Transport
Target   : 150 datasets per domain
Rows/CSV : 1000 rows each
Output   : finance_datasets/, census_datasets/, education_datasets/,
           health_datasets/, transport_datasets/

Install:  pip install requests pandas datagovindia
Run:      python fetch_multidomain_datasets.py
"""
import os, time, requests, pandas as pd
from datetime import datetime
from datagovindia import DataGovIndia


API_KEY    = "579b464db66ec23bdd00000183e9d081381b42124e159d67b00766e6"
BASE_URL   = "https://api.data.gov.in/resource"
TARGET     = 150     # datasets per domain
LIMIT      = 1000    # rows per CSV
TIMEOUT    = 30      # seconds per request
DELAY      = 1.5     # seconds between requests

os.environ["DATAGOVINDIA_API_KEY"] = API_KEY

# 6 domains — each gets its own folder
DOMAINS = {
    "agriculture": "agriculture_datasets",
    "finance":     "finance_datasets",
    "census":      "census_datasets",
    "education":   "education_datasets",
    "health":      "health_datasets",
    "transport":   "transport_datasets",
}


# ── Get real resource IDs from local metadata ────────────────────────────────
def get_candidates(keyword: str) -> list[tuple[str, str]]:
    from datagovindia import DataGovIndia
    dg = DataGovIndia(api_key=API_KEY)

    results = dg.search(keyword, search_fields=["title", "sectors"])

    if results is None or len(results) == 0:
        print(f"    ⚠️  No candidates found for '{keyword}'")
        return []

    results["date_updated"] = pd.to_datetime(results["date_updated"], utc=True, errors="coerce")
    results = results.sort_values("date_updated", ascending=False)

    candidates = []
    for _, row in results.iterrows():
        rid   = str(row["resource_id"]).strip()
        title = str(row["title"]).strip()
        safe  = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
        safe  = "_".join(safe.split())[:55]
        if rid and len(rid) == 36:
            candidates.append((rid, safe))

    return candidates


# ── Fetch one resource from OGD API ─────────────────────────────────────────
def fetch_resource(resource_id: str) -> tuple[pd.DataFrame | None, int, str]:
    params = {"api-key": API_KEY, "format": "json", "limit": LIMIT, "offset": 0}
    try:
        r = requests.get(f"{BASE_URL}/{resource_id}", params=params, timeout=TIMEOUT)
        if r.status_code == 404: return None, 0, "Not found (404)"
        if r.status_code == 401: return None, 0, "Invalid API key (401)"
        if r.status_code == 403: return None, 0, "Forbidden (403)"
        r.raise_for_status()

        body    = r.json()
        records = body.get("records", [])
        fields  = body.get("field", [])
        total   = int(body.get("total", 0))

        if not records:
            return None, total, f"Empty (total={total})"

        df = pd.DataFrame(records)
        if fields:
            df.rename(columns={f["id"]: f["name"]
                                for f in fields if "id" in f and "name" in f},
                      inplace=True)
        df.drop(columns=[c for c in ["_id","id","rank","_score"] if c in df.columns],
                inplace=True)
        return df, total, ""

    except requests.exceptions.Timeout:
        return None, 0, "Timeout"
    except Exception as e:
        return None, 0, str(e)


# ── Fetch TARGET datasets for one domain ────────────────────────────────────
def fetch_domain(domain: str, output_dir: str) -> list[dict]:
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n{'='*65}")
    print(f"  📂  {domain.upper()}  →  {output_dir}/")
    print(f"      Target : {TARGET} CSVs  |  Rows : {LIMIT}  |  Timeout : {TIMEOUT}s")
    print(f"{'='*65}")

    candidates = get_candidates(domain)
    print(f"  Found {len(candidates)} candidates\n")

    saved    = 0
    skipped  = 0
    log_rows = []
    start    = datetime.now()

    for resource_id, name in candidates:
        if saved >= TARGET:
            break

        print(f"  [{saved+1:03d}/{TARGET}]  {name[:52]}")
        print(f"           ID : {resource_id}")
        time.sleep(DELAY)

        df, total, err = fetch_resource(resource_id)

        if df is None:
            print(f"           ❌  {err}\n")
            skipped += 1
            continue

        print(f"           ✅  {len(df)} rows × {len(df.columns)} cols"
              f"  (total in API: {total})")

        fname = f"{saved+1:03d}_{name[:45]}_{resource_id[:8]}.csv"
        fpath = os.path.join(output_dir, fname)
        df.to_csv(fpath, index=False, encoding="utf-8-sig")
        print(f"           💾  {fname}\n")

        log_rows.append({
            "domain":       domain,
            "index":        saved + 1,
            "title":        name,
            "resource_id":  resource_id,
            "rows_fetched": len(df),
            "total_in_api": total,
            "columns":      len(df.columns),
            "file":         fname,
        })
        saved += 1

    elapsed = (datetime.now() - start).seconds // 60
    print(f"  {'─'*60}")
    print(f"  ✅  Saved   : {saved}/{TARGET}")
    print(f"  ❌  Skipped : {skipped}")
    print(f"  ⏱️  Time    : ~{elapsed} min")

    # Save per-domain summary
    if log_rows:
        summary = pd.DataFrame(log_rows)
        spath   = os.path.join(output_dir, f"_summary_{domain}.csv")
        summary.to_csv(spath, index=False)
        print(f"  📋  Summary : {spath}")

    return log_rows


# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    run_time  = datetime.now().strftime("%Y%m%d_%H%M%S")
    all_logs  = []
    grand_start = datetime.now()

    print("=" * 65)
    print("  OGD India — Multi-Domain Dataset Fetcher")
    print(f"  Domains  : {', '.join(DOMAINS.keys())}")
    print(f"  Target   : {TARGET} datasets per domain")
    print(f"  Rows/CSV : {LIMIT}")
    print(f"  Total    : up to {TARGET * len(DOMAINS)} CSVs")
    print("=" * 65)

    for domain, output_dir in DOMAINS.items():
        logs = fetch_domain(domain, output_dir)
        all_logs.extend(logs)

    # ── Master summary ───────────────────────────────────────────────────────
    total_elapsed = (datetime.now() - grand_start).seconds // 60

    print(f"\n{'='*65}")
    print(f"  FINAL SUMMARY")
    print(f"{'='*65}")

    if all_logs:
        master = pd.DataFrame(all_logs)
        mpath  = f"_master_summary_{run_time}.csv"
        master.to_csv(mpath, index=False)

        counts = master.groupby("domain").agg(
            saved=("index", "count"),
            total_rows=("rows_fetched", "sum")
        ).reset_index()
        counts["target"] = TARGET
        counts["status"] = counts["saved"].apply(
            lambda x: "✅ complete" if x >= TARGET else f"⚠️  {x}/{TARGET}"
        )

        print(f"\n{counts.to_string(index=False)}")
        print(f"\n  Total datasets : {len(master)}")
        print(f"  Total rows     : {master['rows_fetched'].sum():,}")
        print(f"  Total time     : ~{total_elapsed} min")
        print(f"  Master summary : {mpath}")

    print(f"\n  Output folders:")
    for domain, output_dir in DOMAINS.items():
        print(f"    {output_dir}/")


if __name__ == "__main__":
    main()