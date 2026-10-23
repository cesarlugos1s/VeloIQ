"""Non-model data resources: non-model data served with the REST contract and UI of a model.

See :mod:`veloiq_framework.non_model_data_resources.non_model_data_resource_definitions` for how to declare one.
"""
from __future__ import annotations

from typing import Any

from .non_model_data_resource_definitions import (
    NON_MODEL_DATA_FIELD_TYPES,
    NonModelDataField,
    NonModelDataRelation,
    NonModelDataResource,
    get_non_model_data_resource,
    get_non_model_data_resources,
    register_non_model_data_resource,
)
from .encode_decode_row_eid import COMPOSITE_EID_ESCAPE, COMPOSITE_EID_SEPARATOR, RowEidEncodingError, decode_eid, encode_eid
from .manage_data_sources_crud import PythonFunctionsDataSource, JsonFileDataSource, DataSourceChangedConflictError, DataSourceRequestContext, NonModelDataSource

__all__ = [
    "NON_MODEL_DATA_FIELD_TYPES",
    "NonModelDataField",
    "NonModelDataRelation",
    "NonModelDataResource",
    "NonModelDataSource",
    "JsonFileDataSource",
    "PythonFunctionsDataSource",
    "DataSourceRequestContext",
    "DataSourceChangedConflictError",
    "COMPOSITE_EID_SEPARATOR",
    "COMPOSITE_EID_ESCAPE",
    "RowEidEncodingError",
    "encode_eid",
    "decode_eid",
    "register_non_model_data_resource",
    "get_non_model_data_resource",
    "get_non_model_data_resources",
    "mount_non_model_data_resource",
    "mount_module_non_model_data_resources",
]


def mount_non_model_data_resource(app_or_router: Any, data_resource: NonModelDataResource, prefix: str = "/api") -> None:
    """Register *resource* and serve it at ``{prefix}/{resource.name}``.

    :param app_or_router: The FastAPI app (or an APIRouter already under ``/api``,
        with ``prefix=""``).
    """
    from .non_model_data_resource_api_router import create_non_model_data_resource_router

    register_non_model_data_resource(data_resource)
    app_or_router.include_router(create_non_model_data_resource_router(data_resource), prefix=prefix)


def mount_module_non_model_data_resources(app: Any, module: Any, label: str) -> list[str]:
    """Mount every :class:`NonModelDataResource` instance defined in an imported ``non_model_data_resources`` module.

    :param module: The imported ``<module>.non_model_data_resources`` Python module.
    :param label: Printed in the startup log (e.g. ``"tasks"`` or ``"myext/tasks"``).
    :return: The names of the mounted resources.
    """
    mounted = []
    for attr_name in dir(module):
        data_resource = getattr(module, attr_name)
        if isinstance(data_resource, NonModelDataResource):
            mount_non_model_data_resource(app, data_resource)
            mounted.append(data_resource.name)
            print(f"  ✅ Non-model data resource: {label}/{data_resource.name}")
    return mounted
