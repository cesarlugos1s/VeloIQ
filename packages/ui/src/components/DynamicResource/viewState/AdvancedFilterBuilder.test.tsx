import React from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { AdvancedFilterBuilder } from "./AdvancedFilterBuilder";

beforeAll(() => {
    (globalThis as any).window = { _: (text: string) => text };
});

const fields: any[] = [{ key: "name", label: "Name", type: "string" }, { key: "amount", label: "Amount", type: "number" }];

describe("AdvancedFilterBuilder", () => {
    it("shows the empty state and the add button without rules", () => {
        const html = renderToString(<AdvancedFilterBuilder fields={fields} rules={[]} setRules={() => {}} />);
        expect(html).toContain("No filters yet.");
        expect(html).toContain("Add Filter");
        expect(html).not.toContain("Clear filters");
    });
    it("shows a row per rule and the clear button", () => {
        const html = renderToString(
            <AdvancedFilterBuilder fields={fields} rules={[{ id: "1", fieldKey: "name", operator: "contains", value: "x" }]} setRules={() => {}} />,
        );
        expect(html).toContain("Clear filters");
        expect(html).toContain("Remove");
        expect(html).not.toContain("No filters yet.");
    });
});
