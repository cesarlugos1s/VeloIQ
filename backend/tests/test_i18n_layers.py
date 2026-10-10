"""Layered translation catalogs: VeloIQ, then extensions, then the host app."""
import json
import os
from pathlib import Path

import pytest
from click.testing import CliRunner

from veloiq_framework.utils import i18n_utils
from veloiq_framework.utils.po_catalog import extract_msgids, read_po


def _po(locales_dir: Path, locale: str, entries: dict) -> None:
    path = locales_dir / locale / "LC_MESSAGES" / "messages.po"
    path.parent.mkdir(parents=True, exist_ok=True)
    body = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n'
    body += "\n".join(f'msgid "{k}"\nmsgstr "{v}"\n' for k, v in entries.items())
    path.write_text(body, encoding="utf-8")


@pytest.fixture
def layers(tmp_path, monkeypatch):
    """A VeloIQ layer, one extension layer and a host layer, all under tmp_path."""
    framework = tmp_path / "framework"
    extension = tmp_path / "extension"
    host = tmp_path / "host"
    _po(framework, "es", {"Save": "Guardar", "Cancel": "Cancelar", "Dashboard": "Tablero"})
    _po(framework, "en", {"sales_record": "Sales Records"})
    _po(extension, "es", {"Ask": "Preguntar", "Dashboard": "Panel"})
    _po(host, "es", {"Save": "Grabar", "sales_record": "Registros de ventas"})
    _po(host, "fr", {"Save": "Enregistrer"})

    saved = (i18n_utils.FRAMEWORK_LOCALES_DIR, i18n_utils._EXTENSION_LOCALES_DIRS,
             i18n_utils.I18N_LOCALES_DIR, i18n_utils.DEFAULT_LOCALE)
    monkeypatch.setattr(i18n_utils, "FRAMEWORK_LOCALES_DIR", framework)
    monkeypatch.delenv("VELOIQ_I18N_LOCALE", raising=False)
    monkeypatch.setenv("LANG", "")
    i18n_utils.configure_i18n(locales_dir=str(host), default_locale="en", extension_locales_dirs=[extension])
    yield tmp_path
    i18n_utils.FRAMEWORK_LOCALES_DIR = saved[0]
    i18n_utils.configure_i18n(locales_dir=str(saved[2]), default_locale=saved[3], extension_locales_dirs=saved[1])


def test_lookup_order_host_then_extensions_then_veloiq(layers):
    _ = i18n_utils._
    assert _("Save", locale="es") == "Grabar"          # host overrides VeloIQ
    assert _("Dashboard", locale="es") == "Panel"      # extension overrides VeloIQ
    assert _("Cancel", locale="es") == "Cancelar"      # VeloIQ's own
    assert _("Ask", locale="es") == "Preguntar"        # extension's own


def test_host_only_locale_falls_back_to_english(layers):
    _ = i18n_utils._
    assert "fr" in i18n_utils.get_supported_locales()
    assert _("Save", locale="fr") == "Enregistrer"
    assert _("sales_record", locale="fr") == "Sales Records"   # English catalog
    assert _("Cancel", locale="fr") == "Cancel"                # source text


def test_ui_catalog_has_english_underneath(layers):
    catalog = i18n_utils.get_ui_catalog("fr")
    assert catalog["Save"] == "Enregistrer"
    assert catalog["sales_record"] == "Sales Records"
    assert "Cancel" not in catalog


def test_regional_catalog_only_needs_its_differences(layers):
    _po(layers / "framework", "es_MX", {"Save": "Salvar"})
    i18n_utils.clear_i18n_catalog_cache()
    i18n_utils.get_supported_locales.cache_clear()
    catalog = i18n_utils.get_catalog_for_locale("es-MX")
    assert catalog["Cancel"] == "Cancelar"      # from the framework's es
    assert catalog["Dashboard"] == "Panel"      # extension es still above framework es_MX


def test_legacy_frontend_catalog_sits_below_host_po(layers, monkeypatch):
    backend = layers / "app" / "backend"
    backend.mkdir(parents=True)
    legacy_dir = layers / "app" / "frontend" / "public" / "i18n"
    legacy_dir.mkdir(parents=True)
    (legacy_dir / "es.json").write_text(json.dumps({
        "Save": "Salvar",          # host PO has Save -> ignored
        "Cancel": "Anular",        # overrides the framework
        "Ask": "Ask",              # untranslated copy -> ignored
        "Customer": "Cliente",     # app string
    }), encoding="utf-8")
    monkeypatch.chdir(backend)
    catalog = i18n_utils.get_frontend_catalog("es")
    assert catalog["Save"] == "Grabar"
    assert catalog["Cancel"] == "Anular"
    assert catalog["Ask"] == "Preguntar"
    assert catalog["Customer"] == "Cliente"


def test_extract_reads_backend_and_frontend_calls(tmp_path):
    (tmp_path / "api.py").write_text('x = _("Hello")\ny = _(f"skip {x}")\nz = _("A \\"quote\\"")\n')
    (tmp_path / "Page.tsx").write_text(
        "const a = _('World');\nconst b = _(`Tmpl ${x}`);\nconst c = _(\"Dash \\u2014 done\", 1);\nfoo_(\"no\");\n_(\" ➕ \");\n"
    )
    assert sorted(extract_msgids(tmp_path)) == sorted(["Hello", 'A "quote"', "World", "Dash — done"])


def test_migrate_keeps_only_app_strings_and_overrides(layers, monkeypatch):
    from veloiq_framework.cli.i18n import i18n

    app = layers / "app"
    (app / "backend" / "app" / "modules").mkdir(parents=True)
    (app / "frontend" / "public" / "i18n").mkdir(parents=True)
    (app / "frontend" / "public" / "i18n" / "es.json").write_text(json.dumps({
        "Cancel": "Cancelar",      # copy of VeloIQ's translation -> dropped
        "Ask": "Consultar",        # override of the extension -> kept
        "Customer": "Cliente",     # app string -> kept
        "Total": "Total",          # untranslated -> dropped
    }), encoding="utf-8")
    monkeypatch.chdir(app / "backend")
    monkeypatch.setattr("veloiq_framework.cli.i18n._package_layers",
                        lambda root: [layers / "framework", layers / "extension"])

    result = CliRunner().invoke(i18n, ["migrate"])
    assert result.exit_code == 0, result.output
    host_po = app / "backend" / "config" / "internationalization" / "locales" / "es" / "LC_MESSAGES" / "messages.po"
    assert read_po(host_po) == {"Customer": "Cliente", "Ask": "Consultar"}
    assert not (app / "frontend" / "public" / "i18n" / "es.json").exists()


def test_shipped_catalogs_parse_and_cover_spanish():
    shipped = Path(i18n_utils.__file__).resolve().parent.parent / "locales"
    es = read_po(shipped / "es" / "LC_MESSAGES" / "messages.po")
    en = read_po(shipped / "en" / "LC_MESSAGES" / "messages.po")
    assert len(es) > 400 and set(es) == set(en)
    assert es["Save"] == "Guardar"


def test_i18n_route_serves_veloiq_translations(client):
    """The task-manager sample keeps no copy of these; they come from VeloIQ's catalog."""
    response = client.get("/i18n/es.json")
    assert response.status_code == 200
    catalog = response.json()
    assert catalog["Pin to dashboard"] == "Fijar en el tablero"
    assert catalog["Dashboard tab help"] == "Ayuda de la pestaña del tablero"
