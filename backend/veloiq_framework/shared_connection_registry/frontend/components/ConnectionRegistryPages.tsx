/**
 * The record pages of the shared connection registry that add the shared operation interface to the standard pages:
 *
 *   - Connection pages (show, edit, create): the standard pages showing only the settings of the connection's endpoint type, with "Test
 *     Connection" in the header of the record page (also in side panels). The create page first asks for the endpoint type.
 *   - Operation page: the standard record page with "Test API" in the header, which can record the answer's structure as the output.
 *   - New operation page: the standard create form with the import card above it, to import operations from an OpenAPI description or
 *     discover one from a URL; one discovered operation fills the form for review, several are recorded under the chosen connection.
 *
 * Registered in the manifest as the show and create overrides of the registry's resources (see menu.py).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Select, Spin, Typography, message } from "antd";
import {
    API_URL, ConnectionTestButton, DynamicCreate, DynamicEdit, DynamicShow, OperationImportCard, OperationTestButton, authenticatedFetch,
    createRegistryOperationInterfaceClient, registryOperationFromDiscovered, testRegistryConnection, useAllModels,
} from "@juicemantics/veloiq-ui";
import type { DiscoveredOperation, ModelDef, OperationTestResult } from "@juicemantics/veloiq-ui";

// Resolved when called (not when the file loads), so the host's translations are always the current ones.
const _ = (text: string): string => {
    const translate = (window as any)._;
    return typeof translate === "function" ? (translate(text) as string) : text;
};

const CONNECTIONS_RESOURCE_NAME = "veloiq_registry_connections";
const OPERATIONS_RESOURCE_NAME = "veloiq_registry_operations";
// Endpoint types the registry can test: a REST connection with a GET to its base address, a database with a trivial read, a file or SFTP connection by looking for its folder.
const DEFAULT_ENDPOINT_TYPE = "rest_api";
const TESTABLE_ENDPOINT_TYPES = ["rest_api", "database", "file", "sftp_folder"];

const LoadingPage = () => <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin /></div>;

function useResourceModel(resourceName: string): { model?: ModelDef; allModels: ModelDef[] } {
    const allModels = useAllModels();
    return { model: allModels.find((candidate: ModelDef) => candidate.resource === resourceName), allModels };
}

interface ConnectionFieldChoices {
    endpointTypes: string[];
    fieldsOfEveryConnection: string[];
    fieldsByEndpointType: Record<string, string[]>;
}

/** Which fields each endpoint type shows, from the registry (undefined while it loads). */
function useConnectionFieldChoices(): ConnectionFieldChoices | undefined {
    const [choices, setChoices] = useState<ConnectionFieldChoices>();
    useEffect(() => {
        let cancelled = false;
        authenticatedFetch(`${API_URL}/registry/choices`).then((response) => response.json()).then((answer) => {
            if (!cancelled) setChoices({
                endpointTypes: answer.endpoint_types ?? [], fieldsOfEveryConnection: answer.fields_of_every_connection ?? [],
                fieldsByEndpointType: answer.fields_by_endpoint_type ?? {},
            });
        }).catch(() => { if (!cancelled) setChoices({ endpointTypes: [], fieldsOfEveryConnection: [], fieldsByEndpointType: {} }); });
        return () => { cancelled = true; };
    }, []);
    return choices;
}

/** The endpoint type of a stored connection (undefined while it loads). */
function useEndpointTypeOfConnection(connectionId: string | undefined): string | undefined {
    const [endpointType, setEndpointType] = useState<string>();
    useEffect(() => {
        let cancelled = false;
        if (!connectionId) return;
        authenticatedFetch(`${API_URL}/${CONNECTIONS_RESOURCE_NAME}/${connectionId}`).then((response) => response.json())
            .then((record) => { if (!cancelled) setEndpointType(String(record?.endpoint_type ?? "")); })
            .catch(() => { if (!cancelled) setEndpointType(""); });
        return () => { cancelled = true; };
    }, [connectionId]);
    return endpointType;
}

/** The model with only the fields of one endpoint type (the common ones and its settings); a type with no known settings keeps the common ones. */
function modelForEndpointType(model: ModelDef, endpointType: string | undefined, choices: ConnectionFieldChoices): ModelDef {
    const shown = new Set([...choices.fieldsOfEveryConnection, ...(choices.fieldsByEndpointType[endpointType ?? ""] ?? [])]);
    return { ...model, fields: model.fields.filter((field) => shown.has(field.key)) };
}

/** A connection's page: the standard record page with "Test Connection" (a REST connection is tested with a GET to its base address, a database with a trivial read, a file or SFTP connection by looking for its folder), showing only the settings of its type. */
export const ConnectionShow: React.FC<{ idOverride?: string }> = ({ idOverride }) => {
    const { model, allModels } = useResourceModel(CONNECTIONS_RESOURCE_NAME);
    const routeParams = useParams();
    const routeId = idOverride ?? routeParams.id;
    const choices = useConnectionFieldChoices();
    const endpointType = useEndpointTypeOfConnection(routeId);
    const shownModel = useMemo(() => (model && choices && endpointType !== undefined ? modelForEndpointType(model, endpointType, choices) : undefined), [model, choices, endpointType]);
    if (!shownModel) return <LoadingPage />;
    return (
        <DynamicShow
            model={shownModel}
            allModels={allModels}
            idOverride={routeId}
            extraHeaderButtons={(record: any) => (
                <ConnectionTestButton disabled={!TESTABLE_ENDPOINT_TYPES.includes(record?.endpoint_type)} runTest={() => testRegistryConnection(Number(record.id))} />
            )}
        />
    );
};

/** A connection's edit page: the standard form with only the settings of its type. */
export const ConnectionEdit: React.FC<{ idOverride?: string }> = ({ idOverride }) => {
    const { model, allModels } = useResourceModel(CONNECTIONS_RESOURCE_NAME);
    const routeParams = useParams();
    const routeId = idOverride ?? routeParams.id;
    const choices = useConnectionFieldChoices();
    const endpointType = useEndpointTypeOfConnection(routeId);
    const shownModel = useMemo(() => (model && choices && endpointType !== undefined ? modelForEndpointType(model, endpointType, choices) : undefined), [model, choices, endpointType]);
    if (!shownModel) return <LoadingPage />;
    return <DynamicEdit model={shownModel} allModels={allModels} idOverride={routeId} />;
};

/**
 * The new connection page: choose the endpoint type first, then fill the standard create form that has only the settings of that type.
 * The type travels in the address (?endpoint_type=file), which the standard create form takes as the value of the field and does not ask for.
 */
export const ConnectionCreate: React.FC<{ model?: ModelDef; allModels?: ModelDef[] }> = () => {
    const { model, allModels } = useResourceModel(CONNECTIONS_RESOURCE_NAME);
    const choices = useConnectionFieldChoices();
    const [searchParams, setSearchParams] = useSearchParams();
    const endpointType = searchParams.get("endpoint_type") ?? DEFAULT_ENDPOINT_TYPE;
    useEffect(() => {
        if (!searchParams.get("endpoint_type")) setSearchParams({ endpoint_type: DEFAULT_ENDPOINT_TYPE }, { replace: true });
    }, [searchParams, setSearchParams]);
    const shownModel = useMemo(() => (model && choices ? modelForEndpointType(model, endpointType, choices) : undefined), [model, choices, endpointType]);
    if (!shownModel || !choices || !searchParams.get("endpoint_type")) return <LoadingPage />;
    return (
        <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 6px" }}>
                <Typography.Text strong className="jm-panel-title">{_("What does the connection connect to?")}</Typography.Text>
                <Select size="small" style={{ minWidth: 220 }} value={endpointType} onChange={(chosen) => setSearchParams({ endpoint_type: chosen })}
                        options={choices.endpointTypes.map((value) => ({ value, label: _(value.replace(/_/g, " ")) }))} />
            </div>
            <DynamicCreate key={endpointType} model={shownModel} allModels={allModels} />
        </>
    );
};

/** Record the structure of a test's answer as the output of the operation. */
async function recordOutputStructure(operationId: number, result: OperationTestResult): Promise<void> {
    const response = await authenticatedFetch(`${API_URL}/registry/operations/${operationId}/response-schema-from-sample`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sample: result.body_parsed }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.detail || _("The output structure could not be recorded."));
}

/** An operation's page: the standard record page with "Test API", which sends the operation with its connection's authentication. */
export const OperationShow: React.FC<{ idOverride?: string }> = ({ idOverride }) => {
    const { model, allModels } = useResourceModel(OPERATIONS_RESOURCE_NAME);
    const routeId = useParams().id;
    if (!model) return <LoadingPage />;
    return (
        <DynamicShow
            model={model}
            allModels={allModels}
            idOverride={idOverride ?? routeId}
            extraHeaderButtons={(record: any) => (
                <OperationTestButton
                    client={createRegistryOperationInterfaceClient({ operationId: () => Number(record.id) })}
                    readCall={async () => ({ path: record.path, http_method: record.method, parameters: { path: [], query: [] } })}
                    onRecordOutput={(result) => recordOutputStructure(Number(record.id), result)}
                />
            )}
        />
    );
};

/** The id a reference field of the form holds (the form may hold the id or the related record). */
function referencedId(value: any): number | undefined {
    const raw = value !== null && typeof value === "object" ? value.id ?? value.eid ?? value.value : value;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : undefined;
}

/** The new operation page: the import card above the standard create form. */
export const OperationCreate: React.FC<{ model?: ModelDef; allModels?: ModelDef[] }> = () => {
    const { model, allModels } = useResourceModel(OPERATIONS_RESOURCE_NAME);
    const [form, setForm] = useState<any>(null);
    const formRef = useRef<any>(null);
    const client = useRef(createRegistryOperationInterfaceClient()).current;
    if (!model) return <LoadingPage />;

    const fillFormFromDiscoveredOperation = (operation: DiscoveredOperation) => {
        const body = registryOperationFromDiscovered(operation);
        form?.setFieldsValue({
            name: body.name, method: body.method, path: body.path, description: body.description,
            parameters_schema: body.parameters_schema ?? undefined, response_schema: body.response_schema ?? undefined,
            source: body.source,
        });
        message.info(_("The discovered values are in the form; review them and save."));
    };

    const recordOperationUnderChosenConnection = async (operation: DiscoveredOperation) => {
        const connectionId = referencedId(form?.getFieldValue("connection_id"));
        if (connectionId === undefined) throw new Error(_("Choose the connection first."));
        const response = await authenticatedFetch(`${API_URL}/${OPERATIONS_RESOURCE_NAME}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...registryOperationFromDiscovered(operation), connection_id: connectionId }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.detail || _("Import failed"));
    };

    return (
        <>
            {form && (
                <OperationImportCard client={client} storeName="registry_discovered_operations" refreshResource={OPERATIONS_RESOURCE_NAME}
                                     onSingleOperation={fillFormFromDiscoveredOperation} onImportOperation={recordOperationUnderChosenConnection} />
            )}
            <DynamicCreate
                model={model}
                allModels={allModels}
                extraHeaderButtons={(pageForm?: any) => {
                    if (pageForm && formRef.current !== pageForm) {
                        formRef.current = pageForm;
                        // The header renders inside the page; hand the form to the card after this render.
                        setTimeout(() => setForm(pageForm), 0);
                    }
                    return null;
                }}
            />
        </>
    );
};
