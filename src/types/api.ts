/**
 * API Types
 * TypeScript types for API requests and responses
 */

// Common Response wrapper
export interface Response<T> {
    code: string;
    info: string;
    data?: T;
}

// Agent Config
export interface AiAgentConfig {
    agentId: string;
    agentName: string;
    agentDesc: string;
}

// Create Session Request
export interface CreateSessionRequest {
    agentId: string;
    userId: string;
}

// Create Session Response
export interface CreateSessionResponse {
    sessionId: string;
}

// Chat Request
export interface ChatRequest {
    agentId: string;
    userId: string;
    sessionId: string;
    message: string;
}

// Chat Response
export interface ChatResponse {
    content: string;
}

// Login Payload (stored in cookie)
export interface LoginPayload {
    user: string;
    ts: number;
}

// Chat Message (for UI)
export interface ChatMessage {
    id: string;
    role: "user" | "agent";
    content: string;
    timestamp: Date;
    agentId?: string;
    sessionId?: string;
}

// Response Codes
export const ResponseCode = {
    SUCCESS: "0000",
} as const;
