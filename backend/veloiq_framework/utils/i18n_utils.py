import os
import ast
from contextvars import ContextVar, Token
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional, Tuple

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


def configure_i18n(locales_dir: str = "", default_locale: str = "") -> None:
    """Override i18n paths at startup (called from create_veloiq_app())."""
    global I18N_LOCALES_DIR, DEFAULT_LOCALE
    if locales_dir:
        I18N_LOCALES_DIR = Path(locales_dir)
    if default_locale:
        DEFAULT_LOCALE = default_locale
    # Clear caches so they pick up new paths.
    get_supported_locales.cache_clear()
    _load_po_catalog_cached.cache_clear()


def _canonicalize_locale(locale: Optional[str]) -> str:
    """
    Normalize locale strings to lowercase underscore format.
    """
    return (locale or "").strip().replace("-", "_").lower()


@lru_cache(maxsize=1)
def get_supported_locales() -> Tuple[str, ...]:
    """
    Discover locales that have a messages.po translation catalog.
    """
    if not I18N_LOCALES_DIR.exists():
        return (FALLBACK_LOCALE,)

    supported = []
    for locale_dir in I18N_LOCALES_DIR.iterdir():
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


def _resolve_po_file(locale: str) -> Optional[Path]:
    resolved_locale = resolve_supported_locale(locale, fallback_locale=FALLBACK_LOCALE)
    locale_candidates = [resolved_locale]
    if "_" in resolved_locale:
        locale_candidates.append(resolved_locale.split("_", 1)[0])
    for loc in locale_candidates:
        candidate = I18N_LOCALES_DIR / loc / "LC_MESSAGES" / f"{I18N_DOMAIN}.po"
        if candidate.exists():
            return candidate
    return None


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


def _load_po_catalog(locale: str) -> Dict[str, str]:
    """
    Load translation entries from the ``messages.po`` catalog for a locale.

    Resolves the file on disk and delegates parsing to a cached helper keyed
    on the file path and its mtime, so on-disk edits invalidate the cache
    automatically (no explicit clear needed for dev workflows).
    """
    po_file = _resolve_po_file(locale)
    if po_file is None:
        return _load_po_catalog_cached(None, 0)
    return _load_po_catalog_cached(str(po_file), po_file.stat().st_mtime_ns)


def get_catalog_for_locale(locale: Optional[str]) -> Dict[str, str]:
    """
    Return translation catalog for a locale resolved to supported files.
    """
    resolved = resolve_supported_locale(locale, fallback_locale=FALLBACK_LOCALE)
    return _load_po_catalog(resolved)


def clear_i18n_catalog_cache() -> None:
    """
    Clear cached parsed PO catalogs. Normally unnecessary because the cache
    is keyed on file mtime; provided for tests and admin tooling.
    """
    _load_po_catalog_cached.cache_clear()


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
    Translate text using the shared application PO catalogs.

    The function resolves the effective locale, tries that catalog first,
    then falls back to the default locale catalog. If no entry is found,
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
