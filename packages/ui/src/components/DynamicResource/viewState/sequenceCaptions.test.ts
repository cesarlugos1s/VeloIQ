import { describe, expect, it } from "vitest";
import { buildSequenceCaptionLines } from "./sequenceCaptions";

const fields: any[] = [
    { key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "image", label: "Image" }, { key: "owner", label: "Owner" },
];
const record = { title: "Plan", status: "Open", image: "x.png", owner: "" };
const format = (field: any, row: any) => String(row[field.key] ?? "");

describe("buildSequenceCaptionLines", () => {
    it("follows the sequence order and skips role fields, empty values and the label text", () => {
        expect(buildSequenceCaptionLines(record, fields, ["title", "image", "owner", "status"], format, {
            excludedFieldKeys: ["image"], maximumLines: 5, labelText: "Plan",
        })).toEqual(["Status: Open"]);
    });
    it("shows only the first lines that fit", () => {
        const many = { title: "A", status: "B", image: "C", owner: "D" };
        expect(buildSequenceCaptionLines(many, fields, ["title", "status", "image", "owner"], format, { maximumLines: 2 }))
            .toEqual(["Title: A", "Status: B"]);
    });
    it("ignores unknown keys", () => {
        expect(buildSequenceCaptionLines(record, fields, ["nope", "status"], format, { maximumLines: 3 })).toEqual(["Status: Open"]);
    });
});
