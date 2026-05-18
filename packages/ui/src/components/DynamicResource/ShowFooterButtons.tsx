import React from "react";
import { Button, Tooltip } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { DeleteButton } from "@refinedev/antd";
import { useNavigate } from "react-router-dom";
import type { ModelDef } from "./types";
import { resolveResourcePath } from "./utils/model";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const ShowFooterButtons: React.FC<{
    model: ModelDef;
    allModels?: ModelDef[];
    recordId: any;
    saveButtonProps: any;
}> = ({ model, allModels, recordId, saveButtonProps }) => {
    const navigate = useNavigate();
    const allModelsList = allModels || [];
    return (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            {recordId != null && (
                <Tooltip title={_("Delete")}>
                    <span>
                        <DeleteButton
                            resource={model.name}
                            recordItemId={recordId}
                            hideText
                            onSuccess={() => navigate(`/${resolveResourcePath(model.resource || model.name, allModelsList)}`)}
                        />
                    </span>
                </Tooltip>
            )}
            <Tooltip title={_("Save")}>
                <Button {...saveButtonProps} type="primary" icon={<SaveOutlined />} />
            </Tooltip>
        </div>
    );
};
