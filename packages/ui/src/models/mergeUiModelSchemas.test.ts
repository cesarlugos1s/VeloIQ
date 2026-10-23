import { describe, expect, it } from "vitest";
import type { ModelDef } from "../components/DynamicResource/types";
import { mergeUiModelSchemas } from "./mergeUiModelSchemas";

const generated: ModelDef[] = [{
    name: "Task",
    label: "Task",
    resource: "task",
    pkField: "id",
    fields: [
        { key: "title", label: "Title", type: "string" },
        { key: "description", label: "Description", type: "string" },
        { key: "estimate", label: "Estimate", type: "number" },
    ],
    relations: [{ resource: "comment", label: "Comments", targetKey: "task_id" } as any],
}];

describe("mergeUiModelSchemas", () => {
    it("returns the generated models unchanged without overrides", () => {
        expect(mergeUiModelSchemas(generated)).toEqual(generated);
    });

    it("changes, adds and omits fields", () => {
        const [task] = mergeUiModelSchemas(generated, [{
            name: "Task",
            fields: [
                { key: "title", label: "Name" },
                { key: "due", label: "Due", type: "date" },
                { key: "description", omit: true },
            ],
        }]);
        expect(task.fields.map((f) => f.key)).toEqual(["title", "estimate", "due"]);
        expect(task.fields[0].label).toBe("Name");
        expect(task.fields[2]).toMatchObject({ key: "due", label: "Due", type: "date" });
        expect(task.fields.some((f) => "omit" in f)).toBe(false);
    });

    it("applies override lists in order, later lists winning", () => {
        const extension = [{ name: "Task", label: "Extension label", fields: [{ key: "estimate", label: "Hours" }] }];
        const manual = [{ name: "Task", label: "App label" }];
        const [task] = mergeUiModelSchemas(generated, extension, manual);
        expect(task.label).toBe("App label");
        expect(task.fields.find((f) => f.key === "estimate")?.label).toBe("Hours");
    });

    it("changes relations by resource and adds new ones", () => {
        const [task] = mergeUiModelSchemas(generated, [{
            name: "Task",
            relations: [{ resource: "comment", label: "Notes" }, { resource: "attachment", label: "Files" } as any],
        }]);
        expect(task.relations?.map((r) => r.label)).toEqual(["Notes", "Files"]);
    });

    it("omits relations", () => {
        const [task] = mergeUiModelSchemas(generated, [{ name: "Task", relations: [{ resource: "comment", omit: true }] }]);
        expect(task.relations).toEqual([]);
    });

    it("appends models only the overrides declare", () => {
        const models = mergeUiModelSchemas(generated, [{ name: "Report", fields: [{ key: "total", type: "number" }] }]);
        expect(models.map((m) => m.name)).toEqual(["Task", "Report"]);
        expect(models[1]).toMatchObject({ resource: "report", pkField: "id", label: "Report" });
        expect(models[1].fields[0]).toMatchObject({ key: "total", label: "total", type: "number" });
    });
});
