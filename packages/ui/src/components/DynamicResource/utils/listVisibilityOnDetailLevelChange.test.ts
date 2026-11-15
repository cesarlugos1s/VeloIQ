import { describe, expect, it } from "vitest";
import { resolveListVisibilityOnDetailLevelChange as resolve } from "./listVisibilityOnDetailLevelChange";

describe("resolveListVisibilityOnDetailLevelChange", () => {
    it("keeps the list as the user left it while the level does not change", () => {
        expect(resolve(3, 3, true, true)).toBe("keep");
        expect(resolve(null, undefined, true, true)).toBe("keep");
        expect(resolve(6, 6, true, true)).toBe("keep");
    });
    it("hides the list on reaching the Analyze level, also when it is the first level seen", () => {
        expect(resolve(3, 6, true, true)).toBe("hide");
        expect(resolve(null, 6, true, true)).toBe("hide");
    });
    it("keeps the list at the Analyze level when there is no Analyze section", () => {
        expect(resolve(3, 6, false, true)).toBe("keep");
    });
    it("shows the list again on leaving the Analyze level, unless it may not", () => {
        expect(resolve(6, 3, true, true)).toBe("show");
        expect(resolve(6, 3, true, false)).toBe("keep");
    });
});
