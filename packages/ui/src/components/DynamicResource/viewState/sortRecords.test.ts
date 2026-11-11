import { describe, expect, it } from "vitest";
import { sortRecordsBySortList } from "./sortRecords";

const fields: any[] = [{ key: "region" }, { key: "amount" }];
const compare = (field: any, a: any, b: any) => (a[field.key] < b[field.key] ? -1 : a[field.key] > b[field.key] ? 1 : 0);
const rows = [
    { region: "B", amount: 1 }, { region: "A", amount: 1 }, { region: "A", amount: 3 }, { region: "B", amount: 2 },
];

describe("sortRecordsBySortList", () => {
    it("sorts by the first entry and breaks ties with the next", () => {
        const sorted = sortRecordsBySortList(rows, [{ fieldKey: "region", order: "ascend" }, { fieldKey: "amount", order: "descend" }], fields, compare);
        expect(sorted.map((r) => `${r.region}${r.amount}`)).toEqual(["A3", "A1", "B2", "B1"]);
    });
    it("returns the records unchanged when no entry applies", () => {
        expect(sortRecordsBySortList(rows, [{ fieldKey: "missing", order: "ascend" }], fields, compare)).toBe(rows);
        expect(sortRecordsBySortList(rows, [], fields, compare)).toBe(rows);
    });
    it("does not modify the input", () => {
        const copy = [...rows];
        sortRecordsBySortList(rows, [{ fieldKey: "amount", order: "ascend" }], fields, compare);
        expect(rows).toEqual(copy);
    });
});
