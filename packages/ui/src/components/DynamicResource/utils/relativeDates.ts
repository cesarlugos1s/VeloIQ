/**
 * Resolves a relative date rule value of the advanced filters ("next 2 weeks", "previous quarter"...):
 * a start and end when `asRange` is set (or the direction is "current"), otherwise one date.
 * Shared by the list page and by tools that turn the same rules into server filters.
 */
import dayjs from "dayjs";

export const resolveRelativeDate = (value: any, asRange: boolean): { start?: dayjs.Dayjs; end?: dayjs.Dayjs; date?: dayjs.Dayjs } => {
        const count = Number(value?.count ?? 1);
        const direction = value?.direction || "next";
        const unit = value?.unit || "weeks";
        const isQuarter = unit === "quarters";
        const base = dayjs();
        if (asRange || direction === "current") {
            const anchor = direction === "current"
                ? base
                : direction === "previous"
                    ? (isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit))
                    : (isQuarter ? base.add(count * 3, "month") : base.add(count, unit));
            if (isQuarter) {
                const quarterStartMonth = Math.floor(anchor.month() / 3) * 3;
                const start = anchor.month(quarterStartMonth).startOf("month");
                const end = start.add(2, "month").endOf("month");
                return { start, end };
            }
            return {
                start: anchor.startOf(unit as dayjs.ManipulateType),
                end: anchor.endOf(unit as dayjs.ManipulateType),
            };
        }
        const target = direction === "previous"
            ? (isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit))
            : (isQuarter ? base.add(count * 3, "month") : base.add(count, unit));
        if (isQuarter) {
            const quarterStartMonth = Math.floor(target.month() / 3) * 3;
            return { date: target.month(quarterStartMonth).startOf("month") };
        }
        return { date: target.startOf(unit as dayjs.ManipulateType) };
};
