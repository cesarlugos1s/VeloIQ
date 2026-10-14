"""Role access policies: runtime allowlists/blocklists of modules and models.

Public API:

* :func:`can_access` / :func:`can_access_model` — the shared decision function
* :class:`AccessDecision` — its result (``allowed`` + reason code)
* :func:`requires_action` — let a custom endpoint declare its action
"""
from veloiq_framework.access.decision import (  # noqa: F401
    ACTIONS,
    AccessDecision,
    can_access,
    can_access_model,
    evaluate_access,
    require_access,
)
from veloiq_framework.access.dependencies import requires_action  # noqa: F401
