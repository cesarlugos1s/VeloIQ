# Non-Model Data Resources

A **non-model data resource** is data that does not come from an application
model, served and shown exactly like a model: a JSON configuration file,
configurable parameters, computed summaries, an external service. The
framework gives it the REST contract of a model's CRUD router and a `ModelDef`,
so the standard pages work with it unchanged: every list view type (table,
gallery, totals-details, calendar…), the record pages and forms, search,
filters, sorting, paging, CSV export, the Analyze section, saved views,
relations and translations.

Use one whenever a page would otherwise need its own list, table or form for
data that is not a model. The same resources serve the admin app and the
[external portals](external-portals.md).

## Declaring a resource

Put the declaration in a module's `non_model_data_resources.py` (in the host
app or in an extension module). At startup the module loader mounts every
`NonModelDataResource` instance it finds there at `/api/<name>`.

```python
from veloiq_framework.non_model_data_resources import (
    JsonFileDataSource, NonModelDataField, NonModelDataResource,
)

regional_rates = NonModelDataResource(
    name="regional_rates",            # endpoint /api/regional_rates, page /regional_rates
    label="Regional Rates",           # a catalog msgid
    module="billing",                 # menu grouping, access policies, licensing
    pk_fields=["region", "code"],     # one or more fields that identify a row
    fields=[
        NonModelDataField(key="region", label="Region"),
        NonModelDataField(key="code", label="Code"),
        NonModelDataField(key="rate", label="Rate", type="number", required=True),
    ],
    data_source=JsonFileDataSource("config/regional_rates.json"),
)
```

From code, `mount_non_model_data_resource(app, resource)` does the same.

Each row gets an `eid` built from its key fields (a composite key is encoded
into one value) and a `_revision`. A write that sends the revision it read is
refused with 409 when the row changed in the meantime; the UI sends it
automatically.

## Data sources

| Source | Rows | Writes |
|---|---|---|
| `JsonFileDataSource(path, …)` | A JSON file: an array of row objects (`layout="list"`) or an object keyed by the row key (`layout="keyed"`); `rows_path` points to the rows inside a larger document, whose other content is kept | Written atomically; `read_only=True` disables writes |
| `JsonFileDataSource(path, packaged_path=…)` | A file shipped inside a pip-installed extension (`packaged_path`) under a host-app overlay (`path`, in `config/`), merged by `eid` | Only the overlay is written; deleting a packaged row adds a `"_deleted": true` marker |
| `PythonFunctionsDataSource(load_all_rows_function, create_row_function=…, update_row_function=…, delete_row_function=…)` | Whatever the functions return: settings files, an external service, computed data | Each write function that is given enables that action |

The functions receive a `DataSourceRequestContext` (the signed-in `user` and
the `request`), so a source can return per-user rows. Host app database reads
inside them go through `jm_execute_orm`.

## Fields

`NonModelDataField(key, label, type, …)`. The type is one of `string`,
`number`, `boolean`, `date`, `datetime`, `time` or `image_url`.

| Option | Effect |
|---|---|
| `required`, `read_only`, `default`, `integer` | Validation and form behavior; writes are validated against the declared fields |
| `options` / `options_url` | Allowed values (a list, or an API path answering them) |
| `multiple` | The field holds a list of values (tags; multi-select editor; a filter matches any of them) |
| `reference`, `reference_key` | A relation field: the target model's table name or non-model resource name (and, for a composite target key, which key part it holds) |
| `type_from_field`, `options_from_field` | The field's type or options come from another field of the same row (parameter lists) |
| `value_colors` | Tag color per value |
| `show_in_list` | `False` leaves it out of the default list columns (still in the column selector and the record page) |
| `show_view_type`, `edit_view_type` | Field view types, as for model fields |
| `read_roles`, `write_roles` | Roles that may read or write the field (`None`: every role); unreadable fields are left out of responses and exports |
| `description` | Help text shown with the field |

Fields known only at run time (one per registered setting, the store's current
categories) come from `build_fields_function`, which returns more fields and
runs on every request.

## Resource options

| Option | Effect |
|---|---|
| `list_view_type` | The list page's view type (`table`, `gallery`, `totals-details`…) |
| `default_sort` | `("field", "asc" \| "desc")` when the request has no sort |
| `default_page_size` | Rows per page a list of the resource starts with |
| `quick_filter_fields` | A multi-select per field in the list's Filters panel (fields with `options`; rows having any chosen value, or for a `multiple` field any of its values) |
| `title_fields` | Fields composing a row's title (record headings, references) |
| `relations` | `NonModelDataRelation(related_resource_name, target_key, …)`: one-to-many relations shown on the record page |
| `can_create`, `can_update`, `can_delete` | Limit the actions the source supports (`None`: what the source supports) |
| `single_record` | Exactly one record (a settings form), shown with the record form instead of a list |
| `source_generates_keys` | The source assigns a new row's key |
| `validate_row` | `(row, rows) -> list[str]` of translated errors, for rules across fields or rows |
| `show_analyze_section` | `False` hides the Analyze section on its lists |
| `access_check` | `(request, action) -> None`, replacing the default access decision (see below) |

Example — the retail store's catalog, a read-only gallery with a category
filter:

```python
storefront_products = NonModelDataResource(
    name="storefront_products",
    label="Products",
    module="product",
    pk_fields=["id"],
    fields=[NonModelDataField(key="id", label="Product", type="number", read_only=True)],
    build_fields_function=build_storefront_product_fields,   # image, name, price, categories…
    list_view_type="gallery",
    quick_filter_fields=["categories"],
    default_page_size=50,
    default_sort=("id", "asc"),
    show_analyze_section=False,
    data_source=PythonFunctionsDataSource(load_storefront_product_rows),
)
```

## Access and licensing

By default a request is allowed when the shared access decision allows it, as
for a model: licensing of the resource's `module`, the role's methods, and the
role access policies (Access Control → Roles), which list a non-model resource
by its module and name. An `access_check` replaces that decision; one that only
adds a rule (e.g. Admin only) calls
`check_shared_non_model_data_resource_access(request, resource, action)` to keep
it. Field-level `read_roles` / `write_roles` apply on top.

## REST contract

| Request | Action |
|---|---|
| `GET /api/<name>` | List with `_start`/`_end` paging (`x-total-count`), `_sort`/`_order`, `q` search, and filters `field=`, `field__in=a,b`, `field__ilike=`, `field_gte=`, `field_lte=`, `field_ne=` |
| `GET /api/<name>/export-csv` | Every matching row as CSV |
| `POST /api/<name>/analyze` | Server-side aggregation for the Analyze section |
| `GET /api/<name>/<eid>` | One row |
| `POST /api/<name>` | Add a row |
| `PUT` / `PATCH /api/<name>/<eid>` | Change a row |
| `DELETE /api/<name>/<eid>` | Delete a row |

`GET /api/veloiq/non-model-data-resources` returns the `ModelDef` of every
resource the user may read; the UI merges them into its models.

## Pages, menus and layouts

- **Pages.** The standard list, create, show and edit pages are served at the
  same paths as a model's (`/<name>`, `/<name>/show/<eid>`…) by
  `NonModelDataResourcePages`, which the app mounts once at
  `/:nonModelDataResource/*` (`VeloIQPortalApp` does this for portals). Refine
  resources for them come from `useRefineResourcesIncludingNonModelData`.
- **Menus.** Add an entry for the resource to the menu: a `"page"` entry with
  `"route": "/<name>"` in `navigation.config.json`, an extension's
  `user_menu_items`, or, in a portal's menu file, an entry keyed by the
  resource name.
- **Record layout.** A record page's sections and the fields side by side are
  a page configuration (`<name>:show`, `<name>:edit`) in the `page_configs.json`
  of the package that owns the resource. See
  [Show and edit page section layout](configuration-reference.md#show-and-edit-page-section-layout).
- **Page-specific actions.** Give a list row actions, and a record page header
  buttons (`showHeaderButtons`), instead of writing a custom page.

## Rows that exist only in a page

For rows that are not saved anywhere until a form is submitted (e.g. an
editable list inside a form), use `useInPageRowsStore(storeName, model, rows)`
in the page and pass its `model` to `DynamicList`. The store answers the
views' requests in the browser, so paging, search, filters, Analyze, inline
editing, adding and deleting work; read the rows with `getRows()` when saving.
