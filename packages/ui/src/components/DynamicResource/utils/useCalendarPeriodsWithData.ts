/**
 * Navigation of a calendar view limited to the months (or weeks) that hold
 * records, so Previous / Next / Today never land on an empty period.
 */
import { useMemo } from "react";
import dayjs from "dayjs";

/** Calendar granularity: a month grid or a week row. */
export type CalendarPeriodMode = "month" | "week";

/** Where the Previous, Next and Today buttons may go (undefined = nowhere, so disable the button). */
export interface CalendarPeriodsWithData {
    /** Start of the closest earlier period that holds records. */
    previousPeriodStart: number | undefined;
    /** Start of the closest later period that holds records. */
    nextPeriodStart: number | undefined;
    /** Start of the period with records closest to today (today's own when it holds records). */
    periodStartNearestToday: number | undefined;
}

/**
 * @param entryDates  the date of every record shown on the calendar
 * @param mode        month or week
 * @param anchorDate  any date inside the period being shown
 */
export function useCalendarPeriodsWithData(
    entryDates: Array<ReturnType<typeof dayjs>>,
    mode: CalendarPeriodMode,
    anchorDate: ReturnType<typeof dayjs>,
): CalendarPeriodsWithData {
    // Sorted start (timestamp) of every period, in this mode, that holds at least one record.
    const periodStartsWithData = useMemo(() => {
        const periodStarts = new Set<number>();
        entryDates.forEach((date) => periodStarts.add(date.startOf(mode).valueOf()));
        return Array.from(periodStarts).sort((first, second) => first - second);
    }, [entryDates, mode]);
    const currentPeriodStart = anchorDate.startOf(mode).valueOf();

    return useMemo(() => {
        const todayPeriodStart = dayjs().startOf(mode).valueOf();
        let periodStartNearestToday: number | undefined;
        periodStartsWithData.forEach((periodStart) => {
            if (
                periodStartNearestToday === undefined
                || Math.abs(periodStart - todayPeriodStart) < Math.abs(periodStartNearestToday - todayPeriodStart)
            ) periodStartNearestToday = periodStart;
        });
        return {
            previousPeriodStart: [...periodStartsWithData].reverse().find((periodStart) => periodStart < currentPeriodStart),
            nextPeriodStart: periodStartsWithData.find((periodStart) => periodStart > currentPeriodStart),
            periodStartNearestToday,
        };
    }, [periodStartsWithData, currentPeriodStart, mode]);
}
