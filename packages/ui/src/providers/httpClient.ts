/**
 * Axios HTTP client with automatic Bearer token injection.
 *
 * Passed to the ``@refinedev/simple-rest`` data provider so that every
 * API request includes the JWT from localStorage.
 */

import axios from "axios";

const TOKEN_KEY = "jm_access_token";

export const httpClient = axios.create();

httpClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Surface the backend's error payload to the UI.  FastAPI returns
// ``{"detail": "<message>"}`` on 4xx (e.g. validation failures and VigilantIQ
// business-rule constraint violations).  Refine/antd shows ``error.message`` in
// the failure notification, which by default is axios's generic
// "Request failed with status code NNN".  Promote the server-provided detail so
// the user sees the actual message (e.g. a constraint rule's violation text).
httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const detail = error?.response?.data?.detail;
        if (detail) {
            error.message =
                typeof detail === "string" ? detail : JSON.stringify(detail);
        }
        return Promise.reject(error);
    },
);
