"""Collapsible model-based banners defined in ``banners.json``.

See :mod:`veloiq_framework.banners.definitions` for the file format,
:mod:`veloiq_framework.banners.service` for how a banner's rows are selected
and :mod:`veloiq_framework.banners.router` for the endpoint the frontend's
``BannerHost`` reads.
"""
from .definitions import get_banner_definitions, load_banner_definitions
from .service import banner_applies, banner_data, banners_for_page

__all__ = [
    "banner_applies",
    "banner_data",
    "banners_for_page",
    "get_banner_definitions",
    "load_banner_definitions",
]
