/**
 * Access Policies — give each role one allowlist or one blocklist of modules
 * and models, with Create/Read/Update/Delete per entry.
 *
 * Admin-only: the backend enforces it on every /auth/access-policies call
 * (AC-A1); a non-admin who opens this route gets the "no access" page.
 * The Admin role is shown but can't be given a policy (AC-A3).
 *
 * After a save or a removal the signed-in user's permissions are refetched
 * (AC-E4). All texts go through window._ (AC-E5).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Empty,
    List,
    Popconfirm,
    Radio,
    Space,
    Spin,
    Table,
    Tag,
    TreeSelect,
    Typography,
    message,
} from "antd";
import { DeleteOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { NoAccessResult, authenticatedFetch, refreshAccess } from "@juicemantics/veloiq-ui";

const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? t(text) : text;
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

interface RoleRow {
    role_id: number;
    role_name: string;
    is_admin: boolean;
    policy: { mode: "allow" | "block"; entries: Entry[] } | null;
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
    before: { mode?: string; entries?: Entry[] } | null;
    after: { mode?: string; entries?: Entry[] } | null;
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

async function readJson(res: Response): Promise<any> {
    return res.json().catch(() => ({}));
}

export default function AccessPoliciesPage() {
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [modules, setModules] = useState<ResourceModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [mode, setMode] = useState<Mode>("none");
    const [entries, setEntries] = useState<Entry[]>([]);
    const [saving, setSaving] = useState(false);
    const [audit, setAudit] = useState<AuditRow[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [rolesRes, resourcesRes] = await Promise.all([
                authenticatedFetch(BASE_URL),
                authenticatedFetch(`${BASE_URL}/resources`),
            ]);
            if (rolesRes.status === 403 || resourcesRes.status === 403) {
                setForbidden(true);
                return;
            }
            if (!rolesRes.ok || !resourcesRes.ok) throw new Error();
            const roleRows: RoleRow[] = await rolesRes.json();
            const resources = await resourcesRes.json();
            setRoles(roleRows);
            setModules(resources.modules ?? []);
            setSelectedRoleId((current) => current ?? roleRows.find((r) => !r.is_admin)?.role_id ?? null);
        } catch {
            message.error(_("Could not load access policies."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const selectedRole = useMemo(
        () => roles.find((r) => r.role_id === selectedRoleId) ?? null,
        [roles, selectedRoleId],
    );

    // Reset the editor to the saved policy whenever the selected role changes.
    useEffect(() => {
        setMode(selectedRole?.policy?.mode ?? "none");
        setEntries(selectedRole?.policy?.entries ?? []);
    }, [selectedRole]);

    useEffect(() => {
        if (selectedRoleId === null) return;
        let cancelled = false;
        (async () => {
            const res = await authenticatedFetch(`${BASE_URL}/audit?role_id=${selectedRoleId}&limit=50`);
            if (!cancelled && res.ok) setAudit(await res.json());
        })();
        return () => { cancelled = true; };
    }, [selectedRoleId, roles]);

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

    const save = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            let res: Response;
            if (mode === "none") {
                res = await authenticatedFetch(`${BASE_URL}/${selectedRole.role_id}`, { method: "DELETE" });
            } else {
                res = await authenticatedFetch(`${BASE_URL}/${selectedRole.role_id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mode,
                        entries: entries.map(({ active: _active, ...e }) => e),
                    }),
                });
            }
            if (!res.ok) {
                const body = await readJson(res);
                message.error(typeof body?.detail === "string" ? body.detail : _("Could not save the access policy."));
                return;
            }
            message.success(mode === "none" ? _("Access policy removed.") : _("Access policy saved."));
            await load();
            void refreshAccess();
        } finally {
            setSaving(false);
        }
    };

    if (loading && roles.length === 0) {
        return <div style={{ padding: 48, textAlign: "center" }}><Spin size="large" /></div>;
    }
    if (forbidden) return <NoAccessResult />;

    const columns = [
        {
            title: _("Module or model"),
            key: "resource",
            render: (_value: unknown, e: Entry) => (
                <Space size={6} wrap>
                    <span>{resourceLabel(e)}</span>
                    {e.active === false && <Tag>{_("Inactive")}</Tag>}
                </Space>
            ),
        },
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

    const describeChange = (row: AuditRow) => {
        if (row.event === "role_get_migration") return _("Read access added to the role's methods");
        if (row.event === "role_deleted") return _("Role deleted");
        const side = (p: AuditRow["before"]) =>
            p && p.mode
                ? `${p.mode === "allow" ? _("Allowlist") : _("Blocklist")} (${p.entries?.length ?? 0})`
                : _("No policy");
        return `${side(row.before)} → ${side(row.after)}`;
    };

    return (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <Space align="center" size={8}>
                <SafetyCertificateOutlined style={{ fontSize: 20 }} />
                <Typography.Title level={4} style={{ margin: 0 }}>{_("Access Policies")}</Typography.Title>
            </Space>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                {_("Decide which modules and models each role can create, read, update and delete. A policy can only restrict: it never grants more than the role's own permissions or the installation's licenses.")}
            </Typography.Paragraph>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <Card title={_("Roles")} size="small" style={{ flex: "0 1 260px", minWidth: 220 }}>
                    <List
                        dataSource={roles}
                        renderItem={(r) => (
                            <List.Item
                                onClick={() => setSelectedRoleId(r.role_id)}
                                style={{
                                    cursor: "pointer",
                                    fontWeight: r.role_id === selectedRoleId ? 600 : 400,
                                }}
                            >
                                <Space size={6} wrap>
                                    <span>{_(r.role_name)}</span>
                                    {r.is_admin
                                        ? <Tag>{_("Full access")}</Tag>
                                        : r.policy
                                            ? <Tag color="blue">{r.policy.mode === "allow" ? _("Allowlist") : _("Blocklist")}</Tag>
                                            : <Tag>{_("No policy")}</Tag>}
                                </Space>
                            </List.Item>
                        )}
                    />
                </Card>

                <Card
                    size="small"
                    title={selectedRole ? _(selectedRole.role_name) : _("Select a role")}
                    style={{ flex: "1 1 520px", minWidth: 0 }}
                >
                    {!selectedRole && <Empty description={_("Select a role")} />}
                    {selectedRole?.is_admin && (
                        <Alert
                            type="info"
                            showIcon
                            message={_("The Admin role always has full access and can't be given an access policy.")}
                        />
                    )}
                    {selectedRole && !selectedRole.is_admin && (
                        <Space direction="vertical" size={16} style={{ width: "100%" }}>
                            <Radio.Group value={mode} onChange={(e) => changeMode(e.target.value)}>
                                <Radio.Button value="none">{_("No policy")}</Radio.Button>
                                <Radio.Button value="allow">{_("Allowlist")}</Radio.Button>
                                <Radio.Button value="block">{_("Blocklist")}</Radio.Button>
                            </Radio.Group>
                            <Typography.Text type="secondary">
                                {mode === "none" && _("Users with this role can use every module and model their role and licenses allow.")}
                                {mode === "allow" && _("Users with this role can use only the listed modules and models, and only the checked actions.")}
                                {mode === "block" && _("Users with this role can use everything except the checked actions on the listed modules and models.")}
                            </Typography.Text>

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

                            <Space>
                                {mode === "none" && selectedRole.policy ? (
                                    <Popconfirm
                                        title={_("Remove this role's access policy?")}
                                        okText={_("Remove")}
                                        cancelText={_("Cancel")}
                                        onConfirm={save}
                                    >
                                        <Button type="primary" danger loading={saving}>{_("Remove policy")}</Button>
                                    </Popconfirm>
                                ) : (
                                    <Button type="primary" onClick={save} loading={saving} disabled={mode === "none"}>
                                        {_("Save")}
                                    </Button>
                                )}
                                <Button
                                    onClick={() => {
                                        setMode(selectedRole.policy?.mode ?? "none");
                                        setEntries(selectedRole.policy?.entries ?? []);
                                    }}
                                    disabled={saving}
                                >
                                    {_("Discard changes")}
                                </Button>
                            </Space>
                        </Space>
                    )}
                </Card>
            </div>

            {selectedRole && !selectedRole.is_admin && (
                <Card size="small" title={_("Change history")}>
                    <Table
                        size="small"
                        rowKey="id"
                        dataSource={audit}
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
                </Card>
            )}
        </div>
    );
}
