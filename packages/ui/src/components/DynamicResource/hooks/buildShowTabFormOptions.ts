import type { ModelDef } from "../types";
import { applyRelationFieldOverrides } from "../utils/viewConfig";
import { isFileModel } from "../utils/model";

export const buildShowTabFormOptions = (
    formProps: any,
    model: ModelDef | undefined,
    allModels?: ModelDef[],
) => {
    const allModelsList = allModels || [];
    const effectiveFields = model ? applyRelationFieldOverrides(model, allModelsList) : [];
    if (!model || !isFileModel(model)) return { formProps, effectiveFields };
    const originalOnFinish = formProps?.onFinish;
    return {
        formProps: {
            ...formProps,
            onFinish: (values: any) => {
                const { data: _binaryData, ...rest } = values || {};
                return originalOnFinish?.(rest);
            },
        },
        effectiveFields,
    };
};
