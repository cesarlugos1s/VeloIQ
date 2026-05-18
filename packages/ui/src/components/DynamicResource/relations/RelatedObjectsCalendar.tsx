import React, { useEffect, useMemo, useRef, useState } from "react";
import { Spin, Alert, Empty, Select, Space, Button, Tooltip, theme } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined } from "@ant-design/icons";
import { useGo } from "@refinedev/core";
import dayjs from "dayjs";
import type { ModelDef, RelationDef } from "../types";
import { resolveResourcePath, getRecordDisplayLabel } from "../utils/model";
import { getShowHref } from "../utils/navigation";
import { CALENDAR_WEEKDAYS, getCalendarDateFieldOptions, getCalendarRecordDate } from "../utils/calendar";
import { useRelatedGalleryRecords } from "./hooks";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const RelatedObjectsCalendar: React.FC<{
    rel: RelationDef;
    record: any;
    relatedModel: ModelDef;
    allModels?: ModelDef[];
}> = ({ rel, record, relatedModel, allModels }) => {
    const _go = useGo();
    const { token } = theme.useToken();
    const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });
    const resource = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
    const dateFieldOptions = useMemo(() => getCalendarDateFieldOptions(relatedModel.fields), [relatedModel.fields]);
    const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
    const [calendarDateField, setCalendarDateField] = useState<string>(() => dateFieldOptions[0]?.key || "");
    const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => dayjs().startOf("month"));
    const dateFieldKeySet = useMemo(() => new Set(dateFieldOptions.map((field) => field.key)), [dateFieldOptions]);

    useEffect(() => {
        if (calendarDateField && dateFieldKeySet.has(calendarDateField)) return;
        const fallback = dateFieldOptions[0]?.key || "";
        if (fallback !== calendarDateField) setCalendarDateField(fallback);
    }, [calendarDateField, dateFieldKeySet, dateFieldOptions]);

    const calendarEntries = useMemo(() => {
        if (!calendarDateField) return [];
        const entries: Array<{ key: string | number; date: ReturnType<typeof dayjs>; id: any; label: string }> = [];
        records.forEach((item) => {
            const recordDate = getCalendarRecordDate(item, calendarDateField);
            if (!recordDate) return;
            const id = item?.eid ?? item?.id;
            entries.push({
                key: id ?? getRecordDisplayLabel(item),
                date: recordDate,
                id,
                label: getRecordDisplayLabel(item),
            });
        });
        return entries;
    }, [calendarDateField, records]);
    const earliestDateTs = useMemo(() => {
        if (calendarEntries.length === 0) return null;
        let earliest = calendarEntries[0].date.valueOf();
        for (let index = 1; index < calendarEntries.length; index += 1) {
            const value = calendarEntries[index].date.valueOf();
            if (value < earliest) earliest = value;
        }
        return earliest;
    }, [calendarEntries]);
    const initSignatureRef = useRef("");
    useEffect(() => {
        const signature = `${calendarDateField}|${calendarMode}|${earliestDateTs ?? "none"}`;
        if (initSignatureRef.current === signature) return;
        initSignatureRef.current = signature;
        if (earliestDateTs === null) {
            setCalendarAnchorDate(dayjs().startOf(calendarMode));
            return;
        }
        setCalendarAnchorDate(dayjs(earliestDateTs).startOf(calendarMode));
    }, [calendarDateField, calendarMode, earliestDateTs]);
    const entriesByDate = useMemo(() => {
        const grouped = new Map<string, typeof calendarEntries>();
        calendarEntries.forEach((entry) => {
            const key = entry.date.format("YYYY-MM-DD");
            const existing = grouped.get(key) || [];
            existing.push(entry);
            grouped.set(key, existing);
        });
        return grouped;
    }, [calendarEntries]);
    const rangeDays = useMemo(() => {
        const current = calendarAnchorDate.startOf(calendarMode);
        if (calendarMode === "week") {
            const start = current.startOf("week");
            return Array.from({ length: 7 }, (_unused, offset) => start.add(offset, "day"));
        }
        const start = current.startOf("month").startOf("week");
        const end = current.endOf("month").endOf("week");
        const totalDays = end.diff(start, "day") + 1;
        return Array.from({ length: totalDays }, (_unused, offset) => start.add(offset, "day"));
    }, [calendarAnchorDate, calendarMode]);
    const periodLabel = useMemo(() => {
        if (calendarMode === "week") {
            const weekStart = calendarAnchorDate.startOf("week");
            const weekEnd = weekStart.endOf("week");
            return `${weekStart.format("MMM D, YYYY")} - ${weekEnd.format("MMM D, YYYY")}`;
        }
        return calendarAnchorDate.startOf("month").format("MMMM YYYY");
    }, [calendarAnchorDate, calendarMode]);

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;
    if (dateFieldOptions.length === 0) return <Empty description={_("No date/datetime fields available for calendar view.")} />;
    if (!records.length) return <Empty description={_("No related records available.")} />;

    const selectedDateField = relatedModel.fields.find((field) => field.key === calendarDateField);
    const selectedLabel = selectedDateField?.label || calendarDateField;
    return (
        <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Space wrap size={8}>
                    <Select
                        size="small"
                        value={calendarMode}
                        onChange={(value: "month" | "week") => setCalendarMode(value)}
                        options={[
                            { label: _("Monthly"), value: "month" },
                            { label: _("Weekly"), value: "week" },
                        ]}
                        style={{ minWidth: 120 }}
                    />
                    <Select
                        size="small"
                        value={calendarDateField}
                        onChange={(value) => setCalendarDateField(value)}
                        options={dateFieldOptions.map((field) => ({ label: field.label, value: field.key }))}
                        style={{ minWidth: 220 }}
                        placeholder={_("Date field")}
                    />
                </Space>
                <Space size={8}>
                    <Tooltip title={_("Previous")}>
                        <Button
                            size="small"
                            icon={<ArrowLeftOutlined />}
                            aria-label={_("Previous")}
                            onClick={() => setCalendarAnchorDate((prev) => prev.subtract(1, calendarMode).startOf(calendarMode))}
                        />
                    </Tooltip>
                    <Tooltip title={_("Today")}>
                        <Button
                            size="small"
                            icon={<CalendarOutlined />}
                            aria-label={_("Today")}
                            onClick={() => setCalendarAnchorDate(dayjs().startOf(calendarMode))}
                        />
                    </Tooltip>
                    <Tooltip title={_("Next")}>
                        <Button
                            size="small"
                            icon={<ArrowRightOutlined />}
                            aria-label={_("Next")}
                            onClick={() => setCalendarAnchorDate((prev) => prev.add(1, calendarMode).startOf(calendarMode))}
                        />
                    </Tooltip>
                </Space>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>
                {periodLabel} {selectedLabel ? `- ${selectedLabel}` : ""}
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 8,
                    overflow: "hidden",
                }}
            >
                {CALENDAR_WEEKDAYS.map((label) => (
                    <div
                        key={label}
                        style={{
                            padding: "6px 8px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: token.colorTextSecondary,
                            background: token.colorFillAlter,
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        }}
                    >
                        {label}
                    </div>
                ))}
                {rangeDays.map((day) => {
                    const dayKey = day.format("YYYY-MM-DD");
                    const entries = entriesByDate.get(dayKey) || [];
                    const isOutsideCurrentMonth = calendarMode === "month" && day.month() !== calendarAnchorDate.month();
                    const isToday = day.isSame(dayjs(), "day");
                    return (
                        <div
                            key={dayKey}
                            style={{
                                minHeight: 120,
                                padding: 8,
                                borderTop: `1px solid ${token.colorBorderSecondary}`,
                                borderRight: day.day() === 6 ? "none" : `1px solid ${token.colorBorderSecondary}`,
                                background: isOutsideCurrentMonth ? token.colorFillAlter : token.colorBgContainer,
                                opacity: isOutsideCurrentMonth ? 0.75 : 1,
                                display: "grid",
                                alignContent: "start",
                                gap: 4,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: isToday ? 700 : 600,
                                    color: isToday ? token.colorPrimary : token.colorTextSecondary,
                                }}
                            >
                                {day.format("D")}
                            </div>
                            <div style={{ display: "grid", gap: 2 }}>
                                {entries.map((entry, index) => {
                                    if (entry.id === undefined || entry.id === null) {
                                        return (
                                            <div key={`${entry.key}-${index}`} style={{ fontSize: 12, lineHeight: 1.3 }}>
                                                {entry.label}
                                            </div>
                                        );
                                    }
                                    return (
                                        <a
                                            key={`${entry.key}-${index}`}
                                            href={getShowHref(resource, entry.id, allModels)}
                                            style={{ display: "block", fontSize: 12, lineHeight: 1.3, color: token.colorLink, textDecoration: "none", wordWrap: "break-word", overflowWrap: "break-word" }}
                                            title={entry.label}
                                        >
                                            {entry.label}
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
