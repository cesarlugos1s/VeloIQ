import { createContext, useContext, useEffect, useRef } from "react";

/** Runs before the Edit page saves its record; throwing cancels the save. */
export type BeforeEditSave = () => Promise<void>;

type Register = (handler: BeforeEditSave) => () => void;

export const BeforeEditSaveContext = createContext<Register | null>(null);

/**
 * Let a component inside DynamicEdit (such as a model's extra Edit tab) save
 * its own data as part of the page's Save. The handler runs before the
 * record is saved; if it throws, the record is not saved.
 */
export function useBeforeEditSave(handler: BeforeEditSave): void {
    const register = useContext(BeforeEditSaveContext);
    const latest = useRef(handler);
    latest.current = handler;
    useEffect(() => register?.(() => latest.current()), [register]);
}
