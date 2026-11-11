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
  Info,
  ShieldCheck,
  Globe,
  Share2,
  X,
  ChevronRight,
  ArrowDown,
  RefreshCw,
} from 'lucide-react';

import { EventKnowledgeBase, ContactOption } from '../types';
import { dbService } from '../services/db';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  requiresFallback?: boolean;
  fallbackDetails?: {
    message?: string;
    contacts?: ContactOption[];
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
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const getStorageKey = (keySlug: string) => `eventform_helpdesk_chat_${keySlug}`;

  // Load event knowledge base and restore device-specific chat history
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const fetchedKb = await dbService.getKnowledgeBase(slugOrId);
        if (isMounted) {
          setKb(fetchedKb);
          if (fetchedKb) {
            // Check for device-specific saved chat history in localStorage
            const storageKey = getStorageKey(fetchedKb.eventId || slugOrId);
            const savedChat = localStorage.getItem(storageKey);
            if (savedChat) {
              try {
                const parsedMessages: ChatMessage[] = JSON.parse(savedChat);
                if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                  setMessages(parsedMessages);
                  return;
                }
              } catch (e) {
                console.warn('Could not parse device chat storage:', e);
              }
            }

            // If no saved chat exists on this device, start fresh conversation
            const initialWelcome: ChatMessage[] = [
              {
                id: 'welcome-msg',
                sender: 'assistant',
                text: `Hello! Welcome to the official **${fetchedKb.eventTitle}** Help Desk. 👋\n\nI'm your 24/7 Event Assistant. I can help answer questions about the event venue, schedule, dress code, directions, and guidelines. How can I assist you today?`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ];
            setMessages(initialWelcome);
            localStorage.setItem(storageKey, JSON.stringify(initialWelcome));
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

  // Persist device chat state whenever messages update
  const saveMessagesToDevice = (updatedMsgs: ChatMessage[]) => {
    if (!kb) return;
    const storageKey = getStorageKey(kb.eventId || slugOrId);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedMsgs));
    } catch (e) {
      console.warn('Failed to persist chat to device storage:', e);
    }
  };

  const handleClearDeviceChat = () => {
    if (!kb) return;
    const freshWelcome: ChatMessage[] = [
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `Hello! Welcome back to **${kb.eventTitle}** Help Desk. 👋\n\nYour chat session has been refreshed. How can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(freshWelcome);
    saveMessagesToDevice(freshWelcome);
  };

  // Handle scroll detection for scroll-to-bottom button
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 120;
    setShowScrollBottomBtn(isFarFromBottom);
  };

  const scrollToBottom = (smooth = true) => {
    chatBottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (!showScrollBottomBtn) {
      scrollToBottom(true);
    }
  }, [messages, isSending]);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || inputText;
    if (!textToSend.trim() || isSending || !kb) return;

    const userText = textToSend.trim();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Format chat history for context
    const recentHistory = messages.map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    saveMessagesToDevice(updatedWithUser);

    if (!customMessage) setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('/api/helpdesk/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userText,
          knowledgeBase: kb,
          chatHistory: recentHistory,
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
        const updatedWithAi = [...updatedWithUser, aiMsg];
        setMessages(updatedWithAi);
        saveMessagesToDevice(updatedWithAi);
      } else {
        const errorMsg: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          text: kb.fallbackMessage || `I'm unable to answer that specific detail at the moment, but our support team will be happy to help.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          requiresFallback: true,
          fallbackDetails: {
            message: kb.fallbackMessage,
            contacts: kb.contacts,
            contactPhone: kb.contactPhone,
            contactEmail: kb.contactEmail,
            whatsappLink: kb.whatsappLink,
          },
        };
        const updatedWithErr = [...updatedWithUser, errorMsg];
        setMessages(updatedWithErr);
        saveMessagesToDevice(updatedWithErr);
      }
    } catch (err) {
      const networkErrMsg: ChatMessage = {
        id: `ai-net-err-${Date.now()}`,
        sender: 'assistant',
        text: kb.fallbackMessage || `Network connection issue. Please feel free to reach out to our team directly:`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        requiresFallback: true,
        fallbackDetails: {
          message: kb.fallbackMessage,
          contacts: kb.contacts,
        },
      };
      const updatedWithNet = [...updatedWithUser, networkErrMsg];
      setMessages(updatedWithNet);
      saveMessagesToDevice(updatedWithNet);
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
      <div className="h-dvh w-full bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-medium text-sm animate-pulse">Loading Event Concierge...</p>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="h-dvh w-full bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Help Desk Not Found</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          The requested event help desk link does not exist or may have been updated.
        </p>
        <button
          onClick={() => (window.location.hash = '')}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg"
        >
          Return to Event Portal
        </button>
      </div>
    );
  }

  // Active contact channels
  const activeContacts: ContactOption[] = kb.contacts && kb.contacts.length > 0
    ? kb.contacts
    : [
        ...(kb.contactPhone ? [{ id: 'ph', type: 'phone' as const, label: 'Phone Desk', value: kb.contactPhone, link: `tel:${kb.contactPhone}` }] : []),
        ...(kb.whatsappLink ? [{ id: 'wa', type: 'whatsapp' as const, label: 'WhatsApp Concierge', value: 'WhatsApp', link: kb.whatsappLink }] : []),
        ...(kb.contactEmail ? [{ id: 'em', type: 'email' as const, label: 'Email', value: kb.contactEmail, link: `mailto:${kb.contactEmail}` }] : []),
      ];

  return (
    <div className="h-dvh max-w-full w-full bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden select-none">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="shrink-0 z-20 backdrop-blur-xl bg-slate-900/90 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-white truncate max-w-[200px] sm:max-w-md leading-tight">
                {kb.eventTitle}
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Official Event AI Assistant</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleClearDeviceChat}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            title="Start fresh conversation on this device"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            title="Event Guide Info"
          >
            <Info className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Event Guide</span>
          </button>
        </div>

      </header>

      {/* Scrollable Message Feed */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl w-full mx-auto relative scrollbar-none"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
            >
              <div className="flex items-end gap-2.5 max-w-[88%] sm:max-w-[78%]">
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 text-[11px] font-black mb-1">
                    AI
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed tracking-normal ${
                    isUser
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 border border-slate-800/90 text-slate-100 rounded-bl-xs shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                  {/* Fallback Contact Card (if unanswerable question or explicit contact request) */}
                  {!isUser && msg.requiresFallback && (
                    <div className="mt-3.5 pt-3 border-t border-slate-800 bg-slate-950/70 rounded-xl p-3 border border-indigo-500/20">
                      <p className="text-[11px] text-indigo-300 font-semibold mb-2.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{msg.fallbackDetails?.message || kb.fallbackMessage || 'Event Support Options:'}</span>
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(msg.fallbackDetails?.contacts || activeContacts).map((cnt, idx) => (
                          <a
                            key={cnt.id || idx}
                            href={cnt.link || '#'}
                            target={cnt.link?.startsWith('http') ? '_blank' : '_self'}
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-medium transition-all active:scale-95 group"
                          >
                            <div className="flex items-center gap-2 truncate">
                              {cnt.type === 'phone' && <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              {cnt.type === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              {cnt.type === 'email' && <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                              {cnt.type === 'website' && <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                              {cnt.type === 'social' && <ExternalLink className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                              {cnt.type === 'other' && <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              <span className="truncate">{cnt.label || cnt.value}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`text-[10px] mt-1.5 text-right ${
                      isUser ? 'text-indigo-200/80' : 'text-slate-500'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Animated Typing Indicator */}
        {isSending && (
          <div className="flex items-center gap-2.5 text-slate-400 text-xs">
            <div className="w-7 h-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0 text-[11px] font-bold">
              AI
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-xs px-4 py-3 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-20 right-6 z-30 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-xl border border-indigo-400/40 transition-all active:scale-90 flex items-center justify-center"
          title="Scroll to latest"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Suggested Quick Questions */}
      {messages.length < 4 && kb && (
        <div className="shrink-0 px-4 py-1.5 max-w-3xl w-full mx-auto overflow-x-auto scrollbar-none flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Suggested:
          </span>
          {kb.venueDetails && (
            <button
              onClick={() => handleSendMessage('Where is the venue and directions?')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 active:scale-95"
            >
              <MapPin className="w-3 h-3 text-emerald-400" /> Venue & Directions
            </button>
          )}
          {kb.scheduleDetails && (
            <button
              onClick={() => handleSendMessage('What is the schedule and door times?')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 active:scale-95"
            >
              <Calendar className="w-3 h-3 text-purple-400" /> Schedule & Timing
            </button>
          )}
          {kb.dressCode && (
            <button
              onClick={() => handleSendMessage('What is the dress code?')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all shrink-0 active:scale-95"
            >
              👔 Dress Code
            </button>
          )}
        </div>
      )}

      {/* Anchored Input Footer */}
      <footer className="shrink-0 z-20 backdrop-blur-xl bg-slate-900/95 border-t border-slate-800/80 p-3 sm:p-4">
        <div className="max-w-3xl w-full mx-auto relative flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask a question about ${kb.eventTitle}...`}
            disabled={isSending}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-3 pr-12 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isSending}
            className="absolute right-2 top-2 bottom-2 px-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* Event Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-200 max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-150 shadow-2xl">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-400" /> {kb.eventTitle} Event Guide
            </h3>

            {/* Church / Venue Photo Banner if present */}
            {kb.venueImage && (
              <div className="my-3 rounded-2xl overflow-hidden border border-slate-800 shadow-md">
                <img
                  src={kb.venueImage}
                  alt={kb.eventTitle}
                  className="w-full h-44 object-cover"
                />
              </div>
            )}

            <p className="text-xs text-slate-400 mb-5 leading-relaxed">{kb.overview}</p>


            <div className="space-y-4 text-xs">
              {kb.venueDetails && (
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/90">
                  <h4 className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" /> Venue & Location
                  </h4>
                  <p className="text-slate-300 leading-relaxed">{kb.venueDetails}</p>
                </div>
              )}

              {kb.scheduleDetails && (
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/90">
                  <h4 className="font-semibold text-purple-400 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> Schedule & Timetable
                  </h4>
                  <p className="text-slate-300 leading-relaxed">{kb.scheduleDetails}</p>
                </div>
              )}

              {kb.dressCode && (
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/90">
                  <h4 className="font-semibold text-amber-400 mb-1">👔 Dress Code</h4>
                  <p className="text-slate-300">{kb.dressCode}</p>
                </div>
              )}

              {/* Dynamic Custom Sections */}
              {kb.sections && kb.sections.length > 0 && kb.sections.map((sec) => (
                <div key={sec.id} className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/90">
                  <h4 className="font-semibold text-indigo-300 mb-1">{sec.title}</h4>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                </div>
              ))}

              {/* Contact Channels */}
              <div className="p-3.5 bg-indigo-950/40 rounded-2xl border border-indigo-500/20">
                <h4 className="font-semibold text-indigo-300 mb-2">Organizer Support Channels</h4>
                <div className="space-y-2">
                  {activeContacts.map((cnt, idx) => (
                    <a
                      key={cnt.id || idx}
                      href={cnt.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-medium hover:bg-slate-800 transition"
                    >
                      <span className="font-bold text-indigo-400">{cnt.label}:</span>
                      <span className="truncate">{cnt.value}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-2xl text-xs transition-all active:scale-98"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
