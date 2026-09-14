"""Shared license-pool aggregation, used by both the ``/api/licensing/status``
endpoint and any server-side code (e.g. the user-guide generator) that needs
to know which modules the current license allows.

Extracted from ``factory.py`` so the aggregation logic (host app registry +
every installed extension's registry) lives in exactly one place.
"""
from datetime import date as _date


def aggregate_license_pool(extensions: list | None = None) -> dict:
    """Return the combined license pool from the host app and all extensions.

    Same shape returned by ``/api/licensing/status``: ``licensed_modules``,
    ``write_allowed_modules``, ``group_statuses``, ``module_groups``,
    ``warnings``, ``installation_id``.
    """
    all_licensed_modules: list[str] = []
    all_write_allowed_modules: list[str] = []
    all_group_statuses: dict[str, str] = {}
    all_module_groups: dict[str, list[str]] = {}
    all_warnings: list[dict] = []
    installation_id: str | None = None

    # ── Host app license registry (if exists) ──────────────────────────
    try:
        import app.modules.license.license_registry as host_reg  # type: ignore[import]

        all_licensed_modules.extend(host_reg.get_licensed_modules())
        all_write_allowed_modules.extend(host_reg.get_write_allowed_modules())
        all_group_statuses.update(getattr(host_reg, "_group_statuses", {}))
        all_module_groups.update(getattr(host_reg, "MODULE_GROUPS", {}))

        get_id_fn = getattr(host_reg, "get_installation_id", None)
        if callable(get_id_fn):
            try:
                installation_id = get_id_fn()
            except Exception:
                pass

        today = _date.today()
        governing = getattr(host_reg, "_governing_keys", {})
        for group, key_data in governing.items():
            status = all_group_statuses.get(group, "blocked")
            end_date = key_data.get("end_date") if isinstance(key_data, dict) else getattr(key_data, "end_date", None)
            if status == "grace_period":
                days_left = max(0, 30 - (today - end_date).days) if end_date else 0
                all_warnings.append({"type": "grace_period", "group": group, "days_remaining": days_left})
            elif status == "active" and end_date and (end_date - today).days <= 30:
                all_warnings.append({"type": "expiry_approaching", "group": group, "days_remaining": (end_date - today).days})
    except ImportError:
        pass  # Host app has no license module — no host modules to gate.

    # ── Extension license registries ────────────────────────────────────
    if extensions:
        for ext in extensions:
            try:
                pkg = ext.modules_package
                lic_mod = __import__(f"{pkg}.license.license_registry", fromlist=["license_registry"])
                ext_licensed = getattr(lic_mod, "get_licensed_modules", lambda: [])()
                ext_write_allowed = getattr(lic_mod, "get_write_allowed_modules", lambda: [])()
                ext_statuses = getattr(lic_mod, "_group_statuses", {})
                ext_groups = getattr(lic_mod, "MODULE_GROUPS", {})

                all_licensed_modules.extend(ext_licensed)
                all_write_allowed_modules.extend(ext_write_allowed)
                all_group_statuses.update(ext_statuses)
                all_module_groups.update(ext_groups)

                today = _date.today()
                governing = getattr(lic_mod, "_governing_keys", {})
                for group, key in governing.items():
                    status = ext_statuses.get(group, "blocked")
                    end_date = key.end_date if hasattr(key, "end_date") else key.get("end_date")
                    if status == "grace_period":
                        days_left = max(0, 30 - (today - end_date).days) if end_date else 0
                        all_warnings.append({"type": "grace_period", "group": group, "days_remaining": days_left})
                    elif status == "active" and end_date and (end_date - today).days <= 30:
                        all_warnings.append({"type": "expiry_approaching", "group": group, "days_remaining": (end_date - today).days})
            except ImportError:
                continue  # Extension has no license module — skip.
            except Exception:
                continue  # Graceful degradation for any other error.

    seen_mods: set[str] = set()
    deduped_licensed: list[str] = []
    for m in all_licensed_modules:
        if m not in seen_mods:
            seen_mods.add(m)
            deduped_licensed.append(m)

    seen_wmods: set[str] = set()
    deduped_write_allowed: list[str] = []
    for m in all_write_allowed_modules:
        if m not in seen_wmods:
            seen_wmods.add(m)
            deduped_write_allowed.append(m)

    return {
        "installation_id": installation_id,
        "licensed_modules": deduped_licensed,
        "write_allowed_modules": deduped_write_allowed,
        "group_statuses": all_group_statuses,
        "module_groups": all_module_groups,
        "warnings": all_warnings,
    }


# Modules that are always accessible regardless of license, mirroring the
# frontend's ``useLicensePool`` ``ALWAYS_ON`` set.
_ALWAYS_ON_MODULES = {"authobjs", "lib", "license"}


def is_module_licensed(module_name: str, pool: dict) -> bool:
    """True if ``module_name`` is accessible under ``pool``, mirroring the
    frontend's ``isModuleLicensed`` (``useLicensePool.ts``): always-on modules
    and modules that aren't gated by any license group are always visible;
    otherwise the module must appear in ``licensed_modules``.
    """
    key = module_name.lower()
    if key in _ALWAYS_ON_MODULES:
        return True
    module_groups = pool.get("module_groups") or {}
    in_any_group = any(key in {m.lower() for m in mods} for mods in module_groups.values())
    if not in_any_group:
        return True
    licensed = {m.lower() for m in (pool.get("licensed_modules") or [])}
    return key in licensed
