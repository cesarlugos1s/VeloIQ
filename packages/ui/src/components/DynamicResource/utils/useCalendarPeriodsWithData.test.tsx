/** The calendar's Previous / Next / Today go only to months or weeks that hold records. */
import React from "react";
import dayjs from "dayjs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useCalendarPeriodsWithData, type CalendarPeriodMode } from "./useCalendarPeriodsWithData";

/** Renders the hook's answer as JSON so the test can read it without a DOM. */
function readPeriods(dates: string[], mode: CalendarPeriodMode, anchor: string) {
    const Probe: React.FC = () => <>{JSON.stringify(useCalendarPeriodsWithData(dates.map((d) => dayjs(d)), mode, dayjs(anchor)))}</>;
    return JSON.parse(renderToString(<Probe />).replace(/&quot;/g, '"'));
}

describe("useCalendarPeriodsWithData", () => {
    const dates = ["2025-01-15", "2025-01-20", "2025-04-02"];

    it("skips the empty months between two months with records", () => {
        const periods = readPeriods(dates, "month", "2025-01-01");
        expect(periods.previousPeriodStart).toBeUndefined();
        expect(dayjs(periods.nextPeriodStart).format("YYYY-MM")).toBe("2025-04");
    });

    it("goes back from a later month to the closest month with records", () => {
        const periods = readPeriods(dates, "month", "2025-04-01");
        expect(dayjs(periods.previousPeriodStart).format("YYYY-MM")).toBe("2025-01");
        expect(periods.nextPeriodStart).toBeUndefined();
    });

    it("works in weeks", () => {
        const periods = readPeriods(dates, "week", "2025-01-15");
        expect(dayjs(periods.nextPeriodStart).format("YYYY-MM-DD")).toBe(dayjs("2025-01-20").startOf("week").format("YYYY-MM-DD"));
    });

    it("has nowhere to go without records", () => {
        const periods = readPeriods([], "month", "2025-01-01");
        expect(periods).toEqual({});
    });
});
