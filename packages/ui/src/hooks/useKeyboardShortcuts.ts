import { useEffect } from "react";

export type ShortcutDef = {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    handler: () => void;
    /** Set to false to allow default browser behavior. Defaults to true. */
    preventDefault?: boolean;
    /** If true, the shortcut will NOT fire when a modal is open. Defaults to true for Escape. */
    skipWhenModalOpen?: boolean;
};

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            for (const shortcut of shortcuts) {
                const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
                if (!keyMatch) continue;

                const ctrlMatch = shortcut.ctrl
                    ? (e.ctrlKey || e.metaKey)
                    : (!e.ctrlKey && !e.metaKey);
                if (!ctrlMatch) continue;

                const shiftMatch = shortcut.shift ? e.shiftKey : true;
                if (!shiftMatch) continue;

                // Don't fire Escape when an Ant Design modal/popover/dropdown is open
                const skipModal = shortcut.skipWhenModalOpen ?? (shortcut.key === "Escape");
                if (skipModal && document.querySelector(".ant-modal-wrap, .ant-popover, .ant-select-dropdown")) {
                    continue;
                }

                if (shortcut.preventDefault !== false) {
                    e.preventDefault();
                }
                shortcut.handler();
                return;
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [shortcuts]);
}
