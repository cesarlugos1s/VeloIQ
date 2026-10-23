"""Quick filters and default page size of a non-model data resource."""
from veloiq_framework.non_model_data_resources import NonModelDataField, NonModelDataResource, PythonFunctionsDataSource
from veloiq_framework.non_model_data_resources.filter_sort_page_rows import filter_rows_by_query_parameters

ROWS = [
    {"id": 1, "name": "Shirt", "categories": ["Apparel", "Men"]},
    {"id": 2, "name": "Mug", "categories": ["Home"]},
    {"id": 3, "name": "Dress", "categories": ["Apparel", "Women"]},
]

catalog = NonModelDataResource(
    name="quick_filter_catalog", label="Catalog", pk_fields=["id"],
    fields=[
        NonModelDataField(key="id", label="Id", type="number"),
        NonModelDataField(key="name", label="Name"),
        NonModelDataField(key="categories", label="Categories", multiple=True,
                          options=["Apparel", "Home", "Men", "Women"]),
    ],
    quick_filter_fields=["categories"],
    default_page_size=50,
    data_source=PythonFunctionsDataSource(lambda request_context: ROWS),
)


def test_the_model_def_names_the_quick_filters_and_page_size():
    model_def = catalog.to_model_def()
    assert model_def["quickFilterFields"] == ["categories"]
    assert model_def["defaultPageSize"] == 50


def test_a_quick_filter_keeps_rows_with_any_chosen_value():
    kept = filter_rows_by_query_parameters(catalog, ROWS, {"categories__in": "Men,Home"})
    assert [row["name"] for row in kept] == ["Shirt", "Mug"]
