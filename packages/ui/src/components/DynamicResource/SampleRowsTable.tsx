import React from "react";
import { Table } from "antd";

/**
 * Renders a small preview table from an array of plain-object rows, deriving
 * columns from the keys of the first row. Shared by the Basic-tier
 * ImportCsvModal and IQVigilant's Smart-tier DataImportExportWorkbench so the
 * "sample rows" preview looks and behaves identically in both.
 */
export const SampleRowsTable: React.FC<{ rows: Record<string, any>[] }> = ({ rows }) => {
    if (!rows.length) return null;
    return (
        <Table
            size="small"
            style={{ marginTop: 4 }}
            pagination={false}
            scroll={{ x: true }}
            dataSource={rows}
            rowKey={(_record, index) => String(index)}
            columns={Object.keys(rows[0]).map((key) => ({
                title: key,
                dataIndex: key,
                ellipsis: true,
            }))}
        />
    );
};
