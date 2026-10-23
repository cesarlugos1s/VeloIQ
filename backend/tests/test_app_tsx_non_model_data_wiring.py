"""`veloiq generate` wires the non-model data resources into an existing host App.tsx once."""
from veloiq_framework.api_schema_gen import _ensure_app_tsx_non_model_data_resource_wiring

APP_TSX = '''import {
    authProvider,
    DynamicList,
} from "@juicemantics/veloiq-ui";

const resources = [];

export default function App() {
    return (
        <Refine
            resources={resources}
        >
            <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                {extensionRoutes.map((r) => (
                    <Route key={r.path} path={r.path} element={r.element} />
                ))}
            </Routes>
        </Refine>
    );
}
'''


def test_wiring_is_added_once(tmp_path):
    app_tsx = tmp_path / "App.tsx"
    app_tsx.write_text(APP_TSX)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    patched = app_tsx.read_text()
    assert "NonModelDataResourcePages," in patched and "useRefineResourcesIncludingNonModelData," in patched
    assert "const resourcesIncludingNonModelData = useRefineResourcesIncludingNonModelData(resources);" in patched
    assert "resources={resourcesIncludingNonModelData}" in patched
    assert patched.index('path="/:nonModelDataResource/*"') < patched.index("{extensionRoutes.map(")
    assert (tmp_path / "App.tsx.bak").read_text() == APP_TSX
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert app_tsx.read_text() == patched


def test_unrecognised_app_tsx_is_left_unchanged(tmp_path):
    app_tsx = tmp_path / "App.tsx"
    restructured = APP_TSX.replace("{extensionRoutes.map(", "{customRoutes.map(")
    app_tsx.write_text(restructured)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert app_tsx.read_text() == restructured


def test_route_passes_page_overrides_and_old_route_is_upgraded(tmp_path):
    """The route gives the extensions' page overrides; a route wired by an earlier version is updated."""
    app_tsx = tmp_path / "App.tsx"
    app_tsx.write_text(APP_TSX)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert "pageOverrides={{ list: extensionListComponents, show: extensionShowComponents" in app_tsx.read_text()

    older = app_tsx.read_text().replace(
        app_tsx.read_text().split('<Route path="/:nonModelDataResource/*"')[1].split("\n")[0],
        ' element={<NonModelDataResourcePages />} />')
    app_tsx.write_text(older)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert "pageOverrides={{" in app_tsx.read_text()


#: A host whose <Refine> is rendered by its own component, which builds `resources` with useMemo.
APP_TSX_WITH_REFINE_IN_APP_CONTENT = '''import {
    authProvider,
} from "@juicemantics/veloiq-ui";

export default function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

function AppContent() {
    const licensedRegistrations = useMemo(() => [], []);

    const resources = useMemo(() => [
        { name: "dashboard", list: "/dashboard", meta: { label: t("Dashboard; home") } },
        ...licensedRegistrations.flatMap(({ models }) => generateResources(models)),
    ], [licensedRegistrations]);

    return (
        <Refine
            resources={resources}
        >
            <Routes>
                {extensionRoutes.map((r) => (
                    <Route key={r.path} path={r.path} element={r.element} />
                ))}
            </Routes>
        </Refine>
    );
}
'''

HOOK_LINE = "const resourcesIncludingNonModelData = useRefineResourcesIncludingNonModelData(resources);"


def test_hook_goes_after_resources_in_the_component_rendering_refine(tmp_path):
    """The hook is placed after `const resources = useMemo(...)` of the component rendering <Refine>, not in App()."""
    app_tsx = tmp_path / "App.tsx"
    app_tsx.write_text(APP_TSX_WITH_REFINE_IN_APP_CONTENT)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    patched = app_tsx.read_text()
    assert patched.count(HOOK_LINE) == 1
    assert patched.index("function AppContent()") < patched.index("], [licensedRegistrations]);") < patched.index(HOOK_LINE)
    assert patched.index(HOOK_LINE) < patched.index("resources={resourcesIncludingNonModelData}")
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert app_tsx.read_text() == patched


def test_hook_placed_by_an_earlier_version_in_app_is_moved(tmp_path):
    """A hook block an earlier version wrote at the top of App() (where `resources` is undefined) is moved."""
    app_tsx = tmp_path / "App.tsx"
    app_tsx.write_text(APP_TSX_WITH_REFINE_IN_APP_CONTENT)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    correct = app_tsx.read_text()
    block = correct[correct.index("    // VELOIQ:NON_MODEL_DATA_RESOURCES:START"):correct.index("// VELOIQ:NON_MODEL_DATA_RESOURCES:END\n") + len("// VELOIQ:NON_MODEL_DATA_RESOURCES:END\n")]
    misplaced = correct.replace(block, "").replace("export default function App() {\n", "export default function App() {\n" + block)
    app_tsx.write_text(misplaced)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert app_tsx.read_text() == correct


def test_navigation_page_entries_are_wired_when_app_tsx_has_its_navigation_config(tmp_path):
    """With the scaffold's navConfigData import, the block also lists the navigation config's "page" entries."""
    app_tsx = tmp_path / "App.tsx"
    with_navigation_config = APP_TSX.replace(
        '} from "@juicemantics/veloiq-ui";\n',
        '} from "@juicemantics/veloiq-ui";\nimport type { NavConfig } from "@juicemantics/veloiq-ui";\nimport navConfigData from "./navigation.config.json";\n',
        1,
    )
    app_tsx.write_text(with_navigation_config)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    patched = app_tsx.read_text()
    assert ("const resourcesIncludingNonModelData = useRefineResourcesIncludingNavigationPages("
            "useRefineResourcesIncludingNonModelData(resources), navConfigData as NavConfig);") in patched
    assert "    useRefineResourcesIncludingNavigationPages," in patched
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert app_tsx.read_text() == patched


def test_an_earlier_block_gains_the_navigation_pages_on_the_next_generate(tmp_path):
    """A block written by an earlier version (no navigation pages) is brought up to date."""
    app_tsx = tmp_path / "App.tsx"
    with_navigation_config = APP_TSX.replace(
        '} from "@juicemantics/veloiq-ui";\n',
        '} from "@juicemantics/veloiq-ui";\nimport type { NavConfig } from "@juicemantics/veloiq-ui";\nimport navConfigData from "./navigation.config.json";\n',
        1,
    )
    app_tsx.write_text(with_navigation_config)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    upgraded = app_tsx.read_text()
    earlier = upgraded.replace(
        "useRefineResourcesIncludingNavigationPages(useRefineResourcesIncludingNonModelData(resources), navConfigData as NavConfig)",
        "useRefineResourcesIncludingNonModelData(resources)",
    ).replace("    useRefineResourcesIncludingNavigationPages,\n", "")
    app_tsx.write_text(earlier)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert app_tsx.read_text() == upgraded


def test_route_passes_the_global_show_header_buttons_when_app_tsx_defines_them(tmp_path):
    """Non-model record pages get the extensions' Show header buttons, as model Show pages do."""
    app_tsx = tmp_path / "App.tsx"
    app_tsx.write_text(APP_TSX)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    # Without the VELOIQ:GLOBAL_SHOW_HEADER_BUTTONS block there is nothing to pass.
    assert "showHeaderButtons=" not in app_tsx.read_text()

    with_header_buttons = app_tsx.read_text().replace(
        "const resources = [];",
        "const resources = [];\nconst _globalShowHeaderButtons = (resource, model, allModels) => (record) => null;",
    )
    app_tsx.write_text(with_header_buttons)
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    patched = app_tsx.read_text()
    assert "showHeaderButtons={_globalShowHeaderButtons} />} />" in patched
    _ensure_app_tsx_non_model_data_resource_wiring(tmp_path)
    assert app_tsx.read_text() == patched
