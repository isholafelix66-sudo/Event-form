import React, { useState } from 'react';
import { FormResponse, EventForm } from '../types';
import { dbService } from '../services/db';
import { TicketPass } from './TicketPass';
import {
  KeyRound,
  Users,
  UserPlus,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  MapPin,
  Trash2,
  RefreshCw,
  QrCode,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import confetti from 'canvas-confetti';

interface RegistrationPortalProps {
  onBackToHome?: () => void;
}

export const RegistrationPortal: React.FC<RegistrationPortalProps> = ({
  onBackToHome,
}) => {
  const { showToast } = useToast();
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mainRegistrant, setMainRegistrant] = useState<FormResponse | null>(null);
  const [dependents, setDependents] = useState<FormResponse[]>([]);
  const [eventForm, setEventForm] = useState<EventForm | null>(null);

  // Add Dependent Modal State
  const [showAddDependentModal, setShowAddDependentModal] = useState(false);
  const [depName, setDepName] = useState('');
  const [depEmail, setDepEmail] = useState('');
  const [depPhone, setDepPhone] = useState('');
  const [isSubmittingDep, setIsSubmittingDep] = useState(false);

  // Selected Dependent Ticket Modal State
  const [viewingTicketResponse, setViewingTicketResponse] = useState<FormResponse | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = accessCode.trim().toUpperCase();
    if (!code) {
      showToast('Please enter your unique Registration Code.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Find main registrant by reference code
      const registrant = await dbService.getResponseByReference(code);
      if (!registrant) {
        showToast('Invalid Registration Code. Please check your ticket pass or email.', 'error');
        setLoading(false);
        return;
      }

      // If this is a dependent code, fetch the main registrant instead
      let main = registrant;
      if (registrant.parent_registration_id) {
        const parent = await dbService.getResponseById(registrant.parent_registration_id);
        if (parent) {
          main = parent;
        }
      }

      setMainRegistrant(main);

      // Fetch event form details
      const form = await dbService.getFormBySlug(main.formId);
      setEventForm(form);

      // Fetch all dependents linked to this main registrant
      const allResponses = await dbService.getResponses();
      const deps = allResponses.filter((r) => r.parent_registration_id === main.reference || r.parent_registration_id === main.id);
      setDependents(deps);

      showToast(`Welcome back, ${main.fullName}!`, 'success');
    } catch (err) {
      console.error('Portal login error:', err);
      showToast('Failed to verify registration code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDependentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainRegistrant || !eventForm) return;

    if (!depName.trim() || !depEmail.trim()) {
      showToast('Please enter at least a Full Name and Email for the additional attendee.', 'error');
      return;
    }

    setIsSubmittingDep(true);
    try {
      const depAnswers = {
        'Full Name': depName.trim(),
        'Email': depEmail.trim(),
        'Phone': depPhone.trim(),
        'Main Registrant Parent': mainRegistrant.reference,
        'Registration Type': 'Dependent / Additional Attendee',
      };

      const { response: newDep } = await dbService.submitResponse(eventForm, depAnswers);

      // Link dependent to main registrant via parent_registration_id
      await dbService.updateResponseParent(newDep.id, mainRegistrant.reference);
      newDep.parent_registration_id = mainRegistrant.reference;

      setDependents((prev) => [...prev, newDep]);
      setShowAddDependentModal(false);
      setDepName('');
      setDepEmail('');
      setDepPhone('');

      confetti({
        particleCount: 75,
        spread: 60,
      });

      showToast(`Successfully registered ${newDep.fullName} under your account!`, 'success');
    } catch (err) {
      console.error('Failed to add dependent:', err);
      showToast('Failed to register additional attendee.', 'error');
    } finally {
      setIsSubmittingDep(false);
    }
  };

  const handleDeleteDependent = async (depId: string) => {
    if (!window.confirm('Are you sure you want to remove this additional attendee?')) return;
    await dbService.deleteResponse(depId);
    setDependents((prev) => prev.filter((d) => d.id !== depId));
    showToast('Additional attendee removed successfully.', 'info');
  };

  // If logged into portal dashboard
  if (mainRegistrant) {
    const totalAttendeesCount = 1 + dependents.length;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Portal Header */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                <KeyRound className="w-3.5 h-3.5" />
                Registrant Dashboard
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {mainRegistrant.formTitle}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Manage your registration pass and additional family/group attendees linked to your account.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMainRegistrant(null);
                  setDependents([]);
                  setAccessCode('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Log Out
              </button>
              {onBackToHome && (
                <button
                  onClick={onBackToHome}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Home
                </button>
              )}
            </div>
          </div>

          {/* Main Registrant Pass Summary Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  Main Pass: {mainRegistrant.reference}
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2">
                  {mainRegistrant.fullName} (Primary Registrant)
                </h2>
                <p className="text-xs text-slate-500">{mainRegistrant.email} • {mainRegistrant.phone || 'No phone'}</p>
              </div>

              <button
                onClick={() => setViewingTicketResponse(mainRegistrant)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                View Main QR Pass
              </button>
            </div>

            {/* Event Info */}
            {eventForm && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 pt-1">
                {eventForm.eventDate && (
                  <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-gray-100">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{new Date(eventForm.eventDate).toLocaleString()}</span>
                  </div>
                )}
                {eventForm.eventLocation && (
                  <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-gray-100">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="line-clamp-1">{eventForm.eventLocation}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dependents & Additional Attendees Section */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Additional Attendees ({totalAttendeesCount} Total)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Family members or guests registered under your primary account.
                </p>
              </div>

              <button
                onClick={() => setShowAddDependentModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Add Child
              </button>
            </div>

            {dependents.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-gray-200">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No children registered yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Click the "Add Child" button above to register children under your account.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dependents.map((dep, index) => (
                  <div
                    key={dep.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-gray-200 hover:border-gray-300 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {dep.reference}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          Child #{index + 1}: {dep.fullName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {dep.email} {dep.phone ? `• ${dep.phone}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => setViewingTicketResponse(dep)}
                        className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        View Pass
                      </button>
                      <button
                        onClick={() => handleDeleteDependent(dep.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Remove child"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Dependent Modal */}
        {showAddDependentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-100 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600">
                  <UserPlus className="w-5 h-5" />
                  <h3 className="text-lg font-black text-slate-900">Add Child</h3>
                </div>
                <button
                  onClick={() => setShowAddDependentModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddDependentSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Williams"
                    value={depName}
                    onChange={(e) => setDepName(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="sarah@example.com"
                    value={depEmail}
                    onChange={(e) => setDepEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+44 7911 123456"
                    value={depPhone}
                    onChange={(e) => setDepPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddDependentModal(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDep}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingDep ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span>Register Attendee</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View QR Pass Modal */}
        {viewingTicketResponse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl">
              <div className="flex justify-end pb-2">
                <button
                  onClick={() => setViewingTicketResponse(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer font-bold text-xs"
                >
                  ✕
                </button>
              </div>
              <TicketPass
                response={viewingTicketResponse}
                form={eventForm}
                onClose={() => setViewingTicketResponse(null)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Login Portal Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />

        <div className="text-center space-y-3 pt-2 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <KeyRound className="w-8 h-8" />
          </div>

          <div>
            <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-mono font-bold uppercase tracking-widest mb-2">
              Secure Registrant Portal
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Access Your Registration
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Enter your unique Registration Code (e.g. EVT-2026-XXXX) found on your confirmation ticket pass or email.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Registration Code
            </label>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="e.g. EVT-2026-X7K9"
              autoFocus
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-white focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase placeholder:text-slate-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !accessCode.trim()}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Access Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
          <p className="text-xs text-slate-400 mb-2">Need to register for an event first?</p>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Public Events</span>
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-6 font-mono">
        Event Management Platform • Registrant Portal Security
      </p>
    </div>
  );
};
