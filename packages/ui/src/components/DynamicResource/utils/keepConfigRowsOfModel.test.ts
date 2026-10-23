import { describe, expect, it } from "vitest";
import type { ModelDef, ViewConfigRow } from "../types";

// viewConfig reads window._ when it loads, so it is imported after window is stubbed.
(globalThis as any).window = { _: (text: string) => text };

const model: ModelDef = {
    name: "JobPosting", label: "Job Posting", resource: "job_posting", pkField: "id",
    fields: [{ key: "title", label: "Title", type: "string" }],
    relations: [{ resource: "job_required_skill", targetKey: "job_id", label: "Required Skills" } as any],
};

const layoutRow = (kind: ViewConfigRow["attribute_or_relation_type"], key: string): ViewConfigRow => ({
    view_type: "PrimaryView", subject_name: "JobPosting", relation_name: kind === "relation" ? key : "",
    object_name: key, form_type: "edit", section: "All Fields", section_id: "all", section_grid_row: 1,
    section_grid_col: 1, tab_name: null, row: 1, column: 1, show_label: true,
    attribute_or_relation_type: kind, name: key,
} as ViewConfigRow);

describe("keepConfigRowsOfModel", () => {
    it("drops layout entries of fields and relations the page's model leaves out", async () => {
        const { keepConfigRowsOfModel } = await import("./viewConfig");
        const rows = [
            layoutRow("attribute", "title"),
            layoutRow("attribute", "employer_tenant_id"),
            layoutRow("relation", "job_required_skill"),
            layoutRow("relation", "swipe"),
            layoutRow("view", "some_view"),
        ];
        expect(keepConfigRowsOfModel(rows, model).map((row) => row.object_name))
            .toEqual(["title", "job_required_skill", "some_view"]);
    });
});
