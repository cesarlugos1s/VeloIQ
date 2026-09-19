"""Baseline entries of the System Configuration Console.

These are the application-wide settings VeloIQ itself owns: logging, appearance
and the ``[views]`` defaults (including the right-side panel layout). They
register through the same contribution registry any extension or module can use
(see ``registry.register_system_config``), so the console has one code path
rather than "core list + extras".
"""
from __future__ import annotations

from .registry import register_system_config

# Each entry: ``key``, ``type`` ("int" / "bool" / "string" / "color"), ``source``
# ("ini" for jm_config.ini, "toml" for the [views] table of veloiq.toml),
# ``card`` (console section), ``label``, ``tooltip`` and optionally ``options``
# and ``default`` (used when a toml key is not yet in the project's veloiq.toml).
BASELINE_SYSTEM_CONFIG_KEYS: list = [
    # ── Logging ──
    {"section": "logging", "key": "log_up_to_relevance", "type": "int",
     "source": "ini", "card": "logging",
     "label": "Log verbosity level",
     "tooltip": "Only log messages at or below this relevance level are emitted. 1 = errors only, 2 = warnings, 3 = info, 4 = debug, 5 = trace."},
    {"section": "logging", "key": "log_to_file", "type": "bool",
     "source": "ini", "card": "logging",
     "label": "Write log to file",
     "tooltip": "If enabled, every message printed to the console by jm_log is also appended to a rotating log file. On by default. Takes effect immediately."},
    {"section": "logging", "key": "file_log_up_to_relevance", "type": "int",
     "source": "ini", "card": "logging",
     "label": "File log verbosity level",
     "tooltip": "Relevance threshold for the log file, independent of the console level above (e.g. keep the console at 2 and capture 4 in the file). Defaults to the console level when unset."},
    {"section": "logging", "key": "log_dir", "type": "string",
     "source": "ini", "card": "logging",
     "label": "Log directory",
     "tooltip": "Directory for the log file, relative to the application's working directory (default: logs). Absolute paths are only accepted when set by an operator through the VELOIQ_LOG_DIR environment variable, which also overrides this value."},
    {"section": "logging", "key": "log_file_name", "type": "string",
     "source": "ini", "card": "logging",
     "label": "Log file name",
     "tooltip": "Name of the log file inside the log directory (default: veloiq.log). Any directory part is ignored."},
    {"section": "logging", "key": "log_max_bytes", "type": "int",
     "source": "ini", "card": "logging",
     "label": "Max log file size (bytes)",
     "tooltip": "The log file is rotated when it reaches this size (default: 10485760 = 10 MB). 0 disables rotation."},
    {"section": "logging", "key": "log_backup_count", "type": "int",
     "source": "ini", "card": "logging",
     "label": "Rotated files to keep",
     "tooltip": "Number of rotated backup files kept (veloiq.log.1, .2, ...) before the oldest is deleted (default: 5)."},

    # ── Appearance ──
    {"key": "modules_color_schema", "type": "string",
     "source": "toml", "card": "appearance", "default": "plain-color",
     "label": "Modules color schema",
     "tooltip": "Color schema for module groups in the UI navigation. \"color-coded\" assigns each module a different color; \"plain-color\" uses a single base color compatible with light and dark mode.",
     "options": ["color-coded", "plain-color"]},
    {"key": "models_color_schema", "type": "string",
     "source": "toml", "card": "appearance", "default": "plain-color",
     "label": "Models color schema",
     "tooltip": "Color schema for model entries in the UI. Same options as modules color schema.",
     "options": ["color-coded", "plain-color"]},
    {"key": "plain_color_base_hex", "type": "color",
     "source": "toml", "card": "appearance", "default": "#1e708a",
     "label": "Base color (hex)",
     "tooltip": "Base hex color used when a color schema is set to \"plain-color\". Examples: \"#1e708a\" (teal), \"#c2410c\" (rust). A color swatch preview will be shown.",
     "options": ["#1e708a", "#1677ff", "#52c41a", "#722ed1", "#fa8c16", "#eb2f96", "#13c2c2", "#f5222d", "#000000", "#ffffff"]},

    # ── Views & Layout ──
    {"section": "views", "key": "show_back_of_cards", "type": "bool",
     "source": "ini", "card": "views",
     "label": "Show back of cards",
     "tooltip": "If enabled, the back side of information cards is rendered. Disable when printing pages with cards because browsers overlap front and back of cards when printing."},
    {"key": "show_view_type", "type": "string",
     "source": "toml", "card": "views", "default": "list",
     "label": "Default show view type",
     "tooltip": "Default view type for a model's show page when nothing else is configured.",
     "options": ["list", "table", "editable-table", "editable-list", "csv", "primary", "gallery", "calendar", "totals-details"]},
    {"key": "edit_view_type", "type": "string",
     "source": "toml", "card": "views", "default": "editable-list",
     "label": "Default edit view type",
     "tooltip": "Default view type for a model's edit page when nothing else is configured.",
     "options": ["editable-list", "list", "table", "editable-table", "csv", "primary", "gallery", "calendar", "totals-details"]},
    {"key": "list_view_type", "type": "string",
     "source": "toml", "card": "views", "default": "table",
     "label": "Default list view type",
     "tooltip": "Default view type for list pages when nothing else is configured.",
     "options": ["table", "list", "editable-table", "editable-list", "csv", "primary", "gallery", "calendar", "totals-details"]},
    {"key": "file_list_view_type", "type": "string",
     "source": "toml", "card": "views", "default": "gallery",
     "label": "File list view type",
     "tooltip": "Default view type for file/attachment list views.",
     "options": ["gallery", "table", "list", "editable-table", "editable-list", "csv", "primary", "calendar", "totals-details"]},
    {"key": "gallery_image_width", "type": "int",
     "source": "toml", "card": "views", "default": "180",
     "label": "Gallery image width (px)",
     "tooltip": "Width in pixels for images rendered in gallery views. Default: 180."},
    {"key": "gallery_image_height", "type": "int",
     "source": "toml", "card": "views", "default": "140",
     "label": "Gallery image height (px)",
     "tooltip": "Height in pixels for images rendered in gallery views. Default: 140."},
    {"key": "relations_max_rows_to_load", "type": "int",
     "source": "toml", "card": "views", "default": "1000",
     "label": "Max relation rows to load",
     "tooltip": "Maximum number of rows to load in relation tables in the UI to avoid high latency when there are too many related objects. Default: 1000."},
    {"key": "max_distinct_column_filter_values_to_ranges", "type": "int",
     "source": "toml", "card": "views", "default": "20",
     "label": "Max distinct filter values to ranges",
     "tooltip": "If a column filter dropdown has more than this many distinct numeric values, the filter switches to range-based selection. Default: 20."},
    {"key": "general_actions_button_position", "type": "string",
     "source": "toml", "card": "views", "default": "top-right",
     "label": "Actions button position",
     "tooltip": "Where the general action buttons (Save, Delete, etc.) are rendered on model pages.",
     "options": ["top-right", "left", "right"]},
    {"key": "add_tabs_for_non_configured_relations", "type": "bool",
     "source": "toml", "card": "views", "default": "true",
     "label": "Auto-tabs for relations",
     "tooltip": "If enabled, forward relations not configured in views_preferences.json each get their own tab on show/edit pages. Disable to suppress auto-generated relation tabs."},
    {"key": "panes_layout_mode", "type": "string",
     "source": "toml", "card": "views", "default": "stack",
     "label": "Side panels layout",
     "tooltip": "How the right-side panels that open when following a link are laid out. \"stack\": a resizable split where only the last N panels stay fully visible and older ones collapse into narrow spines; \"breadcrumb\": one panel at a time with a trail of the previous records; \"overlay\": fixed-width drawers over the page; \"scroll\": fixed-width panels in a horizontally scrolling row.",
     "options": ["stack", "breadcrumb", "overlay", "scroll"]},
    {"key": "panes_max_visible", "type": "int",
     "source": "toml", "card": "views", "default": "2",
     "label": "Max visible side panels",
     "tooltip": "Stack layout: the maximum number of panels shown in full (the main page counts as one). Older panels collapse into narrow vertical spines. Default: 2."},
    {"key": "panes_fixed_width", "type": "int",
     "source": "toml", "card": "views", "default": "480",
     "label": "Side panel minimum width (px)",
     "tooltip": "Minimum width in pixels of each page in the breadcrumb, overlay and scroll layouts; pages use any extra room. The stack layout falls back to breadcrumb when the active panel cannot get this width. Default: 480."},
]


def register_baseline_system_config() -> None:
    """Register VeloIQ's own System Configuration Console entries (idempotent)."""
    register_system_config(BASELINE_SYSTEM_CONFIG_KEYS)
