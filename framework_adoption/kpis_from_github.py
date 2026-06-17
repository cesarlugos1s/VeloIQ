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

    # Split 14-day clone window into two 7-day halves for WoW
    today = date.today()
    seven_days_ago = today - timedelta(days=7)
    clones_this_week = sum(
        c["count"] for c in clones_data.get("clones", [])
        if date.fromisoformat(c["timestamp"].split("T")[0]) >= seven_days_ago
    )
    clones_prev_week = sum(
        c["count"] for c in clones_data.get("clones", [])
        if date.fromisoformat(c["timestamp"].split("T")[0]) < seven_days_ago
    )

    # Estimated previous week PyPI: (last_month - last_week) spread over 23 days → 7-day equivalent
    remaining_days = pypi_month - pypi_week
    pypi_prev_week_est = round(remaining_days / 23 * 7) if pypi_month > pypi_week else 0

    # ── Computed KPIs ─────────────────────────────────────────────────────────
    ratio_terminal    = round(uni_clones / uni_views, 2)       if uni_views  > 0 else 0
    ratio_velocity    = round(tot_clones / uni_clones, 2)      if uni_clones > 0 else 0
    forks_stars_ratio = round(forks / stars, 2)                if stars      > 0 else 0
    clone_pypi_conv   = round(pypi_week / uni_clones * 100, 1) if uni_clones > 0 else 0
    pypi_monthly_avg  = round(pypi_month / 4, 1)               if pypi_month > 0 else 0
    pypi_accel        = round((pypi_week - pypi_monthly_avg) / pypi_monthly_avg * 100, 1) if pypi_monthly_avg > 0 else 0
    clone_wow_str     = pct_change(clones_this_week, clones_prev_week)
    pypi_wow_str      = pct_change(pypi_week, pypi_prev_week_est)

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
    print(f"  GitHub › Clones Previous Week      : {clones_prev_week}")
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

    if clones_prev_week == 0:
        cw_status, cw_interp = "⚪ —", "No prior week data in the 14-day window to compare against."
    elif clones_this_week >= clones_prev_week * 1.5:
        cw_status, cw_interp = "🟢 GREAT", "Possible external mention, blog post, or viral effect this week."
    elif clones_this_week >= clones_prev_week * 1.2:
        cw_status, cw_interp = "🟢 GOOD",  "Clone activity is clearly picking up week over week."
    elif clones_this_week >= clones_prev_week * 0.8:
        cw_status, cw_interp = "🟡 STEADY","Consistent clone activity with no significant spike or drop."
    else:
        cw_status, cw_interp = "🔴 POOR",  "Fewer clones this week than last. Check if a recent change reduced interest."

    if pypi_prev_week_est == 0:
        pw_status, pw_interp = "⚪ —", "No prior week estimate available (monthly data too low to extrapolate)."
    elif pypi_week >= pypi_prev_week_est * 1.5:
        pw_status, pw_interp = "🟢 GREAT", "Install activity is spiking. More teams are adopting the package."
    elif pypi_week >= pypi_prev_week_est * 1.2:
        pw_status, pw_interp = "🟢 GOOD",  "Pip installs are meaningfully up week over week."
    elif pypi_week >= pypi_prev_week_est * 0.8:
        pw_status, pw_interp = "🟡 STEADY","Consistent install activity with no significant change."
    else:
        pw_status, pw_interp = "🔴 POOR",  "Fewer pip installs this week than the prior estimated week."

    accel_sign = "+" if pypi_accel >= 0 else ""
    if pypi_monthly_avg == 0:
        ac_status, ac_interp = "⚪ —", "No monthly baseline available to compare against."
    elif pypi_accel >= 20:
        ac_status, ac_interp = "🟢 GREAT", "This week is well above the monthly average. Strong momentum."
    elif pypi_accel >= 5:
        ac_status, ac_interp = "🟢 GOOD",  "This week is outpacing the monthly average. Positive trend."
    elif pypi_accel >= -10:
        ac_status, ac_interp = "🟡 STEADY","Install rate is roughly in line with the monthly average."
    elif pypi_accel >= -50:
        ac_status, ac_interp = "🔴 POOR",  "This week is meaningfully below the monthly average."
    else:
        ac_status, ac_interp = "🔴 POOR",  "Installs are well below the monthly average. Could be a seasonal dip or a drop-off."

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
        f"{clone_wow_str}  ({clones_prev_week} → {clones_this_week} clones)",
        cw_status, cw_interp,
        "Clone volume last 7 days vs. the 7 days before — both from GitHub's 14-day traffic window.")
    kpi_block("📦", "PyPI WoW Growth (est.)",
        f"{pypi_wow_str}  ({pypi_prev_week_est} → {pypi_week} installs)",
        pw_status, pw_interp,
        "Last week's pip installs vs. estimated prior week: (last_month − last_week) ÷ 23 × 7.")
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
    existing_dates = set()
    if file_exists:
        with open(OUTPUT_FILE, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            for row in reader:
                if row:
                    existing_dates.add(row[0])

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
