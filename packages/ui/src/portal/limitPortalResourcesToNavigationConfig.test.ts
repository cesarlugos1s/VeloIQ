import { describe, expect, it } from "vitest";
import { limitPortalResourcesToNavigationConfig } from "./limitPortalResourcesToNavigationConfig";

(globalThis as any).window = { _: (text: string) => (text === "Profile" ? "Perfil" : text) };

const resources = [
    { name: "dashboard", meta: { label: "Dashboard" } },
    { name: "module:candidates", meta: { label: "Candidates" } },
    { name: "candidate", meta: { label: "Candidate", parent: "module:candidates" } },
    { name: "candidate_skill", meta: { label: "Candidate Skill", parent: "module:candidates" } },
    { name: "module:matches", meta: { label: "Matches" } },
    { name: "match", meta: { label: "Match", parent: "module:matches" } },
];

describe("limitPortalResourcesToNavigationConfig", () => {
    it("shows only the menu file's entries, with its labels", () => {
        const limited = limitPortalResourcesToNavigationConfig(resources, [
            { key: "candidate", label: "Profile", icon: "", sequence: 1, type: "model" },
            { key: "module:matches", label: "Matches", icon: "", sequence: 2, type: "module" },
            { key: "match", label: "Match", icon: "", sequence: 3, type: "model" },
        ]);
        const byName = Object.fromEntries(limited.map((r) => [r.name, r]));
        // A model listed without its module is first-level, with the file's (translated) label.
        expect(byName.candidate.meta).toMatchObject({ label: "Perfil", parent: undefined });
        expect(byName.candidate.meta?.hide).toBeFalsy();
        expect(byName.match.meta).toMatchObject({ parent: "module:matches" });
        // Unlisted resources stay registered (their pages open) but leave the menus.
        expect(byName.candidate_skill.meta?.hide).toBe(true);
        expect(byName["module:candidates"].meta?.hide).toBe(true);
        // The Dashboard follows the portal's own setting.
        expect(byName.dashboard.meta?.hide).toBeUndefined();
    });
});
