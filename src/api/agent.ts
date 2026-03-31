/**
 * Agent API Service
 * Handles all API calls to the backend
 */

import {API_ENDPOINTS, buildApiUrl} from "@/config/api-config";
import {
  AiAgentConfig,
  ChatRequest,
  ChatResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  Response,
  ResponseCode,
} from "@/types/api";

/**
 * Generic request function with JSON handling
 */
async function requestJson<T>(
    endpoint: string,
    options?: RequestInit
): Promise<Response<T>> {
    const url = buildApiUrl(endpoint);

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
        ...options,
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    let json: Response<T> | null = null;
    if (contentType.includes("application/json")) {
        try {
            json = JSON.parse(raw);
        } catch {
            json = null;
        }
    } else {
        try {
            json = JSON.parse(raw);
        } catch {
            json = {code: "ERROR", info: raw} as Response<T>;
        }
    }

    if (!response.ok) {
        const message = json?.info || raw || `HTTP ${response.status}`;
        throw new Error(message);
    }

    return json as Response<T>;
}

/**
 * Ensure the response is successful
 */
function ensureSuccess<T>(resp: Response<T>): T {
    if (!resp) throw new Error("No response from server");
    if (resp.code !== ResponseCode.SUCCESS) {
        throw new Error(resp.info || `Request failed: ${resp.code}`);
    }
    return resp.data as T;
}

/**
 * Query AI Agent config list
 * GET /api/v1/query_ai_agent_config_list
 */
export async function queryAgentConfigList(): Promise<AiAgentConfig[]> {
    const resp = await requestJson<AiAgentConfig[]>(
        API_ENDPOINTS.QUERY_AGENT_CONFIG_LIST,
        {method: "GET"}
    );
    return ensureSuccess(resp) || [];
}

/**
 * Create a new session
 * POST /api/v1/create_session
 */
export async function createSession(
    request: CreateSessionRequest
): Promise<string> {
    const resp = await requestJson<CreateSessionResponse>(
        API_ENDPOINTS.CREATE_SESSION,
        {
            method: "POST",
            body: JSON.stringify(request),
        }
    );
    const data = ensureSuccess(resp);
    if (!data.sessionId) throw new Error("Failed to create session: no sessionId");
    return data.sessionId;
}

/**
 * Send a chat message (non-streaming)
 * POST /api/v1/chat
 */
export async function chat(request: ChatRequest): Promise<string> {
    const resp = await requestJson<ChatResponse>(API_ENDPOINTS.CHAT, {
        method: "POST",
        body: JSON.stringify(request),
    });
    const data = ensureSuccess(resp);
    return data.content || "";
}

/**
 * Send a chat message (streaming)
 * POST /api/v1/chat_stream
 * Returns a ReadableStream for streaming responses
 */
export async function chatStream(
    request: ChatRequest,
    onMessage: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> {
    const url = buildApiUrl(API_ENDPOINTS.CHAT_STREAM);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, {stream: true});

            // Process complete chunks
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.trim()) {
                    onMessage(line);
                }
            }
        }

        // Process remaining buffer
        if (buffer.trim()) {
            onMessage(buffer);
        }

        onComplete();
    } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Check if error is a backend unavailable error
 */
export function isBackendUnavailableError(err: Error): boolean {
    const msg = err.message || "";
    return (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed") ||
        msg.includes("CORS") ||
        msg.includes("fetch")
    );
}
