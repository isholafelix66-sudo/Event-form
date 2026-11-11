import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Plus,
  Trash2,
  Save,
  Copy,
  ExternalLink,
  MessageSquare,
  Sparkles,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  Send,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { EventForm, EventKnowledgeBase, KnowledgeBaseFAQ } from '../types';
import { dbService } from '../services/db';
import { useToast } from '../context/ToastContext';

interface HelpDeskAdminProps {
  onOpenPublicHelpDesk?: (slug: string) => void;
}

export const HelpDeskAdmin: React.FC<HelpDeskAdminProps> = ({ onOpenPublicHelpDesk }) => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [kb, setKb] = useState<EventKnowledgeBase | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'faqs' | 'contacts' | 'preview'>('details');

  // Preview state
  const [previewInput, setPreviewInput] = useState<string>('');
  const [previewMessages, setPreviewMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; fallback?: boolean }>>([
    { sender: 'ai', text: 'Knowledge base preview online. Ask a test question to verify AI grounding.' },
  ]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // New FAQ Form State
  const [newQuestion, setNewQuestion] = useState<string>('');
  const [newAnswer, setNewAnswer] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('General');

  useEffect(() => {
    let isMounted = true;
    async function loadForms() {
      setLoading(true);
      try {
        const list = await dbService.getForms();
        if (isMounted) {
          setForms(list);
          if (list.length > 0) {
            setSelectedFormId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load forms for HelpDesk admin:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadForms();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFormId) return;
    let isMounted = true;
    async function fetchKb() {
      setLoading(true);
      try {
        const fetched = await dbService.getKnowledgeBase(selectedFormId);
        if (isMounted) {
          setKb(fetched);
          setPreviewMessages([
            { sender: 'ai', text: `Preview mode active for "${fetched?.eventTitle}". Ask a test question below.` },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch KB:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchKb();
    return () => {
      isMounted = false;
    };
  }, [selectedFormId]);

  const handleSaveKb = async () => {
    if (!kb) return;
    setSaving(true);
    try {
      await dbService.saveKnowledgeBase(kb);
      showToast('Event Knowledge Base saved successfully', 'success');
    } catch (err) {
      showToast('Failed to save Knowledge Base', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFaq = () => {
    if (!newQuestion.trim() || !newAnswer.trim() || !kb) return;
    const newFaq: KnowledgeBaseFAQ = {
      id: `faq-${Date.now()}`,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      category: newCategory.trim() || 'General',
    };
    setKb({
      ...kb,
      faqs: [...(kb.faqs || []), newFaq],
    });
    setNewQuestion('');
    setNewAnswer('');
    showToast('FAQ added', 'info');
  };

  const handleRemoveFaq = (id: string) => {
    if (!kb) return;
    setKb({
      ...kb,
      faqs: kb.faqs.filter((f) => f.id !== id),
    });
    showToast('FAQ removed', 'info');
  };

  const handleCopyLink = () => {
    if (!kb) return;
    const link = `${window.location.origin}/#helpdesk=${kb.eventSlug || kb.eventId}`;
    navigator.clipboard.writeText(link);
    showToast('Public Help Desk link copied to clipboard!', 'success');
  };

  const handleTestPreviewMessage = async () => {
    if (!previewInput.trim() || !kb || previewLoading) return;
    const q = previewInput.trim();
    setPreviewInput('');
    setPreviewMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setPreviewLoading(true);

    try {
      const res = await fetch('/api/helpdesk/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: q,
          knowledgeBase: kb,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPreviewMessages((prev) => [
          ...prev,
          { sender: 'ai', text: data.answer, fallback: data.requiresFallback },
        ]);
      } else {
        setPreviewMessages((prev) => [
          ...prev,
          { sender: 'ai', text: 'Error executing AI model test.', fallback: true },
        ]);
      }
    } catch (err) {
      setPreviewMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Network connection error during preview test.', fallback: true },
      ]);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading && forms.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading event knowledge bases...</p>
      </div>
    );
  }

  const selectedForm = forms.find((f) => f.id === selectedFormId);
  const publicLink = kb ? `${window.location.origin}/#helpdesk=${kb.eventSlug || kb.eventId}` : '';

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Private-Link Event AI Help Desk
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Event Knowledge Base & AI Concierge</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Manage event guidelines, venue details, dress codes, and FAQs. Each event receives a dedicated public link for visitors.
          </p>
        </div>

        {/* Event Selection Dropdown */}
        <div className="w-full md:w-72 shrink-0 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Select Active Event:
          </label>
          <select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title} ({f.slug})
              </option>
            ))}
          </select>
        </div>
      </div>

      {kb && (
        <>
          {/* Unique Link Banner */}
          <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                  Unique Public Help Desk Link
                </span>
                <p className="text-sm font-mono text-gray-800 truncate">{publicLink}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Link
              </button>
              <button
                onClick={() => {
                  if (onOpenPublicHelpDesk) {
                    onOpenPublicHelpDesk(kb.eventSlug || kb.eventId);
                  } else {
                    window.open(publicLink, '_blank');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Public Desk
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'details'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Overview & Guidelines
            </button>
            <button
              onClick={() => setActiveTab('faqs')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'faqs'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              FAQs ({kb.faqs?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'contacts'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Contacts & Fallbacks
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'preview'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Interactive AI Test Preview
            </button>

            <button
              onClick={handleSaveKb}
              disabled={saving}
              className="ml-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>

          {/* TAB 1: OVERVIEW & GUIDELINES */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" /> Event Overview & Context
                </h3>
                <p className="text-xs text-gray-500">
                  This overview is used by the AI to explain the event purpose, theme, and host identity.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Event Title</label>
                  <input
                    type="text"
                    value={kb.eventTitle}
                    onChange={(e) => setKb({ ...kb, eventTitle: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Event Overview / Summary
                  </label>
                  <textarea
                    rows={4}
                    value={kb.overview || ''}
                    onChange={(e) => setKb({ ...kb, overview: e.target.value })}
                    placeholder="Describe the main purpose, target audience, and expectations..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Venue & Parking Directions
                  </label>
                  <textarea
                    rows={3}
                    value={kb.venueDetails || ''}
                    onChange={(e) => setKb({ ...kb, venueDetails: e.target.value })}
                    placeholder="Hall name, address, nearest tube/bus station, parking tips..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" /> Schedule & Guidelines
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" /> Timetable & Schedule Details
                  </label>
                  <textarea
                    rows={4}
                    value={kb.scheduleDetails || ''}
                    onChange={(e) => setKb({ ...kb, scheduleDetails: e.target.value })}
                    placeholder="Doors open time, key session breakdown, break times, closing hour..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    👔 Dress Code & Required Items
                  </label>
                  <textarea
                    rows={3}
                    value={kb.dressCode || ''}
                    onChange={(e) => setKb({ ...kb, dressCode: e.target.value })}
                    placeholder="Smart casual, formal, items to bring (notebook, laptop, badge)..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FAQS */}
          {activeTab === 'faqs' && (
            <div className="space-y-6">
              {/* Add New FAQ Card */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> Add New Event FAQ
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Question</label>
                    <input
                      type="text"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="e.g. Is there free parking at the cathedral?"
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    >
                      <option value="General">General</option>
                      <option value="Venue">Venue & Parking</option>
                      <option value="Schedule">Schedule & Doors</option>
                      <option value="Registration">Registration & Tickets</option>
                      <option value="Dietary">Dietary & Catering</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Official Answer</label>
                  <textarea
                    rows={2}
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="Provide the exact factual answer..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <button
                  onClick={handleAddFaq}
                  disabled={!newQuestion.trim() || !newAnswer.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add FAQ to Knowledge Base
                </button>
              </div>

              {/* FAQs List */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 text-base">
                  Configured FAQs ({kb.faqs?.length || 0})
                </h3>

                {kb.faqs && kb.faqs.length > 0 ? (
                  kb.faqs.map((faq, index) => (
                    <div
                      key={faq.id}
                      className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-4"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {faq.category || 'General'}
                          </span>
                          <h4 className="font-semibold text-sm text-gray-900">
                            #{index + 1}. {faq.question}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed pl-2 border-l-2 border-indigo-500">
                          {faq.answer}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRemoveFaq(faq.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                        title="Delete FAQ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <p className="text-gray-500 text-sm">No FAQs configured yet for this event.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTS & FALLBACKS */}
          {activeTab === 'contacts' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" /> Direct Organizer Contact Channels
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    📞 Organizer Phone / Support Desk
                  </label>
                  <input
                    type="text"
                    value={kb.contactPhone || ''}
                    onChange={(e) => setKb({ ...kb, contactPhone: e.target.value })}
                    placeholder="+44 7911 123456"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ✉️ Organizer Support Email
                  </label>
                  <input
                    type="email"
                    value={kb.contactEmail || ''}
                    onChange={(e) => setKb({ ...kb, contactEmail: e.target.value })}
                    placeholder="helpdesk@event.org"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    💬 WhatsApp Direct Link
                  </label>
                  <input
                    type="text"
                    value={kb.whatsappLink || ''}
                    onChange={(e) => setKb({ ...kb, whatsappLink: e.target.value })}
                    placeholder="https://wa.me/447911123456"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    🌐 Social / Support Web Page Link
                  </label>
                  <input
                    type="text"
                    value={kb.socialLink || ''}
                    onChange={(e) => setKb({ ...kb, socialLink: e.target.value })}
                    placeholder="https://instagram.com/my_event"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <hr className="border-gray-200 my-4" />

              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">
                  Custom AI Fallback Response Message
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  When a visitor asks something not covered by this knowledge base, the AI politely presents this statement alongside your direct contact buttons.
                </p>

                <textarea
                  rows={3}
                  value={kb.fallbackMessage || ''}
                  onChange={(e) => setKb({ ...kb, fallbackMessage: e.target.value })}
                  placeholder="I don't have that specific detail in our event guide right now. Please reach out to our event coordination team directly using the contact details below:"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* TAB 4: INTERACTIVE PREVIEW */}
          {activeTab === 'preview' && (
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-xl max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Interactive AI Tester ({kb.eventTitle})
                </h3>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold uppercase">
                  Server-Side Gemini Model
                </span>
              </div>

              <div className="h-80 overflow-y-auto space-y-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                {previewMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                      }`}
                    >
                      {m.text}
                      {m.fallback && (
                        <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-amber-300 font-medium">
                          ⚠️ Fallback Triggered: Contact info requested
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {previewLoading && (
                  <div className="text-slate-500 text-xs flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" /> Querying Gemini AI...
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={previewInput}
                  onChange={(e) => setPreviewInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestPreviewMessage()}
                  placeholder="Ask a test question to verify knowledge base grounding..."
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={handleTestPreviewMessage}
                  disabled={!previewInput.trim() || previewLoading}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Test
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
