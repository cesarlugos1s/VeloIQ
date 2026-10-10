"""Translation lookup for VeloIQ and every package built on it.

Catalogs are layered. Each layer is a ``locales`` directory laid out as
``<locale>/LC_MESSAGES/messages.po``, and one catalog per locale holds both
the backend ``_()`` strings and the frontend UI ``_()`` strings of whatever
owns that layer. Lowest priority first:

1. VeloIQ's own catalog (``veloiq_framework/locales``), shipped with the package.
2. Each enabled extension's catalog, in ``veloiq.toml`` order
   (:attr:`VeloIQExtension.locales_dir`).
3. The host app's catalog (``I18N_LOCALES_DIR``), which overrides any string
   of the layers below it.

A locale is supported when any layer has a catalog for it, so a host app can
add a locale on its own; strings no layer translates for that locale fall
back to the English catalogs, then to the source text.
"""
import os
import ast
from contextvars import ContextVar, Token
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

FRAMEWORK_LOCALES_DIR: Path = Path(__file__).resolve().parent.parent / "locales"
_EXTENSION_LOCALES_DIRS: Tuple[Path, ...] = ()

I18N_LOCALES_DIR: Path = Path(
    os.getenv(
        "VELOIQ_I18N_LOCALES_DIR",
        str(Path("config") / "internationalization" / "locales"),
    )
)
I18N_DOMAIN = "messages"
DEFAULT_LOCALE = os.getenv("VELOIQ_I18N_DEFAULT_LOCALE", "en")
FALLBACK_LOCALE = "en"
_REQUEST_LOCALE: ContextVar[Optional[str]] = ContextVar("veloiq_request_locale", default=None)


def configure_i18n(
    locales_dir: str = "",
    default_locale: str = "",
    extension_locales_dirs: Optional[Iterable] = None,
) -> None:
    """Override i18n paths at startup (called from create_veloiq_app()).

    :param locales_dir: The host app's catalogs directory (the top layer).
    :param default_locale: Locale used when nothing else selects one.
    :param extension_locales_dirs: The enabled extensions' catalogs
        directories, lowest priority first; ``None`` keeps the current ones.
    """
    global I18N_LOCALES_DIR, DEFAULT_LOCALE, _EXTENSION_LOCALES_DIRS
    if locales_dir:
        I18N_LOCALES_DIR = Path(locales_dir)
    if default_locale:
        DEFAULT_LOCALE = default_locale
    if extension_locales_dirs is not None:
        _EXTENSION_LOCALES_DIRS = tuple(Path(d) for d in extension_locales_dirs if d)
    # Clear caches so they pick up new paths.
    get_supported_locales.cache_clear()
    _load_po_catalog_cached.cache_clear()
    _merge_po_catalogs_cached.cache_clear()


def catalog_layers() -> Tuple[Path, ...]:
    """The catalogs directories in lookup order, lowest priority first:
    VeloIQ, then the enabled extensions, then the host app."""
    return (FRAMEWORK_LOCALES_DIR, *_EXTENSION_LOCALES_DIRS, I18N_LOCALES_DIR)


def _canonicalize_locale(locale: Optional[str]) -> str:
    """
    Normalize locale strings to lowercase underscore format.
    """
    return (locale or "").strip().replace("-", "_").lower()


@lru_cache(maxsize=1)
def get_supported_locales() -> Tuple[str, ...]:
    """
    Discover locales that have a messages.po translation catalog in any layer.
    """
    supported = []
    for layer in catalog_layers():
        if not layer.is_dir():
            continue
        for locale_dir in layer.iterdir():
            if not locale_dir.is_dir():
                continue
            catalog = locale_dir / "LC_MESSAGES" / f"{I18N_DOMAIN}.po"
            if catalog.exists():
                supported.append(_canonicalize_locale(locale_dir.name))

    if FALLBACK_LOCALE not in supported:
        supported.append(FALLBACK_LOCALE)
    return tuple(sorted(set(supported)))


def resolve_supported_locale(locale: Optional[str], fallback_locale: str = FALLBACK_LOCALE) -> str:
    """
    Resolve locale to one that is supported by available catalogs.
    """
    supported = get_supported_locales()
    fallback = _canonicalize_locale(fallback_locale) or FALLBACK_LOCALE
    if fallback not in supported:
        fallback = FALLBACK_LOCALE if FALLBACK_LOCALE in supported else supported[0]

    candidate = _canonicalize_locale(locale)
    if not candidate:
        return fallback
    if candidate in supported:
        return candidate

    language = candidate.split("_", 1)[0]
    if language in supported:
        return language
    for supported_locale in supported:
        if supported_locale.startswith(f"{language}_"):
            return supported_locale

    return fallback


def _match_supported_locale(locale: Optional[str]) -> Optional[str]:
    """
    Match locale against supported translations without applying fallback.
    """
    supported = get_supported_locales()
    candidate = _canonicalize_locale(locale)
    if not candidate:
        return None
    if candidate in supported:
        return candidate

    language = candidate.split("_", 1)[0]
    if language in supported:
        return language
    for supported_locale in supported:
        if supported_locale.startswith(f"{language}_"):
            return supported_locale
    return None


def resolve_locale_from_accept_language(
    accept_language_header: Optional[str],
    fallback_locale: str = FALLBACK_LOCALE,
) -> str:
    """
    Resolve a supported locale from an Accept-Language header value.
    """
    header = (accept_language_header or "").strip()
    if not header:
        return resolve_supported_locale(None, fallback_locale=fallback_locale)

    weighted_locales = []
    for idx, part in enumerate(header.split(",")):
        token = part.strip()
        if not token:
            continue
        locale = token
        quality = 1.0
        if ";" in token:
            locale, params = token.split(";", 1)
            for param in params.split(";"):
                key, _, value = param.strip().partition("=")
                if key == "q":
                    try:
                        quality = float(value)
                    except ValueError:
                        quality = 0.0
        locale = locale.strip()
        if locale:
            weighted_locales.append((quality, idx, locale))

    weighted_locales.sort(key=lambda item: (-item[0], item[1]))
    for _quality, _idx, locale in weighted_locales:
        if locale == "*":
            return resolve_supported_locale(None, fallback_locale=fallback_locale)
        resolved = _match_supported_locale(locale)
        if resolved:
            return resolved

    return resolve_supported_locale(None, fallback_locale=fallback_locale)


def set_request_locale(locale: Optional[str]) -> Token:
    """
    Set the per-request locale context value.
    """
    resolved = resolve_supported_locale(locale, fallback_locale=FALLBACK_LOCALE)
    return _REQUEST_LOCALE.set(resolved)


def reset_request_locale(token: Token) -> None:
    """
    Reset request locale context.
    """
    _REQUEST_LOCALE.reset(token)


def get_request_locale() -> Optional[str]:
    """
    Get the current request locale from context.
    """
    return _REQUEST_LOCALE.get()


def _decode_po_quoted_line(raw_line: str) -> str:
    """
    Decode a PO quoted-string line into plain text.

    The input must be the quoted segment (for example ``"Hello\\n"``).
    Escape sequences are converted to their corresponding characters.

    :param raw_line: Raw line content from a PO file.
    :type raw_line: str
    :return: Decoded string value, or an empty string for invalid quoted input.
    :rtype: str
    """
    line = raw_line.strip()
    if len(line) < 2 or not line.startswith('"') or not line.endswith('"'):
        return ""
    try:
        # PO quoted strings follow C-style escapes; ast handles escapes
        # while preserving UTF-8 characters correctly.
        decoded = ast.literal_eval(line)
        return decoded if isinstance(decoded, str) else ""
    except (ValueError, SyntaxError):
        return ""


def _translation_lookup_candidates(text: str) -> Tuple[str, ...]:
    """
    Build candidate keys for translation lookup from source text.
    """
    base = str(text or "")
    candidates = []

    def add(value: str) -> None:
        candidate = value or ""
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    add(base)
    stripped = base.strip()
    if stripped != base:
        add(stripped)
    collapsed = " ".join(stripped.split())
    if collapsed != stripped:
        add(collapsed)
    underscore_as_space = collapsed.replace("_", " ")
    if underscore_as_space != collapsed:
        add(underscore_as_space)
    hyphen_as_space = collapsed.replace("-", " ")
    if hyphen_as_space != collapsed:
        add(hyphen_as_space)

    return tuple(candidates)


def _normalize_locale(locale: Optional[str]) -> str:
    """
    Resolve the effective locale code used for translation lookup.

    Resolution order:
    1) Explicit ``locale`` argument
    2) ``VELOIQ_I18N_LOCALE`` environment variable
    3) ``LANG`` environment variable (without encoding suffix)
    4) ``DEFAULT_LOCALE``

    Hyphenated locale codes are normalized to underscore format.

    :param locale: Optional locale code requested by the caller.
    :type locale: str | None
    :return: Normalized locale code (for example ``en_US``).
    :rtype: str
    """
    candidate = (locale or "").strip()
    if not candidate:
        request_locale = get_request_locale()
        if request_locale:
            candidate = request_locale
    if not candidate:
        candidate = os.getenv("VELOIQ_I18N_LOCALE", "").strip()
    if not candidate:
        lang_env = os.getenv("LANG", "").strip()
        if lang_env:
            candidate = lang_env.split(".", 1)[0]
    if not candidate:
        candidate = DEFAULT_LOCALE
    return resolve_supported_locale(candidate, fallback_locale=FALLBACK_LOCALE)


def _layer_po_files(layer: Path, locale: str) -> Tuple[Path, ...]:
    """The catalogs one layer has for ``locale``: its base language's first,
    then the regional one (``es`` then ``es_mx``), so a regional catalog only
    needs the strings that differ from the base language."""
    files = []
    locale_candidates = [locale.split("_", 1)[0]] if "_" in locale else []
    locale_candidates.append(locale)
    for loc in locale_candidates:
        # Directory names keep their on-disk case (``es_MX``); match loosely.
        for candidate_dir in (layer / loc, layer / _denormalize_region(loc)):
            candidate = candidate_dir / "LC_MESSAGES" / f"{I18N_DOMAIN}.po"
            if candidate.exists() and candidate not in files:
                files.append(candidate)
                break
    return tuple(files)


def _denormalize_region(locale: str) -> str:
    """``es_mx`` -> ``es_MX``, the usual on-disk spelling of a regional locale."""
    language, _sep, region = locale.partition("_")
    return f"{language}_{region.upper()}" if region else language


def _locale_po_files(locale: str) -> Tuple[Path, ...]:
    """Every catalog for ``locale`` across all layers, lowest priority first."""
    resolved_locale = resolve_supported_locale(locale, fallback_locale=FALLBACK_LOCALE)
    files = []
    for layer in catalog_layers():
        files.extend(_layer_po_files(layer, resolved_locale))
    return tuple(files)


def _resolve_po_file(locale: str) -> Optional[Path]:
    """The host app's own catalog for ``locale`` (top layer only), or None."""
    resolved_locale = resolve_supported_locale(locale, fallback_locale=FALLBACK_LOCALE)
    files = _layer_po_files(I18N_LOCALES_DIR, resolved_locale)
    return files[-1] if files else None


@lru_cache(maxsize=32)
def _load_po_catalog_cached(po_file_str: Optional[str], _mtime_ns: int) -> Dict[str, str]:
    """
    Parse a ``messages.po`` file. Cache key includes ``_mtime_ns`` so edits to
    the file on disk invalidate the cache without requiring a manual clear.
    """
    if not po_file_str:
        return {}
    po_file = Path(po_file_str)
    catalog: Dict[str, str] = {}
    current_msgid = None
    current_msgstr = None
    state = None

    def flush_entry() -> None:
        """
        Persist the current parsed PO entry into the in-memory catalog.
        """
        nonlocal current_msgid, current_msgstr
        if current_msgid is not None and current_msgid != "" and current_msgstr:
            catalog[current_msgid] = current_msgstr
        current_msgid = None
        current_msgstr = None

    with po_file.open("r", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line:
                flush_entry()
                state = None
                continue
            if line.startswith("#"):
                continue
            if line.startswith("msgid "):
                flush_entry()
                current_msgid = _decode_po_quoted_line(line[5:].strip())
                current_msgstr = ""
                state = "msgid"
                continue
            if line.startswith("msgstr "):
                current_msgstr = _decode_po_quoted_line(line[6:].strip())
                state = "msgstr"
                continue
            if line.startswith('"'):
                if state == "msgid" and current_msgid is not None:
                    current_msgid += _decode_po_quoted_line(line)
                elif state == "msgstr" and current_msgstr is not None:
                    current_msgstr += _decode_po_quoted_line(line)

    flush_entry()
    return catalog


@lru_cache(maxsize=32)
def _merge_po_catalogs_cached(po_files: Tuple[Tuple[str, int], ...]) -> Dict[str, str]:
    """Merge ``(path, mtime_ns)`` catalogs in order, later ones winning. The
    mtimes are part of the cache key, so editing any layer's file on disk
    invalidates the merged result."""
    merged: Dict[str, str] = {}
    for po_file_str, mtime_ns in po_files:
        merged.update(_load_po_catalog_cached(po_file_str, mtime_ns))
    return merged


def _load_po_catalog(locale: str) -> Dict[str, str]:
    """
    Load the merged translation entries of every layer for a locale.

    VeloIQ's catalog first, then each enabled extension's, then the host
    app's, each one overriding the entries of the layers before it. Parsing
    is cached per file path and mtime, so on-disk edits invalidate the cache
    automatically (no explicit clear needed for dev workflows).
    """
    key = tuple((str(f), f.stat().st_mtime_ns) for f in _locale_po_files(locale))
    return _merge_po_catalogs_cached(key)


def get_catalog_for_locale(locale: Optional[str]) -> Dict[str, str]:
    """
    Return the merged translation catalog (all layers) for a locale resolved
    to supported files.
    """
    resolved = resolve_supported_locale(locale, fallback_locale=FALLBACK_LOCALE)
    return _load_po_catalog(resolved)


def get_ui_catalog(locale: Optional[str]) -> Dict[str, str]:
    """
    Return the catalog the browser's ``window._`` uses for ``locale``.

    The merged English catalog sits underneath the locale's own, so a string
    no layer translates for ``locale`` shows its English label rather than
    its raw source text (an identifier such as ``sales_record``), the same
    fallback the backend ``_()`` applies.
    """
    resolved = resolve_supported_locale(locale, fallback_locale=FALLBACK_LOCALE)
    catalog = dict(_load_po_catalog(FALLBACK_LOCALE))
    if resolved != FALLBACK_LOCALE:
        catalog.update(_load_po_catalog(resolved))
    return catalog


def clear_i18n_catalog_cache() -> None:
    """
    Clear cached parsed PO catalogs. Normally unnecessary because the cache
    is keyed on file mtime; provided for tests and admin tooling.
    """
    _load_po_catalog_cached.cache_clear()
    _merge_po_catalogs_cached.cache_clear()


def _humanize_identifier_fallback(text_to_translate: str) -> str:
    """
    Return source text when no translation is found.

    :param text_to_translate: Source text requested for translation.
    :type text_to_translate: str
    :return: Human-readable fallback string.
    :rtype: str
    """
    return text_to_translate


def _(text_to_translate, locale: Optional[str] = None) -> str:
    """
    Translate text using the layered PO catalogs (host app, then the enabled
    extensions, then VeloIQ).

    The function resolves the effective locale, tries that merged catalog
    first, then falls back to the merged English catalog. If no entry is found,
    the source text is returned unchanged.

    :param text_to_translate: Text to translate.
    :type text_to_translate: Any
    :param locale: Optional locale override for this translation call.
    :type locale: str | None
    :return: Translated text or fallback text.
    :rtype: str
    """
    source_text = "" if text_to_translate is None else str(text_to_translate)
    normalized_locale = _normalize_locale(locale)
    candidates = _translation_lookup_candidates(source_text)

    catalog = _load_po_catalog(normalized_locale)
    for candidate in candidates:
        translated = catalog.get(candidate)
        if translated:
            return translated

    fallback_locale = resolve_supported_locale(FALLBACK_LOCALE, fallback_locale=FALLBACK_LOCALE)
    if normalized_locale != fallback_locale:
        default_catalog = _load_po_catalog(fallback_locale)
        for candidate in candidates:
            translated = default_catalog.get(candidate)
            if translated:
                return translated

    return _humanize_identifier_fallback(source_text)


def legacy_frontend_catalog_files(locale: str, serve_frontend: Optional[str] = None) -> Tuple[Path, ...]:
    """
    The host app's legacy per-locale frontend catalogue files, if any.

    Before catalogs were layered, a host app kept every UI translation
    (its own, VeloIQ's and each extension's) in
    ``frontend/public/i18n/<locale>.json``, copied into ``dist/i18n`` by the
    build. The source file wins over the built copy.
    """
    language = _canonicalize_locale(locale).split("_", 1)[0]
    roots = []
    if serve_frontend:
        dist = Path(serve_frontend)
        roots += [dist.parent / "public" / "i18n", dist / "i18n"]
    roots.append(Path.cwd().parent / "frontend" / "public" / "i18n")
    for root in roots:
        candidate = root / f"{language}.json"
        if candidate.is_file():
            return (candidate,)
    return ()


def load_legacy_frontend_catalog(locale: str, serve_frontend: Optional[str] = None) -> Dict[str, str]:
    """
    The host app's legacy frontend catalogue for ``locale`` as ``{key: text}``,
    or ``{}`` when there is none or it can't be parsed.
    """
    import json

    for path in legacy_frontend_catalog_files(locale, serve_frontend):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
        if isinstance(data, dict):
            return {str(k): str(v) for k, v in data.items() if isinstance(v, str)}
    return {}


def get_frontend_catalog(
    locale: Optional[str],
    serve_frontend: Optional[str] = None,
    english_fallback: bool = True,
) -> Dict[str, str]:
    """
    The full catalog the browser's ``window._`` gets for ``locale``
    (served at ``/i18n/<locale>.json``).

    :func:`get_ui_catalog` (every layer, English underneath), plus the host
    app's legacy frontend catalogue while it still has one: its entries sit
    above the packages' catalogs and below the host app's own PO catalog.
    An untranslated copy (value equal to its key) is ignored so it can't
    mask a package's translation.

    :param english_fallback: False leaves out the English catalog underneath,
        for callers that need to know whether ``locale`` itself has an entry.
    """
    catalog = get_ui_catalog(locale) if english_fallback else dict(get_catalog_for_locale(locale))
    legacy = load_legacy_frontend_catalog(locale or FALLBACK_LOCALE, serve_frontend)
    if legacy:
        host_po_file = _resolve_po_file(locale or FALLBACK_LOCALE)
        host_entries = (
            _load_po_catalog_cached(str(host_po_file), host_po_file.stat().st_mtime_ns)
            if host_po_file is not None else {}
        )
        for key, value in legacy.items():
            if key in host_entries or not value or value == key:
                continue
            catalog[key] = value
    return catalog
