import React, { useEffect, useState } from "react";
import { Select } from "antd";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

type AsyncSelectInputProps = {
    optionsUrl: string;
    placeholder?: string;
    value?: any;
    onChange?: (value: any) => void;
};

export const AsyncSelectInput: React.FC<AsyncSelectInputProps> = ({
    optionsUrl,
    placeholder,
    value,
    onChange,
}) => {
    const apiUrl = useApiUrl();
    const [options, setOptions] = useState<{ label: string; value: any }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        const fetchOptions = async () => {
            try {
                const url = optionsUrl.startsWith("http") ? optionsUrl : `${apiUrl}${optionsUrl}`;
                const response = await authenticatedFetch(url);
                if (!response.ok || cancelled) {
                    if (!cancelled) setLoading(false);
                    return;
                }
                const data = await response.json();
                if (cancelled) return;

                // Support multiple response shapes:
                // { choices: [...] } or { options: [...] } or [...]
                let rawChoices: any[] = [];
                if (Array.isArray(data)) {
                    rawChoices = data;
                } else if (Array.isArray(data?.choices)) {
                    rawChoices = data.choices;
                } else if (Array.isArray(data?.options)) {
                    rawChoices = data.options;
                }

                const mapped = rawChoices.map((item: any) => {
                    if (typeof item === "string") {
                        return { label: item, value: item };
                    }
                    if (item && typeof item === "object" && "label" in item && "value" in item) {
                        return { label: String(item.label), value: item.value };
                    }
                    return { label: String(item), value: item };
                });

                setOptions(mapped);
            } catch {
                // silently fail
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchOptions();
        return () => { cancelled = true; };
    }, [apiUrl, optionsUrl]);

    return (
        <Select
            showSearch
            allowClear
            loading={loading}
            options={options}
            value={value}
            onChange={onChange}
            placeholder={placeholder || _("Select...")}
            style={{ width: "100%" }}
            filterOption={(input, option) =>
                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
        />
    );
};
