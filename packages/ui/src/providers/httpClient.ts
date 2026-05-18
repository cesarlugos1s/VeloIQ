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
