"""Data sources of non-model data resources: where their rows are read from and written to.

A source works on whole rows (plain dicts holding every field of the resource)
and identifies them by ``eid`` (see :mod:`~veloiq_framework.non_model_data_resources.encode_decode_row_eid`).
The router holds :meth:`NonModelDataSource.hold_for_read_check_write` around each read-check-write, so a
source only has to apply the change; it raises :class:`DataSourceChangedConflictError`
when its data changed outside the request (another process wrote the file).

Two sources are provided:

* :class:`JsonFileDataSource` — rows of a JSON file, with an optional read-only
  packaged file (shipped inside a pip-installed extension) under a host-side
  overlay file in ``config/``, merged by ``eid`` as ``banners.json`` is;
* :class:`PythonFunctionsDataSource` — rows produced and saved by functions, for data that
  lives elsewhere (ini/toml settings, an external service, computed data).
"""
from __future__ import annotations

import copy
import json
import os
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable, Iterator, Optional, Sequence

from veloiq_framework.utils.views_utils import jm_log

from .encode_decode_row_eid import decode_eid, encode_eid

if TYPE_CHECKING:
    from .non_model_data_resource_definitions import NonModelDataResource

#: Marks, in an overlay file, a packaged row the host app deleted.
OVERLAY_DELETED_ROW_MARKER = "_deleted"


class DataSourceChangedConflictError(RuntimeError):
    """The source's data changed between the request's read and its write."""


class DataSourceRequestContext:
    """What a source may need to know about the request: the user and the request itself."""

    def __init__(self, user: Optional[dict] = None, request: Any = None) -> None:
        self.user = user or {}
        self.request = request


class NonModelDataSource:
    """Base class of the sources: rows read and written by ``eid``.

    Subclasses implement :meth:`load_all_rows` and the writes they support, and set the
    matching ``supports_*`` flag.
    """

    supports_create = False
    supports_update = False
    supports_delete = False

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.pk_fields: list[str] = []

    def bind_to_data_resource(self, data_resource: "NonModelDataResource") -> None:
        """Remember the key fields of the resource the source serves."""
        self.pk_fields = list(data_resource.pk_fields)

    def eid_of_row(self, row: dict) -> str:
        """Return the ``eid`` of *row* from its key fields."""
        return encode_eid([row.get(key) for key in self.pk_fields])

    @contextmanager
    def hold_for_read_check_write(self) -> Iterator[None]:
        """Hold the source while a request reads, checks and writes it."""
        with self._lock:
            yield

    def load_all_rows(self, request_context: DataSourceRequestContext) -> list[dict]:
        """Return every row."""
        raise NotImplementedError

    def create_row(self, request_context: DataSourceRequestContext, row: dict) -> dict:
        """Add *row* and return it as saved."""
        raise NotImplementedError

    def update_row(self, request_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
        """Replace the row *eid* with *row* (the whole new row) and return it as saved."""
        raise NotImplementedError

    def delete_row(self, request_context: DataSourceRequestContext, eid: str) -> None:
        """Remove the row *eid*."""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# JSON file
# ---------------------------------------------------------------------------


def _read_json_file(path: Path) -> Any:
    """Return the parsed content of *path*, or ``None`` when the file doesn't exist."""
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json_file_atomically(path: Path, document: Any) -> None:
    """Write *document* to *path* through a temporary file, replacing it in one step."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=str(path.parent), suffix=".tmp", delete=False,
                                     encoding="utf-8") as handle:
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
        temporary = handle.name
    os.replace(temporary, path)


def _json_file_change_signature(path: Path) -> Optional[tuple[int, int]]:
    """Return ``(mtime_ns, size)`` of *path*, or ``None`` when it doesn't exist."""
    try:
        stat = path.stat()
    except FileNotFoundError:
        return None
    return (stat.st_mtime_ns, stat.st_size)


class JsonFileDataSource(NonModelDataSource):
    """Rows kept in a JSON file.

    :param path: The file the rows are written to, relative to the backend
        working directory (e.g. ``config/regional_rates.json``) or absolute.
    :param packaged_path: A read-only file with the rows shipped inside a
        pip-installed extension. When set, *path* is the host app's overlay:
        its rows replace the packaged rows with the same ``eid``, add new ones,
        or hide a packaged row with ``"_deleted": true``. Writes only touch the
        overlay, so the extension's file is never changed.
    :param rows_path: Keys leading to the rows inside the document
        (e.g. ``["tools"]``); empty when the document itself holds the rows.
        The rest of the document is kept as it is on write.
    :param layout: ``"list"`` (a JSON array of row objects) or ``"keyed"`` (a
        JSON object whose keys are the rows' keys and whose values are the
        other fields of each row).
    :param key_field: For ``layout="keyed"``: the field the object key fills.
        Defaults to the resource's single key field.
    :param read_only: The file is never written (no create, update or delete).
    """

    def __init__(self, path: str | Path, *, packaged_path: str | Path | None = None,
                 rows_path: Sequence[str] = (), layout: str = "list", key_field: str = "",
                 read_only: bool = False) -> None:
        super().__init__()
        if layout not in ("list", "keyed"):
            raise ValueError(f"JsonFileDataSource: unknown layout '{layout}'")
        self.path = Path(path)
        self.packaged_path = Path(packaged_path) if packaged_path else None
        self.rows_path = list(rows_path)
        self.layout = layout
        self.key_field = key_field
        self.read_only = read_only
        self.supports_create = self.supports_update = self.supports_delete = not read_only
        self._signature_when_loaded: Optional[tuple[int, int]] = None

    def bind_to_data_resource(self, data_resource: "NonModelDataResource") -> None:
        """Remember the resource's key fields; a keyed layout needs a one-field key."""
        super().bind_to_data_resource(data_resource)
        if self.layout == "keyed":
            if not self.key_field:
                if len(self.pk_fields) != 1:
                    raise ValueError(f"JsonFileDataSource '{self.path}': a keyed layout needs key_field "
                                     "for a composite key")
                self.key_field = self.pk_fields[0]

    # ── Document <-> rows ────────────────────────────────────────────────────

    def _rows_collection_in_document(self, document: Any) -> Any:
        """Return the rows' collection inside *document* (``None`` when absent)."""
        node = document
        for key in self.rows_path:
            if not isinstance(node, dict):
                return None
            node = node.get(key)
        return node

    def _rows_in_document(self, document: Any) -> list[dict]:
        """Return the rows of a parsed document, as dicts holding every field."""
        collection = self._rows_collection_in_document(document)
        if collection is None:
            return []
        if self.layout == "keyed":
            if not isinstance(collection, dict):
                raise ValueError(f"{self.path}: expected a JSON object of rows")
            return [{self.key_field: key, **(value if isinstance(value, dict) else {"value": value})}
                    for key, value in collection.items()]
        if not isinstance(collection, list):
            raise ValueError(f"{self.path}: expected a JSON array of rows")
        return [dict(row) for row in collection if isinstance(row, dict)]

    def _document_with_rows(self, document: Any, rows: list[dict]) -> Any:
        """Return *document* with its rows' collection replaced by *rows*."""
        if self.layout == "keyed":
            collection: Any = {
                str(row[self.key_field]): {key: value for key, value in row.items() if key != self.key_field}
                for row in rows
            }
        else:
            collection = rows
        if not self.rows_path:
            return collection
        document = copy.deepcopy(document) if isinstance(document, dict) else {}
        node = document
        for key in self.rows_path[:-1]:
            node = node.setdefault(key, {})
        node[self.rows_path[-1]] = collection
        return document

    # ── Reads ────────────────────────────────────────────────────────────────

    def load_all_rows(self, request_context: DataSourceRequestContext) -> list[dict]:
        """Return the packaged rows merged with the overlay's (or the file's rows)."""
        self._signature_when_loaded = _json_file_change_signature(self.path)
        own_rows = self._rows_in_document(_read_json_file(self.path))
        if self.packaged_path is None:
            return own_rows
        merged: dict[str, dict] = {self.eid_of_row(row): row for row in self._rows_in_document(_read_json_file(self.packaged_path))}
        for row in own_rows:
            eid = self.eid_of_row(row)
            if row.get(OVERLAY_DELETED_ROW_MARKER):
                merged.pop(eid, None)
            else:
                merged[eid] = {key: value for key, value in row.items() if key != OVERLAY_DELETED_ROW_MARKER}
        return list(merged.values())

    # ── Writes ───────────────────────────────────────────────────────────────

    def _change_and_save_writable_file_rows(self, change: Callable[[list[dict]], list[dict]]) -> None:
        """Apply *change* to the rows of the writable file and save it.

        :raises DataSourceChangedConflictError: When the file changed since this request's :meth:`load_all_rows`.
        """
        if self.read_only:
            raise PermissionError(f"{self.path} is read-only")
        if _json_file_change_signature(self.path) != self._signature_when_loaded:
            raise DataSourceChangedConflictError(str(self.path))
        document = _read_json_file(self.path)
        rows = change(self._rows_in_document(document))
        _write_json_file_atomically(self.path, self._document_with_rows(document, rows))
        self._signature_when_loaded = _json_file_change_signature(self.path)
        jm_log(1, f"JsonFileDataSource: wrote {len(rows)} row(s) to {self.path}")

    def _packaged_file_row_eids(self) -> set[str]:
        """Return the ``eid`` of every row of the packaged file."""
        if self.packaged_path is None:
            return set()
        return {self.eid_of_row(row) for row in self._rows_in_document(_read_json_file(self.packaged_path))}

    def create_row(self, request_context: DataSourceRequestContext, row: dict) -> dict:
        """Append *row* to the writable file."""
        eid = self.eid_of_row(row)
        self._change_and_save_writable_file_rows(lambda rows: [r for r in rows if self.eid_of_row(r) != eid] + [row])
        return row

    def update_row(self, request_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
        """Replace the row *eid* in the writable file, keeping its position (or add it to the overlay)."""
        def change(rows: list[dict]) -> list[dict]:
            for index, existing in enumerate(rows):
                if self.eid_of_row(existing) == eid:
                    return rows[:index] + [row] + rows[index + 1:]
            return rows + [row]
        self._change_and_save_writable_file_rows(change)
        return row

    def delete_row(self, request_context: DataSourceRequestContext, eid: str) -> None:
        """Remove the row *eid*; a packaged row is hidden by a marker in the overlay."""
        hide_packaged = eid in self._packaged_file_row_eids()

        def change(rows: list[dict]) -> list[dict]:
            kept = [r for r in rows if self.eid_of_row(r) != eid]
            if hide_packaged:
                # Decoded key text gives the same eid as the packaged row's values.
                marker = dict(zip(self.pk_fields, decode_eid(eid, len(self.pk_fields))))
                kept.append({**marker, OVERLAY_DELETED_ROW_MARKER: True})
            return kept
        self._change_and_save_writable_file_rows(change)


# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------


class PythonFunctionsDataSource(NonModelDataSource):
    """Rows produced and saved by Python functions.

    :param load_all_rows_function: ``(request_context) -> list[dict]`` returning every row.
    :param create_row_function: ``(request_context, row) -> dict`` adding a row
        (``None``: rows can't be added).
    :param update_row_function: ``(request_context, eid, row) -> dict`` replacing a row
        (``None``: rows can't be changed).
    :param delete_row_function: ``(request_context, eid) -> None`` removing a row
        (``None``: rows can't be deleted).
    """

    def __init__(self, load_all_rows_function: Callable[[DataSourceRequestContext], list[dict]], *,
                 create_row_function: Optional[Callable[[DataSourceRequestContext, dict], dict]] = None,
                 update_row_function: Optional[Callable[[DataSourceRequestContext, str, dict], dict]] = None,
                 delete_row_function: Optional[Callable[[DataSourceRequestContext, str], None]] = None) -> None:
        super().__init__()
        self._load_all_rows_function = load_all_rows_function
        self._create_row_function = create_row_function
        self._update_row_function = update_row_function
        self._delete_row_function = delete_row_function
        self.supports_create = create_row_function is not None
        self.supports_update = update_row_function is not None
        self.supports_delete = delete_row_function is not None

    def load_all_rows(self, request_context: DataSourceRequestContext) -> list[dict]:
        """Return the rows from ``load_all_rows_function``."""
        return [dict(row) for row in self._load_all_rows_function(request_context)]

    def create_row(self, request_context: DataSourceRequestContext, row: dict) -> dict:
        """Add *row* through ``create_row_function``."""
        return self._create_row_function(request_context, row) if self._create_row_function else row

    def update_row(self, request_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
        """Replace the row *eid* through ``update_row_function``."""
        return self._update_row_function(request_context, eid, row) if self._update_row_function else row

    def delete_row(self, request_context: DataSourceRequestContext, eid: str) -> None:
        """Remove the row *eid* through ``delete_row_function``."""
        if self._delete_row_function:
            self._delete_row_function(request_context, eid)
