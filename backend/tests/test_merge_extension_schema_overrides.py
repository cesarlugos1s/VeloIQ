"""An extension's own schema overrides reach the host app's merged module schema."""
from veloiq_framework.api_schema_gen import _write_merged_schema


def test_merged_schema_applies_extension_overrides_then_host_overrides(tmp_path):
    _write_merged_schema("nlp", tmp_path, with_extension_overrides=True)
    merged = (tmp_path / "nlpSchema.ts").read_text()
    assert "import { nlpManualOverrides as nlpExtensionOverrides } from './nlpSchema.extensionOverrides';" in merged
    assert "import { nlpManualOverrides } from './nlpSchema.manual';" in merged
    # The extension's overrides first, the host's on top.
    assert "const overrideLists: ModelOverride[][] = [nlpExtensionOverrides, nlpManualOverrides];" in merged
    assert "...nlpModelsGen.map(applyOverrides)," in merged


def test_merged_schema_without_extension_overrides_uses_the_host_overrides_only(tmp_path):
    _write_merged_schema("tasks", tmp_path)
    merged = (tmp_path / "tasksSchema.ts").read_text()
    assert "extensionOverrides" not in merged
    assert "const overrideLists: ModelOverride[][] = [tasksManualOverrides];" in merged
