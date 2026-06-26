import React from "react";
import { getModelTone } from "../../utils/modelTone";
import type { ModelDef } from "./types";
import { getModuleLabel } from "./utils/i18n";
import { wrappedPageTitleStyle } from "./utils/formatting";

export const renderModelHeading = ({
    model,
    title,
    actionLabel,
    moduleLabel,
}: {
    model: Pick<ModelDef, "name" | "label" | "resource">;
    title: React.ReactNode;
    actionLabel?: string;
    moduleLabel?: string;
}) => {
    const tone = getModelTone(model);
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "transparent",
                borderRadius: 6,
                paddingTop: 8,
                paddingBottom: 2,
                paddingLeft: 10,
                paddingRight: 10,
            }}
        >
            <div style={{ minWidth: 0, fontSize: 18, fontWeight: 700, color: tone.solid, padding: "2px 8px" }}>
                {title}
            </div>
        </div>
    );
};

export const ModelHeading: React.FC<{
    model: Pick<ModelDef, "name" | "label" | "resource"> & { module?: string };
    title: React.ReactNode;
    actionLabel?: string;
}> = ({ model, title, actionLabel }) => {
    const moduleLabel = model.module ? getModuleLabel(model.module) : undefined;
    return (
        <div style={wrappedPageTitleStyle}>
            {renderModelHeading({ model, title, actionLabel, moduleLabel })}
        </div>
    );
};
