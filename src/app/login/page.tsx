"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {saveLoginPayload} from "@/utils/cookie";

export default function LoginPage() {
    const [userId, setUserId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const trimmedUserId = userId.trim();
        if (!trimmedUserId) {
            setError("Please enter a user ID");
            return;
        }

        setIsLoading(true);

        try {
            // Save login info to cookie
            saveLoginPayload(trimmedUserId);

            // Redirect to main page
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            {/* Background gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute top-[10%] left-[15%] w-[600px] h-[400px] bg-violet-500/10 rounded-full blur-[120px]"/>
                <div
                    className="absolute bottom-[20%] right-[10%] w-[500px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px]"/>
                <div
                    className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-emerald-500/5 rounded-full blur-[150px]"/>
            </div>

            {/* Login Card */}
            <div className="relative w-full max-w-md">
                <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="flex items-center justify-center gap-3 mb-8">
                        <div
                            className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Diagram Studio</h1>
                            <p className="text-xs text-gray-500">AI Agent Scaffold</p>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-2">Welcome Back</h2>
                        <p className="text-gray-400 text-sm">Enter your user ID to continue</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="userId" className="block text-sm font-medium text-gray-300 mb-2">
                                User ID
                            </label>
                            <input
                                id="userId"
                                type="text"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                placeholder="Enter your user ID"
                                autoComplete="username"
                                className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#252525] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                            />
                        </div>

                        {error && (
                            <div
                                className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-500 hover:to-indigo-500 disabled:from-[#252525] disabled:to-[#252525] disabled:text-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-500/25 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                                strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor"
                                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-[#1f1f1f]">
                        <p className="text-center text-xs text-gray-500">
                            Powered by AI Agent Scaffold
                        </p>
                    </div>
                </div>

                {/* Features */}
                <div className="mt-8 grid grid-cols-3 gap-4">
                    <div className="bg-[#111111]/50 border border-[#1f1f1f] rounded-xl p-4 text-center">
                        <div
                            className="w-10 h-10 mx-auto mb-2 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                        </div>
                        <p className="text-xs text-gray-400">AI Assistant</p>
                    </div>
                    <div className="bg-[#111111]/50 border border-[#1f1f1f] rounded-xl p-4 text-center">
                        <div
                            className="w-10 h-10 mx-auto mb-2 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
                            </svg>
                        </div>
                        <p className="text-xs text-gray-400">Draw.io Editor</p>
                    </div>
                    <div className="bg-[#111111]/50 border border-[#1f1f1f] rounded-xl p-4 text-center">
                        <div
                            className="w-10 h-10 mx-auto mb-2 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                        </div>
                        <p className="text-xs text-gray-400">Smart Chat</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
