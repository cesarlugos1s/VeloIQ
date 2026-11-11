/**
 * The shared view state of one page block, as the views use it: the resolved
 * state (defaults, saved, temporary) and setters that write the temporary
 * layer. Saving copies the temporary layer into the saved one with
 * `copyTemporaryIntoSaved`; resetting clears only the temporary layer.
 *
 * A block without a key (an embedded page) keeps its temporary layer in the
 * component, so it behaves like ordinary React state and is lost on unmount.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { getTemporaryViewState, updateTemporaryViewState, useTemporaryViewState } from "../temporaryLayout/temporaryPageLayoutStore";
import { resolveViewState } from "./viewStateLayers";
import type { SharedViewState, ViewStateKey, ViewStateLayer } from "./viewStateTypes";

export interface UseSharedViewStateOptions {
    /** Key from buildViewStateBlockKey; null keeps the temporary layer in the component. */
    blockKey: string | null;
    /** Defaults from the page configuration or a template (keep the object stable between renders). */
    defaults?: ViewStateLayer;
    /** Saved preferences, already mapped to the shared schema (keep the object stable between renders). */
    saved?: ViewStateLayer;
}

export interface SharedViewStateHandle {
    state: SharedViewState;
    /** The temporary layer alone, for saving and for "has unsaved changes". */
    temporary: ViewStateLayer;
    /** Sets keys in the temporary layer; a key set to undefined goes back to the lower layers. */
    update: (changes: ViewStateLayer) => void;
    /** Sets one key like a React state setter; a function receives the current resolved value. */
    setValue: <K extends ViewStateKey>(key: K, next: SetStateAction<SharedViewState[K]>) => void;
    /** Drops every temporary change of this block. */
    resetTemporary: () => void;
}

function withoutUndefinedKeys(layer: ViewStateLayer): ViewStateLayer {
    const cleaned: Record<string, unknown> = { ...layer };
    Object.keys(cleaned).forEach((key) => { if (cleaned[key] === undefined) delete cleaned[key]; });
    return cleaned as ViewStateLayer;
}

export function useSharedViewState({ blockKey, defaults, saved }: UseSharedViewStateOptions): SharedViewStateHandle {
    const [localTemporary, setLocalTemporary] = useState<ViewStateLayer>({});
    const localTemporaryRef = useRef<ViewStateLayer>(localTemporary);
    const storeTemporary = useTemporaryViewState(blockKey);
    const temporary = blockKey ? storeTemporary : localTemporary;

    const lowerLayersRef = useRef({ defaults, saved });
    lowerLayersRef.current = { defaults, saved };

    const state = useMemo(() => resolveViewState({ defaults, saved, temporary }), [defaults, saved, temporary]);

    const update = useCallback((changes: ViewStateLayer) => {
        if (blockKey) {
            updateTemporaryViewState(blockKey, changes);
            return;
        }
        // Written to the ref at once, so two updates in the same tick both apply.
        localTemporaryRef.current = withoutUndefinedKeys({ ...localTemporaryRef.current, ...changes });
        setLocalTemporary(localTemporaryRef.current);
    }, [blockKey]);

    const setValue = useCallback(<K extends ViewStateKey>(key: K, next: SetStateAction<SharedViewState[K]>) => {
        const currentTemporary = blockKey ? getTemporaryViewState(blockKey) : localTemporaryRef.current;
        const current = resolveViewState({ ...lowerLayersRef.current, temporary: currentTemporary })[key];
        const value = typeof next === "function" ? (next as (previous: SharedViewState[K]) => SharedViewState[K])(current) : next;
        update({ [key]: value } as ViewStateLayer);
    }, [blockKey, update]);

    const resetTemporary = useCallback(() => {
        const currentTemporary = blockKey ? getTemporaryViewState(blockKey) : localTemporaryRef.current;
        const clearing: Record<string, undefined> = {};
        Object.keys(currentTemporary).forEach((key) => { clearing[key] = undefined; });
        update(clearing as ViewStateLayer);
    }, [blockKey, update]);

    return { state, temporary, update, setValue, resetTemporary };
}
