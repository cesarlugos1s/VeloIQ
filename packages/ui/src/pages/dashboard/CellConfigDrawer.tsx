import React, { useEffect } from "react";
import { Drawer, Form, Input, InputNumber, Select, Button, Space, Divider, Typography, AutoComplete } from "antd";
import type { DashboardCell, DashboardConfig, DashboardTab } from "./hooks/useDashboardConfig";

const { Text } = Typography;

const VIEW_TYPE_OPTIONS = [
    { label: "Default (from model schema)", value: "" },
    { label: "Table", value: "table" },
    { label: "Gallery", value: "gallery" },
    { label: "Calendar", value: "calendar" },
    { label: "Totals / Details", value: "totals-details" },
];

interface Props {
    open: boolean;
    cell: DashboardCell | null;
    tabId: string | null;
    config: DashboardConfig;
    onClose: () => void;
    onSave: (nextConfig: DashboardConfig) => void;
}

const nextGridPosition = (cells: DashboardCell[]): { row: number; col: number } => {
    if (!cells.length) return { row: 0, col: 0 };
    const maxRow = Math.max(...cells.map((c) => c.row));
    const lastRowCells = cells.filter((c) => c.row === maxRow);
    if (lastRowCells.length < 2) return { row: maxRow, col: lastRowCells.length };
    return { row: maxRow + 1, col: 0 };
};

export const CellConfigDrawer: React.FC<Props> = ({ open, cell, tabId, config, onClose, onSave }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (!cell || !tabId) return;
        const tab = config.tabs.find((t) => t.id === tabId);
        form.setFieldsValue({
            tabName: tab?.name ?? "",
            row: cell.row + 1,
            col: cell.col + 1,
            view_type: cell.view_type ?? "",
            html_style: cell.html_style ?? "",
            min_width: cell.min_width ?? "",
            max_width: cell.max_width ?? "",
            min_height: cell.min_height ?? "",
            max_height: cell.max_height ?? "",
            chart_url: cell.chart_url ?? "",
            chart_title: cell.chart_title ?? "",
        });
    }, [cell, tabId, config, form]);

    const handleSave = () => {
        if (!cell || !tabId) return;
        const values = form.getFieldsValue();
        const newTabName = (values.tabName || "").trim() || config.tabs.find((t) => t.id === tabId)?.name || "";

        const updatedCell: DashboardCell = {
            ...cell,
            row: Math.max(0, (values.row ?? 1) - 1),
            col: Math.max(0, (values.col ?? 1) - 1),
            view_type: values.view_type || null,
            html_style: values.html_style ?? "",
            min_width: values.min_width || null,
            max_width: values.max_width || null,
            min_height: values.min_height || null,
            max_height: values.max_height || null,
            chart_url: values.chart_url || undefined,
            chart_title: values.chart_title || undefined,
        };

        const currentTab = config.tabs.find((t) => t.id === tabId);
        const nameUnchanged = currentTab?.name.trim().toLowerCase() === newTabName.toLowerCase();

        // Check if another tab already has the same name → merge into it.
        const targetTab = !nameUnchanged
            ? config.tabs.find((t) => t.id !== tabId && t.name.trim().toLowerCase() === newTabName.toLowerCase())
            : undefined;

        let nextTabs: DashboardTab[];
        if (nameUnchanged) {
            // Tab name didn't change — just update the cell in place.
            nextTabs = config.tabs.map((tab) => {
                if (tab.id !== tabId) return tab;
                return { ...tab, cells: tab.cells.map((c) => (c.id === cell.id ? updatedCell : c)) };
            });
        } else if (targetTab) {
            // Name matches an existing tab → move this cell into it at the next free slot.
            const { row, col } = nextGridPosition(targetTab.cells);
            const repositionedCell = { ...updatedCell, row, col };
            nextTabs = config.tabs
                .map((tab) => {
                    if (tab.id === tabId) {
                        return { ...tab, cells: tab.cells.filter((c) => c.id !== cell.id) };
                    }
                    if (tab.id === targetTab.id) {
                        return { ...tab, cells: [...tab.cells, repositionedCell] };
                    }
                    return tab;
                })
                .filter((tab) => tab.cells.length > 0);
        } else {
            // New name, no existing tab → extract this cell into a brand-new tab.
            const { row, col } = nextGridPosition([]);
            const repositionedCell = { ...updatedCell, row, col };
            const newTab: DashboardTab = {
                id: crypto.randomUUID(),
                name: newTabName,
                module: currentTab?.module ?? "dashboard",
                cells: [repositionedCell],
            };
            nextTabs = [
                ...config.tabs
                    .map((tab) => {
                        if (tab.id !== tabId) return tab;
                        return { ...tab, cells: tab.cells.filter((c) => c.id !== cell.id) };
                    })
                    .filter((tab) => tab.cells.length > 0),
                newTab,
            ];
        }

        onSave({ ...config, tabs: nextTabs });
        onClose();
    };

    const tabOptions = config.tabs.map((t) => ({ value: t.name, label: t.name }));

    return (
        <Drawer
            title={cell?.source_type === "plotly_chart"
                ? `Configure chart: ${cell?.chart_title ?? cell?.model ?? ""}`
                : cell?.source_type !== "model"
                    ? `Configure section: ${cell?.section_name ?? cell?.model ?? ""}`
                    : `Configure cell: ${cell?.model ?? ""}`}
            placement="right"
            width={380}
            open={open}
            onClose={onClose}
            footer={
                <Space style={{ justifyContent: "flex-end", width: "100%", display: "flex" }}>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="primary" onClick={handleSave}>Save</Button>
                </Space>
            }
        >
            <Form form={form} layout="vertical" size="small">
                <Divider orientation="left">Tab</Divider>
                <Form.Item name="tabName" label="Tab name">
                    <AutoComplete
                        options={tabOptions}
                        filterOption={false}
                        placeholder="Select existing or type a new name"
                    />
                </Form.Item>

                <Divider orientation="left">Position</Divider>
                <Space>
                    <Form.Item name="row" label="Row" style={{ marginBottom: 0 }}>
                        <InputNumber min={1} style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item name="col" label="Column" style={{ marginBottom: 0 }}>
                        <InputNumber min={1} style={{ width: 80 }} />
                    </Form.Item>
                </Space>

                {cell?.source_type === "model" && (
                    <>
                        <Divider orientation="left">View</Divider>
                        <Form.Item name="view_type" label="View type">
                            <Select options={VIEW_TYPE_OPTIONS} />
                        </Form.Item>
                    </>
                )}

                {cell?.source_type === "plotly_chart" && (
                    <>
                        <Divider orientation="left">Chart</Divider>
                        <Form.Item name="chart_title" label="Chart title">
                            <Input placeholder="e.g. Confidence by Month" />
                        </Form.Item>
                        <Form.Item name="chart_url" label="Chart URL">
                            <Input placeholder="/api/nl-answers-confidence-by-month-chart" />
                        </Form.Item>
                    </>
                )}

                <Divider orientation="left">Size</Divider>
                <Space wrap>
                    <Form.Item name="min_width" label="Min width" style={{ marginBottom: 0 }}>
                        <Input placeholder="e.g. 320px" style={{ width: 130 }} />
                    </Form.Item>
                    <Form.Item name="max_width" label="Max width" style={{ marginBottom: 0 }}>
                        <Input placeholder="e.g. 800px" style={{ width: 130 }} />
                    </Form.Item>
                </Space>
                <Space wrap style={{ marginTop: 8 }}>
                    <Form.Item name="min_height" label="Min height" style={{ marginBottom: 0 }}>
                        <Input placeholder="e.g. 300px" style={{ width: 130 }} />
                    </Form.Item>
                    <Form.Item name="max_height" label="Max height" style={{ marginBottom: 0 }}>
                        <Input placeholder="e.g. 600px" style={{ width: 130 }} />
                    </Form.Item>
                </Space>

                <Divider orientation="left">Style</Divider>
                <Form.Item
                    name="html_style"
                    label={<Text>HTML style <Text type="secondary">(inline CSS)</Text></Text>}
                >
                    <Input.TextArea
                        rows={4}
                        placeholder="e.g. background-color: #f0f4ff; border-radius: 8px;"
                        style={{ fontFamily: "monospace", fontSize: 12 }}
                    />
                </Form.Item>
            </Form>
        </Drawer>
    );
};
