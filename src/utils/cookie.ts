/**
 * Cookie Utilities
 * Helper functions for cookie management
 */

import {LoginPayload} from "@/types/api";

export const COOKIE_NAME = "ai_agent_login";

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie ? document.cookie.split("; ") : [];
    for (const item of cookies) {
        const eqIndex = item.indexOf("=");
        const k = eqIndex >= 0 ? item.slice(0, eqIndex) : item;
        const v = eqIndex >= 0 ? item.slice(eqIndex + 1) : "";
        if (k === name) return decodeURIComponent(v);
    }
    return null;
}

/**
 * Set a cookie
 */
export function setCookie(
    name: string,
    value: string,
    days: number = 7
): void {
    if (typeof document === "undefined") return;

    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; Path=/; SameSite=Lax`;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Safely parse JSON
 */
export function safeParseJson<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

/**
 * Get login payload from cookie
 */
export function getLoginPayload(): LoginPayload | null {
    const rawLogin = getCookie(COOKIE_NAME);
    if (!rawLogin) return null;
    return safeParseJson<LoginPayload>(rawLogin);
}

/**
 * Save login payload to cookie
 */
export function saveLoginPayload(userId: string): void {
    const payload: LoginPayload = {
        user: userId,
        ts: Date.now(),
    };
    setCookie(COOKIE_NAME, JSON.stringify(payload));
}

/**
 * Clear login
 */
export function clearLogin(): void {
    deleteCookie(COOKIE_NAME);
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
    const payload = getLoginPayload();
    return !!payload?.user;
}

/**
 * Get current user ID
 */
export function getCurrentUserId(): string | null {
    const payload = getLoginPayload();
    return payload?.user || null;
}

/**
 * Format timestamp to readable date string
 */
export function formatTime(ts: number): string {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
