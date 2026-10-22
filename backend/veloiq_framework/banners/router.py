"""HTTP endpoint of the collapsible banners, mounted under ``/api``.

``GET /api/veloiq/banners`` returns the banners one page shows, each with its
display settings, its row count and its first rows, so the browser draws every
banner of the page from one request. The host app passes the page's
``resource`` (and ``module`` for custom pages); an external website passes its
``site`` key instead (e.g. ``candidate-portal``).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from veloiq_framework.db import get_session

from .service import banners_for_page

router = APIRouter(tags=["banners"])


@router.get("/veloiq/banners")
def get_page_banners(
    request: Request,
    resource: Optional[str] = None,
    module: Optional[str] = None,
    site: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Return the banners shown on the page described by the query parameters.

    :param resource: The host app page's model or named query resource.
    :param module: The page's module, for pages that are not a model page.
    :param site: The external website key, for an external website's pages.
    :return: ``{"banners": [...]}``, highest ``priority`` first. Banners whose
        models the signed-in user may not read are left out.
    """
    user = getattr(request.state, "user", None)
    return {"banners": banners_for_page(session, user, resource=resource, module=module, site=site)}
