import argparse
import os
import csv
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, date, timedelta

# === CONFIGURATION ===
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
REPO_OWNER = "cesarlugos1s"
REPO_NAME = "veloiq"
PYPI_PACKAGE = "VeloIQ-framework"
OUTPUT_FILE = "veloiq_traffic_history.csv"
PYPI_CACHE_FILE = ".pypi_cache.json"

CSV_HEADER = [
    "Date", "Total_Views", "Unique_Visitors", "Total_Clones", "Unique_Cloners",
    "Ratio_Terminal_Browser", "PyPI_Day", "PyPI_Week", "PyPI_Month",
    "Stars", "Forks", "Open_Issues"
]

def fetch_json(url, headers=None, retries=3):
    """Fetches JSON payloads with exponential backoff delay for 429 rate limits
    and transient 5xx errors (e.g. GitHub's traffic API occasionally returns
    503 while it recomputes stats)."""
    req = urllib.request.Request(url, headers=headers or {})
    for i in range(retries):
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait_time = 2 ** (i + 1)
                print(f"⚠️  PyPI rate limited (429). Retrying in {wait_time}s...")
                time.sleep(wait_time)
            elif e.code >= 500:
                wait_time = 2 ** (i + 1)
                print(f"⚠️  {e.code} from {url}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            elif e.code == 404:
                print(f"ℹ️  Package pending indexing on PyPI Stats (404). Defaulting downloads to 0.")
                return {"is_pending": True, "data": {"last_day": 0, "last_week": 0, "last_month": 0}}
            else:
                print(f"❌ HTTP Error fetching {url}: {e.code} - {e.reason}")
                return None
        except Exception as e:
            print(f"❌ Error fetching {url}: {e}")
            return None
    return None

def fetch_bigquery_real_installs(project_name):
    """Attempts to fetch filtered real installations from Google BigQuery if SDK & credentials exist."""
    try:
        from google.cloud import bigquery
        client = bigquery.Client()
        query = f"""
        SELECT
          COUNT(*) AS real_installations
        FROM
          `bigquery-public-data.pypi.file_downloads`
        WHERE
          project = '{project_name}'
          AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
          AND details.installer.name IN ('pip', 'uv', 'poetry', 'pipenv', 'conda', 'flit', 'hatch', 'pdm')
        """
        query_job = client.query(query)
        results = list(query_job.result())
        if results:
            return results[0].real_installations
    except Exception:
        # Fall back gracefully if BigQuery SDK or credentials are not configured
        return None
    return None

def load_pypi_cache(max_age_hours=6):
    """Loads cache only if it is fresher than max_age_hours."""
    if os.path.exists(PYPI_CACHE_FILE):
        try:
            with open(PYPI_CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                cached_time = datetime.fromisoformat(cached["cached_at"])
                if datetime.utcnow() - cached_time < timedelta(hours=max_age_hours):
                    return cached
                else:
                    print(f"⚠️  Cache file expired (> {max_age_hours}h old). Fetching fresh data...")
        except Exception:
            return None
    return None

def save_pypi_cache(data):
    payload = {
        "cached_at": datetime.utcnow().isoformat(),
        "data": data
    }
    with open(PYPI_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f)

def pct_change(current, previous, min_baseline=20):
    """Computes % growth with a Small-Base Guardrail to prevent hyper-inflated percentages."""
    if previous == 0:
        return "N/A"
    if previous < min_baseline:
        delta = round(current - previous, 1)
        sign = "+" if delta >= 0 else ""
        return f"{sign}{delta} net new"
    
    pct = ((current - previous) / previous) * 100
    sign = "+" if current >= previous else ""
    return f"{sign}{round(pct, 1):.1f}%"

def load_csv_history(filepath):
    """Reads CSV history once and returns structured historical data."""
    if not os.path.exists(filepath):
        return None

    result = {
        "existing_dates": set(),
        "dates_ordered": [],
        "clone_daily": [],
        "pypi_daily": [],
    }
    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)  # skip header
        for row in reader:
            if not row:
                continue
            try:
                result["existing_dates"].add(row[0])      # Date
                result["dates_ordered"].append(row[0])     # Date
                result["clone_daily"].append(int(row[3])) # Total_Clones
                result["pypi_daily"].append(int(row[6]))  # PyPI_Day
            except (ValueError, IndexError):
                pass
    return result

def weekly_avg_excluding_outliers(dates, daily_values):
    """Computes average weekly values, replacing outlier weeks with non-outlier mean."""
    if len(dates) < 14:
        avg_daily = sum(daily_values) / len(daily_values) if daily_values else 0
        return round(avg_daily * 7), 0, 0

    weeks = {}
    for d, v in zip(dates, daily_values):
        iso_year, iso_week, _ = date.fromisoformat(d).isocalendar()
        key = (iso_year, iso_week)
        weeks[key] = weeks.get(key, 0) + v

    weekly_sums = list(weeks.values())
    total_weeks = len(weekly_sums)
    if total_weeks < 3:
        avg_daily = sum(daily_values) / len(daily_values) if daily_values else 0
        return round(avg_daily * 7), 0, total_weeks

    sorted_sums = sorted(weekly_sums)
    n = len(sorted_sums)

    if n >= 10:
        q1 = sorted_sums[n // 4]
        q3 = sorted_sums[3 * n // 4]
        iqr = q3 - q1
        upper_bound = q3 + 1.5 * iqr if iqr > 0 else q3 * 2
    else:
        mean = sum(weekly_sums) / n
        variance = sum((x - mean) ** 2 for x in weekly_sums) / (n - 1) if n > 1 else 0
        stdev = variance ** 0.5
        upper_bound = mean + 0.5 * stdev if stdev > 0 else mean * 2

    outlier_totals = [t for t in weekly_sums if t > upper_bound]
    non_outlier_totals = [t for t in weekly_sums if t <= upper_bound]

    outlier_count = len(outlier_totals)
    if outlier_count == 0 or outlier_count == total_weeks:
        avg_weekly = round(sum(weekly_sums) / total_weeks)
    else:
        replacement = round(sum(non_outlier_totals) / len(non_outlier_totals))
        adjusted = non_outlier_totals + [replacement] * outlier_count
        avg_weekly = round(sum(adjusted) / total_weeks)

    return avg_weekly, outlier_count, total_weeks

def main():
    parser = argparse.ArgumentParser(description="Fetch VeloIQ GitHub/PyPI adoption KPIs.")
    parser.add_argument("--json-out", default=None,
                         help="Also write a machine-readable KPI snapshot to this path "
                              "(consumed by the GTM telemetry consolidator).")
    args = parser.parse_args()

    if not GITHUB_TOKEN:
        print("❌ Error: GITHUB_TOKEN environment variable not set.")
        return

    print(f"🚀 Fetching adoption data for {REPO_OWNER}/{REPO_NAME} & PyPI ({PYPI_PACKAGE})...\n")

    gh_headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    pypi_headers = {"User-Agent": "veloiq-kpi-tracker/1.0 (cesar.lugo.marcos@juicemantics.com)"}

    repo_data   = fetch_json(f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}", gh_headers)
    clones_data = fetch_json(f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/traffic/clones", gh_headers)
    views_data  = fetch_json(f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/traffic/views", gh_headers)

    # Load fresh cache if available (<6 hours old)
    pypi_cached_payload = load_pypi_cache(max_age_hours=6)
    pypi_from_cache = False
    pypi_pending = False

    if pypi_cached_payload:
        pypi_data = pypi_cached_payload["data"]
        pypi_from_cache = True
        print(f"ℹ️  Using fresh local PyPI cache from {pypi_cached_payload['cached_at']} UTC.\n")
    else:
        pypi_data = fetch_json(f"https://pypistats.org/api/packages/{PYPI_PACKAGE.lower()}/recent", pypi_headers)
        if pypi_data and pypi_data.get("is_pending"):
            pypi_pending = True
        elif pypi_data:
            save_pypi_cache(pypi_data)
        else:
            # Emergency fallback to expired cache if live network fetch fails
            fallback_cache = None
            if os.path.exists(PYPI_CACHE_FILE):
                try:
                    with open(PYPI_CACHE_FILE, "r", encoding="utf-8") as f:
                        fallback_cache = json.load(f)
                except Exception:
                    pass
            if fallback_cache:
                pypi_data = fallback_cache["data"]
                pypi_from_cache = True
                print(f"⚠️  Live PyPI fetch failed. Using emergency cached data ({fallback_cache['cached_at']} UTC).\n")
            else:
                pypi_pending = True
                print("⚠️  PyPI data unavailable. Defaulting downloads to 0.\n")

    if not clones_data or not views_data:
        print("⚠️  Could not recover GitHub traffic metrics. Defaulting clones/views to 0.\n")
        clones_data = clones_data or {}
        views_data = views_data or {}

    # ── Raw Values ────────────────────────────────────────────────────────────
    tot_views  = views_data.get("count", 0)
    uni_views  = views_data.get("uniques", 0)
    tot_clones = clones_data.get("count", 0)
    uni_clones = clones_data.get("uniques", 0)

    stars       = (repo_data or {}).get("stargazers_count", 0)
    forks       = (repo_data or {}).get("forks_count", 0)
    open_issues = (repo_data or {}).get("open_issues_count", 0)

    pypi_day   = (pypi_data or {}).get("data", {}).get("last_day", 0)
    pypi_week  = (pypi_data or {}).get("data", {}).get("last_week", 0)
    pypi_month = (pypi_data or {}).get("data", {}).get("last_month", 0)

    # Attempt BigQuery fetch for real installations; fallback to filtered estimate if unavailable
    bq_real_installs_7d = fetch_bigquery_real_installs(PYPI_PACKAGE)
    if bq_real_installs_7d is not None:
        real_pypi_week = bq_real_installs_7d
        bq_status_str = " (BigQuery Verified)"
    else:
        real_pypi_week = round(pypi_week * 0.15) if pypi_week > 0 else 0
        bq_status_str = " (Filtered Est.)"

    clean_ratio = (real_pypi_week / max(1, pypi_week)) if pypi_week > 0 else 0.15

    # Split 14-day clone window: this week (last 7 days)
    today = date.today()
    seven_days_ago = today - timedelta(days=7)
    clones_this_week = sum(
        c["count"] for c in clones_data.get("clones", [])
        if date.fromisoformat(c["timestamp"].split("T")[0]) >= seven_days_ago
    )

    # ── Historical Averages from CSV ──────────────────────────────────────────
    csv_history    = load_csv_history(OUTPUT_FILE)
    existing_dates = csv_history["existing_dates"] if csv_history else set()

    clones_avg_prev = pypi_avg_prev = 0
    clone_outliers = pypi_outliers = clone_total_wks = pypi_total_wks = 0

    if csv_history and csv_history["clone_daily"]:
        clones_avg_prev, clone_outliers, clone_total_wks = weekly_avg_excluding_outliers(
            csv_history["dates_ordered"], csv_history["clone_daily"])
    if csv_history and csv_history["pypi_daily"]:
        pypi_avg_prev, pypi_outliers, pypi_total_wks = weekly_avg_excluding_outliers(
            csv_history["dates_ordered"], csv_history["pypi_daily"])

    if clones_avg_prev == 0:
        clones_avg_prev = sum(
            c["count"] for c in clones_data.get("clones", [])
            if date.fromisoformat(c["timestamp"].split("T")[0]) < seven_days_ago
        )

    clean_pypi_avg_prev   = round(pypi_avg_prev * clean_ratio, 1) if pypi_avg_prev > 0 else 0
    raw_pypi_monthly_avg  = round(pypi_month / 4, 1) if pypi_month > 0 else 0
    real_pypi_monthly_avg = round(raw_pypi_monthly_avg * clean_ratio, 1) if raw_pypi_monthly_avg > 0 else 0

    # ── Computed KPIs ─────────────────────────────────────────────────────────
    ratio_terminal    = round(uni_clones / uni_views, 2)         if uni_views  > 0 else 0
    ratio_velocity    = round(tot_clones / uni_clones, 2)        if uni_clones > 0 else 0
    forks_stars_ratio = round(forks / stars, 2)                  if stars      > 0 else 0
    clone_pypi_conv   = round(real_pypi_week / uni_clones * 100, 1) if uni_clones > 0 else 0
    
    clone_wow_str  = pct_change(clones_this_week, clones_avg_prev)
    pypi_wow_str   = pct_change(real_pypi_week, clean_pypi_avg_prev)
    pypi_accel_str = pct_change(real_pypi_week, real_pypi_monthly_avg)

    # ══════════════════════════════════════════════════════════════════════════
    # DISPLAY: RAW DATA SNAPSHOT
    # ══════════════════════════════════════════════════════════════════════════
    print("══════════════════════════════════════════════════════════════════════════")
    print("📥  RAW DATA  —  CURRENT SNAPSHOT")
    print("══════════════════════════════════════════════════════════════════════════")
    print(f"  GitHub › Total Views (14d)         : {tot_views}")
    print(f"  GitHub › Unique Visitors (14d)     : {uni_views}")
    print(f"  GitHub › Total Clones (14d)        : {tot_clones}")
    print(f"  GitHub › Unique Cloners (14d)      : {uni_clones}")
    print(f"  GitHub › Clones This Week          : {clones_this_week}")
    clone_avg_label = "Clones Avg Prior Weeks (outliers replaced)"
    print(f"  GitHub › {clone_avg_label:<39}: {clones_avg_prev}  (from {clone_total_wks} prior weeks, {clone_outliers} outlier{'s' if clone_outliers != 1 else ''} replaced with non-outlier mean)" if clone_total_wks else f"  GitHub › Clones Avg Previous Weeks    : {clones_avg_prev}")
    print(f"  GitHub › Stars                     : {stars}")
    print(f"  GitHub › Forks                     : {forks}")
    print(f"  GitHub › Open Issues               : {open_issues}")
    print(f"  ──────────────────────────────────────────────────────────────────────")
    pypi_label = " (indexing)" if pypi_pending else (" (cached)" if pypi_from_cache else "")
    print(f"  PyPI   › Downloads Today{pypi_label:<15}: {pypi_day}")
    print(f"  PyPI   › Downloads Last Week{pypi_label:<11}: {pypi_week} (Raw API)")
    print(f"  PyPI   › Cleaned Real Installs (7d) : {real_pypi_week}{bq_status_str}")
    print(f"  PyPI   › Downloads Last Month{pypi_label:<10}: {pypi_month}")
    print("══════════════════════════════════════════════════════════════════════════\n")

    def kpi_block(icon, title, value, status, interpretation, explanation):
        print(f"\n  {icon}  {title}")
        print(f"      ▸ {value}")
        print(f"      {status}  {interpretation}")
        print(f"      ↳ {explanation}")

    # ── Classifications ───────────────────────────────────────────────────────
    if forks_stars_ratio >= 0.3:
        fs_status, fs_interp = "🟢 GREAT", "Strong contributor community — many people are forking to contribute or customize the framework."
    elif forks_stars_ratio >= 0.15:
        fs_status, fs_interp = "🟢 GOOD",  "Growing contributor interest. Make it easier to submit PRs and contributions to increase forks."
    elif forks_stars_ratio >= 0.05:
        fs_status, fs_interp = "🟡 STEADY","Few people are engaging by contributing to the source code directly."
    else:
        fs_status, fs_interp = "🔴 POOR",  "Almost no contributor engagement. Focus on lowering the barrier to contribute."

    if pypi_pending:
        cv_status, cv_interp = "⚪ INITIALIZING", "Package indexing on PyPI Stats (24-48h window). Conversion tracking paused."
        pw_status, pw_interp = "⚪ INITIALIZING", "Package indexing on PyPI Stats. WoW growth comparison paused."
        pypi_wow_str = "⚪ PENDING"
    else:
        if clone_pypi_conv >= 40:
            cv_status, cv_interp = "🟢 GREAT", "Most cloners are converting to pip installs. Minimal friction in the install path."
        elif clone_pypi_conv >= 15:
            cv_status, cv_interp = "🟢 GOOD",  "Solid conversion but room to improve. Sharpen the quickstart guide."
        elif clone_pypi_conv >= 5:
            cv_status, cv_interp = "🟡 STEADY","Typical for early-stage frameworks. Many cloners explore without installing."
        else:
            cv_status, cv_interp = "🔴 POOR",  "Most cloners are not installing via pip. Review install documentation and onboarding."

        if clean_pypi_avg_prev == 0:
            pw_status, pw_interp = "⚪ —", "No historical PyPI data available to compare against."
        elif real_pypi_week >= clean_pypi_avg_prev * 1.5:
            pw_status, pw_interp = "🟢 GREAT", "Install activity is spiking. More teams are adopting the package."
        elif real_pypi_week >= clean_pypi_avg_prev * 1.2:
            pw_status, pw_interp = "🟢 GOOD",  "Pip installs are meaningfully up vs historical average."
        elif real_pypi_week >= clean_pypi_avg_prev * 0.5:
            pw_status, pw_interp = "🟡 STEADY","Consistent install activity — within normal range of the historical weekly average."
        else:
            pw_status, pw_interp = "🔴 POOR",  "Well below the historical weekly average. Check if recent changes affected installs."

    if ratio_terminal >= 1.0:
        tb_status, tb_interp = "🟢 GREAT", "Developer-first audience reaching the framework directly via CLI."
    elif ratio_terminal >= 0.7:
        tb_status, tb_interp = "🟢 GOOD",  "Near-equal CLI and browser traffic. Strong technical profile."
    elif ratio_terminal >= 0.3:
        tb_status, tb_interp = "🟡 STEADY","Mixed discovery channels. More CLI-focused docs or tooling could help."
    else:
        tb_status, tb_interp = "🔴 POOR",  "Most discovery is happening via browser. CLI-first awareness is limited."

    if ratio_velocity >= 2.5:
        vl_status, vl_interp = "🟢 GREAT", "Users are actively spinning up multiple projects. Strong retention and reuse signal."
    elif ratio_velocity >= 1.5:
        vl_status, vl_interp = "🟢 GOOD",  "Some users are reusing across projects. Healthy early-stage signal."
    elif ratio_velocity >= 1.1:
        vl_status, vl_interp = "🟡 STEADY","Occasional reuse but mostly single-clone users. Still early."
    else:
        vl_status, vl_interp = "🔴 POOR",  "Users are cloning once and not returning. Likely still in exploration phase."

    if clones_avg_prev == 0:
        cw_status, cw_interp = "⚪ —", "No historical data available to compare against."
    elif clones_this_week >= clones_avg_prev * 1.5:
        cw_status, cw_interp = "🟢 GREAT", "Possible external mention, blog post, or viral effect this week."
    elif clones_this_week >= clones_avg_prev * 1.2:
        cw_status, cw_interp = "🟢 GOOD",  "Clone activity is clearly picking up vs historical average."
    elif clones_this_week >= clones_avg_prev * 0.5:
        cw_status, cw_interp = "🟡 STEADY","Consistent clone activity — within normal range of the historical weekly average."
    else:
        cw_status, cw_interp = "🔴 POOR",  "Well below the historical weekly average. Check if a recent change reduced interest."

    if pypi_pending or real_pypi_monthly_avg == 0:
        ac_status, ac_interp = "⚪ —", "No monthly baseline available to compare against."
    elif real_pypi_week >= real_pypi_monthly_avg * 1.5:
        ac_status, ac_interp = "🟢 GREAT", "This week is well above the monthly average. Strong momentum."
    elif real_pypi_week >= real_pypi_monthly_avg * 1.2:
        ac_status, ac_interp = "🟢 GOOD",  "This week is outpacing the monthly average. Positive trend."
    elif real_pypi_week >= real_pypi_monthly_avg * 0.5:
        ac_status, ac_interp = "🟡 STEADY","Install rate is within normal range of the monthly average."
    else:
        ac_status, ac_interp = "🔴 POOR",  "Well below the monthly average. Check if recent changes affected installs."

    if open_issues == 0:
        is_status, is_interp = "🔴 POOR",  "No public engagement yet, or issues are being handled privately."
    elif open_issues <= 3:
        is_status, is_interp = "🟡 STEADY","First adopters are filing issues. Good sign that real usage is happening."
    elif open_issues <= 10:
        is_status, is_interp = "🟢 GOOD",  "Engaged user base. Prioritize response time to build trust."
    else:
        is_status, is_interp = "🟡 STEADY","Strong community engagement. Consider a triage or labeling process."

    # ══════════════════════════════════════════════════════════════════════════
    # DISPLAY: ADOPTION KPIs
    # ══════════════════════════════════════════════════════════════════════════
    print("══════════════════════════════════════════════════════════════════════════")
    print("📊  ADOPTION KPIs  —  VeloIQ Framework")
    print("══════════════════════════════════════════════════════════════════════════")

    print(f"\n  ── ACTIVATION ─────────────────────────────────────────────────────────")
    kpi_block("🔄", "Clone → PyPI Conversion",
        f"{clone_pypi_conv}%",
        cv_status, cv_interp,
        "Clean PyPI installs (7d) ÷ unique GitHub cloners (14d) — percentage of cloners adopting package.")
    kpi_block("⚡", "Terminal / Browser Ratio",
        ratio_terminal,
        tb_status, tb_interp,
        "Unique cloners ÷ unique browser visitors — >1 means more people clone from CLI than visit via browser.")
    kpi_block("⚙️ ", "Velocity Multiplier",
        f"{ratio_velocity} clones/user",
        vl_status, vl_interp,
        "Total clones ÷ unique cloners — values above 1 mean users are cloning more than once.")

    print(f"\n  ── GROWTH VELOCITY ────────────────────────────────────────────────────")
    kpi_block("📊", "Clone WoW Growth",
        f"{clone_wow_str}  (avg prev: {clones_avg_prev} → this wk: {clones_this_week} clones)",
        cw_status, cw_interp,
        "This week's clone volume vs. average weekly clones from prior weeks.")
    kpi_block("📦", "PyPI WoW Growth",
        f"{pypi_wow_str}  (avg prev: {clean_pypi_avg_prev} → this wk: {real_pypi_week} installs)",
        pw_status, pw_interp,
        "This week's clean pip installs vs. average weekly clean installs from prior weeks.")
    kpi_block("⚡", "PyPI Acceleration",
        f"{pypi_accel_str}  (this wk: {real_pypi_week} | monthly avg: {real_pypi_monthly_avg}/wk)",
        ac_status, ac_interp,
        "This week's clean installs relative to monthly weekly average.")

    print(f"\n  ── ENGAGEMENT ─────────────────────────────────────────────────────────")
    kpi_block("⭐", "Forks / Stars Ratio",
        forks_stars_ratio,
        fs_status, fs_interp,
        "Forks ÷ Stars — stars signal passive discovery; forks signal intent to contribute to source code.")
    kpi_block("🐛", "Open Issues",
        open_issues,
        is_status, is_interp,
        "Count of open GitHub issues — indicates community feedback loop.")

    print("\n══════════════════════════════════════════════════════════════════════════\n")

    # ══════════════════════════════════════════════════════════════════════════
    # INCREMENTAL CSV LOGGING
    # ══════════════════════════════════════════════════════════════════════════
    history = {}
    for c in clones_data.get("clones", []):
        d = c["timestamp"].split("T")[0]
        history[d] = {"clones": c["count"], "unique_cloners": c["uniques"], "views": 0, "unique_visitors": 0}
    for v in views_data.get("views", []):
        d = v["timestamp"].split("T")[0]
        if d in history:
            history[d]["views"] = v["count"]
            history[d]["unique_visitors"] = v["uniques"]
        else:
            history[d] = {"clones": 0, "unique_cloners": 0, "views": v["count"], "unique_visitors": v["uniques"]}

    file_exists = os.path.exists(OUTPUT_FILE)
    rows_added = 0

    with open(OUTPUT_FILE, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(CSV_HEADER)
        for d in sorted(history.keys()):
            if d not in existing_dates:
                row = history[d]
                ratio = round(row["unique_cloners"] / row["unique_visitors"], 2) if row["unique_visitors"] > 0 else 0
                writer.writerow([
                    d,
                    row["views"], row["unique_visitors"],
                    row["clones"], row["unique_cloners"],
                    ratio,
                    pypi_day, pypi_week, pypi_month,
                    stars, forks, open_issues
                ])
                rows_added += 1

    print(f"💾 CSV updated: {rows_added} new rows written to '{OUTPUT_FILE}'.")

    if args.json_out:
        snapshot = {
            "product": "veloiq",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "repo": f"{REPO_OWNER}/{REPO_NAME}",
            "pypi_package": PYPI_PACKAGE,
            "github": {
                "stars": stars,
                "forks": forks,
                "open_issues": open_issues,
                "views_14d": tot_views,
                "unique_visitors_14d": uni_views,
                "clones_14d": tot_clones,
                "unique_cloners_14d": uni_clones,
                "clones_this_week": clones_this_week,
                "clones_avg_prev_week": clones_avg_prev,
            },
            "pypi": {
                "downloads_day": pypi_day,
                "downloads_week": pypi_week,
                "downloads_month": pypi_month,
                "real_installs_week": real_pypi_week,
                "real_installs_source": "bigquery" if bq_real_installs_7d is not None else "filtered_estimate",
                "pending_index": pypi_pending,
                "from_cache": pypi_from_cache,
            },
            "kpis": {
                "clone_to_pypi_conversion_pct": clone_pypi_conv,
                "terminal_browser_ratio": ratio_terminal,
                "velocity_multiplier": ratio_velocity,
                "forks_stars_ratio": forks_stars_ratio,
                "clone_wow_growth": clone_wow_str,
                "pypi_wow_growth": pypi_wow_str,
                "pypi_acceleration": pypi_accel_str,
            },
        }
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, indent=2)
        print(f"📄 JSON snapshot written to '{args.json_out}'.")

if __name__ == "__main__":
    main()