import React, { useEffect } from "react";
import { useOne } from "@refinedev/core";
import { Skeleton } from "antd";

export const ReferenceField: React.FC<{ id: string | number; resource: string; onLabel?: (label: string) => void }> = ({ id, resource, onLabel }) => {
    const { data, isLoading } = useOne({ resource: resource, id: id, queryOptions: { enabled: !!id } });
    const record = data?.data;
    const label = record?._label || record?.name || record?.description || id;
    useEffect(() => {
        if (onLabel && !isLoading && label !== undefined && label !== null) {
            onLabel(String(label));
        }
    }, [label, onLabel, isLoading]);
    if (isLoading) return <Skeleton.Input active size="small" style={{ width: 100 }} />;
    return <span>{label}</span>;
};
