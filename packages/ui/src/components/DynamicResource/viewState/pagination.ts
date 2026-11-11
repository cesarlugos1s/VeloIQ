/**
 * Pagination every view type uses: the same page size choices and the same
 * props for the paginator, so the control looks and behaves the same in the
 * table, gallery, list and related-model blocks.
 */

/** The page sizes a user can choose from. */
export const PAGE_SIZE_OPTIONS = ["10", "20", "50", "100"];

export interface PaginationPropsInput {
    current: number;
    pageSize: number;
    /** Undefined while the server total is not known. */
    total: number | undefined;
    hideOnSinglePage?: boolean;
    onChange: (page: number, pageSize?: number) => void;
}

export function buildPaginationProps({ current, pageSize, total, hideOnSinglePage = true, onChange }: PaginationPropsInput) {
    return {
        current,
        pageSize,
        total,
        hideOnSinglePage,
        showSizeChanger: true,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        onChange,
        onShowSizeChange: onChange,
    };
}
