'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    Mic, 
    MessageSquare, 
    Sparkles, 
    BarChart3, 
    Send, 
    BookOpen, 
    Clock, 
    FileText, 
    BookOpenCheck,
    ChevronDown,
    ChevronUp,
    PlayCircle,
    Calendar,
    ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { IBook, IBookSummary, Messages } from '@/types';
import VapiControls from './VapiControls';
import { chatWithBookAction, generateBookSummaryAction } from '@/lib/actions/ai.actions';
import { getBookAnalyticsAction } from '@/lib/actions/analytics.actions';
import Image from 'next/image';

interface ChatHistoryItem {
    role: 'user' | 'assistant';
    content: string;
    pageCitations?: number[];
    sources?: Array<{ content: string; pageNumber: number }>;
}

export default function BookWorkspace({ book: initialBook }: { book: IBook }) {
    const [book, setBook] = useState<IBook>(initialBook);
    const [activeTab, setActiveTab] = useState<'voice' | 'text' | 'insights'>('voice');
    
    // Text Chat States
    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([
        {
            role: 'assistant',
            content: `Hello! I am your EchoPages text companion for "${initialBook.title}". I have fully parsed this book into our intelligence database. Ask me any question, search for key concepts, or request deep explanations, and I will answer you while citing exact page numbers!`,
        }
    ]);
    const [inputQuery, setInputQuery] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [selectedSource, setSelectedSource] = useState<{ content: string; pageNumber: number } | null>(null);

    // Insights & Analytics States
    const [summary, setSummary] = useState<IBookSummary | null>(book.summary || null);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [analytics, setAnalytics] = useState<{
        totalSessions: number;
        totalDurationSeconds: number;
        sessions: Array<{
            _id: string;
            startedAt: string | Date;
            durationSeconds: number;
        }>;
    } | null>(null);
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
    const [openConceptIndex, setOpenConceptIndex] = useState<number | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, isChatLoading]);

    // Load Analytics & Summary when Insights tab is clicked
    useEffect(() => {
        if (activeTab === 'insights') {
            loadAnalytics();
            if (!summary) {
                autoGenerateSummary();
            }
        }
    }, [activeTab]);

    const loadAnalytics = async () => {
        setIsAnalyticsLoading(true);
        try {
            const res = await getBookAnalyticsAction(book._id);
            if (res.success && res.data) {
                setAnalytics(res.data);
            }
        } catch (err) {
            console.error('Error loading analytics:', err);
        } finally {
            setIsAnalyticsLoading(false);
        }
    };

    const autoGenerateSummary = async () => {
        setIsSummaryLoading(true);
        try {
            const res = await generateBookSummaryAction(book._id);
            if (res.success && res.data) {
                setSummary(res.data);
                // Update local book state to cache summary
                setBook(prev => ({ ...prev, summary: res.data }));
                toast.success('AI Book Insights generated successfully!');
            } else {
                toast.error(res.error || 'Failed to generate AI insights.');
            }
        } catch (err) {
            console.error('Error generating summary:', err);
            toast.error('An error occurred during AI analysis.');
        } finally {
            setIsSummaryLoading(false);
        }
    };

    const handleSendChat = async (queryToSend?: string) => {
        const query = (queryToSend || inputQuery).trim();
        if (!query) return;

        setInputQuery('');
        setIsChatLoading(true);

        const newUserMessage: ChatHistoryItem = { role: 'user', content: query };
        const updatedHistory = [...chatHistory, newUserMessage];
        setChatHistory(updatedHistory);

        try {
            // Map history format to standard simple history for actions
            const simplifiedHistory = updatedHistory.slice(0, -1).map(h => ({
                role: h.role,
                content: h.content
            }));

            const res = await chatWithBookAction(book._id, query, simplifiedHistory);

            if (res.success && res.reply) {
                setChatHistory(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: res.reply,
                        pageCitations: res.citedPages,
                        sources: res.sources,
                    }
                ]);
            } else {
                toast.error(res.error || 'Failed to get AI response.');
                setChatHistory(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
                    }
                ]);
            }
        } catch (err) {
            console.error('Error in chat submit:', err);
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsChatLoading(false);
        }
    };

    const formatSeconds = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        return parts.join(' ');
    };

    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-6 p-4 md:p-6">
            {/* Top Book Banner & Workspace Nav */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex gap-5 items-center">
                    <div className="relative w-16 h-24 rounded-lg overflow-hidden border border-[#cbd5e1] flex-shrink-0 shadow-sm">
                        <Image
                            src={book.coverURL || "/assets/book.png"}
                            alt={book.title}
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold font-serif text-[#212a3b] line-clamp-1">{book.title}</h1>
                        <p className="text-sm font-medium text-[#64748b] mt-0.5">by {book.author}</p>
                        <div className="flex gap-2 items-center mt-2 flex-wrap">
                            <span className="text-xs px-2.5 py-1 bg-[#f1f5f9] text-[#334155] rounded-full font-medium">
                                Voice: {book.persona || "Daniel"}
                            </span>
                            <span className="text-xs px-2.5 py-1 bg-[#e0f2fe] text-[#0369a1] rounded-full font-medium">
                                {book.totalSegments} Pages parsed
                            </span>
                        </div>
                    </div>
                </div>

                {/* Glassmorphic Tab Navigator */}
                <div className="flex bg-[#f1f5f9] p-1.5 rounded-xl border border-[#e2e8f0] w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('voice')}
                        className={`flex items-center justify-center gap-2 flex-1 md:flex-none text-xs md:text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
                            activeTab === 'voice' 
                                ? 'bg-white text-[#212a3b] shadow-sm' 
                                : 'text-[#64748b] hover:text-[#212a3b]'
                        }`}
                    >
                        <Mic className="size-4" />
                        Voice
                    </button>
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`flex items-center justify-center gap-2 flex-1 md:flex-none text-xs md:text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
                            activeTab === 'text' 
                                ? 'bg-white text-[#212a3b] shadow-sm' 
                                : 'text-[#64748b] hover:text-[#212a3b]'
                        }`}
                    >
                        <MessageSquare className="size-4" />
                        Text Chat
                    </button>
                    <button
                        onClick={() => setActiveTab('insights')}
                        className={`flex items-center justify-center gap-2 flex-1 md:flex-none text-xs md:text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
                            activeTab === 'insights' 
                                ? 'bg-white text-[#212a3b] shadow-sm' 
                                : 'text-[#64748b] hover:text-[#212a3b]'
                        }`}
                    >
                        <Sparkles className="size-4" />
                        Insights
                    </button>
                </div>
            </div>

            {/* Tab Contents */}
            <div className="min-h-[500px]">
                {/* 1. Voice Tab */}
                {activeTab === 'voice' && (
                    <div className="animate-in fade-in duration-200">
                        <VapiControls book={book} />
                    </div>
                )}

                {/* 2. Text Tab */}
                {activeTab === 'text' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
                        {/* Chat Core Pane */}
                        <div className="lg:col-span-2 flex flex-col bg-white border border-[#e2e8f0] rounded-2xl shadow-sm h-[600px] overflow-hidden">
                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
                                {chatHistory.map((msg, index) => (
                                    <div 
                                        key={index}
                                        className={`flex flex-col max-w-[85%] ${
                                            msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                                        }`}
                                    >
                                        <div 
                                            className={`p-3.5 md:p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                                msg.role === 'user' 
                                                    ? 'bg-[#212a3b] text-white rounded-br-none' 
                                                    : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#334155] rounded-bl-none'
                                            }`}
                                        >
                                            {/* Process page citations inside text to make them interactive */}
                                            <p className="whitespace-pre-wrap">
                                                {msg.content}
                                            </p>

                                            {/* Sources/References pills */}
                                            {msg.sources && msg.sources.length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex flex-wrap gap-2 items-center">
                                                    <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Sources:</span>
                                                    {msg.sources.map((src, sIdx) => (
                                                        <button
                                                            key={sIdx}
                                                            onClick={() => setSelectedSource(src)}
                                                            className="text-xs bg-white border border-[#cbd5e1] hover:border-[#212a3b] text-[#212a3b] font-medium px-2 py-1 rounded-md flex items-center gap-1 transition-all"
                                                        >
                                                            <FileText className="size-3" />
                                                            Page {src.pageNumber || 'Intro'}
                                                            <ArrowUpRight className="size-2.5" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {isChatLoading && (
                                    <div className="self-start flex gap-1.5 items-center bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-2xl rounded-bl-none shadow-sm max-w-[85%]">
                                        <span className="size-2 rounded-full bg-[#64748b] animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="size-2 rounded-full bg-[#64748b] animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="size-2 rounded-full bg-[#64748b] animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat Action Input */}
                            <div className="border-t border-[#e2e8f0] p-4 bg-slate-50">
                                <form 
                                    onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} 
                                    className="flex gap-2 items-center bg-white border border-[#cbd5e1] focus-within:border-[#212a3b] rounded-xl p-1.5 shadow-sm transition-all"
                                >
                                    <input
                                        type="text"
                                        value={inputQuery}
                                        onChange={(e) => setInputQuery(e.target.value)}
                                        placeholder="Ask a question about the book content..."
                                        disabled={isChatLoading}
                                        className="flex-1 px-3 py-2 text-sm text-[#334155] outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isChatLoading || !inputQuery.trim()}
                                        className="p-2.5 bg-[#212a3b] hover:bg-[#34425c] text-white disabled:opacity-50 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                                    >
                                        <Send className="size-4" />
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Interactive Citation Overlay & Quick Prompts Side pane */}
                        <div className="flex flex-col gap-6">
                            {/* Selected Page Citation viewer */}
                            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm min-h-[220px] flex flex-col">
                                <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-3 mb-3">
                                    <BookOpen className="size-5 text-[#212a3b]" />
                                    <h3 className="font-bold text-sm text-[#212a3b]">Source Page Segment</h3>
                                </div>
                                {selectedSource ? (
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div className="text-xs md:text-sm text-[#475569] leading-relaxed italic bg-slate-50 border border-slate-100 rounded-xl p-3.5 max-h-[220px] overflow-y-auto">
                                            "{selectedSource.content}"
                                        </div>
                                        <div className="mt-3 flex justify-between items-center text-xs font-semibold text-[#64748b]">
                                            <span>Page {selectedSource.pageNumber}</span>
                                            <button 
                                                onClick={() => setSelectedSource(null)}
                                                className="text-[#ef4444] hover:underline"
                                            >
                                                Clear Viewer
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                                        <BookOpenCheck className="size-8 text-[#cbd5e1] mb-2" />
                                        <p className="text-xs text-[#94a3b8] font-medium max-w-[200px]">
                                            Click on any page source pill in the chat history to read the actual book text here.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Recommended Book Prompts */}
                            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                                <h3 className="font-bold text-sm text-[#212a3b] border-b border-[#f1f5f9] pb-3 mb-3 flex items-center gap-2">
                                    <Sparkles className="size-4.5 text-amber-500" />
                                    Suggested Questions
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {(summary?.suggestedQuestions && summary.suggestedQuestions.length > 0 ? summary.suggestedQuestions : [
                                        `What is the main thesis of ${book.title}?`,
                                        `Summarize the key core concepts discussed.`,
                                        `Who is the intended target audience?`,
                                        `What practical methodologies are proposed?`
                                    ]).map((q, qIdx) => (
                                        <button
                                            key={qIdx}
                                            disabled={isChatLoading}
                                            onClick={() => handleSendChat(q)}
                                            className="text-left text-xs bg-slate-50 border border-slate-100 hover:border-[#212a3b] hover:bg-slate-100 font-semibold text-[#475569] p-3 rounded-xl transition-all leading-snug cursor-pointer"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Insights & Analytics Tab */}
                {activeTab === 'insights' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* Summary & Core Concepts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* AI Summary card */}
                            <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-5 md:p-6 shadow-sm min-h-[300px] flex flex-col">
                                <div className="flex justify-between items-center border-b border-[#f1f5f9] pb-4 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="size-5 text-[#212a3b]" />
                                        <h2 className="text-lg font-bold text-[#212a3b] font-serif">AI Book Insights</h2>
                                    </div>
                                    {!summary && !isSummaryLoading && (
                                        <button 
                                            onClick={autoGenerateSummary}
                                            className="text-xs bg-[#212a3b] hover:bg-[#34425c] text-white px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                                        >
                                            Generate Analysis
                                        </button>
                                    )}
                                </div>

                                {isSummaryLoading ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
                                        <div className="size-8 rounded-full border-4 border-[#212a3b] border-t-transparent animate-spin" />
                                        <p className="text-sm font-semibold text-[#475569]">Analyzing introductory pages & synthesizing literary concepts...</p>
                                        <p className="text-xs text-[#94a3b8]">This may take up to 10-15 seconds</p>
                                    </div>
                                ) : summary ? (
                                    <div className="space-y-5">
                                        <div>
                                            <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-2">Executive Summary</h3>
                                            <p className="text-sm leading-relaxed text-[#334155] bg-slate-50 border border-slate-100 p-4 rounded-xl font-medium">
                                                {summary.executiveSummary}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-2">Target Audience</h3>
                                                <div className="text-sm text-[#475569] leading-relaxed">
                                                    {summary.targetAudience}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-2">Details</h3>
                                                <ul className="text-xs text-[#475569] space-y-1.5 font-semibold">
                                                    <li className="flex items-center gap-1.5">
                                                        <BookOpen className="size-3.5 text-[#212a3b]" />
                                                        Total parsed segments: {book.totalSegments}
                                                    </li>
                                                    <li className="flex items-center gap-1.5">
                                                        <Clock className="size-3.5 text-[#212a3b]" />
                                                        Avg. voice session duration: 15 mins
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                        <Sparkles className="size-10 text-[#cbd5e1] mb-2 animate-pulse" />
                                        <p className="text-sm font-semibold text-[#475569]">No AI Insights Generated Yet</p>
                                        <p className="text-xs text-[#94a3b8] mt-1 max-w-[320px]">
                                            Click the button above to run high-dimensional Gemini analysis on the book's index.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Core Concepts Card */}
                            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                                <h3 className="font-bold text-sm text-[#212a3b] border-b border-[#f1f5f9] pb-3 mb-3 flex items-center gap-2">
                                    <BookOpenCheck className="size-4.5 text-emerald-600" />
                                    Core Concepts
                                </h3>

                                {isSummaryLoading ? (
                                    <div className="space-y-2 py-4">
                                        <div className="h-10 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                                        <div className="h-10 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                                        <div className="h-10 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                                    </div>
                                ) : summary?.coreConcepts && summary.coreConcepts.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                        {summary.coreConcepts.map((concept, index) => {
                                            const isOpen = openConceptIndex === index;
                                            return (
                                                <div key={index} className="border border-[#cbd5e1] rounded-xl overflow-hidden shadow-sm">
                                                    <button
                                                        onClick={() => setOpenConceptIndex(isOpen ? null : index)}
                                                        className="w-full text-left p-3.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#334155] flex justify-between items-center transition-all cursor-pointer"
                                                    >
                                                        <span>Concept #{index + 1}</span>
                                                        {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                                    </button>
                                                    {isOpen && (
                                                        <div className="p-3 text-xs leading-relaxed text-[#475569] border-t border-[#cbd5e1] bg-white animate-in slide-in-from-top-1 duration-150">
                                                            {concept}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-6 py-12">
                                        <FileText className="size-8 text-[#cbd5e1] mb-2" />
                                        <p className="text-xs text-[#94a3b8] font-medium">Generate AI Insights to view core concept mappings.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Analytics Panel */}
                        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 md:p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-[#212a3b] font-serif border-b border-[#f1f5f9] pb-4 mb-4 flex items-center gap-2">
                                <BarChart3 className="size-5 text-[#212a3b]" />
                                Voice Study Engagement Analytics
                            </h2>

                            {isAnalyticsLoading ? (
                                <div className="flex items-center justify-center p-8 text-center">
                                    <div className="size-6 rounded-full border-3 border-[#212a3b] border-t-transparent animate-spin" />
                                </div>
                            ) : analytics ? (
                                <div className="space-y-6">
                                    {/* Stats grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-4">
                                            <div className="size-11 bg-white border border-[#cbd5e1] rounded-lg flex items-center justify-center">
                                                <PlayCircle className="size-6 text-[#212a3b]" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Total Voice Sessions</p>
                                                <h4 className="text-xl font-bold text-[#212a3b] mt-0.5">{analytics.totalSessions}</h4>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-4">
                                            <div className="size-11 bg-white border border-[#cbd5e1] rounded-lg flex items-center justify-center">
                                                <Clock className="size-6 text-[#212a3b]" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Total Practice Time</p>
                                                <h4 className="text-xl font-bold text-[#212a3b] mt-0.5">{formatSeconds(analytics.totalDurationSeconds)}</h4>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-4">
                                            <div className="size-11 bg-white border border-[#cbd5e1] rounded-lg flex items-center justify-center">
                                                <BookOpenCheck className="size-6 text-[#212a3b]" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Average Session Duration</p>
                                                <h4 className="text-xl font-bold text-[#212a3b] mt-0.5">
                                                    {analytics.totalSessions > 0 
                                                        ? formatSeconds(Math.round(analytics.totalDurationSeconds / analytics.totalSessions))
                                                        : '0s'
                                                    }
                                                </h4>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Session History Table */}
                                    <div>
                                        <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <Calendar className="size-3.5 text-[#64748b]" />
                                            Active Learning Log
                                        </h3>
                                        {analytics.sessions.length > 0 ? (
                                            <div className="border border-[#cbd5e1] rounded-xl overflow-hidden shadow-sm">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50 border-b border-[#cbd5e1] text-[#334155] font-bold">
                                                        <tr>
                                                            <th className="p-3.5">Session ID</th>
                                                            <th className="p-3.5">Date & Time</th>
                                                            <th className="p-3.5 text-right">Duration</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#cbd5e1] text-[#475569] font-medium">
                                                        {analytics.sessions.map((sess, idx) => (
                                                            <tr key={sess._id} className="hover:bg-slate-50 transition-all">
                                                                <td className="p-3.5 font-mono text-[10px]">#{sess._id.slice(-8)}</td>
                                                                <td className="p-3.5">
                                                                    {new Date(sess.startedAt).toLocaleDateString(undefined, {
                                                                        year: 'numeric',
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    })}
                                                                </td>
                                                                <td className="p-3.5 text-right font-bold text-[#212a3b]">{formatSeconds(sess.durationSeconds)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 border border-dashed border-[#cbd5e1] rounded-xl text-xs text-[#94a3b8] font-semibold">
                                                No voice sessions logged. Click the "Voice" tab to start your first session.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-xs text-[#94a3b8] font-semibold">
                                    Failed to retrieve engagement statistics.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
