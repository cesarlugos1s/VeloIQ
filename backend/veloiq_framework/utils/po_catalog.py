"""Read, extract and update ``messages.po`` catalogs.

Used by ``veloiq i18n`` to keep a package's catalogs (VeloIQ's own or an
extension's) in step with the ``_()`` strings in its backend and frontend
source, and to move a host app's translations into its own catalog.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from veloiq_framework.utils.i18n_utils import _decode_po_quoted_line

# `_("...")`, `_('...')` and (TS) `_(\`...\`)` with a plain literal as the
# first argument. Not preceded by an identifier character, so `foo_(` and
# `obj._(` don't match; f-strings and template literals with `${}` are
# skipped since they have no fixed msgid.
_CALL_RE = re.compile(
    r"""(?<![\w$.])_\(\s*(?P<q>"|'|`)(?P<body>(?:\\.|(?!(?P=q)).)*?)(?P=q)\s*[,)]""",
    re.DOTALL,
)
_SOURCE_SUFFIXES = {".py", ".ts", ".tsx"}
_SKIP_DIRS = {"node_modules", "dist", "build", "__pycache__", ".venv", "venv", ".git", "tests", "test"}

_HEADER = (
    'msgid ""\n'
    'msgstr ""\n'
    '"Content-Type: text/plain; charset=UTF-8\\n"\n'
    '"Language: {locale}\\n"\n'
)


def _unescape(body: str, quote: str, is_python: bool) -> Optional[str]:
    """Decode a matched string literal body, or None when it has no fixed text."""
    if quote == "`" and "${" in body:
        return None
    if is_python:
        try:
            value = ast.literal_eval(f"{quote}{body}{quote}")
        except (ValueError, SyntaxError):
            return None
        return value if isinstance(value, str) else None
    out, i = [], 0
    escapes = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\", '"': '"', "'": "'", "`": "`"}
    while i < len(body):
        ch = body[i]
        if ch == "\\" and i + 1 < len(body):
            nxt = body[i + 1]
            width = {"u": 4, "x": 2}.get(nxt, 0)
            code = body[i + 2:i + 2 + width]
            if width and len(code) == width and all(c in "0123456789abcdefABCDEF" for c in code):
                out.append(chr(int(code, 16)))
                i += 2 + width
                continue
            out.append(escapes.get(nxt, nxt))
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def iter_source_files(root: Path) -> Iterable[Path]:
    """Every .py/.ts/.tsx file under ``root``, skipping build output, tests and vendored deps."""
    for path in sorted(root.rglob("*")):
        if path.suffix not in _SOURCE_SUFFIXES or not path.is_file():
            continue
        if _SKIP_DIRS.intersection(part for part in path.relative_to(root).parts[:-1]):
            continue
        if path.name.endswith((".d.ts", ".umd.js")):
            continue
        yield path


def extract_msgids(root: Path) -> List[str]:
    """The distinct ``_()`` literals in the backend and frontend source under ``root``,
    in first-seen order."""
    seen: Dict[str, None] = {}
    for path in iter_source_files(root):
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        is_python = path.suffix == ".py"
        for match in _CALL_RE.finditer(text):
            value = _unescape(match.group("body"), match.group("q"), is_python)
            # Symbol-only strings (" ➕ ", ">=") have nothing to translate.
            if value and any(ch.isalpha() for ch in value):
                seen.setdefault(value, None)
    return list(seen)


def read_po(path: Path) -> Dict[str, str]:
    """Every entry of a PO file as ``{msgid: msgstr}``, in file order,
    including untranslated ones (empty msgstr). The header is left out."""
    entries: Dict[str, str] = {}
    if not path.is_file():
        return entries
    msgid: Optional[str] = None
    msgstr: Optional[str] = None
    state = None

    def flush() -> None:
        nonlocal msgid, msgstr
        if msgid:
            entries[msgid] = msgstr or ""
        msgid, msgstr = None, None

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            flush()
            state = None
        elif line.startswith("#"):
            continue
        elif line.startswith("msgid "):
            flush()
            msgid, msgstr, state = _decode_po_quoted_line(line[5:].strip()), "", "msgid"
        elif line.startswith("msgstr "):
            msgstr, state = _decode_po_quoted_line(line[6:].strip()), "msgstr"
        elif line.startswith('"'):
            if state == "msgid" and msgid is not None:
                msgid += _decode_po_quoted_line(line)
            elif state == "msgstr" and msgstr is not None:
                msgstr += _decode_po_quoted_line(line)
    flush()
    return entries


def _quote(text: str) -> str:
    escaped = (
        text.replace("\\", "\\\\").replace('"', '\\"')
        .replace("\n", "\\n").replace("\t", "\\t").replace("\r", "\\r")
    )
    return f'"{escaped}"'


def format_entry(msgid: str, msgstr: str) -> str:
    return f"msgid {_quote(msgid)}\nmsgstr {_quote(msgstr)}\n"


def append_entries(path: Path, locale: str, entries: Iterable[Tuple[str, str]], comment: str = "") -> int:
    """Append ``(msgid, msgstr)`` entries the file doesn't have yet, creating it
    (with a header) when missing. Existing entries and their order are kept.

    :return: The number of entries added.
    """
    existing = read_po(path)
    new = [(k, v) for k, v in entries if k and k not in existing]
    if not new:
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    text = path.read_text(encoding="utf-8") if path.is_file() else _HEADER.format(locale=locale)
    if not text.endswith("\n"):
        text += "\n"
    chunks = [f"\n# {comment}\n" if comment else "\n"]
    chunks.append("\n".join(format_entry(k, v) for k, v in new))
    path.write_text(text + "".join(chunks), encoding="utf-8")
    return len(new)


def set_translations(path: Path, translations: Dict[str, str]) -> int:
    """Fill in msgstr values for msgids already in the file whose msgstr is
    empty. Translated entries are never changed.

    :return: The number of entries filled.
    """
    if not path.is_file() or not translations:
        return 0
    lines = path.read_text(encoding="utf-8").split("\n")
    out: List[str] = []
    filled = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("msgid "):
            # Collect the full msgid (possibly multi-line).
            block = [line]
            msgid = _decode_po_quoted_line(line[5:].strip())
            j = i + 1
            while j < len(lines) and lines[j].startswith('"'):
                msgid += _decode_po_quoted_line(lines[j])
                block.append(lines[j])
                j += 1
            if j < len(lines) and lines[j].strip() == 'msgstr ""' and (
                j + 1 >= len(lines) or not lines[j + 1].startswith('"')
            ) and msgid and translations.get(msgid):
                out.extend(block)
                out.append(f"msgstr {_quote(translations[msgid])}")
                filled += 1
                i = j + 1
                continue
            out.extend(block)
            i = j
            continue
        out.append(line)
        i += 1
    if filled:
        path.write_text("\n".join(out), encoding="utf-8")
    return filled


def locale_po_path(locales_dir: Path, locale: str) -> Path:
    return locales_dir / locale / "LC_MESSAGES" / "messages.po"


def remove_entries(path: Path, msgids: Iterable[str]) -> int:
    """Remove the entries with these msgids (and their preceding comments).

    :return: The number of entries removed.
    """
    drop = set(msgids)
    if not path.is_file() or not drop:
        return 0
    blocks = path.read_text(encoding="utf-8").split("\n\n")
    kept, removed = [], 0
    for block in blocks:
        entry_lines = [l for l in block.split("\n") if l and not l.startswith("#")]
        msgid = None
        if entry_lines and entry_lines[0].startswith("msgid "):
            msgid = _decode_po_quoted_line(entry_lines[0][5:].strip())
            for l in entry_lines[1:]:
                if not l.startswith('"'):
                    break
                msgid += _decode_po_quoted_line(l)
        if msgid and msgid in drop:
            removed += 1
            continue
        kept.append(block)
    if removed:
        path.write_text("\n\n".join(kept), encoding="utf-8")
    return removed
