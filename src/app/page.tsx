"use client";

import {DrawIoEmbed, DrawIoEmbedRef} from "react-drawio";
import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {chat, createSession, isBackendUnavailableError, queryAgentConfigList} from "@/api/agent";
import {clearLogin, formatTime, getCurrentUserId, getLoginPayload} from "@/utils/cookie";
import {AgentResponse, AiAgentConfig, ChatMessage, ConversationBookmark} from "@/types/api";
import {API_BASE_URL} from "@/config/api-config";
import {createBookmark, deleteBookmark, getBookmarkById, getBookmarks, saveBookmark} from "@/utils/bookmark";

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
  const drawioReadyRef = useRef(false);
  const pendingXmlRef = useRef<string | null>(null);

  // Bookmark state
  const [bookmarks, setBookmarks] = useState<ConversationBookmark[]>([]);
  const [currentBookmarkId, setCurrentBookmarkId] = useState<string | null>(null);
  const [bookmarkSidebarOpen, setBookmarkSidebarOpen] = useState(true);

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

  // Load bookmarks on mount
  useEffect(() => {
    if (userId) {
      const loadedBookmarks = getBookmarks().filter(b => b.userId === userId);
      setBookmarks(loadedBookmarks);
    }
  }, [userId]);

  // Reload bookmarks from localStorage
  const reloadBookmarks = useCallback(() => {
    if (userId) {
      const loadedBookmarks = getBookmarks().filter(b => b.userId === userId);
      setBookmarks(loadedBookmarks);
    }
  }, [userId]);

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

  // Start a new conversation (clear current state)
  const handleNewConversation = () => {
    setMessages([]);
    setDiagramXml("");
    setSessionId("");
    setCurrentBookmarkId(null);
    setInputValue("");
    setStatus(null);
    // Clear draw.io canvas
    if (drawioReadyRef.current && drawioRef.current) {
      drawioRef.current.load({xml: ""});
    }
  };

  // Switch to a bookmark
  const handleSelectBookmark = (bookmark: ConversationBookmark) => {
    setCurrentBookmarkId(bookmark.id);
    setMessages(bookmark.messages);
    setDiagramXml(bookmark.diagramXml);
    setSessionId(bookmark.sessionId);
    setSelectedAgentId(bookmark.agentId);

    // Load diagram XML into draw.io
    if (bookmark.diagramXml && drawioReadyRef.current && drawioRef.current) {
      drawioRef.current.load({xml: bookmark.diagramXml});
    } else if (bookmark.diagramXml) {
      pendingXmlRef.current = bookmark.diagramXml;
    }

    setStatus({text: `Loaded conversation: ${bookmark.title}`, type: "info"});
  };

  // Delete a bookmark
  const handleDeleteBookmark = (bookmarkId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the bookmark selection
    deleteBookmark(bookmarkId);
    reloadBookmarks();

    // If we're deleting the current bookmark, clear the state
    if (currentBookmarkId === bookmarkId) {
      handleNewConversation();
    }

    setStatus({text: "Conversation deleted", type: "info"});
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

      // Parse response from agent
      // Expected JSON format: { type: "user" | "drawio", content: "..." }
      // Fallback: raw XML (treat as drawio) or plain text
      let parsed: AgentResponse | null = null;
      let isRawXml = false;

      // Check if response is raw XML (starts with <mxfile or <mxGraphModel)
      const trimmedResponse = response.trim();
      if (trimmedResponse.startsWith("<mxfile") || trimmedResponse.startsWith("<mxGraphModel")) {
        isRawXml = true;
        console.log("[Chat] Detected raw XML response");
      } else {
        // Try to parse as JSON
        try {
          parsed = JSON.parse(response) as AgentResponse;
          console.log("[Chat] Parsed JSON:", parsed);
        } catch (e) {
          console.log("[Chat] Not JSON, treating as plain text");
        }
      }

      if (isRawXml || parsed?.type === "drawio") {
        // Render XML in DrawIo panel
        // Extract mxGraphModel from mxfile wrapper if present
        let xml = isRawXml ? response : parsed!.content;
        const mxGraphModelMatch = xml.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
        if (mxGraphModelMatch) {
          xml = mxGraphModelMatch[0];
        }
        console.log("[Chat] Loading XML into DrawIo, length:", xml.length);
        setDiagramXml(xml);
        if (drawioReadyRef.current && drawioRef.current) {
          console.log("[Chat] DrawIo ready, loading XML now");
          drawioRef.current.load({xml});
        } else {
          console.log("[Chat] DrawIo not ready, storing XML for later");
          pendingXmlRef.current = xml;
        }
        const agentMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: isRawXml ? response : parsed!.content,
          timestamp: new Date(),
          agentId: selectedAgentId,
          sessionId: currentSessionId,
          type: "drawio",
        };

        // Update messages and save to bookmark
        setMessages(prev => {
          const newMessages = [...prev, agentMessage];

          // Save to bookmark after draw.io render success
          const selectedAgent = agents.find(a => a.agentId === selectedAgentId);
          if (selectedAgent && userId) {
            if (currentBookmarkId) {
              // Update existing bookmark
              const existingBookmark = getBookmarkById(currentBookmarkId);
              if (existingBookmark) {
                const updatedBookmark: ConversationBookmark = {
                  ...existingBookmark,
                  messages: newMessages,
                  diagramXml: xml,
                  updatedAt: Date.now(),
                };
                const firstUserMessage = newMessages.find((m: ChatMessage) => m.role === "user");
                if (firstUserMessage) {
                  updatedBookmark.title = firstUserMessage.content.substring(0, 50) +
                      (firstUserMessage.content.length > 50 ? "..." : "");
                }
                saveBookmark(updatedBookmark);
                console.log("[Bookmark] Updated bookmark:", currentBookmarkId);
              }
            } else {
              // Create new bookmark
              const newBookmark = createBookmark({
                agentId: selectedAgentId,
                agentName: selectedAgent.agentName,
                sessionId: currentSessionId,
                userId: userId,
                messages: newMessages,
                diagramXml: xml,
              });
              saveBookmark(newBookmark);
              setCurrentBookmarkId(newBookmark.id);
              console.log("[Bookmark] Created new bookmark:", newBookmark.id, newBookmark.title);
            }
            // Reload bookmarks list
            const loadedBookmarks = getBookmarks().filter(b => b.userId === userId);
            setBookmarks(loadedBookmarks);
          }

          return newMessages;
        });
      } else if (parsed?.type === "user") {
        // AI is asking the user to supply more information
        const agentMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: parsed.content,
          timestamp: new Date(),
          agentId: selectedAgentId,
          sessionId: currentSessionId,
          type: "user",
        };
        setMessages(prev => [...prev, agentMessage]);
      } else {
        // Fallback: plain-text response
        const agentMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: response,
          timestamp: new Date(),
          agentId: selectedAgentId,
          sessionId: currentSessionId,
        };
        setMessages(prev => [...prev, agentMessage]);
      }
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
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Preset prompts shown when the chat is empty
  const presetPrompts = [
    {
      label: "H5 Login Flow",
      detail: "请帮我绘制一个 H5 端用户登录流程图，包含：输入账号密码、表单校验、调用登录接口、token 存储、跳转首页，以及异常处理（账号不存在、密码错误、网络超时）。"
    },
    {
      label: "E-commerce Shopping",
      detail: "请帮我绘制一个电商购物流程图，包含：商品浏览、加入购物车、确认订单、选择支付方式、支付成功/失败、订单状态更新、物流跟踪。"
    },
    {
      label: "Microservices Arch",
      detail: "请帮我绘制一个微服务架构图，包含：API 网关、用户服务、商品服务、订单服务、支付服务，以及各服务之间的调用关系和 MQ 消息队列。"
    },
    {
      label: "CI/CD Pipeline",
      detail: "请帮我绘制一个 CI/CD 流水线流程图，包含：代码提交、触发构建、单元测试、代码扫描、Docker 镜像构建、推送镜像仓库、部署到测试环境、手动审批、部署到生产环境。"
    },
  ];

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

            {/* Bookmark Sidebar Toggle */}
            <button
                onClick={() => setBookmarkSidebarOpen(!bookmarkSidebarOpen)}
                className={`p-2.5 rounded-lg transition-all duration-200 ${
                    bookmarkSidebarOpen
                        ? "bg-violet-600/20 text-violet-400 hover:bg-violet-600/30"
                        : "bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-white"
                }`}
                title={bookmarkSidebarOpen ? "Hide Conversations" : "Show Conversations"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
              </svg>
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

        <main className="flex-1 flex overflow-hidden relative">
          {/* Bookmark Sidebar */}
          <div
              className={`flex flex-col bg-[#111111] border-r border-[#1f1f1f] transition-all duration-300 ease-in-out ${
                  bookmarkSidebarOpen ? "w-[280px]" : "w-0"
              } overflow-hidden`}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f] bg-[#0d0d0d]">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                </svg>
                <h2 className="text-sm font-semibold text-white">Conversations</h2>
              </div>
              <button
                  onClick={() => setBookmarkSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1a1a] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
                </svg>
              </button>
            </div>

            {/* New Conversation Button */}
            <div className="p-3 border-b border-[#1f1f1f]">
              <button
                  onClick={handleNewConversation}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                New Conversation
              </button>
            </div>

            {/* Bookmark List */}
            <div
                className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
              {bookmarks.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8 px-4">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor"
                         viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <p>No saved conversations</p>
                    <p className="mt-1 text-xs">Start chatting to save your first conversation</p>
                  </div>
              ) : (
                  bookmarks.map((bookmark) => (
                      <div
                          key={bookmark.id}
                          onClick={() => handleSelectBookmark(bookmark)}
                          className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-150 ${
                              currentBookmarkId === bookmark.id
                                  ? "bg-violet-600/20 border border-violet-500/40"
                                  : "bg-[#1a1a1a] border border-[#252525] hover:bg-[#222222] hover:border-[#333333]"
                          }`}
                      >
                        {/* Bookmark Title */}
                        <div className="flex items-start gap-2 pr-6">
                          <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              currentBookmarkId === bookmark.id ? "text-violet-400" : "text-gray-500"
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${
                                currentBookmarkId === bookmark.id ? "text-white" : "text-gray-300"
                            }`}>
                              {bookmark.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">{bookmark.agentName}</span>
                              <span className="text-[10px] text-gray-600">
                                {new Date(bookmark.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                            onClick={(e) => handleDeleteBookmark(bookmark.id, e)}
                            className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                            title="Delete conversation"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                  ))
              )}
            </div>
          </div>

          {/* Sidebar Toggle (when closed) */}
          {!bookmarkSidebarOpen && (
              <button
                  onClick={() => setBookmarkSidebarOpen(true)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-[#111111] border border-[#1f1f1f] rounded-r-lg text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors shadow-lg"
                  title="Show Conversations"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                </svg>
              </button>
          )}

          {/* DrawIo Editor Area */}
          <div className="flex-1 min-h-0 bg-[#0d0d0d]">
            <DrawIoEmbed
                ref={drawioRef}
                urlParameters={{
                  ui: "dark",
                  spin: true,
                  libraries: true,
                  saveAndExit: false,
                }}
                onLoad={() => {
                  console.log("[DrawIo] Ready");
                  drawioReadyRef.current = true;
                  // Load any pending XML that arrived before DrawIo was ready
                  if (pendingXmlRef.current && drawioRef.current) {
                    console.log("[DrawIo] Loading pending XML");
                    drawioRef.current.load({xml: pendingXmlRef.current});
                    pendingXmlRef.current = null;
                  }
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
                        {message.type === "drawio" ? (
                            <span className="flex items-center gap-2 text-emerald-400">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor"
                                   viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
                              </svg>
                              Diagram rendered in the editor
                            </span>
                        ) : (
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        )}
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
              {/* Preset Prompt Chips — shown only when no messages yet */}
              {messages.length === 0 && selectedAgentId && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {presetPrompts.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => setInputValue(p.detail)}
                            className="px-2.5 py-1 text-xs rounded-lg bg-[#1a1a1a] border border-[#252525] text-gray-400 hover:text-violet-300 hover:border-violet-500/40 hover:bg-violet-500/10 transition-all duration-150 text-left"
                        >
                          {p.label}
                        </button>
                    ))}
                  </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedAgentId ? "Type a message..." : "Select an agent first..."}
                    disabled={!selectedAgentId || isSending}
                    rows={3}
                    className="w-full px-4 py-3 text-sm bg-[#1a1a1a] border border-[#252525] rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                    style={{minHeight: "80px", maxHeight: "200px"}}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = Math.min(target.scrollHeight, 200) + "px";
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
                Press <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-gray-500">Ctrl + Enter</kbd> to send
                · <kbd
                  className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-gray-500">Enter</kbd> for new line
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
