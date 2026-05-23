import React, { useEffect } from "react";
import { useOne, useGo } from "@refinedev/core";
import { Skeleton, theme } from "antd";
import { getShowHref, shouldHandleLinkClick } from "../utils/navigation";
import { usePaneNavigation } from "../../../contexts/PaneNavigationContext";

export const ReferenceField: React.FC<{ id: string | number; resource: string; onLabel?: (label: string) => void }> = ({ id, resource, onLabel }) => {
    const { data, isLoading } = useOne({ resource: resource, id: id, queryOptions: { enabled: !!id } });
    const record = data?.data;
    const label = record?._label || record?.name || record?.description || id;
    const go = useGo();
    const paneNav = usePaneNavigation();
    const { token } = theme.useToken();

    useEffect(() => {
        if (onLabel && !isLoading && label !== undefined && label !== null) {
            onLabel(String(label));
        }
    }, [label, onLabel, isLoading]);

    if (isLoading) return <Skeleton.Input active size="small" style={{ width: 100 }} />;

    const href = getShowHref(resource, id);
    return (
        <a
            href={href}
            onClick={(e) => {
                if (!shouldHandleLinkClick(e)) return;
                e.preventDefault();
                if (paneNav?.isInMultiPane) {
                    paneNav.openDetail(resource, id);
                } else {
                    go({ to: { resource, action: "show", id } });
                }
            }}
            style={{ color: token.colorLink, textDecoration: "none", cursor: "pointer" }}
        >
            {label}
        </a>
    );
};
