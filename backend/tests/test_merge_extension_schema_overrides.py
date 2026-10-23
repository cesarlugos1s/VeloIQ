"""Generated module schemas merge their overrides with the shared ``mergeUiModelSchemas``."""
from veloiq_framework.api_schema_gen import _write_manual_schema_if_missing, _write_merged_schema


def test_merged_schema_applies_extension_overrides_then_host_overrides(tmp_path):
    _write_merged_schema("nlp", tmp_path, with_extension_overrides=True)
    merged = (tmp_path / "nlpSchema.ts").read_text()
    assert "import { mergeUiModelSchemas } from '@juicemantics/veloiq-ui';" in merged
    assert "import { nlpManualOverrides as nlpExtensionOverrides } from './nlpSchema.extensionOverrides';" in merged
    assert "import { nlpManualOverrides } from './nlpSchema.manual';" in merged
    # The extension's overrides first, the host's on top.
    assert "export const nlpModels: ModelDef[] = mergeUiModelSchemas(nlpModelsGen, nlpExtensionOverrides, nlpManualOverrides);" in merged
    # No merge code of its own any more.
    assert "const mergeFields" not in merged


def test_merged_schema_without_extension_overrides_uses_the_host_overrides_only(tmp_path):
    _write_merged_schema("tasks", tmp_path)
    merged = (tmp_path / "tasksSchema.ts").read_text()
    assert "extensionOverrides" not in merged
    assert "mergeUiModelSchemas(tasksModelsGen, tasksManualOverrides);" in merged


def test_manual_stub_uses_the_package_override_types_and_documents_omit(tmp_path):
    _write_manual_schema_if_missing("tasks", tmp_path)
    manual = (tmp_path / "tasksSchema.manual.ts").read_text()
    assert "import type { ModelOverride } from '@juicemantics/veloiq-ui';" in manual
    assert "export const tasksManualOverrides: ModelOverride[] = [" in manual
    assert "omit: true" in manual
    # Never overwritten once it exists.
    (tmp_path / "tasksSchema.manual.ts").write_text("custom")
    _write_manual_schema_if_missing("tasks", tmp_path)
    assert (tmp_path / "tasksSchema.manual.ts").read_text() == "custom"
