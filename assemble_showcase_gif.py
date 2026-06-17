#!/usr/bin/env python3
"""Stitch the Studio-flow frames + reused running-app screenshots into one GIF.

Studio frames come from website/showcase-assets/demo-gif/frames/ (captured by
take_showcase_gif_frames.py). The "running app with data" tail reuses the
already-curated website/showcase-assets/*.png images instead of recapturing —
they're already cropped to a consistent 1600x952 canvas for the website.

Each frame gets a caption banner overlaid at the top explaining what's
happening, so the GIF reads on its own without narration.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
FRAMES = ROOT / "website/showcase-assets/demo-gif/frames"
ASSETS = ROOT / "website/showcase-assets"
OUT = ROOT / "website/showcase-assets/demo-gif/build-an-app.gif"

CANVAS = (1600, 952)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"
BANNER_HEIGHT = 56
BANNER_MARGIN = 320  # keep clear of the Studio sidebar badge / app toolbar corners
FONT = ImageFont.truetype(FONT_PATH, 24)

# Zoom crop regions — (x1, y1, x2, y2) in original PNG pixel space (3360×1960).
# Every box is sized to the CANVAS 1.68:1 ratio so PIL resize introduces no distortion.
# Unzoomed scale: 1600/3360 ≈ 0.48×.  Zoomed scale: ~1.7× magnification.
Z_LEFT   = (0,    0,   2016, 1200)  # Command Panel left column (Add Module, Dashboard, Search)
Z_RIGHT  = (1344, 0,   3360, 1200)  # Command Panel right column (Add Model)
Z_BUILD  = (1344, 270, 3360, 1470)  # Build Frontend card (right col, 2nd row) + terminal
Z_SCHEMA = (0,    0,   2240, 1333)  # Schema Browser — left ⅔ of page (field/relation forms)
Z_GRAPH  = (600,  0,   2616, 1200)  # Relation graph — centered on the node cluster

# (path, hold-duration-ms, caption[, zoom]).  zoom = one of the Z_* constants above,
# or omitted for full-frame shots.  Consecutive frames repeat the same caption on purpose.
SEQUENCE = [
    # ── Login / overview ─────────────────────────────────────────────────────
    (FRAMES / "001_login_empty.png",  600,  "Signing in to VeloIQ Studio"),
    (FRAMES / "003_login_filled.png", 600,  "Signing in to VeloIQ Studio"),
    (FRAMES / "005_summary.png",      2600, "Studio summary — a fresh, empty project"),
    (FRAMES / "007_command_panel.png", 800, "Command Panel — scaffolding commands"),

    # ── Add Module (left column) ──────────────────────────────────────────────
    (FRAMES / "008_add_module_projects_typed.png",   1100, "Creating the \"projects\" module", Z_LEFT),
    (FRAMES / "009_add_module_projects_running.png",  700, "Creating the \"projects\" module", Z_LEFT),
    (FRAMES / "010_add_module_projects_done.png",    1400, "Creating the \"projects\" module", Z_LEFT),
    (FRAMES / "012_add_module_tasks_typed.png",      1000, "Creating the \"tasks\" module",    Z_LEFT),
    (FRAMES / "013_add_module_tasks_running.png",     700, "Creating the \"tasks\" module",    Z_LEFT),
    (FRAMES / "014_add_module_tasks_done.png",       1300, "Creating the \"tasks\" module",    Z_LEFT),

    # ── Add Model (right column) ──────────────────────────────────────────────
    (FRAMES / "016_add_model_Project_name_typed.png",     1100, "Adding the Project model", Z_RIGHT),
    (FRAMES / "017_add_model_Project_module_selected.png", 1100, "Adding the Project model", Z_RIGHT),
    (FRAMES / "018_add_model_Project_running.png",         700, "Adding the Project model", Z_RIGHT),
    (FRAMES / "019_add_model_Project_done.png",           1400, "Adding the Project model", Z_RIGHT),
    (FRAMES / "021_add_model_Task_name_typed.png",        1000, "Adding the Task model",    Z_RIGHT),
    (FRAMES / "022_add_model_Task_module_selected.png",   1000, "Adding the Task model",    Z_RIGHT),
    (FRAMES / "023_add_model_Task_running.png",            700, "Adding the Task model",    Z_RIGHT),
    (FRAMES / "024_add_model_Task_done.png",              1300, "Adding the Task model",    Z_RIGHT),

    # ── Schema Browser — fields & relations ──────────────────────────────────
    (FRAMES / "026_schema_project_fields.png",              1300, "Project model created — default fields",      Z_SCHEMA),
    (FRAMES / "028_add_field_project_status_typed.png",     1000, "Adding a \"status\" field to Project",        Z_SCHEMA),
    (FRAMES / "029_add_field_project_status_configured.png", 1300, "Adding a \"status\" field to Project",       Z_SCHEMA),
    (FRAMES / "030_add_field_project_status_running.png",    700, "Adding a \"status\" field to Project",        Z_SCHEMA),
    (FRAMES / "031_add_field_project_status_done.png",      1400, "Adding a \"status\" field to Project",        Z_SCHEMA),
    (FRAMES / "033_schema_task_fields.png",                 1100, "Task model created — default fields",         Z_SCHEMA),
    (FRAMES / "034_add_field_task_status_typed.png",         900, "Adding a \"status\" field to Task",           Z_SCHEMA),
    (FRAMES / "035_add_field_task_status_configured.png",   1200, "Adding a \"status\" field to Task",           Z_SCHEMA),
    (FRAMES / "036_add_field_task_status_running.png",       700, "Adding a \"status\" field to Task",           Z_SCHEMA),
    (FRAMES / "037_add_field_task_status_done.png",         1200, "Adding a \"status\" field to Task",           Z_SCHEMA),
    (FRAMES / "039_add_field_task_due_date_typed.png",       900, "Adding a \"due_date\" field to Task",         Z_SCHEMA),
    (FRAMES / "040_add_field_task_due_date_configured.png", 1100, "Adding a \"due_date\" field to Task",         Z_SCHEMA),
    (FRAMES / "042_add_field_task_due_date_done.png",       1300, "Adding a \"due_date\" field to Task",         Z_SCHEMA),
    (FRAMES / "044_add_relation_empty.png",                 1100, "Linking Task → Project (many-to-one)",        Z_SCHEMA),
    (FRAMES / "045_add_relation_configured.png",            1300, "Linking Task → Project (many-to-one)",        Z_SCHEMA),
    (FRAMES / "046_add_relation_running.png",                700, "Linking Task → Project (many-to-one)",        Z_SCHEMA),
    (FRAMES / "047_add_relation_done.png",                  1400, "Linking Task → Project (many-to-one)",        Z_SCHEMA),
    (FRAMES / "049_relation_graph.png",                     2200, "The relation graph: every Task belongs to a Project", Z_GRAPH),

    # ── Dashboard & Search ────────────────────────────────────────────────────
    (FRAMES / "052_dashboard_before.png",           600, "Adding Project & Task to the Dashboard", Z_LEFT),
    (FRAMES / "054_dashboard_add_project_done.png", 700, "Adding Project & Task to the Dashboard", Z_LEFT),
    (FRAMES / "057_dashboard_add_task_done.png",    700, "Adding Project & Task to the Dashboard", Z_LEFT),
    (FRAMES / "059_dashboard_after.png",           1100, "Adding Project & Task to the Dashboard", Z_LEFT),
    (FRAMES / "061_search_before.png",              600, "Adding Project & Task to Search",         Z_LEFT),
    (FRAMES / "063_search_add_Project_done.png",    600, "Adding Project & Task to Search",         Z_LEFT),
    (FRAMES / "066_search_add_Task_done.png",       600, "Adding Project & Task to Search",         Z_LEFT),
    (FRAMES / "068_search_after.png",               900, "Adding Project & Task to Search",         Z_LEFT),

    # ── Build Frontend (right column, 2nd row) ────────────────────────────────
    (FRAMES / "070_build_before.png",  600, "Building the frontend",          Z_BUILD),
    (FRAMES / "071_build_running.png", 600, "Building the frontend",          Z_BUILD),
    (FRAMES / "072_build_done.png",   1900, "Build complete — app served at /", Z_BUILD),

    # ── Running app with data — reused website showcase assets (already 1600×952) ──
    (ASSETS / "dashboard-light.png", 1500, "The running app — light theme"),
    (ASSETS / "dashboard-dark.png",  1500, "...and dark theme, out of the box"),
    (ASSETS / "view-table.png",      1500, "Task list, fully populated with data"),
    (ASSETS / "detail-relations.png", 1700, "Project detail — its related Tasks"),
    (ASSETS / "detail-master.png",   1700, "Task detail / edit form"),
]


def draw_caption(im: Image.Image, text: str) -> Image.Image:
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle([BANNER_MARGIN, 0, im.size[0] - BANNER_MARGIN, BANNER_HEIGHT], fill=(15, 23, 42, 215))
    bbox = draw.textbbox((0, 0), text, font=FONT)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (im.size[0] - text_w) / 2 - bbox[0]
    y = (BANNER_HEIGHT - text_h) / 2 - bbox[1]
    draw.text((x, y), text, font=FONT, fill=(255, 255, 255, 255))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")



def load_frame(path: Path, caption: str, zoom=None) -> Image.Image:
    im = Image.open(path).convert("RGB")
    if zoom:
        im = im.crop(zoom)
    if im.size != CANVAS:
        im = im.resize(CANVAS, Image.LANCZOS)
    im = draw_caption(im, caption)
    return im.quantize(colors=256, method=Image.MEDIANCUT)


def main():
    missing = [e[0] for e in SEQUENCE if not e[0].exists()]
    if missing:
        raise SystemExit("Missing frames:\n" + "\n".join(str(p) for p in missing))

    frames, durations = [], []
    for entry in SEQUENCE:
        path, dur, caption = entry[0], entry[1], entry[2]
        zoom = entry[3] if len(entry) > 3 else None
        frames.append(load_frame(path, caption, zoom))
        durations.append(dur)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=True,
    )
    total_s = sum(durations) / 1000
    print(f"Wrote {OUT} — {len(frames)} frames, ~{total_s:.1f}s, {OUT.stat().st_size/1_048_576:.1f} MB")


if __name__ == "__main__":
    main()
