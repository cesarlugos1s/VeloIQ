import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { resetAllTemporaryLayouts, updateTemporaryViewState } from "../temporaryLayout/temporaryPageLayoutStore";
import { useSharedViewState } from "./useSharedViewState";

afterEach(() => resetAllTemporaryLayouts());

const Probe: React.FC<{ blockKey: string | null }> = ({ blockKey }) => {
    const { state } = useSharedViewState({ blockKey, defaults: { pageSize: 5 }, saved: { pageSize: 20, page: 2 } });
    return <span>{`${state.pageSize}/${state.page}`}</span>;
};

describe("useSharedViewState", () => {
    it("resolves defaults, saved and temporary in that precedence", () => {
        expect(renderToString(<Probe blockKey="p:list#list" />)).toContain("20/2");
        updateTemporaryViewState("p:list#list", { pageSize: 50 });
        expect(renderToString(<Probe blockKey="p:list#list" />)).toContain("50/2");
    });
    it("ignores temporary changes of another block and of a null key", () => {
        updateTemporaryViewState("p:list#other", { pageSize: 99 });
        expect(renderToString(<Probe blockKey="p:list#list" />)).toContain("20/2");
        expect(renderToString(<Probe blockKey={null} />)).toContain("20/2");
    });
});

describe("setValue", () => {
    it("applies functional updates in sequence for a keyed block", async () => {
        const { getTemporaryViewState } = await import("../temporaryLayout/temporaryPageLayoutStore");
        let handle: ReturnType<typeof useSharedViewState> | undefined;
        const Capture: React.FC = () => { handle = useSharedViewState({ blockKey: "q:list#list" }); return null; };
        renderToString(<Capture />);
        handle!.setValue("pageSize", 20);
        handle!.setValue("pageSize", (previous) => previous + 5);
        expect(getTemporaryViewState("q:list#list").pageSize).toBe(25);
        handle!.resetTemporary();
        expect(getTemporaryViewState("q:list#list")).toEqual({});
    });
});
