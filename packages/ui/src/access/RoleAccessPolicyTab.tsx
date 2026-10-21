/**
 * The Role model's "Access Policy" tab: one allowlist or one blocklist of
 * modules and models per role, with Create/Read/Update/Delete per entry.
 * And its "Feature Access" tab: one allowlist or one blocklist of the
 * features extensions register (such as answering methods), kept apart
 * from the module policy.
 *
 * Show page: the saved policy (read-only) and its change history.
 * Edit page: the policy editor, saved by the page's own Save button
 * (useBeforeEditSave) before the role itself.
 *
 * Admin-only: the backend enforces it on every /auth/access-policies call
 * (AC-A1). The Admin role can't be given a policy (AC-A3). After a save or a
 * removal the signed-in user's permissions are refetched (AC-E4). All texts
 * go through window._ (AC-E5).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Button,
    Checkbox,
    Radio,
    Space,
    Spin,
    Table,
    Tag,
    TreeSelect,
    Typography,
    message,
} from "antd";
import { CheckOutlined, DeleteOutlined } from "@ant-design/icons";
import { authenticatedFetch } from "../utils/authenticatedFetch";
import { refreshAccess } from "./accessStore";
import { useBeforeEditSave } from "../components/DynamicResource/hooks/useBeforeEditSave";
import type { ModelExtraTab } from "../components/DynamicResource/types";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

const BASE_URL = "/auth/access-policies";

type Action = "create" | "read" | "update" | "delete";
type Mode = "none" | "allow" | "block";

interface Entry {
    module_key: string;
    model_key: string | null;
    can_create: boolean;
    can_read: boolean;
    can_update: boolean;
    can_delete: boolean;
    active?: boolean;
}

interface Policy {
    mode: "allow" | "block";
    entries: Entry[];
}

interface FeatureEntry {
    feature_key: string;
    active?: boolean;
}

interface FeaturePolicy {
    mode: "allow" | "block";
    entries: FeatureEntry[];
}

interface RoleRow {
    role_id: number;
    role_name: string;
    is_admin: boolean;
    policy: Policy | null;
    feature_policy: FeaturePolicy | null;
}

interface ResourceModule {
    key: string;
    source: string;
    name: string;
    models: { key: string }[];
}

interface AuditRow {
    id: number;
    event: string;
    actor_username: string;
    created_at: string | null;
    before: { mode?: string; entries?: unknown[] } | null;
    after: { mode?: string; entries?: unknown[] } | null;
}

/** A registered feature, as `/auth/access-policies/resources` lists it (texts translated). */
interface ResourceFeature {
    key: string;
    source: string;
    name: string;
    label: string;
    group: string;
    description: string;
}

const ACTIONS: { action: Action; flag: keyof Entry; label: string }[] = [
    { action: "create", flag: "can_create", label: "Create" },
    { action: "read", flag: "can_read", label: "Read" },
    { action: "update", flag: "can_update", label: "Update" },
    { action: "delete", flag: "can_delete", label: "Delete" },
];

const entryId = (e: Pick<Entry, "module_key" | "model_key">) => `${e.module_key}|${e.model_key ?? ""}`;

/** Show "<module>" or "<module> › <model>", each translated through the catalogs. */
const resourceLabel = (e: Pick<Entry, "module_key" | "model_key">) => {
    const moduleName = e.module_key.split(":").slice(1).join(":") || e.module_key;
    return e.model_key ? `${_(moduleName)} › ${_(e.model_key)}` : _(moduleName);
};

const modeLabel = (mode: Mode) =>
    mode === "allow" ? _("Allowlist") : mode === "block" ? _("Blocklist") : _("No policy");

const modeHelp = (mode: Mode) =>
    mode === "allow"
        ? _("Users with this role can use only the listed modules and models, and only the checked actions.")
        : mode === "block"
            ? _("Users with this role can use everything except the checked actions on the listed modules and models.")
            : _("Users with this role can use every module and model their role and licenses allow.");

/** Payload comparison key: what the backend would store for this editor state. */
const policyKey = (mode: Mode, entries: Entry[]) =>
    mode === "none" ? "none" : JSON.stringify({ mode, entries: entries.map(({ active: _active, ...e }) => e) });

async function readJson(res: Response): Promise<any> {
    return res.json().catch(() => ({}));
}

/** Load one role's policy row (or `forbidden` for a non-admin). */
function useRolePolicy(roleId: number | string | undefined) {
    const [row, setRow] = useState<RoleRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);

    const load = useCallback(async () => {
        if (roleId === undefined || roleId === null) return;
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${BASE_URL}/${roleId}`);
            if (res.status === 403) {
                setForbidden(true);
                return;
            }
            if (!res.ok) throw new Error();
            setRow(await res.json());
        } catch {
            message.error(_("Could not load access policies."));
        } finally {
            setLoading(false);
        }
    }, [roleId]);

    useEffect(() => { void load(); }, [load]);
    return { row, loading, forbidden, reload: load };
}

const AdminNote: React.FC = () => (
    <Alert
        type="info"
        showIcon
        message={_("The Admin role always has full access and can't be given an access policy.")}
    />
);

/** Audit event codes of feature policies (shown on the Feature Access tab). */
const FEATURE_EVENTS = ["feature_save", "feature_delete"];

/**
 * A role's change history. `events`, when given, keeps only those event
 * codes; `excludeEvents` drops them. The Access Policy tab leaves out the
 * feature policy events, which the Feature Access tab shows instead.
 */
const ChangeHistory: React.FC<{ roleId: number; events?: string[]; excludeEvents?: string[] }> = ({
    roleId,
    events,
    excludeEvents,
}) => {
    const [audit, setAudit] = useState<AuditRow[]>([]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await authenticatedFetch(`${BASE_URL}/audit?role_id=${roleId}&limit=50`);
            if (!cancelled && res.ok) setAudit(await res.json());
        })();
        return () => { cancelled = true; };
    }, [roleId]);

    const rows = useMemo(
        () => audit.filter((row) =>
            (!events || events.includes(row.event)) && !(excludeEvents ?? []).includes(row.event)),
        [audit, events, excludeEvents],
    );

    const describeChange = (row: AuditRow) => {
        if (row.event === "role_get_migration") return _("Read access added to the role's methods");
        if (row.event === "role_deleted") return _("Role deleted");
        const side = (p: AuditRow["before"]) =>
            p && p.mode ? `${modeLabel(p.mode as Mode)} (${p.entries?.length ?? 0})` : _("No policy");
        return `${side(row.before)} → ${side(row.after)}`;
    };

    return (
        <Table
            size="small"
            rowKey="id"
            dataSource={rows}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{ emptyText: _("No changes recorded yet.") }}
            columns={[
                {
                    title: _("When"),
                    key: "created_at",
                    render: (_v: unknown, row: AuditRow) =>
                        row.created_at ? new Date(row.created_at).toLocaleString() : "",
                },
                {
                    title: _("Changed by"),
                    key: "actor",
                    render: (_v: unknown, row: AuditRow) => row.actor_username || _("System"),
                },
                {
                    title: _("Change"),
                    key: "change",
                    render: (_v: unknown, row: AuditRow) => describeChange(row),
                },
            ]}
        />
    );
};

const resourceColumn = () => ({
    title: _("Module or model"),
    key: "resource",
    render: (_value: unknown, e: Entry) => (
        <Space size={6} wrap>
            <span>{resourceLabel(e)}</span>
            {e.active === false && <Tag>{_("Inactive")}</Tag>}
        </Space>
    ),
});

/** Show page: the saved policy, read-only, and its change history. */
export const RoleAccessPolicyView: React.FC<{ record: any }> = ({ record }) => {
    const { row, loading, forbidden } = useRolePolicy(record?.id);
    if (forbidden) return null;
    if (loading && !row) return <div style={{ padding: 24, textAlign: "center" }}><Spin /></div>;
    if (!row) return null;
    if (row.is_admin) return <AdminNote />;

    const mode: Mode = row.policy?.mode ?? "none";
    const columns = [
        resourceColumn(),
        ...ACTIONS.map(({ action, flag, label }) => ({
            title: _(label),
            key: action,
            width: 90,
            align: "center" as const,
            render: (_value: unknown, e: Entry) => (e[flag] ? <CheckOutlined aria-label={_(label)} /> : null),
        })),
    ];

    return (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Space size={8} wrap>
                <Tag color={mode === "none" ? undefined : "blue"}>{modeLabel(mode)}</Tag>
                <Typography.Text type="secondary">{modeHelp(mode)}</Typography.Text>
            </Space>
            {mode !== "none" && (
                <div style={{ overflowX: "auto" }}>
                    <Table
                        size="small"
                        rowKey={entryId}
                        columns={columns}
                        dataSource={row.policy?.entries ?? []}
                        pagination={false}
                        locale={{ emptyText: _("No modules or models listed yet.") }}
                    />
                </div>
            )}
            <Typography.Title level={5} style={{ margin: 0 }}>{_("Change history")}</Typography.Title>
            <ChangeHistory roleId={row.role_id} excludeEvents={FEATURE_EVENTS} />
        </Space>
    );
};

/** Edit page: the policy editor, saved by the page's Save button. */
export const RoleAccessPolicyEditor: React.FC<{ record: any }> = ({ record }) => {
    const { row, loading, forbidden, reload } = useRolePolicy(record?.id);
    const [modules, setModules] = useState<ResourceModule[]>([]);
    const [mode, setMode] = useState<Mode>("none");
    const [entries, setEntries] = useState<Entry[]>([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await authenticatedFetch(`${BASE_URL}/resources`);
            if (!cancelled && res.ok) setModules((await res.json()).modules ?? []);
        })();
        return () => { cancelled = true; };
    }, []);

    const resetToSaved = useCallback(() => {
        setMode(row?.policy?.mode ?? "none");
        setEntries(row?.policy?.entries ?? []);
    }, [row]);

    // Start the editor from the saved policy whenever it (re)loads.
    useEffect(() => { resetToSaved(); }, [resetToSaved]);

    const dirty = row !== null && policyKey(mode, entries) !== policyKey(row.policy?.mode ?? "none", row.policy?.entries ?? []);

    useBeforeEditSave(async () => {
        if (!row || row.is_admin || !dirty) return;
        const res = mode === "none"
            ? await authenticatedFetch(`${BASE_URL}/${row.role_id}`, { method: "DELETE" })
            : await authenticatedFetch(`${BASE_URL}/${row.role_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, entries: entries.map(({ active: _active, ...e }) => e) }),
            });
        if (!res.ok) {
            const body = await readJson(res);
            message.error(typeof body?.detail === "string" ? body.detail : _("Could not save the access policy."));
            throw new Error("access policy not saved");
        }
        message.success(mode === "none" ? _("Access policy removed.") : _("Access policy saved."));
        await reload();
        void refreshAccess();
    });

    const usedIds = useMemo(() => new Set(entries.map(entryId)), [entries]);

    const treeData = useMemo(
        () => modules.map((m) => ({
            title: _(m.name),
            value: entryId({ module_key: m.key, model_key: null }),
            disabled: usedIds.has(entryId({ module_key: m.key, model_key: null })),
            children: m.models.map((model) => ({
                title: _(model.key),
                value: entryId({ module_key: m.key, model_key: model.key }),
                disabled: usedIds.has(entryId({ module_key: m.key, model_key: model.key })),
            })),
        })),
        [modules, usedIds],
    );

    const addEntry = (value: string) => {
        const [moduleKey, modelKey] = value.split("|");
        // A new allowlist entry starts with Read; a new blocklist entry blocks nothing yet.
        setEntries((prev) => [...prev, {
            module_key: moduleKey,
            model_key: modelKey || null,
            can_create: false,
            can_read: mode === "allow",
            can_update: false,
            can_delete: false,
            active: true,
        }]);
    };

    /**
     * Toggle one action. Keeps entries valid as the backend requires (AC-B6):
     * an allowlist can't grant Create/Update/Delete without Read, and a
     * blocklist that blocks Read also blocks Create/Update/Delete.
     */
    const toggle = (id: string, action: Action, checked: boolean) => {
        setEntries((prev) => prev.map((e) => {
            if (entryId(e) !== id) return e;
            const next = { ...e, [`can_${action}`]: checked } as Entry;
            if (mode === "allow") {
                if (action === "read" && !checked) {
                    next.can_create = next.can_update = next.can_delete = false;
                } else if (action !== "read" && checked) {
                    next.can_read = true;
                }
            } else if (mode === "block") {
                if (action === "read" && checked) {
                    next.can_create = next.can_update = next.can_delete = true;
                } else if (action !== "read" && !checked) {
                    next.can_read = false;
                }
            }
            return next;
        }));
    };

    const changeMode = (next: Mode) => {
        setMode(next);
        // Flags mean "granted" in an allowlist and "denied" in a blocklist,
        // so switching starts each entry from a neutral, valid state.
        setEntries((prev) => prev.map((e) => ({
            ...e,
            can_create: false,
            can_read: next === "allow",
            can_update: false,
            can_delete: false,
        })));
    };

    if (forbidden) return null;
    if (loading && !row) return <div style={{ padding: 24, textAlign: "center" }}><Spin /></div>;
    if (!row) return null;
    if (row.is_admin) return <AdminNote />;

    const columns = [
        resourceColumn(),
        ...ACTIONS.map(({ action, flag, label }) => ({
            title: _(label),
            key: action,
            width: 90,
            align: "center" as const,
            render: (_value: unknown, e: Entry) => (
                <Checkbox
                    checked={Boolean(e[flag])}
                    onChange={(ev) => toggle(entryId(e), action, ev.target.checked)}
                    aria-label={`${_(label)} ${resourceLabel(e)}`}
                />
            ),
        })),
        {
            title: "",
            key: "remove",
            width: 56,
            render: (_value: unknown, e: Entry) => (
                <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    aria-label={_("Remove")}
                    onClick={() => setEntries((prev) => prev.filter((x) => entryId(x) !== entryId(e)))}
                />
            ),
        },
    ];

    return (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                {_("Decide which modules and models each role can create, read, update and delete. A policy can only restrict: it never grants more than the role's own permissions or the installation's licenses.")}
            </Typography.Paragraph>
            <Radio.Group value={mode} onChange={(e) => changeMode(e.target.value)}>
                <Radio.Button value="none">{_("No policy")}</Radio.Button>
                <Radio.Button value="allow">{_("Allowlist")}</Radio.Button>
                <Radio.Button value="block">{_("Blocklist")}</Radio.Button>
            </Radio.Group>
            <Typography.Text type="secondary">{modeHelp(mode)}</Typography.Text>

            {mode === "none" && row.policy && (
                <Alert type="warning" showIcon message={_("This role's access policy will be removed when you save.")} />
            )}
            {mode === "allow" && entries.length === 0 && (
                <Alert
                    type="warning"
                    showIcon
                    message={_("This allowlist is empty: users with this role will lose access to every module.")}
                />
            )}

            {mode !== "none" && (
                <>
                    <TreeSelect
                        style={{ width: "100%" }}
                        treeData={treeData}
                        value={null as any}
                        placeholder={_("Add a module or model")}
                        onChange={(value: string) => value && addEntry(value)}
                        showSearch
                        treeNodeFilterProp="title"
                        treeDefaultExpandAll={false}
                    />
                    <div style={{ overflowX: "auto" }}>
                        <Table
                            size="small"
                            rowKey={entryId}
                            columns={columns}
                            dataSource={entries}
                            pagination={false}
                            locale={{ emptyText: _("No modules or models listed yet.") }}
                        />
                    </div>
                    <Typography.Text type="secondary">
                        {_("A module entry applies to every model in it; a model entry overrides its module's entry for that model.")}
                    </Typography.Text>
                </>
            )}

            {dirty && (
                <Button onClick={resetToSaved} style={{ alignSelf: "flex-start" }}>
                    {_("Discard changes")}
                </Button>
            )}
        </Space>
    );
};

/** The Role model's extra Show/Edit tab. */
export const roleAccessPolicyTab: ModelExtraTab = {
    key: "access_policy",
    label: "Access Policy",
    show: RoleAccessPolicyView,
    edit: RoleAccessPolicyEditor,
};


// ── Feature Access tab ──────────────────────────────────────────────────────

const featureModeHelp = (mode: Mode) =>
    mode === "allow"
        ? _("Users with this role can use only the listed features.")
        : mode === "block"
            ? _("Users with this role can use every feature except the listed ones.")
            : _("Users with this role can use every feature.");

/** Payload comparison key for the feature editor. */
const featurePolicyKey = (mode: Mode, keys: string[]) =>
    mode === "none" ? "none" : JSON.stringify({ mode, keys: [...keys].sort() });

/** Load the registered features (labels, groups and descriptions translated by the backend). */
function useRegisteredFeatures() {
    const [features, setFeatures] = useState<ResourceFeature[]>([]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await authenticatedFetch(`${BASE_URL}/resources`);
            if (!cancelled && res.ok) setFeatures((await res.json()).features ?? []);
        })();
        return () => { cancelled = true; };
    }, []);
    return features;
}

interface FeatureRow {
    key: string;
    label: string;
    group: string;
    description: string;
    active: boolean;
}

/**
 * One table row per registered feature, plus any saved entry whose feature
 * is no longer registered (kept, shown as inactive).
 */
function featureRows(features: ResourceFeature[], saved: FeatureEntry[]): FeatureRow[] {
    const rows: FeatureRow[] = features.map((f) => ({
        key: f.key, label: f.label, group: f.group, description: f.description, active: true,
    }));
    const known = new Set(rows.map((r) => r.key));
    for (const e of saved) {
        if (!known.has(e.feature_key)) {
            rows.push({ key: e.feature_key, label: e.feature_key, group: "", description: "", active: false });
        }
    }
    return rows;
}

const featureColumns = () => [
    {
        title: _("Feature"),
        key: "label",
        render: (_value: unknown, r: FeatureRow) => (
            <Space size={6} wrap>
                <span>{r.label}</span>
                {!r.active && <Tag>{_("Inactive")}</Tag>}
            </Space>
        ),
    },
    { title: _("Group"), dataIndex: "group", key: "group" },
    { title: _("Description"), dataIndex: "description", key: "description" },
];

/** Show page: the saved feature policy, read-only, and its change history. */
export const RoleFeatureAccessView: React.FC<{ record: any }> = ({ record }) => {
    const { row, loading, forbidden } = useRolePolicy(record?.id);
    const features = useRegisteredFeatures();
    if (forbidden) return null;
    if (loading && !row) return <div style={{ padding: 24, textAlign: "center" }}><Spin /></div>;
    if (!row) return null;
    if (row.is_admin) return <AdminNote />;

    const mode: Mode = row.feature_policy?.mode ?? "none";
    const saved = row.feature_policy?.entries ?? [];
    const listed = new Set(saved.map((e) => e.feature_key));
    const rows = featureRows(features, saved).filter((r) => listed.has(r.key));

    return (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Space size={8} wrap>
                <Tag color={mode === "none" ? undefined : "blue"}>{modeLabel(mode)}</Tag>
                <Typography.Text type="secondary">{featureModeHelp(mode)}</Typography.Text>
            </Space>
            {mode !== "none" && (
                <div style={{ overflowX: "auto" }}>
                    <Table
                        size="small"
                        rowKey="key"
                        columns={featureColumns()}
                        dataSource={rows}
                        pagination={false}
                        locale={{ emptyText: _("No features listed yet.") }}
                    />
                </div>
            )}
            <Typography.Title level={5} style={{ margin: 0 }}>{_("Change history")}</Typography.Title>
            <ChangeHistory roleId={row.role_id} events={FEATURE_EVENTS} />
        </Space>
    );
};

/** Edit page: the feature policy editor, saved by the page's Save button. */
export const RoleFeatureAccessEditor: React.FC<{ record: any }> = ({ record }) => {
    const { row, loading, forbidden, reload } = useRolePolicy(record?.id);
    const features = useRegisteredFeatures();
    const [mode, setMode] = useState<Mode>("none");
    const [keys, setKeys] = useState<string[]>([]);

    const resetToSaved = useCallback(() => {
        setMode(row?.feature_policy?.mode ?? "none");
        setKeys((row?.feature_policy?.entries ?? []).map((e) => e.feature_key));
    }, [row]);

    // Start the editor from the saved feature policy whenever it (re)loads.
    useEffect(() => { resetToSaved(); }, [resetToSaved]);

    const savedKeys = (row?.feature_policy?.entries ?? []).map((e) => e.feature_key);
    const dirty = row !== null
        && featurePolicyKey(mode, keys) !== featurePolicyKey(row.feature_policy?.mode ?? "none", savedKeys);

    useBeforeEditSave(async () => {
        if (!row || row.is_admin || !dirty) return;
        const url = `${BASE_URL}/${row.role_id}/features`;
        const res = mode === "none"
            ? await authenticatedFetch(url, { method: "DELETE" })
            : await authenticatedFetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, entries: keys.map((k) => ({ feature_key: k })) }),
            });
        if (!res.ok) {
            const body = await readJson(res);
            message.error(typeof body?.detail === "string" ? body.detail : _("Could not save the feature access."));
            throw new Error("feature policy not saved");
        }
        message.success(mode === "none" ? _("Feature access removed.") : _("Feature access saved."));
        await reload();
        void refreshAccess();
    });

    if (forbidden) return null;
    if (loading && !row) return <div style={{ padding: 24, textAlign: "center" }}><Spin /></div>;
    if (!row) return null;
    if (row.is_admin) return <AdminNote />;

    const rows = featureRows(features, row.feature_policy?.entries ?? []);

    return (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                {_("Decide which features, such as answering methods, each role can use. A feature also has to be switched on in the configuration to be used.")}
            </Typography.Paragraph>
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                <Radio.Button value="none">{_("No policy")}</Radio.Button>
                <Radio.Button value="allow">{_("Allowlist")}</Radio.Button>
                <Radio.Button value="block">{_("Blocklist")}</Radio.Button>
            </Radio.Group>
            <Typography.Text type="secondary">{featureModeHelp(mode)}</Typography.Text>

            {mode === "none" && row.feature_policy && (
                <Alert type="warning" showIcon message={_("This role's feature access will be removed when you save.")} />
            )}
            {mode === "allow" && keys.length === 0 && (
                <Alert
                    type="warning"
                    showIcon
                    message={_("This allowlist is empty: users with this role will not be able to use any feature.")}
                />
            )}

            {mode !== "none" && (
                <div style={{ overflowX: "auto" }}>
                    <Table
                        size="small"
                        rowKey="key"
                        columns={featureColumns()}
                        dataSource={rows}
                        pagination={false}
                        rowSelection={{
                            selectedRowKeys: keys,
                            onChange: (selected) => setKeys(selected.map(String)),
                        }}
                        locale={{ emptyText: _("No features are registered.") }}
                    />
                </div>
            )}

            {dirty && (
                <Button onClick={resetToSaved} style={{ alignSelf: "flex-start" }}>
                    {_("Discard changes")}
                </Button>
            )}
        </Space>
    );
};

/** The Role model's Feature Access Show/Edit tab. */
export const roleFeatureAccessTab: ModelExtraTab = {
    key: "feature_access",
    label: "Feature Access",
    show: RoleFeatureAccessView,
    edit: RoleFeatureAccessEditor,
};
