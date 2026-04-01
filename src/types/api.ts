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

// Agent Response JSON (parsed from ChatResponse.content)
export type AgentResponseType = "user" | "drawio";

export interface AgentResponse {
    type: AgentResponseType;
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
    /** Mirrors AgentResponse.type; "drawio" messages rendered diagram in DrawIo panel */
    type?: AgentResponseType;
}

// Response Codes
export const ResponseCode = {
    SUCCESS: "0000",
} as const;

// Conversation Bookmark (for localStorage persistence)
export interface ConversationBookmark {
    id: string;
    title: string;
    agentId: string;
    agentName: string;
    sessionId: string;
    userId: string;
    messages: ChatMessage[];
    diagramXml: string;
    createdAt: number;
    updatedAt: number;
}

// Serialized version for localStorage (Date as string)
export interface SerializedChatMessage {
    id: string;
    role: "user" | "agent";
    content: string;
    timestamp: string;
    agentId?: string;
    sessionId?: string;
    type?: AgentResponseType;
}

export interface SerializedConversationBookmark {
    id: string;
    title: string;
    agentId: string;
    agentName: string;
    sessionId: string;
    userId: string;
    messages: SerializedChatMessage[];
    diagramXml: string;
    createdAt: number;
    updatedAt: number;
}
