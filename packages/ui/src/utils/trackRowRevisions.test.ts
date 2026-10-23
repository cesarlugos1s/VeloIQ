import { describe, expect, it } from "vitest";
import { rememberRowRevisions, rowRevisionFor } from "./trackRowRevisions";

describe("trackRowRevisions", () => {
    it("remembers list rows and sends their revision on writes only", () => {
        rememberRowRevisions("/api/rates?_start=0&_end=25", [
            { eid: "EMEA~A1", _revision: "r1" },
            { eid: "AMER~A1" },
        ]);
        expect(rowRevisionFor("/api/rates/EMEA~A1", "PATCH")).toBe("r1");
        expect(rowRevisionFor("/api/rates/EMEA%7EA1", "DELETE")).toBe("r1");
        expect(rowRevisionFor("/api/rates/EMEA~A1", "GET")).toBeUndefined();
        expect(rowRevisionFor("/api/rates/AMER~A1", "PATCH")).toBeUndefined();
    });

    it("updates the revision from a row response and keys a create under the list path", () => {
        rememberRowRevisions("/api/rates/EMEA~A1", { eid: "EMEA~A1", _revision: "r2" });
        expect(rowRevisionFor("/api/rates/EMEA~A1", "PUT")).toBe("r2");
        rememberRowRevisions("/api/rates", { eid: "APAC~C3", _revision: "r3" });
        expect(rowRevisionFor("/api/rates/APAC~C3", "PATCH")).toBe("r3");
    });
});
