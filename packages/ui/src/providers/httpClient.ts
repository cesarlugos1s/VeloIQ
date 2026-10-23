/**
 * Axios HTTP client with automatic Bearer token injection.
 *
 * Passed to the ``@refinedev/simple-rest`` data provider so that every
 * API request includes the JWT from localStorage.
 */

import axios from "axios";
import { getActiveLocale } from "../utils/activeLocale";
import { ROW_REVISIONS_RESPONSE_HEADER, rememberRowRevisions, rowRevisionFor } from "../utils/trackRowRevisions";
import { answerInPageRowsRequest } from "../utils/serveInPageRowsStores";

const TOKEN_KEY = "jm_access_token";

export const httpClient = axios.create();

// Rows that exist only in the page are answered from their store instead of
// the network (see serveInPageRowsStores), so Refine's data provider serves
// them like any other resource.
const networkAdapter = axios.getAdapter(httpClient.defaults.adapter);
httpClient.defaults.adapter = (config) => {
    const requestUrl = config.url ? `${config.baseURL ?? ""}${config.url}` : "";
    const query = config.params ? new URLSearchParams(config.params as Record<string, string>).toString() : "";
    const inPageAnswer = requestUrl
        ? answerInPageRowsRequest(query ? `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}${query}` : requestUrl, config.method, config.data)
        : null;
    if (!inPageAnswer) return networkAdapter(config);
    const response = { data: inPageAnswer.body, status: inPageAnswer.status, statusText: String(inPageAnswer.status),
                       headers: inPageAnswer.headers, config, request: {} };
    if (inPageAnswer.status >= 400) {
        return Promise.reject(new axios.AxiosError(
            typeof inPageAnswer.body?.detail === "string" ? inPageAnswer.body.detail : `HTTP ${inPageAnswer.status}`,
            String(inPageAnswer.status), config, {}, response as any));
    }
    return Promise.resolve(response as any);
};

httpClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.headers && !config.headers["Accept-Language"]) {
        config.headers["Accept-Language"] = getActiveLocale();
    }
    // Concurrent-edit check of non-model data resource rows (see trackRowRevisions).
    const revision = config.url ? rowRevisionFor(config.url, config.method) : undefined;
    if (revision && config.headers && !config.headers["If-Match"]) {
        config.headers["If-Match"] = revision;
    }
    return config;
});

// Surface the backend's error payload to the UI.  FastAPI returns
// ``{"detail": "<message>"}`` on 4xx (e.g. validation failures and IQVigilant
// business-rule constraint violations).  Refine/antd shows ``error.message`` in
// the failure notification, which by default is axios's generic
// "Request failed with status code NNN".  Promote the server-provided detail so
// the user sees the actual message (e.g. a constraint rule's violation text).
httpClient.interceptors.response.use(
    (response) => {
        if (response.headers?.[ROW_REVISIONS_RESPONSE_HEADER] && response.config?.url) {
            rememberRowRevisions(response.config.url, response.data);
        }
        return response;
    },
    (error) => {
        const detail = error?.response?.data?.detail;
        if (detail) {
            error.message =
                typeof detail === "string" ? detail : JSON.stringify(detail);
        }
        return Promise.reject(error);
    },
);
