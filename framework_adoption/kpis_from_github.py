import os
import csv
import json
import urllib.request
from datetime import datetime

# === CONFIGURACIÓN ===
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "TU_TOKEN_DE_GITHUB_AQUÍ")
REPO_OWNER = "cesarlugos1s"
REPO_NAME = "veloiq"
OUTPUT_FILE = "veloiq_traffic_history.csv"

def fetch_github_traffic(endpoint):
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/traffic/{endpoint}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"❌ Error al conectar con el endpoint '{endpoint}': {e}")
        return None

def main():
    if "AQUÍ" in GITHUB_TOKEN or not GITHUB_TOKEN:
        print("❌ Error: Necesitas configurar tu GITHUB_TOKEN para acceder a las estadísticas de tráfico.")
        return

    print(f"🚀 Obteniendo estadísticas de tráfico para {REPO_OWNER}/{REPO_NAME}...\n")

    clones_data = fetch_github_traffic("clones")
    views_data = fetch_github_traffic("views")

    if not clones_data or not views_data:
        return

    # -------------------------------------------------------------
    # 📊 SECCIÓN: IMPRESIÓN DE DE EXPLICACIÓN DE KPIS EN LA TERMINAL
    # -------------------------------------------------------------
    tot_views = views_data.get("count", 0)
    uni_views = views_data.get("uniques", 0)
    tot_clones = clones_data.get("count", 0)
    uni_clones = clones_data.get("uniques", 0)

    ratio_terminal = round(uni_clones / uni_views, 2) if uni_views > 0 else 0
    ratio_velocidad = round(tot_clones / uni_clones, 2) if uni_clones > 0 else 0

    print("==========================================================================")
    print("📊 REPORTE DE KPIS - ÚLTIMOS 14 DÍAS (Métricas de Adopción de VeloIQ)")
    print("==========================================================================")

    print(f"👁️  Vistas Totales: {tot_views}")
    print("   ↳ PROPÓSITO: Mide el alcance general y el tráfico superficial que llega al repositorio web.")
    print("--------------------------------------------------------------------------")

    print(f"👤 Visitantes Únicos: {uni_views}")
    print("   ↳ PROPÓSITO: Mide cuántos desarrolladores reales entraron a ver tu repo desde un navegador.")
    print("--------------------------------------------------------------------------")

    print(f"📦 Clones Totales: {tot_clones}")
    print("   ↳ PROPÓSITO: Volumen bruto de descargas. Si es alto, indica actividad intensa o scripts automatizados.")
    print("--------------------------------------------------------------------------")

    print(f"🚀 Clonadores Únicos: {uni_clones}")
    print("   ↳ PROPÓSITO: ¡Tu KPI Estrella (North Star)! Mide cuántos humanos reales instalaron el framework.")
    print("--------------------------------------------------------------------------")

    print(f"⚡ Ratio Terminal/Browser: {ratio_terminal}")
    print("   ↳ PROPÓSITO: Si es > 1, significa que los devs clonan directo desde la CLI gracias a tus guías externas.")
    print("--------------------------------------------------------------------------")

    print(f"⚙️  Multiplicador de Velocidad: {ratio_velocidad} clones/usuario")
    print("   ↳ PROPÓSITO: Mide la retención operativa. Si es alto, tus usuarios están creando múltiples entornos/proyectos.")
    print("==========================================================================\n")

    # Mapear datos por fecha para combinarlos e indexar el archivo CSV
    history = {}

    for c in clones_data.get("clones", []):
        date = c["timestamp"].split("T")[0]
        history[date] = {"clones": c["count"], "unique_cloners": c["uniques"], "views": 0, "unique_visitors": 0}

    for v in views_data.get("views", []):
        date = v["timestamp"].split("T")[0]
        if date in history:
            history[date]["views"] = v["count"]
            history[date]["unique_visitors"] = v["uniques"]
        else:
            history[date] = {"clones": 0, "unique_cloners": 0, "views": v["count"], "unique_visitors": v["uniques"]}

    # Guardar en CSV de manera incremental
    file_exists = os.path.exists(OUTPUT_FILE)
    existing_dates = set()

    if file_exists:
        with open(OUTPUT_FILE, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            for row in reader:
                if row: existing_dates.add(row[0])

    rows_added = 0
    with open(OUTPUT_FILE, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["Fecha", "Vistas Totales", "Visitantes Únicos", "Clones Totales", "Clonadores Únicos", "Ratio Terminal/Browser"])

        for date in sorted(history.keys()):
            if date not in existing_dates:
                d = history[date]
                ratio = round(d["unique_cloners"] / d["unique_visitors"], 2) if d["unique_visitors"] > 0 else 0
                writer.writerow([date, d["views"], d["unique_visitors"], d["clones"], d["unique_cloners"], ratio])
                rows_added += 1

    print(f"💾 Guardado incremental terminado. Se añadieron {rows_added} líneas nuevas a '{OUTPUT_FILE}'.")

if __name__ == "__main__":
    main()