import { describe, expect, it } from "vitest";
import { PAGE_SIZE_OPTIONS, buildPaginationProps } from "./pagination";

describe("buildPaginationProps", () => {
    it("offers the shared page sizes and sends size changes to the same handler", () => {
        const onChange = () => {};
        const props = buildPaginationProps({ current: 2, pageSize: 20, total: 55, onChange });
        expect(props).toMatchObject({ current: 2, pageSize: 20, total: 55, hideOnSinglePage: true, showSizeChanger: true });
        expect(props.pageSizeOptions).toBe(PAGE_SIZE_OPTIONS);
        expect(props.onShowSizeChange).toBe(onChange);
    });
    it("lets a view keep the paginator visible on one page", () => {
        expect(buildPaginationProps({ current: 1, pageSize: 10, total: 3, hideOnSinglePage: false, onChange: () => {} }).hideOnSinglePage).toBe(false);
    });
});
