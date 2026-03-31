/**
 * API Configuration
 * Centralized management of API endpoints
 */

// API Base URL - change this to your backend server address
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8091";

// API Endpoints
export const API_ENDPOINTS = {
    // Query AI Agent config list
    QUERY_AGENT_CONFIG_LIST: "/api/v1/query_ai_agent_config_list",

    // Create session
    CREATE_SESSION: "/api/v1/create_session",

    // Chat (non-streaming)
    CHAT: "/api/v1/chat",

    // Chat (streaming)
    CHAT_STREAM: "/api/v1/chat_stream",
} as const;

// Build full API URL
export function buildApiUrl(endpoint: string): string {
    return `${API_BASE_URL}${endpoint}`;
}
