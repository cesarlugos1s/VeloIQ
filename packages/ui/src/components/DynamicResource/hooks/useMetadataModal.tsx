import React, { useState } from "react";
import { Button, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { ModelDef } from "../types";
import { MetadataModal } from "../MetadataModal";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const useMetadataModal = (model: ModelDef, allModels?: ModelDef[]) => {
    const [metadataOpen, setMetadataOpen] = useState(false);
    const metadataButton = (
        <Tooltip title={_("Metadata")}>
            <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setMetadataOpen(true)} />
        </Tooltip>
    );
    const metadataModal = (
        <MetadataModal model={model} allModels={allModels} open={metadataOpen} onClose={() => setMetadataOpen(false)} />
    );
    return { metadataButton, metadataModal };
};
