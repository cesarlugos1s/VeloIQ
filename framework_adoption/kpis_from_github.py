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
    req = urllib.request.Request(url, headers=headers or {})
    for i in range(retries):
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                # Don't retry rate limits — caller will use cache instead
                print(f"⚠️  PyPI rate limited (429). Will use cached values.")
                return None
            else:
                print(f"❌ HTTP Error fetching {url}: {e.code} - {e.reason}")
                return None
        except Exception as e:
            print(f"❌ Error fetching {url}: {e}")
            return None
    return None

def load_pypi_cache():
    if os.path.exists(PYPI_CACHE_FILE):
        with open(PYPI_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def save_pypi_cache(data):
    payload = {
        "cached_at": datetime.utcnow().isoformat(),
        "data": data
    }
    with open(PYPI_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f)

def pct_change(current, previous):
    if previous == 0:
        return "N/A"
    sign = "+" if current >= previous else ""
    return f"{sign}{round((current - previous) / previous * 100, 1):.1f}%"

def trend_icon(current, previous):
    return "📈" if current >= previous else "📉"

def load_csv_history(filepath):
    """Read the CSV history once and return structured data for all consumers.

    Returns a dict with:
      - existing_dates : set[str]          – dates already recorded (for dedup)
      - dates_ordered  : list[str]          – dates in row order (for week grouping)
      - clone_daily    : list[int]          – daily Total_Clones values
      - pypi_daily     : list[int]          – daily PyPI_Day values
    Returns None when the file does not exist.
    """
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
    """Compute the average weekly value, replacing outlier weeks with the
    mean of the non-outlier weeks.

    Groups daily values into ISO weeks, sums each week, then detects outlier
    weeks (abnormally high totals).  Detection adapts to sample size:

      • n ≥ 10 weeks  →  IQR method:  weeks > Q3 + 1.5×IQR are outliers
      • n < 10 weeks  →  Z‑score:     weeks > μ + 0.5σ are outliers

    Outlier weeks are replaced with the average of the non-outlier weeks so
    they still contribute but don't distort the average. If every week is an
    outlier, no replacement is performed (plain average is returned).

    Returns (average_weekly_value, outlier_weeks_count, total_weeks).
    Falls back to a simple average when fewer than 3 weeks of data exist.
    """
    if len(dates) < 14:          # fewer than 2 weeks of daily data
        avg_daily = sum(daily_values) / len(daily_values) if daily_values else 0
        return round(avg_daily * 7), 0, 0

    # Group daily values by ISO week
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

    # ── Outlier detection ──────────────────────────────────────────────────
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
    # ────────────────────────────────────────────────────────────────────────

    # Split into outliers and non-outliers
    outlier_totals = []
    non_outlier_totals = []
    for key, total in weeks.items():
        if total > upper_bound:
            outlier_totals.append(total)
        else:
            non_outlier_totals.append(total)

    outlier_count = len(outlier_totals)
    if outlier_count == 0 or outlier_count == total_weeks:
        # Nothing to replace, or everything is an outlier → plain average
        avg_weekly = round(sum(weekly_sums) / total_weeks)
    else:
        replacement = round(sum(non_outlier_totals) / len(non_outlier_totals))
        adjusted = non_outlier_totals + [replacement] * outlier_count
        avg_weekly = round(sum(adjusted) / total_weeks)

    return avg_weekly, outlier_count, total_weeks


def main():
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
    pypi_data   = fetch_json(f"https://pypistats.org/api/packages/{PYPI_PACKAGE.lower()}/recent", pypi_headers)

    pypi_from_cache = False
    if pypi_data:
        save_pypi_cache(pypi_data)
    else:
        cached = load_pypi_cache()
        if cached:
            pypi_data = cached["data"]
            pypi_from_cache = True
            print(f"⚠️  Using cached PyPI data from {cached['cached_at']} UTC.\n")
        else:
            print("⚠️  PyPI data unavailable and no cache found. PyPI columns will show 0.\n")

    if not clones_data or not views_data:
        print("❌ Could not recover GitHub traffic metrics. Script execution halted.")
        return

    # ── Raw values ────────────────────────────────────────────────────────────
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

    # Split 14-day clone window: this week (last 7 days)
    today = date.today()
    seven_days_ago = today - timedelta(days=7)
    clones_this_week = sum(
        c["count"] for c in clones_data.get("clones", [])
        if date.fromisoformat(c["timestamp"].split("T")[0]) >= seven_days_ago
    )

    # ── Historical averages from CSV (all previous weeks) ────────────────────────
    # Load CSV history once to compute the average of all prior weeks, which gives a
    # fairer baseline than comparing against a single prior week.
    csv_history   = load_csv_history(OUTPUT_FILE)
    existing_dates = csv_history["existing_dates"] if csv_history else set()

    clones_avg_prev = 0
    pypi_avg_prev   = 0
    clone_outliers = pypi_outliers = clone_total_wks = pypi_total_wks = 0

    if csv_history and csv_history["clone_daily"]:
        clones_avg_prev, clone_outliers, clone_total_wks = weekly_avg_excluding_outliers(
            csv_history["dates_ordered"], csv_history["clone_daily"])
    if csv_history and csv_history["pypi_daily"]:
        pypi_avg_prev, pypi_outliers, pypi_total_wks = weekly_avg_excluding_outliers(
            csv_history["dates_ordered"], csv_history["pypi_daily"])

    # Fallback: if no CSV history exists, use the prior 7 days from the 14-day window
    if clones_avg_prev == 0:
        clones_avg_prev = sum(
            c["count"] for c in clones_data.get("clones", [])
            if date.fromisoformat(c["timestamp"].split("T")[0]) < seven_days_ago
        )

    # ── Computed KPIs ─────────────────────────────────────────────────────────
    ratio_terminal    = round(uni_clones / uni_views, 2)       if uni_views  > 0 else 0
    ratio_velocity    = round(tot_clones / uni_clones, 2)      if uni_clones > 0 else 0
    forks_stars_ratio = round(forks / stars, 2)                if stars      > 0 else 0
    clone_pypi_conv   = round(pypi_week / uni_clones * 100, 1) if uni_clones > 0 else 0
    pypi_monthly_avg  = round(pypi_month / 4, 1)               if pypi_month > 0 else 0
    pypi_accel        = round((pypi_week - pypi_monthly_avg) / pypi_monthly_avg * 100, 1) if pypi_monthly_avg > 0 else 0
    clone_wow_str     = pct_change(clones_this_week, clones_avg_prev)
    pypi_wow_str      = pct_change(pypi_week, pypi_avg_prev)

    # ══════════════════════════════════════════════════════════════════════════
    # RAW DATA
    # ══════════════════════════════════════════════════════════════════════════
    print("══════════════════════════════════════════════════════════════════════════")
    print("📥  RAW DATA  —  CURRENT SNAPSHOT")
    print("══════════════════════════════════════════════════════════════════════════")
    print(f"  GitHub › Total Views (14d)         : {tot_views}")
    print(f"  GitHub › Unique Visitors (14d)     : {uni_views}")
    print(f"  GitHub › Total Clones (14d)        : {tot_clones}")
    print(f"  GitHub › Unique Cloners (14d)      : {uni_clones}")
    print(f"  GitHub › Clones This Week          : {clones_this_week}")
    clone_avg_label = f"Clones Avg Prior Weeks (outliers replaced)"
    print(f"  GitHub › {clone_avg_label:<39}: {clones_avg_prev}  (from {clone_total_wks} prior weeks, {clone_outliers} outlier{'s' if clone_outliers != 1 else ''} replaced with non-outlier mean)" if clone_total_wks else f"  GitHub › Clones Avg Previous Weeks    : {clones_avg_prev}")
    print(f"  GitHub › Stars                     : {stars}")
    print(f"  GitHub › Forks                     : {forks}")
    print(f"  GitHub › Open Issues               : {open_issues}")
    print(f"  ──────────────────────────────────────────────────────────────────────")
    pypi_label = " (cached)" if pypi_from_cache else ""
    print(f"  PyPI   › Downloads Today{pypi_label:<15}: {pypi_day}")
    print(f"  PyPI   › Downloads Last Week{pypi_label:<11}: {pypi_week}")
    print(f"  PyPI   › Downloads Last Month{pypi_label:<10}: {pypi_month}")
    print("══════════════════════════════════════════════════════════════════════════\n")

    # ── Classifications (status label + interpretation) ───────────────────────
    def kpi_block(icon, title, value, status, interpretation, explanation):
        print(f"\n  {icon}  {title}")
        print(f"      ▸ {value}")
        print(f"      {status}  {interpretation}")
        print(f"      ↳ {explanation}")

    if forks_stars_ratio >= 0.3:
        fs_status, fs_interp = "🟢 GREAT", "Strong contributor community — many people are forking to contribute or customize the framework."
    elif forks_stars_ratio >= 0.15:
        fs_status, fs_interp = "🟢 GOOD",  "Growing contributor interest. Make it easier to submit PRs and contributions to increase forks."
    elif forks_stars_ratio >= 0.05:
        fs_status, fs_interp = "🟡 STEADY","Few people are engaging by contributing to the source code directly."
    else:
        fs_status, fs_interp = "🔴 POOR",  "Almost no contributor engagement. Focus on lowering the barrier to contribute."

    if clone_pypi_conv >= 40:
        cv_status, cv_interp = "🟢 GREAT", "Most cloners are converting to pip installs. Minimal friction in the install path."
    elif clone_pypi_conv >= 15:
        cv_status, cv_interp = "🟢 GOOD",  "Solid conversion but room to improve. Sharpen the quickstart guide."
    elif clone_pypi_conv >= 5:
        cv_status, cv_interp = "🟡 STEADY","Typical for early-stage frameworks. Many cloners explore without installing."
    else:
        cv_status, cv_interp = "🔴 POOR",  "Most cloners are not installing via pip. Review install documentation and onboarding."

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
        cw_status, cw_interp = "⚪ —", "No historical data available to compare against (first run?)."
    elif clones_this_week >= clones_avg_prev * 1.5:
        cw_status, cw_interp = "🟢 GREAT", "Possible external mention, blog post, or viral effect this week."
    elif clones_this_week >= clones_avg_prev * 1.2:
        cw_status, cw_interp = "🟢 GOOD",  "Clone activity is clearly picking up vs historical average."
    elif clones_this_week >= clones_avg_prev * 0.5:
        cw_status, cw_interp = "🟡 STEADY","Consistent clone activity — within normal range of the historical weekly average."
    else:
        cw_status, cw_interp = "🔴 POOR",  "Well below the historical weekly average. Check if a recent change reduced interest."

    if pypi_avg_prev == 0:
        pw_status, pw_interp = "⚪ —", "No historical PyPI data available to compare against (first run?)."
    elif pypi_week >= pypi_avg_prev * 1.5:
        pw_status, pw_interp = "🟢 GREAT", "Install activity is spiking. More teams are adopting the package."
    elif pypi_week >= pypi_avg_prev * 1.2:
        pw_status, pw_interp = "🟢 GOOD",  "Pip installs are meaningfully up vs historical average."
    elif pypi_week >= pypi_avg_prev * 0.5:
        pw_status, pw_interp = "🟡 STEADY","Consistent install activity — within normal range of the historical weekly average."
    else:
        pw_status, pw_interp = "🔴 POOR",  "Well below the historical weekly average. Check if recent changes affected installs."

    accel_sign = "+" if pypi_accel >= 0 else ""
    if pypi_monthly_avg == 0:
        ac_status, ac_interp = "⚪ —", "No monthly baseline available to compare against."
    elif pypi_accel >= 50:
        ac_status, ac_interp = "🟢 GREAT", "This week is well above the monthly average. Strong momentum."
    elif pypi_accel >= 20:
        ac_status, ac_interp = "🟢 GOOD",  "This week is outpacing the monthly average. Positive trend."
    elif pypi_accel >= -50:
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
    # KPIs
    # ══════════════════════════════════════════════════════════════════════════
    print("══════════════════════════════════════════════════════════════════════════")
    print("📊  ADOPTION KPIs  —  VeloIQ Framework")
    print("══════════════════════════════════════════════════════════════════════════")

    print(f"\n  ── ACTIVATION ─────────────────────────────────────────────────────────")
    kpi_block("🔄", "Clone → PyPI Conversion",
        f"{clone_pypi_conv}%",
        cv_status, cv_interp,
        "PyPI downloads (7d) ÷ unique GitHub cloners (14d) — how many repo visitors actually installed the package.")
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
        "This week's clone volume vs. the average weekly clones from all prior weeks (high-outlier weeks replaced with non-outlier mean).")
    kpi_block("📦", "PyPI WoW Growth",
        f"{pypi_wow_str}  (avg prev: {pypi_avg_prev} → this wk: {pypi_week} installs)",
        pw_status, pw_interp,
        "This week's pip installs vs. the average weekly installs from all prior weeks (high-outlier weeks replaced with non-outlier mean).")
    kpi_block("⚡", "PyPI Acceleration",
        f"{accel_sign}{pypi_accel}%  (this wk: {pypi_week} | monthly avg: {pypi_monthly_avg}/wk)",
        ac_status, ac_interp,
        "% above/below the monthly weekly average (last_month ÷ 4). Bounded between -100% and +∞.")

    print(f"\n  ── ENGAGEMENT ─────────────────────────────────────────────────────────")
    kpi_block("⭐", "Forks / Stars Ratio",
        forks_stars_ratio,
        fs_status, fs_interp,
        "Forks ÷ Stars — stars signal passive discovery; forks signal intent to contribute to or extend the framework's source code.")
    kpi_block("🐛", "Open Issues",
        open_issues,
        is_status, is_interp,
        "Count of open GitHub issues — users only file issues when invested enough to engage.")

    print("\n══════════════════════════════════════════════════════════════════════════\n")

    # ══════════════════════════════════════════════════════════════════════════
    # Incremental CSV
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
    # existing_dates already populated by load_csv_history() above — reuse it

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

if __name__ == "__main__":
    main()
