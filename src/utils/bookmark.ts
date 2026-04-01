/**
 * Bookmark Storage Utilities
 * Manages conversation bookmarks in localStorage
 */

import {ChatMessage, ConversationBookmark, SerializedChatMessage, SerializedConversationBookmark} from "@/types/api";

const BOOKMARKS_STORAGE_KEY = "ai_agent_conversation_bookmarks";

/**
 * Serialize ChatMessage for localStorage (convert Date to string)
 */
function serializeMessage(message: ChatMessage): SerializedChatMessage {
    return {
        ...message,
        timestamp: message.timestamp.toISOString(),
    };
}

/**
 * Deserialize ChatMessage from localStorage (convert string to Date)
 */
function deserializeMessage(message: SerializedChatMessage): ChatMessage {
    return {
        ...message,
        timestamp: new Date(message.timestamp),
    };
}

/**
 * Serialize ConversationBookmark for localStorage
 */
function serializeBookmark(bookmark: ConversationBookmark): SerializedConversationBookmark {
    return {
        ...bookmark,
        messages: bookmark.messages.map(serializeMessage),
    };
}

/**
 * Deserialize ConversationBookmark from localStorage
 */
function deserializeBookmark(bookmark: SerializedConversationBookmark): ConversationBookmark {
    return {
        ...bookmark,
        messages: bookmark.messages.map(deserializeMessage),
    };
}

/**
 * Generate a unique bookmark ID
 */
export function generateBookmarkId(): string {
    return `bm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all bookmarks from localStorage (sorted by updatedAt desc - newest first)
 */
export function getBookmarks(): ConversationBookmark[] {
    if (typeof window === "undefined") return [];

    try {
        const data = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
        if (!data) return [];

        const serialized: SerializedConversationBookmark[] = JSON.parse(data);
        return serialized
            .map(deserializeBookmark)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
        console.error("[Bookmark] Failed to load bookmarks:", error);
        return [];
    }
}

/**
 * Get a single bookmark by ID
 */
export function getBookmarkById(id: string): ConversationBookmark | null {
    const bookmarks = getBookmarks();
    return bookmarks.find(b => b.id === id) || null;
}

/**
 * Save bookmarks to localStorage
 */
function saveBookmarks(bookmarks: ConversationBookmark[]): void {
    if (typeof window === "undefined") return;

    try {
        const serialized = bookmarks.map(serializeBookmark);
        localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
        console.error("[Bookmark] Failed to save bookmarks:", error);
    }
}

/**
 * Create or update a bookmark
 * If bookmark with same ID exists, update it
 * Otherwise, create a new bookmark
 * Always moves the updated/created bookmark to the top (by updating timestamp)
 */
export function saveBookmark(bookmark: ConversationBookmark): void {
    const bookmarks = getBookmarks();
    const existingIndex = bookmarks.findIndex(b => b.id === bookmark.id);

    // Update timestamp to move to top
    const updatedBookmark = {
        ...bookmark,
        updatedAt: Date.now(),
    };

    if (existingIndex !== -1) {
        // Update existing bookmark
        bookmarks[existingIndex] = updatedBookmark;
    } else {
        // Add new bookmark
        bookmarks.unshift(updatedBookmark);
    }

    saveBookmarks(bookmarks);
    console.log("[Bookmark] Saved bookmark:", bookmark.id, bookmark.title);
}

/**
 * Delete a bookmark by ID
 */
export function deleteBookmark(id: string): void {
    const bookmarks = getBookmarks();
    const filtered = bookmarks.filter(b => b.id !== id);
    saveBookmarks(filtered);
    console.log("[Bookmark] Deleted bookmark:", id);
}

/**
 * Create a new bookmark from current conversation state
 */
export function createBookmark(params: {
    agentId: string;
    agentName: string;
    sessionId: string;
    userId: string;
    messages: ChatMessage[];
    diagramXml: string;
}): ConversationBookmark {
    const now = Date.now();

    // Generate title from first user message
    const firstUserMessage = params.messages.find(m => m.role === "user");
    const title = firstUserMessage
        ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
        : "New Conversation";

    return {
        id: generateBookmarkId(),
        title,
        agentId: params.agentId,
        agentName: params.agentName,
        sessionId: params.sessionId,
        userId: params.userId,
        messages: params.messages,
        diagramXml: params.diagramXml,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Update an existing bookmark with new data
 */
export function updateBookmarkData(
    bookmarkId: string,
    updates: {
        messages?: ChatMessage[];
        diagramXml?: string;
    }
): ConversationBookmark | null {
    const bookmark = getBookmarkById(bookmarkId);
    if (!bookmark) return null;

    const updatedBookmark: ConversationBookmark = {
        ...bookmark,
        ...(updates.messages && {messages: updates.messages}),
        ...(updates.diagramXml && {diagramXml: updates.diagramXml}),
        updatedAt: Date.now(),
    };

    // Update title if messages changed and we have a new first user message
    if (updates.messages) {
        const firstUserMessage = updates.messages.find(m => m.role === "user");
        if (firstUserMessage) {
            updatedBookmark.title = firstUserMessage.content.substring(0, 50) +
                (firstUserMessage.content.length > 50 ? "..." : "");
        }
    }

    saveBookmark(updatedBookmark);
    return updatedBookmark;
}
