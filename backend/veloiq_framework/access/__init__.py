"""Role access policies: runtime allowlists/blocklists of modules and models.

Public API:

* :func:`can_access` / :func:`can_access_model` — the shared decision function
* :func:`can_use_feature` — the same for registered features
* :func:`feature_is_enabled` — a feature's config switch and :func:`can_use_feature` together
* :func:`set_feature_user` — set the user :func:`feature_is_enabled` decides for
* :func:`register_feature` — let an extension register a feature
* :class:`AccessDecision` — its result (``allowed`` + reason code)
* :func:`requires_action` — let a custom endpoint declare its action
"""
from veloiq_framework.access.decision import (  # noqa: F401
    ACTIONS,
    AccessDecision,
    can_access,
    can_access_model,
    can_use_feature,
    current_feature_user,
    evaluate_access,
    evaluate_feature_access,
    feature_is_enabled,
    require_access,
    reset_feature_user,
    set_feature_user,
)
from veloiq_framework.access.registry import register_feature  # noqa: F401
from veloiq_framework.access.dependencies import requires_action  # noqa: F401
