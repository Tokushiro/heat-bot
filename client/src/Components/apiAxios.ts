import axios from "axios";

const apiBase =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL)
        ? String(import.meta.env.VITE_API_BASE_URL)
        : "";

export const api = axios.create({
    // Default to relative calls so Vite proxy can forward "/api" requests in development
    baseURL: apiBase,
});
