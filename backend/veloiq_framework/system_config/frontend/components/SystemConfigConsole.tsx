/**
 * System Configuration Console — manage application-wide system settings.
 *
 * Accessible as a submenu in the host app's Configurations dropdown. The
 * settings are the one record of the `veloiq_system_config` single-record
 * non-model data resource (see
 * veloiq_framework/system_config/system_config_non_model_data_resource.py),
 * shown with the standard "primary" view: the record's show/edit form, one
 * field per registered setting with the standard editor of its type (number,
 * switch, color, pick-list), grouped in Sections Grid cells by console section.
 * The layout can be changed with the page configuration tool like any record
 * page. Saving writes the changed settings to jm_config.ini / veloiq.toml;
 * the backend validates them and detects concurrent edits.
 */
import React from "react";
import { Spin } from "antd";
import { DynamicList, useAllModels } from "@juicemantics/veloiq-ui";

/** Resource name of the System Configuration settings (backend SYSTEM_CONFIG_RESOURCE_NAME). */
const SYSTEM_CONFIG_RESOURCE_NAME = "veloiq_system_config";

const SystemConfigConsole: React.FC = () => {
    const allModels = useAllModels();
    // The ModelDef is loaded from the backend after sign-in (non-model data resources).
    const systemConfigModel = allModels.find((model) => model.resource === SYSTEM_CONFIG_RESOURCE_NAME);
    if (!systemConfigModel) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                <Spin />
            </div>
        );
    }
    return <DynamicList key={SYSTEM_CONFIG_RESOURCE_NAME} model={systemConfigModel} allModels={allModels} />;
};

export default SystemConfigConsole;
