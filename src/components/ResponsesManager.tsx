import React, { useState, useEffect } from 'react';
import { FormResponse, EventForm, ResponseStatus } from '../types';
import { dbService } from '../services/db';
import {
  Search,
  Download,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Calendar,
  Mail,
  Phone,
  Ticket,
  ChevronRight,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { TicketPass } from './TicketPass';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../types';

interface ResponsesManagerProps {
  initialFormId?: string | null;
  currentRole?: UserRole;
}

export const ResponsesManager: React.FC<ResponsesManagerProps> = ({
  initialFormId,
  currentRole = 'super_admin',
}) => {
  const { showToast } = useToast();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [forms, setForms] = useState<EventForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>(initialFormId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [responseToDelete, setResponseToDelete] = useState<FormResponse | null>(null);
  const [showPurgeFormConfirm, setShowPurgeFormConfirm] = useState(false);

  const canDelete = currentRole === 'super_admin' || currentRole === 'admin';

  const getAttendeeName = (r: FormResponse) => {
    if (r.fullName && r.fullName !== 'Attendee') return r.fullName;
    const match = Object.entries(r.answers || {}).find(
      ([k, v]) => typeof v === 'string' && v.length > 2 && !v.includes('@') && !v.startsWith('+') && !/^\d+$/.test(v) && v !== 'Yes' && v !== 'No'
    );
    return (match?.[1] as string) || 'Attendee';
  };

  useEffect(() => {
    setLoading(true);
    const unsubForms = dbService.subscribeForms((f) => {
      setForms(f);
    });

    const unsubResponses = dbService.subscribeResponses((r) => {
      setResponses(r);
      setLoading(false);
    }, selectedFormId);

    return () => {
      unsubForms();
      unsubResponses();
    };
  }, [selectedFormId]);

  useEffect(() => {
    if (initialFormId) {
      setSelectedFormId(initialFormId);
    }
  }, [initialFormId]);

  const handleStatusChange = async (responseId: string, newStatus: ResponseStatus) => {
    await dbService.updateResponseStatus(responseId, newStatus);
    showToast(`Status updated to ${newStatus}`, 'success');
    if (selectedResponse && selectedResponse.id === responseId) {
      setSelectedResponse((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const confirmDeleteResponse = async () => {
    if (!responseToDelete) return;
    const name = responseToDelete.fullName;
    await dbService.deleteResponse(responseToDelete.id);
    setResponseToDelete(null);
    if (selectedResponse?.id === responseToDelete.id) {
      setSelectedResponse(null);
    }
    showToast(`Deleted registration for ${name}`, 'info');
  };

  const handlePurgeFormResponses = async () => {
    if (selectedFormId === 'all') return;
    const targetForm = forms.find((f) => f.id === selectedFormId);
    const count = await dbService.deleteResponsesForForm(selectedFormId);
    setShowPurgeFormConfirm(false);
    showToast(`Purged ${count} responses for "${targetForm?.title}"`, 'info');
  };

  const getChurchName = (r: FormResponse) => {
    if (r.answers && r.answers['Church / Ministry']) return r.answers['Church / Ministry'];
    const match = Object.entries(r.answers || {}).find(
      ([k, v]) => k.toLowerCase().includes('church') || k.toLowerCase().includes('ministry')
    );
    return (match?.[1] as string) || '';
  };

  // Export to CSV
  const handleExportCSV = () => {
    const dataToExport = filteredResponses;
    if (dataToExport.length === 0) {
      showToast('No responses to export.', 'error');
      return;
    }

    const headers = [
      'Reference',
      'Event Form',
      'Full Name',
      'Attendee Type',
      'Parent Reference',
      'Email',
      'Phone',
      'Church / Ministry',
      'Status',
      'Checked In',
      'Checked In At',
      'Agent',
      'Registration Date',
    ];

    const rows = dataToExport.map((r) => [
      `"${r.reference}"`,
      `"${r.formTitle.replace(/"/g, '""')}"`,
      `"${getAttendeeName(r).replace(/"/g, '""')}"`,
      `"${r.parent_registration_id ? 'Child / Dependent' : 'Primary Registrant'}"`,
      `"${r.parent_registration_id || ''}"`,
      `"${r.email}"`,
      `"${r.phone || ''}"`,
      `"${getChurchName(r).replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.checkedIn ? 'Yes' : 'No'}"`,
      `"${r.checkedInAt || ''}"`,
      `"${r.agentName || 'Public'}"`,
      `"${new Date(r.createdAt).toISOString()}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const activeForm = forms.find((f) => f.id === selectedFormId);
    const filename = activeForm
      ? `${activeForm.slug}-responses-${new Date().toISOString().slice(0, 10)}.csv`
      : `eventform-all-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${dataToExport.length} responses to CSV`, 'success');
  };

  const filteredResponses = responses.filter((r) => {
    const matchesForm = selectedFormId === 'all' || r.formId === selectedFormId;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const churchVal = getChurchName(r).toLowerCase();
    const matchesSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone && r.phone.toLowerCase().includes(search.toLowerCase())) ||
      churchVal.includes(search.toLowerCase()) ||
      r.reference.toLowerCase().includes(search.toLowerCase());

    return matchesForm && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Registration Responses
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {canDelete
              ? 'Manage registrations, verify attendee details, export CSV data, or delete records.'
              : 'View attendee registrations, verify delegate status, and export CSV lists.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && selectedFormId !== 'all' && (
            <button
              onClick={() => setShowPurgeFormConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Purge Event Records
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-2xl text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            Export CSV ({filteredResponses.length})
          </button>
        </div>
      </div>

      {/* Control Bar: Form Selector, Status Filter, Search */}
      <div className="bg-white p-3 sm:p-4 rounded-3xl border border-gray-200/90 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Form Filter Dropdown */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <span className="text-xs font-bold text-gray-500">Filter Event:</span>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:ring-indigo-500 text-gray-800"
            >
              <option value="all">All Events ({responses.length} total)</option>
              {forms.map((f) => {
                const count = responses.filter((r) => r.formId === f.id).length;
                return (
                  <option key={f.id} value={f.id}>
                    {f.title} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {['all', 'confirmed', 'attended', 'pending', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Responses Table / Card Layout */}
      {loading ? (
        <div className="py-16 text-center text-xs text-gray-400 font-medium">
          Loading responses...
        </div>
      ) : filteredResponses.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No responses match your filters</h3>
          <p className="text-xs text-gray-500 mt-1">
            {search
              ? 'Try clearing your search query or switching form filter.'
              : 'No registrations have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-extrabold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Attendee</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredResponses.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 font-mono font-black text-indigo-700">
                      {r.reference}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-gray-900">{getAttendeeName(r)}</span>
                        {r.parent_registration_id ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Child ({r.parent_registration_id})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-gray-500 font-medium">{r.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-gray-700 line-clamp-1">{r.formTitle}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.checkedIn ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3" /> Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={r.status}
                        onChange={(e) => handleStatusChange(r.id, e.target.value as ResponseStatus)}
                        className={`text-[11px] font-bold rounded-xl px-2.5 py-1 border transition cursor-pointer ${
                          r.status === 'attended'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.status === 'confirmed'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : r.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="attended">Attended</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap font-medium">
                      {new Date(r.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedResponse(r)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition cursor-pointer mr-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>

                      {/* Delete Response Button (Admin Only) */}
                      {canDelete && (
                        <button
                          onClick={() => setResponseToDelete(r)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Delete Response Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Response Details Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                  {selectedResponse.reference}
                </span>
                <h2 className="text-xl font-black text-gray-900 mt-1">
                  {getAttendeeName(selectedResponse)}
                </h2>
                <p className="text-xs text-gray-500">{selectedResponse.formTitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResponseToDelete(selectedResponse)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedResponse(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Ticket Pass View */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Digital Pass & QR Code
              </div>
              <TicketPass
                response={selectedResponse}
                form={forms.find((f) => f.id === selectedResponse.formId)}
              />
            </div>

            {/* Linked Dependents / Additional Attendees Expansion */}
            {(() => {
              const dependentsList = responses.filter(
                (r) => r.parent_registration_id === selectedResponse.reference || r.parent_registration_id === selectedResponse.id
              );
              const totalCount = 1 + dependentsList.length;

              return (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                        Linked Attendees ({totalCount} Total under Main Registrant)
                      </h4>
                      <p className="text-[11px] text-indigo-700">
                        Primary registrant and associated family members or guests.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                      {totalCount} Attendees
                    </span>
                  </div>

                  {dependentsList.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-indigo-200/60">
                      {dependentsList.map((dep, dIdx) => (
                        <div key={dep.id} className="bg-white p-3 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-600">{dep.reference}</span>
                              <span className="font-bold text-gray-900">Guest #{dIdx + 1}: {dep.fullName}</span>
                            </div>
                            <div className="text-[11px] text-gray-500">{dep.email} {dep.phone ? `• ${dep.phone}` : ''}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            {dep.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Complete Answers List */}
            <div>
              <h3 className="text-sm font-black text-gray-900 mb-3">Submitted Answers</h3>
              <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                {Object.entries(selectedResponse.answers || {}).map(([key, val]) => {
                  const formForResp = forms.find((f) => f.id === selectedResponse.formId);
                  const matchedQuestion = formForResp?.questions.find((q) => q.id === key);
                  const questionTitle = matchedQuestion ? matchedQuestion.title : key;

                  return (
                    <div key={key} className="text-xs border-b border-gray-200/60 pb-2 last:border-0 last:pb-0">
                      <span className="font-semibold text-gray-500 block text-[11px]">{questionTitle}</span>
                      <span className="font-bold text-gray-800">
                        {Array.isArray(val) ? val.join(', ') : String(val || '-')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Check-in Status & Actions */}
            <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-700">Attendance Status</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {selectedResponse.checkedIn
                    ? `Checked in at ${new Date(selectedResponse.checkedInAt || '').toLocaleTimeString()} by ${selectedResponse.checkedInBy || 'Staff'}`
                    : 'Awaiting venue arrival'}
                </div>
              </div>

              <div className="flex gap-2">
                {!selectedResponse.checkedIn ? (
                  <button
                    onClick={() => handleStatusChange(selectedResponse.id, 'attended')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Check In Now
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusChange(selectedResponse.id, 'confirmed')}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Reset Check-In
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Response */}
      {responseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-gray-900">Delete Registration?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Are you sure you want to delete the registration for{' '}
                <strong className="text-gray-800">"{responseToDelete.fullName}"</strong> (Ref: {responseToDelete.reference})? This cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResponseToDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteResponse}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Purging Event Responses */}
      {showPurgeFormConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-gray-900">Purge Event Responses?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Are you sure you want to delete all <strong className="text-gray-900">{filteredResponses.length}</strong> attendee registration records for this event form? This cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPurgeFormConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeFormResponses}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Yes, Purge Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
