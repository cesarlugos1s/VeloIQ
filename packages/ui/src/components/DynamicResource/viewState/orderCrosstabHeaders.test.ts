import { describe, expect, it } from "vitest";
import { orderCrosstabHeaders } from "./orderCrosstabHeaders";

const region: any = { key: "region" };
const product: any = { key: "product" };
const compare = (field: any, a: any, b: any) => (a[field.key] < b[field.key] ? -1 : a[field.key] > b[field.key] ? 1 : 0);
const reps = new Map<string, any>([
    ["B • y", { region: "B", product: "y" }], ["A • y", { region: "A", product: "y" }],
    ["A • z", { region: "A", product: "z" }], ["B • z", { region: "B", product: "z" }],
]);
const labels = ["B • y", "A • y", "A • z", "B • z"];

describe("orderCrosstabHeaders", () => {
    it("nests several sorted fields of one axis in sort list order", () => {
        const sorted = orderCrosstabHeaders(labels, reps, [region, product], [{ fieldKey: "region", order: "ascend" }, { fieldKey: "product", order: "descend" }], compare);
        expect(sorted).toEqual(["A • z", "A • y", "B • z", "B • y"]);
    });
    it("keeps first-seen order when the sorted field is on no axis (dormant)", () => {
        expect(orderCrosstabHeaders(labels, reps, [region], [{ fieldKey: "other", order: "ascend" }], compare)).toBe(labels);
    });
    it("ignores sort entries of the other axis", () => {
        const rowReps = new Map<string, any>([["x", { product: "b" }], ["y", { product: "a" }]]);
        expect(orderCrosstabHeaders(["x", "y"], rowReps, [product], [{ fieldKey: "region", order: "ascend" }, { fieldKey: "product", order: "ascend" }], compare)).toEqual(["y", "x"]);
    });
});
