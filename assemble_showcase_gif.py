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

# (path, hold-duration-ms, caption). Studio portion is a curated subset of the
# captured frames (not every duplicate "hold" file) so we control pacing
# explicitly. Consecutive frames repeat the same caption on purpose.
SEQUENCE = [
    (FRAMES / "001_login_empty.png", 600, "Signing in to VeloIQ Studio"),
    (FRAMES / "003_login_filled.png", 600, "Signing in to VeloIQ Studio"),
    (FRAMES / "005_summary.png", 2600, "Studio summary — a fresh, empty project"),
    (FRAMES / "007_command_panel.png", 800, "Command Panel — scaffolding commands"),

    (FRAMES / "008_add_module_projects_typed.png", 1100, "Creating the \"projects\" module"),
    (FRAMES / "009_add_module_projects_running.png", 700, "Creating the \"projects\" module"),
    (FRAMES / "010_add_module_projects_done.png", 1400, "Creating the \"projects\" module"),
    (FRAMES / "012_add_module_tasks_typed.png", 1000, "Creating the \"tasks\" module"),
    (FRAMES / "013_add_module_tasks_running.png", 700, "Creating the \"tasks\" module"),
    (FRAMES / "014_add_module_tasks_done.png", 1300, "Creating the \"tasks\" module"),

    (FRAMES / "016_add_model_Project_name_typed.png", 1100, "Adding the Project model"),
    (FRAMES / "017_add_model_Project_module_selected.png", 1100, "Adding the Project model"),
    (FRAMES / "018_add_model_Project_running.png", 700, "Adding the Project model"),
    (FRAMES / "019_add_model_Project_done.png", 1400, "Adding the Project model"),
    (FRAMES / "021_add_model_Task_name_typed.png", 1000, "Adding the Task model"),
    (FRAMES / "022_add_model_Task_module_selected.png", 1000, "Adding the Task model"),
    (FRAMES / "023_add_model_Task_running.png", 700, "Adding the Task model"),
    (FRAMES / "024_add_model_Task_done.png", 1300, "Adding the Task model"),

    (FRAMES / "026_schema_project_fields.png", 1300, "Project model created — default fields"),
    (FRAMES / "028_add_field_project_status_typed.png", 1000, "Adding a \"status\" field to Project"),
    (FRAMES / "029_add_field_project_status_configured.png", 1300, "Adding a \"status\" field to Project"),
    (FRAMES / "030_add_field_project_status_running.png", 700, "Adding a \"status\" field to Project"),
    (FRAMES / "031_add_field_project_status_done.png", 1400, "Adding a \"status\" field to Project"),
    (FRAMES / "033_schema_task_fields.png", 1100, "Task model created — default fields"),
    (FRAMES / "034_add_field_task_status_typed.png", 900, "Adding a \"status\" field to Task"),
    (FRAMES / "035_add_field_task_status_configured.png", 1200, "Adding a \"status\" field to Task"),
    (FRAMES / "036_add_field_task_status_running.png", 700, "Adding a \"status\" field to Task"),
    (FRAMES / "037_add_field_task_status_done.png", 1200, "Adding a \"status\" field to Task"),
    (FRAMES / "039_add_field_task_due_date_typed.png", 900, "Adding a \"due_date\" field to Task"),
    (FRAMES / "040_add_field_task_due_date_configured.png", 1100, "Adding a \"due_date\" field to Task"),
    (FRAMES / "042_add_field_task_due_date_done.png", 1300, "Adding a \"due_date\" field to Task"),

    (FRAMES / "044_add_relation_empty.png", 1100, "Linking Task → Project (many-to-one)"),
    (FRAMES / "045_add_relation_configured.png", 1300, "Linking Task → Project (many-to-one)"),
    (FRAMES / "046_add_relation_running.png", 700, "Linking Task → Project (many-to-one)"),
    (FRAMES / "047_add_relation_done.png", 1400, "Linking Task → Project (many-to-one)"),
    (FRAMES / "049_relation_graph.png", 2200, "The relation graph: every Task belongs to a Project"),

    (FRAMES / "052_dashboard_before.png", 600, "Adding Project & Task to the Dashboard"),
    (FRAMES / "054_dashboard_add_project_done.png", 700, "Adding Project & Task to the Dashboard"),
    (FRAMES / "057_dashboard_add_task_done.png", 700, "Adding Project & Task to the Dashboard"),
    (FRAMES / "059_dashboard_after.png", 1100, "Adding Project & Task to the Dashboard"),

    (FRAMES / "061_search_before.png", 600, "Adding Project & Task to Search"),
    (FRAMES / "063_search_add_Project_done.png", 600, "Adding Project & Task to Search"),
    (FRAMES / "066_search_add_Task_done.png", 600, "Adding Project & Task to Search"),
    (FRAMES / "068_search_after.png", 900, "Adding Project & Task to Search"),

    (FRAMES / "070_build_before.png", 600, "Building the frontend"),
    (FRAMES / "071_build_running.png", 600, "Building the frontend"),
    (FRAMES / "072_build_done.png", 1900, "Build complete — app served at /"),

    # ── Running app with data — reused website showcase assets ──────────────
    (ASSETS / "dashboard-light.png", 1500, "The running app — light theme"),
    (ASSETS / "dashboard-dark.png", 1500, "...and dark theme, out of the box"),
    (ASSETS / "view-table.png", 1500, "Task list, fully populated with data"),
    (ASSETS / "detail-relations.png", 1700, "Project detail — its related Tasks"),
    (ASSETS / "detail-master.png", 1700, "Task detail / edit form"),
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


def load_frame(path: Path, caption: str) -> Image.Image:
    im = Image.open(path).convert("RGB")
    if im.size != CANVAS:
        im = im.resize(CANVAS, Image.LANCZOS)
    im = draw_caption(im, caption)
    return im.quantize(colors=256, method=Image.MEDIANCUT)


def main():
    missing = [p for p, _, _ in SEQUENCE if not p.exists()]
    if missing:
        raise SystemExit("Missing frames:\n" + "\n".join(str(p) for p in missing))

    frames = [load_frame(p, caption) for p, _, caption in SEQUENCE]
    durations = [d for _, d, _ in SEQUENCE]

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
