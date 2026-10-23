"""Definitions of non-model data resources: non-model data served like a model.

A *non-model data resource* is data that doesn't come from an application model (a
JSON configuration file, configurable parameters, computed statistics, an
external service) exposed through the same REST contract as the CRUD router of
a model: list with paging, filters, search and sort, get, create, update,
delete, ``x-total-count``, ``eid``, ``export-csv`` and ``analyze``. The
framework also gives it a ``ModelDef`` (``GET /api/veloiq/non-model-data-resources``),
so every standard view type, the view type slider, the Analyze section, saved
views, the Views Grid and Sections Grid cells and i18n work with it unchanged.

Declare one in a module's ``non_model_data_resources.py`` (host app or extension
module), where the loader finds every :class:`NonModelDataResource` instance, or
register it from code with :func:`register_non_model_data_resource`::

    from veloiq_framework.non_model_data_resources import JsonFileDataSource, NonModelDataField, NonModelDataResource

    regional_rates = NonModelDataResource(
        name="regional_rates",
        label="Regional Rates",
        module="billing",
        pk_fields=["region", "code"],
        fields=[
            NonModelDataField(key="region", label="Region"),
            NonModelDataField(key="code", label="Code"),
            NonModelDataField(key="rate", label="Rate", type="number", required=True),
        ],
        source=JsonFileDataSource("config/regional_rates.json"),
    )

Rules every source follows (see the requirement's "Rules for each non-model
source"): a stable primary key of one or more fields (``pk_fields``); relation
fields name their target (``reference``, and ``reference_key`` for one part of
a composite target key); writes are validated against the declared fields;
concurrent edits are detected with a per-row revision; files shipped inside a
pip-installed extension are written to a host-side overlay (see
:class:`~veloiq_framework.non_model_data_resources.manage_data_sources_crud.JsonFileDataSource`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

#: Field types of a ``FieldDef`` in the UI package (``FieldDef.type``).
NON_MODEL_DATA_FIELD_TYPES = ("string", "number", "boolean", "date", "datetime", "time", "image_url")


@dataclass
class NonModelDataField:
    """One field (column) of a non-model data resource.

    :param key: The field's key in each row.
    :param label: Display label (a catalog msgid; translated by the UI).
        Derived from ``key`` when empty.
    :param type: One of :data:`NON_MODEL_DATA_FIELD_TYPES`.
    :param integer: For ``type="number"``: only whole numbers are accepted.
    :param required: A value must be given when a row is created or changed.
    :param read_only: The UI shows the field without an editor, and writes ignore it.
    :param options: Allowed values: plain values or ``{"label", "value"}`` dicts.
    :param options_url: API path (under ``/api``) answering the allowed values
        (a list, or an object whose first list-valued property holds them).
    :param multiple: The field holds a list of values of its ``type`` (shown as
        tags, edited with a multi-select); filters match any of its values.
    :param reference: Target of a relation field: a model's table name or a
        non-model data resource's name.
    :param reference_key: For a target with a composite key, the target key
        field this field holds (one field per key part).
    :param type_from_field: Key of another field of the same row whose value
        is this field's type for that row (a :data:`NON_MODEL_DATA_FIELD_TYPES` entry, or a
        field view type token such as ``color``). Used by parameter lists, where
        each row's value has its own type.
    :param options_from_field: Key of another field of the same row holding
        this field's allowed values for that row.
    :param value_colors: Tag color of each value (value → antd color name or
        hex), e.g. green for an "Active" status; values left out get the default
        option colors.
    :param description: Help text shown with the field.
    :param default: Value given to the field of a new row when none is sent.
    :param show_view_type: Field view type on show/list pages.
    :param edit_view_type: Field view type on edit pages.
    :param read_roles: Roles that may read the field (``None`` = every role).
    :param write_roles: Roles that may write the field (``None`` = every role).
    """

    key: str
    label: str = ""
    type: str = "string"
    integer: bool = False
    required: bool = False
    read_only: bool = False
    options: Optional[list] = None
    options_url: str = ""
    multiple: bool = False
    reference: str = ""
    reference_key: str = ""
    type_from_field: str = ""
    options_from_field: str = ""
    value_colors: Optional[dict] = None
    description: str = ""
    default: Any = None
    show_view_type: str = ""
    edit_view_type: str = ""
    read_roles: Optional[list[str]] = None
    write_roles: Optional[list[str]] = None

    def __post_init__(self) -> None:
        if not self.label:
            self.label = self.key.replace("_", " ").title()
        if self.type not in NON_MODEL_DATA_FIELD_TYPES:
            raise ValueError(f"NonModelDataField '{self.key}': unknown type '{self.type}'")

    def option_values(self) -> list:
        """Return the allowed values of the field (empty when any value is allowed)."""
        return [option.get("value") if isinstance(option, dict) else option for option in (self.options or [])]

    def to_field_def(self, pk_fields: list[str]) -> dict:
        """Return the field as a UI ``FieldDef`` (camelCase keys)."""
        field_def: dict[str, Any] = {"key": self.key, "label": self.label, "type": self.type}
        if self.key in pk_fields:
            field_def["isPk"] = True
        if self.required:
            field_def["required"] = True
        if self.read_only:
            field_def["readOnly"] = True
        if self.options:
            field_def["options"] = [
                option if isinstance(option, dict) else {"label": str(option), "value": option}
                for option in self.options
            ]
        if self.options_url:
            field_def["optionsUrl"] = self.options_url
        if self.multiple:
            field_def["multiple"] = True
        if self.reference:
            field_def["reference"] = self.reference
        if self.reference_key:
            field_def["referenceKey"] = self.reference_key
        if self.type_from_field:
            field_def["typeFromField"] = self.type_from_field
        if self.options_from_field:
            field_def["optionsFromField"] = self.options_from_field
        if self.value_colors:
            field_def["valueColors"] = {str(value): color for value, color in self.value_colors.items()}
        if self.description:
            field_def["description"] = self.description
        if self.default is not None:
            field_def["defaultValue"] = self.default
        if self.show_view_type:
            field_def["showViewType"] = self.show_view_type
        if self.edit_view_type:
            field_def["editViewType"] = self.edit_view_type
        if self.read_roles is not None:
            field_def["readRoles"] = list(self.read_roles)
        if self.write_roles is not None:
            field_def["writeRoles"] = list(self.write_roles)
        return field_def


@dataclass
class NonModelDataRelation:
    """A one-to-many relation from a non-model data resource to the rows of another resource.

    Shown as a relation tab on the resource's show page, with the related
    resource's rows whose ``target_key`` holds this row's ``eid``.

    :param related_resource_name: The related model's table name or non-model data resource's name.
    :param target_key: The related resource's field that holds this row's ``eid``.
    :param label: Tab label (a catalog msgid).
    :param show_view_type: Relation view type on the show page.
    :param edit_view_type: Relation view type on the edit page.
    """

    related_resource_name: str
    target_key: str
    label: str = ""
    show_view_type: str = ""
    edit_view_type: str = ""

    def to_relation_def(self) -> dict:
        """Return the relation as a UI ``RelationDef``."""
        relation_def: dict[str, Any] = {
            "resource": self.related_resource_name,
            "targetKey": self.target_key,
            "label": self.label or self.related_resource_name.replace("_", " ").title(),
        }
        if self.show_view_type:
            relation_def["showViewType"] = self.show_view_type
        if self.edit_view_type:
            relation_def["editViewType"] = self.edit_view_type
        return relation_def


@dataclass
class NonModelDataResource:
    """Non-model data exposed as a framework resource at ``/api/{name}``.

    :param name: URL-safe resource name (the Refine resource and endpoint prefix).
    :param label: Display name (a catalog msgid).
    :param fields: The row fields, in display order.
    :param pk_fields: The field(s) whose values identify a row. A row's ``eid``
        is built from them (see :mod:`veloiq_framework.non_model_data_resources.encode_decode_row_eid`).
    :param data_source: Where the rows are read from and written to
        (:class:`~veloiq_framework.non_model_data_resources.manage_data_sources_crud.NonModelDataSource`).
    :param module: Module the resource belongs to (menu grouping and access
        policies). ``None`` for framework resources.
    :param description: Shown under the page heading.
    :param list_view_type: Default view type of the list page.
    :param default_sort: ``(field_key, "asc" | "desc")`` applied when the request has no sort.
    :param title_fields: Field keys whose values compose a row's title.
    :param relations: One-to-many relations shown as tabs on the show page.
    :param can_create: Rows may be added (``None``: when the source supports it).
    :param can_update: Rows may be changed (``None``: when the source supports it).
    :param can_delete: Rows may be deleted (``None``: when the source supports it).
    :param access_check: ``(request, action) -> None``, raising an
        ``HTTPException`` to deny. Replaces the default check, which applies the
        role's methods and access policy to ``module`` and ``name``.
    :param validate_row: ``(row, rows) -> list[str]`` of translated error
        messages, for rules across fields or rows. ``row`` is the row as it
        would be saved; ``rows`` are the other rows of the resource.
    :param single_record: The resource holds exactly one record (a settings
        form): rows are never added or deleted, the record's title is the
        resource's label, and it is shown with the "primary" view type (the
        record's show/edit form) rather than as a list.
    :param source_generates_keys: The source assigns a new row's key when the
        request doesn't give one (e.g. from other fields): key fields aren't
        required on create, and the saved row returned by the source carries it.
    :param show_analyze_section: False hides the Analyze section (charts and
        summaries) and its toggle on the resource's lists, for configuration
        lists where it adds nothing.
    :param build_fields_function: ``() -> list[NonModelDataField]`` returning
        fields known only when the app runs (e.g. one per registered setting).
        They follow ``fields`` and are rebuilt for every request. The record
        form's layout (sections, fields side by side) is a page configuration
        in the ``page_configs.json`` of the package that owns the resource
        (see :mod:`veloiq_framework.merge_layered_page_configs`).
    """

    name: str
    label: str
    fields: list[NonModelDataField]
    pk_fields: list[str]
    data_source: Any
    module: Optional[str] = None
    description: str = ""
    list_view_type: str = "table"
    default_sort: Optional[tuple[str, str]] = None
    title_fields: list[str] = field(default_factory=list)
    relations: list[NonModelDataRelation] = field(default_factory=list)
    can_create: Optional[bool] = None
    can_update: Optional[bool] = None
    can_delete: Optional[bool] = None
    access_check: Optional[Callable[[Any, str], None]] = None
    validate_row: Optional[Callable[[dict, list[dict]], list[str]]] = None
    single_record: bool = False
    source_generates_keys: bool = False
    show_analyze_section: bool = True
    build_fields_function: Optional[Callable[[], list[NonModelDataField]]] = None

    def __post_init__(self) -> None:
        # The declared fields; refresh_fields() appends the built ones to them.
        self._declared_fields = list(self.fields)
        if self.single_record:
            self.can_create = False
            self.can_delete = False
        keys = [f.key for f in self.fields]
        if not self.pk_fields:
            raise ValueError(f"NonModelDataResource '{self.name}': pk_fields is required")
        missing = [key for key in self.pk_fields if key not in keys]
        if missing:
            raise ValueError(f"NonModelDataResource '{self.name}': pk_fields {missing} are not fields")

    # ── Capabilities ─────────────────────────────────────────────────────────

    def accepts_write_action(self, action: str) -> bool:
        """True when the resource accepts *action* (``create``, ``update`` or ``delete``)."""
        declared = {"create": self.can_create, "update": self.can_update, "delete": self.can_delete}.get(action)
        supported = bool(getattr(self.data_source, f"supports_{action}", False))
        return supported if declared is None else (declared and supported)

    # ── Fields ───────────────────────────────────────────────────────────────

    def refresh_fields(self) -> None:
        """Rebuild ``fields``: the declared fields, then those of ``build_fields_function``."""
        if self.build_fields_function is None:
            return
        declared_keys = {f.key for f in self._declared_fields}
        built = [f for f in self.build_fields_function() if f.key not in declared_keys]
        self.fields = self._declared_fields + built

    def get_field_by_key(self, key: str) -> Optional[NonModelDataField]:
        """Return the field with *key*, or ``None``."""
        return next((f for f in self.fields if f.key == key), None)

    @property
    def ui_primary_key_field(self) -> str:
        """The ``ModelDef.pkField``: the key field, or ``eid`` for a composite key."""
        return self.pk_fields[0] if len(self.pk_fields) == 1 else "eid"

    # ── UI schema ────────────────────────────────────────────────────────────

    def to_model_def(self) -> dict:
        """Return the resource as a UI ``ModelDef`` (the shape of ``allModels.gen.ts`` entries)."""
        self.refresh_fields()
        model_def: dict[str, Any] = {
            "name": "".join(part.title() for part in self.name.split("_")),
            "label": self.label,
            "resource": self.name,
            "pkField": self.ui_primary_key_field,
            "pkFields": list(self.pk_fields),
            "isNonModelData": True,
            "isSingleRecord": self.single_record,
            "listViewType": self.list_view_type,
            "fields": [f.to_field_def(self.pk_fields) for f in self.fields],
            "relations": [relation.to_relation_def() for relation in self.relations],
            "capabilities": {action: self.accepts_write_action(action) for action in ("create", "update", "delete")},
        }
        if self.module:
            model_def["module"] = self.module
        if self.description:
            model_def["description"] = self.description
        if self.default_sort:
            model_def["defaultSort"] = {"field": self.default_sort[0], "order": self.default_sort[1]}
        if self.title_fields:
            model_def["titleFields"] = list(self.title_fields)
        if not self.show_analyze_section:
            model_def["showAnalyzeSection"] = False
        return model_def


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

#: Every registered non-model data resource, keyed by name.
_NON_MODEL_DATA_RESOURCES_BY_NAME: dict[str, NonModelDataResource] = {}


def register_non_model_data_resource(data_resource: NonModelDataResource) -> None:
    """Record *resource*; a later registration with the same name replaces it."""
    _NON_MODEL_DATA_RESOURCES_BY_NAME[data_resource.name] = data_resource


def get_non_model_data_resource(name: str) -> Optional[NonModelDataResource]:
    """Return the non-model data resource called *name*, or ``None``."""
    return _NON_MODEL_DATA_RESOURCES_BY_NAME.get(name)


def get_non_model_data_resources() -> list[NonModelDataResource]:
    """Return every registered non-model data resource, in registration order."""
    return list(_NON_MODEL_DATA_RESOURCES_BY_NAME.values())
