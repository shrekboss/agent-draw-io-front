# Chat Interface

<cite>
**Referenced Files in This Document**
- [page.tsx](file://src/app/page.tsx)
- [agent.ts](file://src/api/agent.ts)
- [api.ts](file://src/types/api.ts)
- [api-config.ts](file://src/config/api-config.ts)
- [cookie.ts](file://src/utils/cookie.ts)
- [layout.tsx](file://src/app/layout.tsx)
- [login/page.tsx](file://src/app/login/page.tsx)
</cite>

## Update Summary

**Changes Made**

- Updated keyboard shortcuts section to document new Ctrl+Enter submission functionality
- Enhanced preset prompt system documentation with four new examples
- Added documentation for dynamic input height feature
- Updated dual-mode interaction system description
- Revised input handling section with new dynamic height capabilities

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction

This document describes the Chat Interface component responsible for real-time-like messaging, message history
management, AI agent integration, and diagram rendering. It covers UI components, input handling, keyboard shortcuts,
preset prompts, message classification, typing indicators, error handling, and how chat context influences diagram
creation. Accessibility and responsive design considerations are included, along with performance guidance for long
conversations.

## Project Structure

The Chat Interface is implemented in a single page that orchestrates agent selection, session lifecycle, message
exchange, and diagram rendering via an embedded editor.

```mermaid
graph TB
subgraph "UI Layer"
Page["DiagramStudioPage<br/>src/app/page.tsx"]
ChatPanel["Chat Panel<br/>messages, input, typing indicator"]
DrawIo["DrawIo Embed<br/>XML renderer"]
end
subgraph "API Layer"
AgentAPI["Agent API Service<br/>src/api/agent.ts"]
Types["API Types<br/>src/types/api.ts"]
Config["API Config<br/>src/config/api-config.ts"]
end
subgraph "Auth & Utils"
Cookie["Cookie Utils<br/>src/utils/cookie.ts"]
Login["Login Page<br/>src/app/login/page.tsx"]
Layout["Root Layout<br/>src/app/layout.tsx"]
end
Page --> ChatPanel
Page --> DrawIo
Page --> AgentAPI
AgentAPI --> Types
AgentAPI --> Config
Page --> Cookie
Login --> Cookie
Layout --> Page
```

**Diagram sources**

- [page.tsx:11-648](file://src/app/page.tsx#L11-L648)
- [agent.ts:1-191](file://src/api/agent.ts#L1-L191)
- [api.ts:1-74](file://src/types/api.ts#L1-L74)
- [api-config.ts:1-28](file://src/config/api-config.ts#L1-L28)
- [cookie.ts:1-111](file://src/utils/cookie.ts#L1-L111)
- [login/page.tsx:1-173](file://src/app/login/page.tsx#L1-L173)
- [layout.tsx:1-34](file://src/app/layout.tsx#L1-L34)

**Section sources**

- [page.tsx:11-648](file://src/app/page.tsx#L11-L648)
- [layout.tsx:20-33](file://src/app/layout.tsx#L20-L33)

## Core Components
- Chat state management: messages, input, sending state, typing state, status, and session ID.
- Agent selection and session lifecycle: agents list, last selected agent persistence, session creation.
- Real-time-like message processing: non-streaming chat with JSON-parsed agent responses supporting diagram rendering.
- UI elements: message bubbles, typing indicators, status bar, preset prompts, input area with dynamic height, and
  keyboard shortcuts.
- Integration with Draw.io editor: loading XML into the embedded editor and exporting rendered diagrams.

Key implementation references:
- State initialization and effects: [page.tsx:23-90](file://src/app/page.tsx#L23-L90)
- Agent selection and session reset: [page.tsx:92-100](file://src/app/page.tsx#L92-L100)
- Message sending and response parsing: [page.tsx:118-258](file://src/app/page.tsx#L118-L258)
- Typing indicator and
  auto-scroll: [page.tsx:88-90](file://src/app/page.tsx#L88-L90), [page.tsx:529](file://src/app/page.tsx#L529)
- Preset prompts and input
  handling: [page.tsx:267-285](file://src/app/page.tsx#L267-L285), [page.tsx:532-589](file://src/app/page.tsx#L532-L589)
- Draw.io
  integration: [page.tsx:382-401](file://src/app/page.tsx#L382-L401), [page.tsx:195-202](file://src/app/page.tsx#L195-L202)

**Section sources**

- [page.tsx:23-258](file://src/app/page.tsx#L23-L258)
- [page.tsx:404-589](file://src/app/page.tsx#L404-L589)

## Architecture Overview
The Chat Interface follows a unidirectional data flow:
- UI collects user input and triggers actions.
- Actions call the Agent API service to create sessions and send messages.
- Responses are parsed; if the agent returns a diagram, the XML is loaded into the Draw.io editor.
- Messages are appended to the local state, updating the UI and optionally triggering auto-scroll.

```mermaid
sequenceDiagram
participant U as "User"
participant P as "DiagramStudioPage<br/>page.tsx"
participant A as "Agent API<br/>agent.ts"
participant S as "Backend API"
participant D as "DrawIo Embed"
U->>P : Type message + press Ctrl/Cmd+Enter
P->>P : Validate input, set sending/typing state
P->>A : createSession() if missing
A->>S : POST /api/v1/create_session
S-->>A : { sessionId }
A-->>P : sessionId
P->>A : chat() with {agentId, userId, sessionId, message}
A->>S : POST /api/v1/chat
S-->>A : "JSON stringified AgentResponse or plain text"
A-->>P : response string
P->>P : Parse JSON -> AgentResponse
alt type == "drawio"
P->>D : load({xml})
P->>P : Append agent message with type "drawio"
else type == "user"
P->>P : Append agent message with type "user"
else
P->>P : Append agent message (plain text)
end
P->>P : Clear typing state, update status
```

**Diagram sources**

- [page.tsx:118-258](file://src/app/page.tsx#L118-L258)
- [agent.ts:87-113](file://src/api/agent.ts#L87-L113)
- [api-config.ts:10-22](file://src/config/api-config.ts#L10-L22)

**Section sources**

- [page.tsx:118-258](file://src/app/page.tsx#L118-L258)
- [agent.ts:87-113](file://src/api/agent.ts#L87-L113)
- [api-config.ts:10-22](file://src/config/api-config.ts#L10-L22)

## Detailed Component Analysis

### Message Classification and Rendering
- Classification: messages carry a role field ("user" or "agent") and optional type field mirroring AgentResponse.type.
- Rendering: user messages appear on the right with distinct styling; agent messages appear on the left with a subtle
  border and dark background. Special rendering for diagram messages displays an icon and label.
- Timestamps and session IDs: timestamps are formatted per message; session IDs are shown when present.

References:
- Role and type fields: [api.ts:59-68](file://src/types/api.ts#L59-L68)
- Rendering logic: [page.tsx:458-509](file://src/app/page.tsx#L458-L509)
- Timestamp/session ID display: [page.tsx:496-506](file://src/app/page.tsx#L496-L506)

```mermaid
flowchart TD
Start(["Render Message"]) --> CheckRole{"role == 'user'?"}
CheckRole --> |Yes| UserBubble["Render user bubble<br/>right-aligned"]
CheckRole --> |No| AgentBubble["Render agent bubble<br/>left-aligned"]
AgentBubble --> CheckType{"type == 'drawio'?"}
CheckType --> |Yes| DrawioIcon["Show diagram icon + label"]
CheckType --> |No| PlainText["Show plain text content"]
UserBubble --> End(["Done"])
DrawioIcon --> End
PlainText --> End
```

**Diagram sources**

- [page.tsx:458-509](file://src/app/page.tsx#L458-L509)
- [api.ts:47-50](file://src/types/api.ts#L47-L50)

**Section sources**
- [api.ts:47-68](file://src/types/api.ts#L47-L68)
- [page.tsx:458-509](file://src/app/page.tsx#L458-L509)

### Message History Management

- Storage: messages array holds ChatMessage entries with id, role, content, timestamp, and optional
  agentId/sessionId/type.
- Auto-scroll: effect scrolls to bottom when messages or typing state changes.
- Empty state: shows guidance when no messages exist.

References:
- State and effect: [page.tsx:27-90](file://src/app/page.tsx#L27-L90)
- Message list rendering: [page.tsx:448-509](file://src/app/page.tsx#L448-L509)

**Section sources**
- [page.tsx:27-90](file://src/app/page.tsx#L27-L90)
- [page.tsx:448-509](file://src/app/page.tsx#L448-L509)

### Status Indicators and Error Handling
- Status bar: displays info/error messages with appropriate styling.
- Error propagation: caught errors are converted to ChatMessage entries and status updates; backend-unavailable
  detection augments status messages.
- Finalization: sending and typing states are cleared in finally blocks.

References:

- Status display: [page.tsx:441-446](file://src/app/page.tsx#L441-L446)
- Error handling block: [page.tsx:238-258](file://src/app/page.tsx#L238-L258)
- Backend availability detection: [agent.ts:181-190](file://src/api/agent.ts#L181-L190)

**Section sources**

- [page.tsx:238-258](file://src/app/page.tsx#L238-L258)
- [agent.ts:181-190](file://src/api/agent.ts#L181-L190)

### Input Handling and Keyboard Shortcuts

- Multi-line textarea with dynamic height adjustment that automatically resizes based on content.
- Dual-mode keyboard interaction: Ctrl/Cmd+Enter sends the message immediately; Enter alone creates a new line.
- Disable states: input disabled when no agent selected or during send; send button disabled when input is empty or
  agent is missing.

**Updated** Enhanced with dynamic height calculation and dual-mode keyboard interaction system.

References:

- Input element and handler: [page.tsx:550-563](file://src/app/page.tsx#L550-L563)
- Dynamic height calculation: [page.tsx:559-563](file://src/app/page.tsx#L559-L563)
- Dual-mode keyboard handler: [page.tsx:260-265](file://src/app/page.tsx#L260-L265)

**Section sources**

- [page.tsx:550-563](file://src/app/page.tsx#L550-L563)
- [page.tsx:559-563](file://src/app/page.tsx#L559-L563)
- [page.tsx:260-265](file://src/app/page.tsx#L260-L265)

### Preset Prompt Functionality

- Enhanced preset chips: shown only when the chat is empty and an agent is selected.
- Four comprehensive examples: H5 Login Flow, E-commerce Shopping, Microservices Architecture, and CI/CD Pipeline.
- Behavior: clicking a chip populates the input with the associated prompt.

**Updated** Expanded from basic preset prompts to four detailed examples covering different use cases.

References:

- Enhanced preset prompts definition: [page.tsx:267-285](file://src/app/page.tsx#L267-L285)
- Chip rendering and click handler: [page.tsx:535-546](file://src/app/page.tsx#L535-L546)

**Section sources**

- [page.tsx:267-285](file://src/app/page.tsx#L267-L285)
- [page.tsx:535-546](file://src/app/page.tsx#L535-L546)

### Typing Indicators
- Visual indicator: three bouncing dots inside an agent-styled bubble.
- Lifecycle: set when sending starts; cleared in finally after response processing.

References:

- Typing indicator rendering: [page.tsx:511-528](file://src/app/page.tsx#L511-L528)
- State
  transitions: [page.tsx:142-144](file://src/app/page.tsx#L142-L144), [page.tsx:254-257](file://src/app/page.tsx#L254-L257)

**Section sources**

- [page.tsx:511-528](file://src/app/page.tsx#L511-L528)
- [page.tsx:142-144](file://src/app/page.tsx#L142-L144)
- [page.tsx:254-257](file://src/app/page.tsx#L254-L257)

### Integration with AI Agent System
- Agent selection: dropdown loads agent configs and persists last selection.
- Session lifecycle: session created on first message if absent; session ID stored and reused.
- Non-streaming chat: response content is either parsed JSON (AgentResponse) or plain text fallback.

References:

- Agent loading and
  selection: [page.tsx:55-87](file://src/app/page.tsx#L55-L87), [page.tsx:94-102](file://src/app/page.tsx#L94-L102)
- Session creation: [page.tsx:146-155](file://src/app/page.tsx#L146-L155)
- Chat
  request/response: [agent.ts:106-113](file://src/api/agent.ts#L106-L113), [api.ts:31-42](file://src/types/api.ts#L31-L42)

**Section sources**

- [page.tsx:55-155](file://src/app/page.tsx#L55-L155)
- [agent.ts:106-113](file://src/api/agent.ts#L106-L113)
- [api.ts:31-42](file://src/types/api.ts#L31-L42)

### Message Queuing and Response Processing

- Queue model: messages are appended to the existing list; no explicit queue abstraction is used. The UI renders the
  latest message immediately upon arrival.
- Response processing: JSON parsing determines whether the agent requested a diagram or additional information;
  otherwise, a plain text message is appended.

References:

- Message append and status: [page.tsx:203-237](file://src/app/page.tsx#L203-L237)
- JSON parsing and branching: [page.tsx:165-184](file://src/app/page.tsx#L165-L184)

**Section sources**

- [page.tsx:165-237](file://src/app/page.tsx#L165-L237)

### Conversation Flow Management and Context Influence

- Session-scoped context: each conversation has a sessionId; agent responses include agentId and sessionId for
  traceability.
- Context preservation: messages carry agentId and sessionId to maintain continuity across exchanges.
- Diagram context: when a diagram is rendered, subsequent agent messages can reference the same session to keep the
  editor synchronized.

References:
- Session fields on messages: [api.ts:64-67](file://src/types/api.ts#L64-L67)
- Session usage in
  chat: [page.tsx:148-155](file://src/app/page.tsx#L148-L155), [page.tsx:208-211](file://src/app/page.tsx#L208-L211)

**Section sources**
- [api.ts:64-67](file://src/types/api.ts#L64-L67)
- [page.tsx:148-211](file://src/app/page.tsx#L148-L211)

### Accessibility and Responsive Design
- Accessibility:
    - Semantic labels and roles: buttons, selects, and inputs use appropriate attributes.
    - Focus styles: inputs and buttons apply focus outlines and ring styles.
    - Disabled states: controls reflect disabled state to screen readers.
- Responsive design:
    - Flexible layout: main area uses flexbox; chat panel width animates smoothly.
    - Scrollbars: custom scrollbar styles applied to message area.
    - Typography: fonts configured via root layout.

References:
- Layout and fonts: [layout.tsx:20-33](file://src/app/layout.tsx#L20-L33)
- Chat panel width animation: [page.tsx:406-408](file://src/app/page.tsx#L406-L408)
- Scrollbar customization: [page.tsx:449](file://src/app/page.tsx#L449)

**Section sources**
- [layout.tsx:20-33](file://src/app/layout.tsx#L20-L33)
- [page.tsx:406-408](file://src/app/page.tsx#L406-L408)
- [page.tsx:449](file://src/app/page.tsx#L449)

## Dependency Analysis
The Chat Interface depends on:
- Agent API service for network operations.
- API configuration for endpoint URLs and base URL.
- Types for request/response contracts.
- Cookie utilities for authentication state.
- Draw.io embed for diagram rendering.

```mermaid
graph LR
Page["page.tsx"] --> AgentAPI["agent.ts"]
Page --> Types["api.ts"]
AgentAPI --> Config["api-config.ts"]
Page --> Cookie["cookie.ts"]
Page --> DrawIo["DrawIoEmbed"]
Login["login/page.tsx"] --> Cookie
Layout["layout.tsx"] --> Page
```

**Diagram sources**
- [page.tsx:1-10](file://src/app/page.tsx#L1-L10)
- [agent.ts:1-16](file://src/api/agent.ts#L1-L16)
- [api-config.ts:1-28](file://src/config/api-config.ts#L1-L28)
- [api.ts:1-11](file://src/types/api.ts#L1-L11)
- [cookie.ts:1-11](file://src/utils/cookie.ts#L1-L11)
- [login/page.tsx:1-6](file://src/app/login/page.tsx#L1-L6)
- [layout.tsx:1-4](file://src/app/layout.tsx#L1-L4)

**Section sources**
- [page.tsx:1-10](file://src/app/page.tsx#L1-L10)
- [agent.ts:1-16](file://src/api/agent.ts#L1-L16)
- [api-config.ts:1-28](file://src/config/api-config.ts#L1-L28)
- [api.ts:1-11](file://src/types/api.ts#L1-L11)
- [cookie.ts:1-11](file://src/utils/cookie.ts#L1-L11)
- [login/page.tsx:1-6](file://src/app/login/page.tsx#L1-L6)
- [layout.tsx:1-4](file://src/app/layout.tsx#L1-L4)

## Performance Considerations
- Long conversation histories:
    - Current implementation appends all messages without pagination or virtualization. For very long histories,
      consider:
        - Virtualized lists for messages.
        - Pagination or message truncation with "show more" controls.
        - Immutable updates with stable keys to minimize re-renders.
- Rendering costs:
    - Diagram rendering occurs on demand when receiving a "drawio" message; avoid unnecessary reloads by checking XML
      equality before calling load.
- Network efficiency:
    - Non-streaming chat is simpler but slower for long responses. Consider adding streaming support to improve
      perceived latency.
- UI responsiveness:
    - Keep heavy computations off the render thread; memoize derived values like selected agent name.
    - Dynamic height calculation is optimized to prevent layout thrashing by using automatic height adjustment.
- Accessibility and UX:
    - Ensure smooth scrolling and fast input handling; avoid layout thrashing by batching DOM writes.

## Troubleshooting Guide
Common issues and resolutions:
- Backend unavailable:
    - Symptom: error status indicating backend unavailability.
    - Cause: network errors or CORS failures.
    - Resolution: verify API base URL and network connectivity; check console for fetch-related errors.
    -
    References: [agent.ts:181-190](file://src/api/agent.ts#L181-L190), [page.tsx:251-253](file://src/app/page.tsx#L251-L253)
- No agent selected:
    - Symptom: send button disabled; status indicates selecting an agent.
    - Resolution: choose an agent from the dropdown.
    -
    References: [page.tsx:123-131](file://src/app/page.tsx#L123-L131), [page.tsx:566-568](file://src/app/page.tsx#L566-L568)
- Login required:
    - Symptom: redirect to login page or status indicating login required.
    - Resolution: authenticate via login page; ensure cookie is set.
    -
    References: [page.tsx:39-52](file://src/app/page.tsx#L39-L52), [login/page.tsx:13-36](file://src/app/login/page.tsx#L13-L36), [cookie.ts:63-101](file://src/utils/cookie.ts#L63-L101)
- Diagram not rendering:
    - Symptom: agent responds with diagram but editor remains blank.
    - Resolution: confirm JSON parsing yields type "drawio"; ensure XML is valid; verify Draw.io embed is mounted.
    - References: [page.tsx:195-202](file://src/app/page.tsx#L195-L202), [api.ts:47-50](file://src/types/api.ts#L47-L50)
- Keyboard shortcut not working:
    - Symptom: Ctrl+Enter does not submit messages.
    - Resolution: ensure browser supports keyboard event modifiers; check that input field has focus.
    - References: [page.tsx:260-265](file://src/app/page.tsx#L260-L265)

**Section sources**
- [agent.ts:181-190](file://src/api/agent.ts#L181-L190)
- [page.tsx:123-131](file://src/app/page.tsx#L123-L131)
- [page.tsx:251-253](file://src/app/page.tsx#L251-L253)
- [page.tsx:39-52](file://src/app/page.tsx#L39-L52)
- [login/page.tsx:13-36](file://src/app/login/page.tsx#L13-L36)
- [cookie.ts:63-101](file://src/utils/cookie.ts#L63-L101)
- [page.tsx:195-202](file://src/app/page.tsx#L195-L202)
- [api.ts:47-50](file://src/types/api.ts#L47-L50)
- [page.tsx:260-265](file://src/app/page.tsx#L260-L265)

## Conclusion

The Chat Interface integrates agent selection, session management, non-streaming chat, and diagram rendering into a
cohesive UI. It uses clear message classification, status indicators, and typing cues to guide users. Recent
enhancements include a dual-mode keyboard interaction system with Ctrl+Enter submission, expanded preset prompt
examples, and dynamic input height handling. For production-scale usage, consider implementing message virtualization,
streaming responses, and robust error recovery to enhance performance and user experience.