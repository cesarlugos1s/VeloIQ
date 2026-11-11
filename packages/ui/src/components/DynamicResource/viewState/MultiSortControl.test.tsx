import React from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { MultiSortControl, findNextUnsortedFieldKey, moveSortEntry } from "./MultiSortControl";

beforeAll(() => {
    (globalThis as any).window = { _: (text: string) => text };
});

const fields: any[] = [{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C" }];

describe("sort list helpers", () => {
    it("picks the first field not yet sorted", () => {
        expect(findNextUnsortedFieldKey(fields, [{ fieldKey: "a", order: "ascend" }])).toBe("b");
        expect(findNextUnsortedFieldKey(fields, fields.map((f) => ({ fieldKey: f.key, order: "ascend" as const })))).toBeUndefined();
    });
    it("moves entries and ignores out-of-range moves", () => {
        const list = [{ fieldKey: "a", order: "ascend" as const }, { fieldKey: "b", order: "descend" as const }];
        expect(moveSortEntry(list, 1, -1).map((i) => i.fieldKey)).toEqual(["b", "a"]);
        expect(moveSortEntry(list, 0, -1)).toBe(list);
    });
});

describe("MultiSortControl", () => {
    it("shows the empty state without sorting", () => {
        const html = renderToString(<MultiSortControl fields={fields} sortList={[]} setSortList={() => {}} />);
        expect(html).toContain("No sorting yet.");
        expect(html).toContain("Add sort");
        expect(html).not.toContain("Clear sort");
    });
    it("shows a row per sorted field", () => {
        const html = renderToString(
            <MultiSortControl fields={fields} sortList={[{ fieldKey: "a", order: "ascend" }, { fieldKey: "b", order: "descend" }]} setSortList={() => {}} />,
        );
        expect(html).toContain("Clear sort");
        expect(html.match(/Remove/g)?.length).toBe(2);
    });
});
