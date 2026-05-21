import { useState, useEffect, useCallback } from "react";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { API_URL } from "../../../providers/constants";

export function usePinRecord(resource: string, recordId: string | number | undefined) {
    const [pinned, setPinned] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!resource || recordId === undefined || recordId === null || recordId === "") return;
        let cancelled = false;
        authenticatedFetch(
            `${API_URL}/dashboard/pinned-records/check?resource=${encodeURIComponent(resource)}&record_id=${encodeURIComponent(String(recordId))}`
        )
            .then((r) => r.json())
            .then((d) => { if (!cancelled) setPinned(Boolean(d.pinned)); })
            .catch(() => { if (!cancelled) setPinned(false); });
        return () => { cancelled = true; };
    }, [resource, recordId]);

    const pin = useCallback(async () => {
        if (!resource || recordId === undefined) return;
        setLoading(true);
        try {
            await authenticatedFetch(`${API_URL}/dashboard/pinned-records`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource, record_id: String(recordId) }),
            });
            setPinned(true);
        } finally {
            setLoading(false);
        }
    }, [resource, recordId]);

    const unpin = useCallback(async () => {
        if (!resource || recordId === undefined) return;
        setLoading(true);
        try {
            await authenticatedFetch(
                `${API_URL}/dashboard/pinned-records/${encodeURIComponent(resource)}/${encodeURIComponent(String(recordId))}`,
                { method: "DELETE" }
            );
            setPinned(false);
        } finally {
            setLoading(false);
        }
    }, [resource, recordId]);

    const toggle = useCallback(() => (pinned ? unpin() : pin()), [pinned, pin, unpin]);

    return { pinned, loading, pin, unpin, toggle };
}

export async function pinRecords(resource: string, recordIds: (string | number)[]): Promise<void> {
    await Promise.all(
        recordIds.map((id) =>
            authenticatedFetch(`${API_URL}/dashboard/pinned-records`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource, record_id: String(id) }),
            })
        )
    );
}

export async function unpinRecords(resource: string, recordIds: (string | number)[]): Promise<void> {
    await Promise.all(
        recordIds.map((id) =>
            authenticatedFetch(
                `${API_URL}/dashboard/pinned-records/${encodeURIComponent(resource)}/${encodeURIComponent(String(id))}`,
                { method: "DELETE" }
            )
        )
    );
}
