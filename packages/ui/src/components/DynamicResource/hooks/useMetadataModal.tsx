import React, { useEffect, useState } from "react";
import { Button, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { ModelDef } from "../types";
import { MetadataModal } from "../MetadataModal";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const useMetadataModal = (model: ModelDef, allModels?: ModelDef[], initialOpen = false) => {
    // initialOpen lets a Help action (?metadata=1) force this open. Handled
    // two ways: the useState initializer covers a fresh mount (e.g. landing
    // on this page via a link with the param already set); the effect below
    // covers a Help action clicked while already on this page, where the URL
    // changes but the component doesn't remount.
    const [metadataOpen, setMetadataOpen] = useState(initialOpen);
    useEffect(() => {
        if (initialOpen) setMetadataOpen(true);
    }, [initialOpen]);
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
