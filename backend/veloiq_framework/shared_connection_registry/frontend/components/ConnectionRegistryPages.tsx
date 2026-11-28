/**
 * The record pages of the shared connection registry that add the shared operation interface to the standard pages:
 *
 *   - Connection page: the standard record page with "Test Connection" in the header (also in side panels).
 *   - Operation page: the standard record page with "Test API" in the header, which can record the answer's structure as the output.
 *   - New operation page: the standard create form with the import card above it, to import operations from an OpenAPI description or
 *     discover one from a URL; one discovered operation fills the form for review, several are recorded under the chosen connection.
 *
 * Registered in the manifest as the show and create overrides of the registry's resources (see menu.py).
 */
import React, { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Spin, message } from "antd";
import {
    API_URL, ConnectionTestButton, DynamicCreate, DynamicShow, OperationImportCard, OperationTestButton, authenticatedFetch,
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
const REST_ENDPOINT_TYPE = "rest_api";

const LoadingPage = () => <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin /></div>;

function useResourceModel(resourceName: string): { model?: ModelDef; allModels: ModelDef[] } {
    const allModels = useAllModels();
    return { model: allModels.find((candidate: ModelDef) => candidate.resource === resourceName), allModels };
}

/** A connection's page: the standard record page with "Test Connection" (a REST connection is tested with a GET to its base address). */
export const ConnectionShow: React.FC<{ idOverride?: string }> = ({ idOverride }) => {
    const { model, allModels } = useResourceModel(CONNECTIONS_RESOURCE_NAME);
    const routeId = useParams().id;
    if (!model) return <LoadingPage />;
    return (
        <DynamicShow
            model={model}
            allModels={allModels}
            idOverride={idOverride ?? routeId}
            extraHeaderButtons={(record: any) => (
                <ConnectionTestButton disabled={record?.endpoint_type !== REST_ENDPOINT_TYPE} runTest={() => testRegistryConnection(Number(record.id))} />
            )}
        />
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
