"use client";

import {DrawIoEmbed, DrawIoEmbedRef} from "react-drawio";
import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {chat, createSession, isBackendUnavailableError, queryAgentConfigList} from "@/api/agent";
import {clearLogin, formatTime, getCurrentUserId, getLoginPayload} from "@/utils/cookie";
import {AiAgentConfig, ChatMessage} from "@/types/api";
import {API_BASE_URL} from "@/config/api-config";

export default function DiagramStudioPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loginTime, setLoginTime] = useState<string>("");

  // Agent state
  const [agents, setAgents] = useState<AiAgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  // Chat state
  const [chatOpen, setChatOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<{ text: string; type: "info" | "error" } | null>(null);

  // DrawIo state
  const [imgData, setImgData] = useState<string | null>(null);
  const [diagramXml, setDiagramXml] = useState<string>("");
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check login status on mount
  useEffect(() => {
    setIsClient(true);
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      router.replace("/login");
      return;
    }
    setUserId(currentUserId);

    const payload = getLoginPayload();
    if (payload?.ts) {
      setLoginTime(formatTime(payload.ts));
    }
  }, [router]);

  // Load agents on mount
  const loadAgents = useCallback(async () => {
    setIsLoadingAgents(true);
    setStatus({text: "Loading agents...", type: "info"});

    try {
      const agentList = await queryAgentConfigList();
      setAgents(agentList);

      // Restore last selected agent
      const lastAgentId = localStorage.getItem("ai_agent_last_agent") || "";
      if (lastAgentId && agentList.some(a => a.agentId === lastAgentId)) {
        setSelectedAgentId(lastAgentId);
      }

      setStatus({text: "Agents loaded successfully", type: "info"});
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setStatus({text: `Failed to load agents: ${error.message}`, type: "error"});

      if (isBackendUnavailableError(error)) {
        setStatus({text: `Backend unavailable. Please check API: ${API_BASE_URL}`, type: "error"});
      }
    } finally {
      setIsLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadAgents();
    }
  }, [userId, loadAgents]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages, isTyping]);

  // Handle agent selection
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    if (agentId) {
      localStorage.setItem("ai_agent_last_agent", agentId);
    }
    // Reset session when agent changes
    setSessionId("");
  };

  // Handle logout
  const handleLogout = () => {
    clearLogin();
    router.replace("/login");
  };

  // Handle export
  const handleExport = () => {
    if (drawioRef.current) {
      drawioRef.current.exportDiagram({
        format: "xmlsvg",
      });
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    if (!selectedAgentId) {
      setStatus({text: "Please select an agent first", type: "error"});
      return;
    }

    if (!userId) {
      setStatus({text: "Please login first", type: "error"});
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);
    setIsTyping(true);
    setStatus(null);

    try {
      // Create session if not exists
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createSession({
          agentId: selectedAgentId,
          userId: userId,
        });
        setSessionId(currentSessionId);
      }

      // Send chat message
      const response = await chat({
        agentId: selectedAgentId,
        userId: userId,
        sessionId: currentSessionId,
        message: userMessage.content,
      });

      // Check if response contains XML diagram
      const xmlMatch = response.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
      if (xmlMatch) {
        setDiagramXml(xmlMatch[0]);
        // Load diagram into DrawIo
        if (drawioRef.current) {
          drawioRef.current.load({xml: xmlMatch[0]});
        }
      }

      const agentMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: response,
        timestamp: new Date(),
        agentId: selectedAgentId,
        sessionId: currentSessionId,
      };

      setMessages(prev => [...prev, agentMessage]);
      setStatus({text: "Message sent successfully", type: "info"});
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      setStatus({text: `Error: ${error.message}`, type: "error"});

      if (isBackendUnavailableError(error)) {
        setStatus({text: `Backend unavailable. Check API: ${API_BASE_URL}`, type: "error"});
      }
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get selected agent name
  const selectedAgent = agents.find(a => a.agentId === selectedAgentId);

  // Don't render until we check login status
  if (!isClient || !userId) {
    return (
        <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"/>
        </div>
    );
  }

  return (
      <div className="flex flex-col h-screen w-full bg-[#0a0a0a]">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3 bg-[#111111] border-b border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">Diagram Studio</h1>
              <p className="text-[10px] text-gray-500">API: {API_BASE_URL}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Agent Selector */}
            <select
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(e.target.value)}
                disabled={isLoadingAgents}
                className="px-3 py-2 text-sm bg-[#1a1a1a] border border-[#252525] rounded-lg text-white focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
            >
              <option value="">{isLoadingAgents ? "Loading..." : "Select Agent"}</option>
              {agents.map(agent => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.agentName} - {agent.agentDesc}
                  </option>
              ))}
            </select>

            {/* User Info */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#252525] rounded-lg">
              <span className="text-sm font-medium text-white">{userId}</span>
              <span className="text-xs text-gray-500">{loginTime ? `Logged in ${loginTime}` : ""}</span>
            </div>

            {/* Export Button */}
            <button
                onClick={handleExport}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
            >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              Export
            </span>
            </button>

            {/* Chat Toggle */}
            <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`p-2.5 rounded-lg transition-all duration-200 ${
                    chatOpen
                        ? "bg-violet-600/20 text-violet-400 hover:bg-violet-600/30"
                        : "bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-white"
                }`}
                title={chatOpen ? "Hide Chat" : "Show Chat"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </button>

            {/* Logout */}
            <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {/* DrawIo Editor Area */}
          <div className="flex-1 min-h-0 bg-[#0d0d0d]">
            <DrawIoEmbed
                ref={drawioRef}
                xml={diagramXml || undefined}
                urlParameters={{
                  ui: "dark",
                  spin: true,
                  libraries: true,
                  saveAndExit: false,
                }}
                onExport={(data) => setImgData(data.data)}
            />
          </div>

          {/* Chat Panel */}
          <div
              className={`flex flex-col bg-[#111111] border-l border-[#1f1f1f] transition-all duration-300 ease-in-out ${
                  chatOpen ? "w-[400px]" : "w-0"
              } overflow-hidden`}
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f] bg-[#0d0d0d]">
              <div className="flex items-center gap-2.5">
                <div
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {selectedAgent?.agentName || "AI Assistant"}
                  </h2>
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : "Ready"}
                </span>
                </div>
              </div>
              <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            {/* Status Bar */}
            {status && (
                <div
                    className={`px-4 py-2 text-xs ${status.type === "error" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                  {status.text}
                </div>
            )}

            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
              {messages.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">
                    <p>Select an agent and start chatting.</p>
                    <p className="mt-2 text-xs">AI responses with diagrams will be rendered in the editor.</p>
                  </div>
              )}

              {messages.map((message) => (
                  <div
                      key={message.id}
                      className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                            message.role === "user"
                                ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
                                : "bg-gradient-to-br from-emerald-400 to-cyan-500 text-white"
                        }`}
                    >
                      {message.role === "user" ? "U" : "AI"}
                    </div>
                    {/* Message Bubble */}
                    <div className={`group max-w-[85%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              message.role === "user"
                                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-md"
                                  : "bg-[#1a1a1a] text-gray-200 rounded-bl-md border border-[#252525]"
                          }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                      <div
                          className={`flex gap-2 text-[10px] mt-1 px-1 text-gray-500 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <span>
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                        {message.sessionId && (
                            <span className="text-gray-600">#{message.sessionId.slice(0, 6)}</span>
                        )}
                      </div>
                    </div>
                  </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                  <div className="flex gap-2.5">
                    <div
                        className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-xs font-medium text-white">
                      AI
                    </div>
                    <div className="bg-[#1a1a1a] border border-[#252525] rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span
                            className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span
                            className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[#1f1f1f] bg-[#0d0d0d]">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedAgentId ? "Type a message..." : "Select an agent first..."}
                    disabled={!selectedAgentId || isSending}
                    rows={1}
                    className="w-full px-4 py-3 text-sm bg-[#1a1a1a] border border-[#252525] rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                    style={{minHeight: "44px", maxHeight: "120px"}}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = Math.min(target.scrollHeight, 120) + "px";
                    }}
                />
                </div>
                <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || !selectedAgentId || isSending}
                    className="p-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-500 hover:to-indigo-500 disabled:from-[#252525] disabled:to-[#252525] disabled:text-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-500/20 disabled:shadow-none"
                >
                  {isSending ? (
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                  ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-2 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-gray-500">Enter</kbd> to send · <kbd
                  className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-gray-500">Shift + Enter</kbd> for new line
              </p>
            </div>
        </div>
      </main>

        {/* Exported Image Preview Modal */}
        {imgData && (
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setImgData(null)}
            >
              <div
                  className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5 max-w-3xl max-h-[85vh] overflow-auto shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Export Preview
                  </h2>
                  <button
                      onClick={() => setImgData(null)}
                      className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1a1a] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f]">
                  <img
                      src={imgData}
                      alt="Exported diagram"
                      className="max-w-full h-auto rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                      onClick={() => setImgData(null)}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <a
                      href={imgData}
                      download="diagram.svg"
                      className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all"
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
        )}
    </div>
  );
}
