import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Phone,
  Mail,
  ExternalLink,
  MapPin,
  Calendar,
  HelpCircle,
  RefreshCw,
  Info,
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { EventKnowledgeBase, KnowledgeBaseFAQ } from '../types';
import { dbService } from '../services/db';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  requiresFallback?: boolean;
  fallbackDetails?: {
    message?: string;
    contactPhone?: string;
    contactEmail?: string;
    whatsappLink?: string;
    socialLink?: string;
    fallbackLink?: string;
  };
}

interface PublicHelpDeskProps {
  slugOrId: string;
}

export const PublicHelpDesk: React.FC<PublicHelpDeskProps> = ({ slugOrId }) => {
  const [kb, setKb] = useState<EventKnowledgeBase | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const fetchedKb = await dbService.getKnowledgeBase(slugOrId);
        if (isMounted) {
          setKb(fetchedKb);
          if (fetchedKb) {
            setMessages([
              {
                id: 'welcome-msg',
                sender: 'assistant',
                text: `Welcome to the official **${fetchedKb.eventTitle}** Help Desk! 👋\n\nI'm your 24/7 AI Concierge, trained specifically on this event's schedule, venue, dress code, and guidelines. How can I assist you today?`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load event knowledge base:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [slugOrId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || inputText;
    if (!textToSend.trim() || isSending || !kb) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customMessage) setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('/api/helpdesk/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: textToSend.trim(),
          knowledgeBase: kb,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          requiresFallback: data.requiresFallback,
          fallbackDetails: data.fallbackDetails,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          text: kb.fallbackMessage || `I'm unable to process that request right now. Please connect with our event team below:`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          requiresFallback: true,
          fallbackDetails: {
            message: kb.fallbackMessage,
            contactPhone: kb.contactPhone,
            contactEmail: kb.contactEmail,
            whatsappLink: kb.whatsappLink,
            fallbackLink: kb.fallbackLink,
          },
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const networkErrMsg: ChatMessage = {
        id: `ai-net-err-${Date.now()}`,
        sender: 'assistant',
        text: kb.fallbackMessage || `Connection error. Please reach out directly to our event team below:`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        requiresFallback: true,
        fallbackDetails: {
          message: kb.fallbackMessage,
          contactPhone: kb.contactPhone,
          contactEmail: kb.contactEmail,
          whatsappLink: kb.whatsappLink,
        },
      };
      setMessages((prev) => [...prev, networkErrMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-medium text-sm animate-pulse">Loading Event Concierge Knowledge Base...</p>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mb-4">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Event Help Desk Not Found</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          The requested event help desk link does not exist or may have been removed.
        </p>
        <button
          onClick={() => (window.location.hash = '')}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background Decorative Blur */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800/80 px-4 py-3 sm:px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-white truncate max-w-[200px] sm:max-w-md">
                {kb.eventTitle}
              </h1>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-semibold tracking-wide uppercase hidden sm:inline-block">
                AI Help Desk
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Grounded in Official Event Guide
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
            title="Event Guide Info"
          >
            <Info className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Event Guide</span>
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 max-w-4xl w-full mx-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
            >
              <div className="flex items-end gap-2.5 max-w-[92%] sm:max-w-[80%]">
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 text-xs font-bold mb-1">
                    AI
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Fallback Contact Card inside message if fallback required */}
                  {!isUser && msg.requiresFallback && msg.fallbackDetails && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 bg-slate-950/60 rounded-xl p-3 border border-indigo-500/20">
                      <p className="text-xs text-indigo-300 font-semibold mb-2 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-400" /> Direct Organizer Contact Options
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                        {msg.fallbackDetails.contactPhone && (
                          <a
                            href={`tel:${msg.fallbackDetails.contactPhone}`}
                            className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium transition-all"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Call: {msg.fallbackDetails.contactPhone}</span>
                          </a>
                        )}

                        {msg.fallbackDetails.whatsappLink && (
                          <a
                            href={msg.fallbackDetails.whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 font-medium transition-all"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>WhatsApp Organizer</span>
                            <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
                          </a>
                        )}

                        {msg.fallbackDetails.contactEmail && (
                          <a
                            href={`mailto:${msg.fallbackDetails.contactEmail}`}
                            className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium transition-all"
                          >
                            <Mail className="w-3.5 h-3.5 text-blue-400" />
                            <span className="truncate">{msg.fallbackDetails.contactEmail}</span>
                          </a>
                        )}

                        {msg.fallbackDetails.fallbackLink && (
                          <a
                            href={msg.fallbackDetails.fallbackLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 font-medium transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Official Support Page</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`text-[10px] mt-1.5 text-right ${
                      isUser ? 'text-indigo-200/70' : 'text-slate-500'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isSending && (
          <div className="flex items-center gap-2.5 text-slate-400 text-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0 text-xs font-bold">
              AI
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </main>

      {/* Suggested FAQ Question Pills */}
      {messages.length < 5 && kb && (
        <div className="px-4 py-2 max-w-4xl w-full mx-auto overflow-x-auto scrollbar-none flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-indigo-400" /> Quick Questions:
          </span>
          {kb.venueDetails && (
            <button
              onClick={() => handleSendMessage('Where is the venue and what are the directions?')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5"
            >
              <MapPin className="w-3 h-3 text-emerald-400" /> Venue & Parking
            </button>
          )}
          {kb.scheduleDetails && (
            <button
              onClick={() => handleSendMessage('What is the schedule and timetable for the event?')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5"
            >
              <Calendar className="w-3 h-3 text-purple-400" /> Schedule & Doors Open
            </button>
          )}
          {kb.faqs && kb.faqs.length > 0 && (
            <button
              onClick={() => handleSendMessage(kb.faqs[0].question)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-amber-400" /> {kb.faqs[0].question}
            </button>
          )}
          {kb.dressCode && (
            <button
              onClick={() => handleSendMessage('What is the recommended dress code?')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all shrink-0"
            >
              👔 Dress Code
            </button>
          )}
        </div>
      )}

      {/* Input Bar */}
      <footer className="sticky bottom-0 z-20 backdrop-blur-xl bg-slate-900/90 border-t border-slate-800 p-3 sm:p-4">
        <div className="max-w-4xl w-full mx-auto relative flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask anything about ${kb.eventTitle}...`}
            disabled={isSending}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-3.5 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isSending}
            className="absolute right-2 top-2 bottom-2 px-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-2">
          Official Event AI Assistant • Operates strictly on organizer-verified knowledge base
        </p>
      </footer>

      {/* Event Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-200 max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-400" /> {kb.eventTitle} Overview
            </h3>
            <p className="text-xs text-slate-400 mb-4">{kb.overview}</p>

            <div className="space-y-4 text-xs">
              {kb.venueDetails && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <h4 className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" /> Venue & Location
                  </h4>
                  <p className="text-slate-300 leading-relaxed">{kb.venueDetails}</p>
                </div>
              )}

              {kb.scheduleDetails && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <h4 className="font-semibold text-purple-400 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> Schedule & Doors
                  </h4>
                  <p className="text-slate-300 leading-relaxed">{kb.scheduleDetails}</p>
                </div>
              )}

              {kb.dressCode && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <h4 className="font-semibold text-amber-400 mb-1">👔 Dress Code</h4>
                  <p className="text-slate-300">{kb.dressCode}</p>
                </div>
              )}

              <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20">
                <h4 className="font-semibold text-indigo-300 mb-2">Organizer Contact Desk</h4>
                <div className="space-y-1.5">
                  {kb.contactPhone && <p>📞 Phone: {kb.contactPhone}</p>}
                  {kb.contactEmail && <p>✉️ Email: {kb.contactEmail}</p>}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-xs transition-all"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
