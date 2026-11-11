import { describe, expect, it } from "vitest";
import { orderAfterMove, orderAfterSelection } from "./fieldSequenceOperations";

describe("field sequence operations", () => {
    it("keeps the place of kept fields and appends new ones", () => {
        expect(orderAfterSelection(["c", "b", "a"], ["a", "c", "d"])).toEqual(["c", "a", "d"]);
        expect(orderAfterSelection(null, ["x", "y"])).toEqual(["x", "y"]);
    });
    it("moves a field one position, from the selection when no order exists", () => {
        expect(orderAfterMove(["a", "b", "c"], null, "b", "left")).toEqual(["b", "a", "c"]);
        expect(orderAfterMove(null, ["a", "b"], "a", "right")).toEqual(["b", "a"]);
    });
    it("ignores impossible moves", () => {
        expect(orderAfterMove(["a", "b"], null, "a", "left")).toEqual(["a", "b"]);
        expect(orderAfterMove(["a", "b"], null, "z", "right")).toEqual(["a", "b"]);
    });
});
