import React from "react";
import { Select, Checkbox, Typography, Button } from "antd";
import { useSelect } from "@refinedev/antd";
import type { FieldDef, ModelDef } from "../types";
import { findModelByName, resolveResourcePath } from "../utils/model";
import { formatNumberValue } from "../utils/formatting";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const RELATION_SELECT_DEFAULT_PAGE_SIZE = 2000;

export const RelationSelect = ({ field, value, onChange, allModels, multiple, serverSearch, excludeId }: { field: FieldDef, value?: any, onChange?: (val: any) => void, allModels?: ModelDef[], multiple?: boolean, serverSearch?: boolean, excludeId?: string | number }) => {
    const optionLabel = "_label";
    const resourceName = field.referencePath || field.reference;
    const resolvedResource = resourceName && allModels ? resolveResourcePath(resourceName, allModels) : resourceName;
    const referencedModel = resourceName ? findModelByName(allModels, resourceName) : undefined;
    const resolvedOptionValue = (field as any).optionValue || referencedModel?.pkField || "eid";
    const [loadAll, setLoadAll] = React.useState(false);
    const pageSize = loadAll ? 999999 : RELATION_SELECT_DEFAULT_PAGE_SIZE;
    const { selectProps, queryResult } = useSelect({
        resource: resolvedResource,
        optionLabel,
        optionValue: resolvedOptionValue,
        defaultValue: value,
        filters: [],
        queryOptions: { enabled: true },
        debounce: 500,
        pagination: { current: 1, pageSize, mode: "server" }
    });
    const filteredOptions = excludeId !== undefined && excludeId !== null
        ? (selectProps.options ?? []).filter((opt) => String(opt.value) !== String(excludeId))
        : selectProps.options;
    const serverTotal = queryResult?.data?.total ?? 0;
    const loadedCount = filteredOptions?.length ?? 0;
    const isCapped = !loadAll && serverTotal > loadedCount && loadedCount > 0;
    const normalizeSearch = (val: any) => String(val ?? "").toLowerCase();
    const selectedSet = React.useMemo(() => new Set(Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : []), [value]);
    const [searchValue, setSearchValue] = React.useState("");
    return (
        <div>
            <Select
                {...selectProps}
                options={filteredOptions}
                value={value}
                onChange={onChange}
                mode={multiple ? "multiple" : undefined}
                onSearch={multiple ? (val) => setSearchValue(val) : serverSearch ? selectProps.onSearch : () => {}}
                searchValue={multiple ? searchValue : undefined}
                style={{ width: "100%" }}
                placeholder={`Select ${field.label}...`}
                allowClear
                showSearch
                optionFilterProp="label"
                filterOption={serverSearch ? false : (input, option) => normalizeSearch(option?.label).includes(normalizeSearch(input))}
                {...(multiple ? {
                    menuItemSelectedIcon: null,
                    optionRender: (option: any) => (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Checkbox checked={selectedSet.has(option.value)} style={{ pointerEvents: "none" }} />
                            <span>{option.label}</span>
                        </span>
                    ),
                } : {})}
            />
            {isCapped && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {_("Showing N of T — type to search")
                            .replace("N", formatNumberValue(loadedCount))
                            .replace("T", formatNumberValue(serverTotal))}
                    </Typography.Text>
                    <Button
                        size="small"
                        type="link"
                        style={{ fontSize: 11, padding: 0 }}
                        loading={queryResult?.isLoading || queryResult?.isFetching}
                        onClick={() => setLoadAll(true)}
                    >
                        {_("Load all")}
                    </Button>
                </div>
            )}
        </div>
    );
};
