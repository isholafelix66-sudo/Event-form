import React, { useState, useEffect } from 'react';
import { EventForm, FormResponse } from '../types';
import { dbService } from '../services/db';
import {
  Users,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Ticket,
  Printer,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Church,
  Calendar,
  MapPin,
  ArrowRight,
  Eye
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useToast } from '../context/ToastContext';

interface BulkRegistrationProps {
  currentAgentName?: string;
  currentAgentId?: string;
  onViewResponses?: (formId: string) => void;
}

interface QuickAttendeeRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  church: string;
  notes?: string;
}

export const BulkRegistration: React.FC<BulkRegistrationProps> = ({
  currentAgentName = 'Agent Sarah',
  currentAgentId = 'agent-1',
  onViewResponses,
}) => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [batchChurch, setBatchChurch] = useState<string>('');
  const [rows, setRows] = useState<QuickAttendeeRow[]>([
    { id: '1', fullName: '', email: '', phone: '', church: '' },
    { id: '2', fullName: '', email: '', phone: '', church: '' },
    { id: '3', fullName: '', email: '', phone: '', church: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResults, setSuccessResults] = useState<{
    formTitle: string;
    formId: string;
    responses: FormResponse[];
  } | null>(null);

  useEffect(() => {
    const unsub = dbService.subscribeForms((f) => {
      const published = f.filter((item) => item.status === 'published');
      const list = published.length > 0 ? published : f;
      setForms(list);
      if (list.length > 0 && !selectedFormId) {
        setSelectedFormId(list[0].id);
      }
    });
    return () => unsub();
  }, [selectedFormId]);

  const activeForm = forms.find((f) => f.id === selectedFormId);

  const handleBatchChurchChange = (val: string) => {
    setBatchChurch(val);
    // Auto-populate church into blank row fields
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        church: r.church.trim() === '' ? val : r.church,
      }))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        fullName: '',
        email: '',
        phone: '',
        church: batchChurch || '',
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof QuickAttendeeRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmitBulk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFormId || !activeForm) {
      showToast('Please select an event form for this bulk registration.', 'error');
      return;
    }

    const validRows = rows.filter(
      (r) => r.fullName.trim() !== '' && r.email.trim() !== ''
    );

    if (validRows.length === 0) {
      showToast('Please fill in at least one attendee with a Name and Email.', 'error');
      return;
    }

    setIsSubmitting(true);
    const createdResponses: FormResponse[] = [];

    try {
      // Find church/ministry question in target event form if present
      const churchQuestion = activeForm.questions.find(
        (q) =>
          q.title.toLowerCase().includes('church') ||
          q.title.toLowerCase().includes('ministry') ||
          q.id.toLowerCase().includes('ministry')
      );

      for (const row of validRows) {
        const churchValue = (row.church || batchChurch || '').trim();

        const answers: Record<string, any> = {
          'Full Name': row.fullName.trim(),
          'Email': row.email.trim(),
          'Phone': row.phone ? row.phone.trim() : '',
          'Church / Ministry': churchValue,
          'Registration Mode': 'Bulk Desk Agent',
          'Agent Notes': row.notes || 'On-site Bulk Entry',
        };

        if (churchQuestion) {
          answers[churchQuestion.id] = churchValue;
        }

        // Submit response directly into selected event form responses
        const { response } = await dbService.submitResponse(activeForm, answers, {
          agentId: currentAgentId,
          agentName: currentAgentName,
        });
        createdResponses.push(response);
      }

      setSuccessResults({
        formTitle: activeForm.title,
        formId: activeForm.id,
        responses: createdResponses,
      });

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });

      showToast(
        `Registered ${createdResponses.length} attendees for "${activeForm.title}"! Entries saved to event responses.`,
        'success'
      );
    } catch (err) {
      console.error('Bulk registration error:', err);
      showToast('Failed to register bulk attendees.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForMore = () => {
    setRows([
      { id: '1', fullName: '', email: '', phone: '', church: batchChurch },
      { id: '2', fullName: '', email: '', phone: '', church: batchChurch },
      { id: '3', fullName: '', email: '', phone: '', church: batchChurch },
    ]);
    setSuccessResults(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
            <UserCheck className="w-4 h-4" />
            Registration Agent Desk Mode
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Bulk Event Registration
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Register multiple attendees and church delegates directly into specific event forms with instant pass generation.
          </p>
        </div>

        {/* Active Agent Badge */}
        <div className="bg-indigo-50 border border-indigo-100 px-3.5 py-2 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {currentAgentName.charAt(0)}
          </div>
          <div>
            <div className="text-[10px] font-bold text-indigo-950 uppercase tracking-wider">Active Agent</div>
            <div className="text-xs font-bold text-indigo-700">{currentAgentName}</div>
          </div>
        </div>
      </div>

      {successResults ? (
        /* Results Table / Summary Screen */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
          <div className="text-center py-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-2">
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-emerald-950">
              Successfully Registered {successResults.responses.length} Attendees!
            </h2>
            <p className="text-xs text-emerald-700 max-w-lg mx-auto leading-relaxed">
              All entries have been saved under event <span className="font-bold underline">{successResults.formTitle}</span>. Please remind each registrant to check their email for updates and individual registration passes.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-extrabold text-[10px] border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Pass Ref</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Church / Ministry</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {successResults.responses.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-black text-indigo-700">
                      {res.reference}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{res.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{res.email}</td>
                    <td className="px-4 py-3 text-gray-600">{res.phone || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {res.answers['Church / Ministry'] || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        CONFIRMED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => window.print()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Batch Passes</span>
              </button>

              <button
                onClick={() => {
                  if (onViewResponses) {
                    onViewResponses(successResults.formId);
                  } else {
                    window.location.hash = 'responses';
                  }
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>View in Event Responses</span>
              </button>
            </div>

            <button
              onClick={handleResetForMore}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Another Batch</span>
            </button>
          </div>
        </div>
      ) : (
        /* The Bulk Entry Grid Form */
        <form onSubmit={handleSubmitBulk} className="space-y-6">
          {/* Target Event Selection Banner */}
          <div className="bg-white rounded-3xl p-5 border border-indigo-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-900 uppercase tracking-wider">
                    Target Event Form *
                  </label>
                  <p className="text-[11px] text-gray-500">
                    All bulk registrations will be saved under responses for this specific event.
                  </p>
                </div>
              </div>

              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full sm:w-80 px-4 py-2 text-xs font-bold bg-indigo-50/70 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-indigo-950 cursor-pointer"
                required
              >
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title} ({f.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Event Overview Pill & Default Batch Church Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {activeForm && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-900">{activeForm.title}</div>
                  {activeForm.eventDate && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-500" />
                      <span>{new Date(activeForm.eventDate).toLocaleString()}</span>
                    </div>
                  )}
                  {activeForm.eventLocation && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 line-clamp-1">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      <span>{activeForm.eventLocation}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Default Batch Church / Ministry Input */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Church className="w-3.5 h-3.5 text-amber-600" />
                  <span>Default Church / Ministry Affiliation</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Grace Chapel, London (auto-fills below)"
                  value={batchChurch}
                  onChange={(e) => handleBatchChurchChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-xl focus:ring-1 focus:ring-amber-500 focus:outline-none text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Attendee Batch Entries Table */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                  Attendee Entry Rows
                </span>
              </div>
              <span className="text-xs text-gray-400 font-semibold">
                {rows.filter((r) => r.fullName.trim() && r.email.trim()).length} valid attendee(s)
              </span>
            </div>

            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3.5 rounded-2xl bg-gray-50 border border-gray-200 items-center transition hover:border-gray-300"
                >
                  <div className="sm:col-span-1 flex items-center justify-between">
                    <span className="w-6 text-center text-xs font-mono font-bold text-gray-400">
                      #{idx + 1}
                    </span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="sm:hidden text-gray-400 hover:text-rose-500 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Full Name */}
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={row.fullName}
                      onChange={(e) => handleRowChange(row.id, 'fullName', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-gray-900"
                      required={idx === 0}
                    />
                  </div>

                  {/* Email */}
                  <div className="sm:col-span-3">
                    <input
                      type="email"
                      placeholder="Email Address *"
                      value={row.email}
                      onChange={(e) => handleRowChange(row.id, 'email', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-gray-900"
                      required={idx === 0}
                    />
                  </div>

                  {/* Phone */}
                  <div className="sm:col-span-2">
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={row.phone}
                      onChange={(e) => handleRowChange(row.id, 'phone', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-gray-900"
                    />
                  </div>

                  {/* Church / Ministry */}
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Church / Ministry"
                      value={row.church}
                      onChange={(e) => handleRowChange(row.id, 'church', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-gray-900 font-medium"
                    />
                  </div>

                  {/* Remove Row Action */}
                  <div className="hidden sm:col-span-1 sm:flex items-center justify-end">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Remove attendee row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Attendee Row</span>
              </button>

              <span className="text-xs text-gray-400">
                Each row receives a unique registration reference & pass.
              </span>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registering Batch...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit All Registrations</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
