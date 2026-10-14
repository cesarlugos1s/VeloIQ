/**
 * Checks the frontend access decision against the cases shared with the
 * backend (test-fixtures/access.json): for every case, evaluateAccess must
 * give the same answer — and the same reason when it denies — as the
 * backend's evaluate_access.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { evaluateAccess, type AccessContext } from "./evaluateAccess";

const FIXTURES = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../test-fixtures/access.json"), "utf-8"),
);

describe("shared access cases", () => {
    for (const testCase of FIXTURES.cases) {
        it(testCase.name, () => {
            const ctx = { ...FIXTURES.base, ...testCase.with } as AccessContext;
            const decision = evaluateAccess(ctx, testCase.module_key, testCase.model_key, testCase.action);
            expect(decision.allowed).toBe(testCase.allowed);
            if (!testCase.allowed) expect(decision.reason).toBe(testCase.reason);
        });
    }
});
