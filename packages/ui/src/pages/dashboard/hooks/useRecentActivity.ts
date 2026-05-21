import { useState, useEffect, useCallback } from "react";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { API_URL } from "../../../providers/constants";

export interface RecentRecord {
    id: string | number;
    _label: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}

export interface RecentActivityGroup {
    model_name: string;
    resource: string;
    records: RecentRecord[];
}

export interface RecentActivityData {
    groups: RecentActivityGroup[];
    days: number;
}

export function useRecentActivity(days?: number) {
    const [data, setData] = useState<RecentActivityData | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = days !== undefined ? `?days=${days}` : "";
            const res = await authenticatedFetch(`${API_URL}/dashboard/recent-activity${params}`);
            if (res.ok) setData(await res.json());
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    return { data, loading, reload: load };
}
