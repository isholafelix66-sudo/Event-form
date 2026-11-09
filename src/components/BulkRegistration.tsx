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
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useToast } from '../context/ToastContext';

interface BulkRegistrationProps {
  currentAgentName?: string;
  currentAgentId?: string;
}

interface QuickAttendeeRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes?: string;
}

export const BulkRegistration: React.FC<BulkRegistrationProps> = ({
  currentAgentName = 'Agent Sarah',
  currentAgentId = 'agent-1',
}) => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [rows, setRows] = useState<QuickAttendeeRow[]>([
    { id: '1', fullName: '', email: '', phone: '' },
    { id: '2', fullName: '', email: '', phone: '' },
    { id: '3', fullName: '', email: '', phone: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResults, setSuccessResults] = useState<FormResponse[] | null>(null);

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

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { id: String(Date.now()), fullName: '', email: '', phone: '' },
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
    const validRows = rows.filter((r) => r.fullName.trim() !== '' && r.email.trim() !== '');

    if (validRows.length === 0) {
      showToast('Please fill in at least one attendee with a Name and Email.', 'error');
      return;
    }

    const form = forms.find((f) => f.id === selectedFormId);
    if (!form) return;

    setIsSubmitting(true);
    const createdResponses: FormResponse[] = [];

    try {
      for (const row of validRows) {
        const answers: Record<string, any> = {
          'Full Name': row.fullName,
          'Email': row.email,
          'Phone': row.phone,
          'Registration Mode': 'Desk Registration Agent',
          'Agent Notes': row.notes || 'Bulk Registration Desk',
        };

        const { response } = await dbService.submitResponse(form, answers, {
          agentId: currentAgentId,
          agentName: currentAgentName,
        });
        createdResponses.push(response);
      }

      setSuccessResults(createdResponses);
      confetti({
        particleCount: 80,
        spread: 60,
      });
      showToast(`Registered ${createdResponses.length} attendees successfully! Confirmation emails sent.`, 'success');
    } catch (err) {
      console.error('Bulk registration error', err);
      showToast('Failed to register attendees.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForMore = () => {
    setRows([
      { id: '1', fullName: '', email: '', phone: '' },
      { id: '2', fullName: '', email: '', phone: '' },
    ]);
    setSuccessResults(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
            <UserCheck className="w-4 h-4" />
            Registration Agent Desk Mode
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Bulk On-Site Registration
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Fast multi-attendee registration for event reception desks, church entrances, and group bookings.
          </p>
        </div>

        {/* Agent attribution badge */}
        <div className="bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-2xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
            {currentAgentName.charAt(0)}
          </div>
          <div>
            <div className="text-[11px] font-bold text-indigo-950">Active Agent</div>
            <div className="text-xs font-semibold text-indigo-700">{currentAgentName}</div>
          </div>
        </div>
      </div>

      {successResults ? (
        /* Results Table / Summary */
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-5">
          <div className="text-center py-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-emerald-950">
              Successfully Registered {successResults.length} Attendees!
            </h2>
            <p className="text-xs text-emerald-700 mt-1">
              All records have been saved as independent entries under agent <span className="font-semibold">{currentAgentName}</span>.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[10px] border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5">Ref Pass</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {successResults.map((res) => (
                  <tr key={res.id}>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                      {res.reference}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{res.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{res.email}</td>
                    <td className="px-4 py-3 text-gray-600">{res.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                        CONFIRMED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Batch Slips
            </button>

            <button
              onClick={handleResetForMore}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Register Another Batch
            </button>
          </div>
        </div>
      ) : (
        /* The Bulk Entry Grid Form */
        <form onSubmit={handleSubmitBulk} className="space-y-5">
          {/* Form Selection */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Select Event:</span>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title} ({f.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-gray-500">
              Each row creates an individual QR reference code.
            </div>
          </div>

          {/* Rows List */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Attendee Batch Entries
            </div>

            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div
                  key={row.id}
                  className="flex flex-col sm:flex-row items-center gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-200"
                >
                  <span className="w-6 text-center text-xs font-bold text-gray-400">
                    #{idx + 1}
                  </span>

                  <input
                    type="text"
                    placeholder="Full Name *"
                    value={row.fullName}
                    onChange={(e) => handleRowChange(row.id, 'fullName', e.target.value)}
                    className="flex-1 w-full sm:w-auto px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    required={idx === 0}
                  />

                  <input
                    type="email"
                    placeholder="Email Address *"
                    value={row.email}
                    onChange={(e) => handleRowChange(row.id, 'email', e.target.value)}
                    className="flex-1 w-full sm:w-auto px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    required={idx === 0}
                  />

                  <input
                    type="tel"
                    placeholder="Phone"
                    value={row.phone}
                    onChange={(e) => handleRowChange(row.id, 'phone', e.target.value)}
                    className="w-full sm:w-36 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />

                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={row.notes || ''}
                    onChange={(e) => handleRowChange(row.id, 'notes', e.target.value)}
                    className="w-full sm:w-44 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-gray-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Another Row
              </button>

              <div className="text-xs text-gray-400">
                {rows.filter((r) => r.fullName && r.email).length} valid attendee(s) ready
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering Batch...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit All Registrations
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
