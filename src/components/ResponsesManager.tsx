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
  AlertTriangle,
  UserPlus,
  Plus,
  Building,
  RefreshCw,
  Link2,
  Link,
  Unlink,
  CheckSquare,
  Square,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
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

  // Add Response & Child under Parent Modal State
  const [showAddResponseModal, setShowAddResponseModal] = useState(false);
  const [modalFormId, setModalFormId] = useState<string>('');
  const [modalParentRef, setModalParentRef] = useState<string>('');
  const [isUnderParent, setIsUnderParent] = useState<boolean>(false);
  const [modalName, setModalName] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalPhone, setModalPhone] = useState('');
  const [modalChurch, setModalChurch] = useState('');
  const [modalCustomAnswers, setModalCustomAnswers] = useState<Record<string, any>>({});
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [createdPassResponse, setCreatedPassResponse] = useState<FormResponse | null>(null);

  const getChurchName = (r: FormResponse) => {
    if (r.answers && r.answers['Church / Ministry']) return r.answers['Church / Ministry'];
    const match = Object.entries(r.answers || {}).find(
      ([k, v]) => k.toLowerCase().includes('church') || k.toLowerCase().includes('ministry')
    );
    return (match?.[1] as string) || '';
  };

  const getAttendeeName = (r: FormResponse) => {
    if (r.fullName && r.fullName !== 'Attendee') return r.fullName;
    const match = Object.entries(r.answers || {}).find(
      ([k, v]) => typeof v === 'string' && v.length > 2 && !v.includes('@') && !v.startsWith('+') && !/^\d+$/.test(v) && v !== 'Yes' && v !== 'No'
    );
    return (match?.[1] as string) || 'Attendee';
  };

  // Change Parent / Reassign Relationship State (for existing records without opening new forms)
  const [showChangeParentModal, setShowChangeParentModal] = useState(false);
  const [parentModalTarget, setParentModalTarget] = useState<FormResponse | null>(null);
  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);
  const [targetParentReference, setTargetParentReference] = useState('');
  const [parentActionType, setParentActionType] = useState<'link' | 'unlink'>('link');
  const [syncChurchWithParent, setSyncChurchWithParent] = useState(true);
  const [parentPickerSearch, setParentPickerSearch] = useState('');
  const [isUpdatingParent, setIsUpdatingParent] = useState(false);

  const handleOpenAddResponseModal = (defaultParentRef?: string) => {
    const targetFormId = selectedFormId !== 'all' ? selectedFormId : (forms[0]?.id || '');
    setModalFormId(targetFormId);
    setModalParentRef(defaultParentRef || '');
    setIsUnderParent(!!defaultParentRef);
    setModalName('');
    setModalEmail('');
    setModalPhone('');
    
    if (defaultParentRef) {
      const parent = responses.find((r) => r.reference === defaultParentRef || r.id === defaultParentRef);
      if (parent) {
        setModalChurch(getChurchName(parent));
      } else {
        setModalChurch('');
      }
    } else {
      setModalChurch('');
    }
    
    setModalCustomAnswers({});
    setCreatedPassResponse(null);
    setShowAddResponseModal(true);
  };

  const handleOpenAddChildUnderParent = (parent: FormResponse) => {
    setModalFormId(parent.formId);
    setModalParentRef(parent.reference);
    setIsUnderParent(true);
    setModalName('');
    setModalEmail('');
    setModalPhone('');
    setModalChurch(getChurchName(parent));
    setModalCustomAnswers({});
    setCreatedPassResponse(null);
    setShowAddResponseModal(true);
  };

  const handleOpenChangeParentSingle = (r: FormResponse) => {
    setParentModalTarget(r);
    setSelectedResponseIds([r.id]);
    setTargetParentReference(r.parent_registration_id || '');
    setParentActionType('link');
    setSyncChurchWithParent(true);
    setParentPickerSearch('');
    setShowChangeParentModal(true);
  };

  const handleOpenChangeParentBatch = () => {
    if (selectedResponseIds.length === 0) return;
    setParentModalTarget(null);
    setTargetParentReference('');
    setParentActionType('link');
    setSyncChurchWithParent(true);
    setParentPickerSearch('');
    setShowChangeParentModal(true);
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedResponseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (allIds: string[]) => {
    if (selectedResponseIds.length === allIds.length && allIds.length > 0) {
      setSelectedResponseIds([]);
    } else {
      setSelectedResponseIds(allIds);
    }
  };

  const handleSaveParentChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedResponseIds.length === 0) return;

    const parentRefToSet = parentActionType === 'unlink' ? null : targetParentReference.trim().toUpperCase();

    if (parentActionType === 'link') {
      if (!parentRefToSet) {
        showToast('Please select or enter a valid parent registration reference.', 'error');
        return;
      }

      if (parentModalTarget && (parentModalTarget.reference.toUpperCase() === parentRefToSet || parentModalTarget.id === parentRefToSet)) {
        showToast('An attendee cannot be set as their own parent.', 'error');
        return;
      }
    }

    setIsUpdatingParent(true);
    try {
      await dbService.batchUpdateResponsesParent(
        selectedResponseIds,
        parentRefToSet,
        parentActionType === 'link' ? syncChurchWithParent : false
      );

      // Instantly update responses in local state
      setResponses((prev) =>
        prev.map((item) => {
          if (!selectedResponseIds.includes(item.id)) return item;
          const updatedAnswers = { ...(item.answers || {}) };
          if (parentRefToSet) {
            updatedAnswers['parent_registration_id'] = parentRefToSet;
            updatedAnswers['Main Registrant Parent'] = parentRefToSet;
            updatedAnswers['Registration Type'] = 'Child / Dependent';
            if (syncChurchWithParent) {
              const p = responses.find(
                (x) => x.reference.toUpperCase() === parentRefToSet || x.id === parentRefToSet
              );
              if (p) {
                const church = getChurchName(p);
                if (church) updatedAnswers['Church / Ministry'] = church;
              }
            }
          } else {
            delete updatedAnswers['parent_registration_id'];
            delete updatedAnswers['Main Registrant Parent'];
            if (updatedAnswers['Registration Type'] === 'Child / Dependent') {
              delete updatedAnswers['Registration Type'];
            }
          }
          return {
            ...item,
            parent_registration_id: parentRefToSet || undefined,
            answers: updatedAnswers,
          };
        })
      );

      // Also update selectedResponse if currently displayed in details modal
      if (selectedResponse && selectedResponseIds.includes(selectedResponse.id)) {
        setSelectedResponse((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            parent_registration_id: parentRefToSet || undefined,
          };
        });
      }

      confetti({
        particleCount: 60,
        spread: 55,
      });

      const count = selectedResponseIds.length;
      if (parentActionType === 'unlink') {
        showToast(
          count === 1
            ? `Attendee unlinked. Now an independent primary account.`
            : `${count} attendees unlinked to independent primary accounts.`,
          'success'
        );
      } else {
        showToast(
          count === 1
            ? `Successfully assigned as child under parent ${parentRefToSet}!`
            : `Successfully assigned ${count} attendees as children under parent ${parentRefToSet}!`,
          'success'
        );
      }

      setShowChangeParentModal(false);
      setSelectedResponseIds([]);
    } catch (err) {
      console.error('Failed to change parent relationship:', err);
      showToast('Failed to update registration relationship.', 'error');
    } finally {
      setIsUpdatingParent(false);
    }
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

  const handleCreateResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetForm = forms.find((f) => f.id === modalFormId);
    if (!targetForm) {
      showToast('Please select a valid event form.', 'error');
      return;
    }

    if (!modalName.trim()) {
      showToast('Please enter the attendee full name.', 'error');
      return;
    }
    if (!modalEmail.trim() || !modalEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    if (isUnderParent && !modalParentRef.trim()) {
      showToast('Please select or specify the parent registration reference.', 'error');
      return;
    }

    setIsSubmittingResponse(true);
    try {
      const answers: Record<string, any> = {
        ...modalCustomAnswers,
        'Full Name': modalName.trim(),
        'Email': modalEmail.trim(),
        'Phone': modalPhone.trim(),
      };

      if (modalChurch.trim()) {
        answers['Church / Ministry'] = modalChurch.trim();
        const churchQ = targetForm.questions.find(
          (q) => q.title.toLowerCase().includes('church') || q.title.toLowerCase().includes('ministry')
        );
        if (churchQ) {
          answers[churchQ.id] = modalChurch.trim();
        }
      }

      // Populate matching form question IDs for name, email, phone if defined
      const nameQ = targetForm.questions.find(
        (q) => q.title.toLowerCase().includes('name') && q.type === 'short_answer'
      );
      if (nameQ && !answers[nameQ.id]) {
        answers[nameQ.id] = modalName.trim();
      }

      const emailQ = targetForm.questions.find(
        (q) => q.type === 'email' || q.title.toLowerCase().includes('email')
      );
      if (emailQ && !answers[emailQ.id]) {
        answers[emailQ.id] = modalEmail.trim();
      }

      const phoneQ = targetForm.questions.find(
        (q) => q.type === 'phone' || q.title.toLowerCase().includes('phone')
      );
      if (phoneQ && modalPhone.trim() && !answers[phoneQ.id]) {
        answers[phoneQ.id] = modalPhone.trim();
      }

      const parentRefClean = isUnderParent && modalParentRef.trim() ? modalParentRef.trim().toUpperCase() : undefined;
      if (parentRefClean) {
        answers['parent_registration_id'] = parentRefClean;
        answers['Main Registrant Parent'] = parentRefClean;
        answers['Registration Type'] = 'Child / Dependent';
      }

      const { response: newResp } = await dbService.submitResponse(
        targetForm,
        answers,
        {
          agentName: 'Admin Officer',
          parent_registration_id: parentRefClean,
        }
      );

      confetti({
        particleCount: 75,
        spread: 60,
      });

      showToast(
        parentRefClean
          ? `Successfully registered ${newResp.fullName} under parent ${parentRefClean}!`
          : `Successfully registered ${newResp.fullName}!`,
        'success'
      );

      setCreatedPassResponse(newResp);
    } catch (err) {
      console.error('Failed to create response:', err);
      showToast('Failed to save registration response.', 'error');
    } finally {
      setIsSubmittingResponse(false);
    }
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

        <div className="flex flex-wrap items-center gap-2">
          {canDelete && (
            <button
              onClick={() => handleOpenAddResponseModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Response</span>
            </button>
          )}

          {canDelete && selectedFormId !== 'all' && (
            <button
              onClick={() => setShowPurgeFormConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition cursor-pointer"
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
        <div className="space-y-3">
          {/* Batch Selection Action Bar */}
          {selectedResponseIds.length > 0 && (
            <div className="bg-indigo-950 text-white rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg border border-indigo-800 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                  {selectedResponseIds.length}
                </span>
                <span className="text-xs font-bold text-indigo-100">
                  {selectedResponseIds.length} attendee{selectedResponseIds.length > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenChangeParentBatch}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Assign all selected attendees as children under an existing parent account"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Assign as Child under Parent</span>
                </button>
                <button
                  onClick={() => {
                    setParentModalTarget(null);
                    setParentActionType('unlink');
                    setTargetParentReference('');
                    setShowChangeParentModal(true);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-indigo-100 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Unlink selected attendees to become independent primary registrants"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Unlink (Make Primary)</span>
                </button>
                <button
                  onClick={() => setSelectedResponseIds([])}
                  className="text-indigo-300 hover:text-white text-xs font-semibold px-2 py-1 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-extrabold text-[10px]">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredResponses.length > 0 &&
                          filteredResponses.every((r) => selectedResponseIds.includes(r.id))
                        }
                        onChange={() =>
                          handleToggleSelectAll(filteredResponses.map((r) => r.id))
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        title="Select All"
                      />
                    </th>
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
                  {filteredResponses.map((r) => {
                    const isSelected = selectedResponseIds.includes(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={`transition ${
                          isSelected ? 'bg-indigo-50/50 hover:bg-indigo-50/80' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(r.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-mono font-black text-indigo-700">
                          {r.reference}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-gray-900">{getAttendeeName(r)}</span>
                            {r.parent_registration_id ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenChangeParentSingle(r);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
                                title="Click to change parent account or unlink"
                              >
                                <Link2 className="w-2.5 h-2.5" />
                                <span>Child ({r.parent_registration_id})</span>
                              </button>
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
                          {/* Reassign / Change Parent Button (Admin Only) */}
                          {canDelete && (
                            <button
                              onClick={() => handleOpenChangeParentSingle(r)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer mr-1 ${
                                r.parent_registration_id
                                  ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
                                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                              }`}
                              title={
                                r.parent_registration_id
                                  ? 'Change which parent this child belongs to, or unlink to primary'
                                  : 'Change this existing attendee to be a child under someone'
                              }
                            >
                              <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{r.parent_registration_id ? 'Change Parent' : 'Link to Parent'}</span>
                            </button>
                          )}

                          {/* Quick Add Child Button (Admin Only - for primary registrants) */}
                          {canDelete && !r.parent_registration_id && (
                            <button
                              onClick={() => handleOpenAddChildUnderParent(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer mr-1"
                              title="Register a new child or dependent under this attendee"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>+ Child</span>
                            </button>
                          )}

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
                    );
                  })}
                </tbody>
              </table>
            </div>
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

            {/* Account Relationship & Parent Assignment (Change without opening form) */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                      Account Relationship
                    </span>
                    {selectedResponse.parent_registration_id ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Child / Dependent Account
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Primary Account
                      </span>
                    )}
                  </div>

                  {selectedResponse.parent_registration_id ? (
                    <p className="text-xs text-gray-700 mt-1">
                      Currently linked as a child under Parent:{' '}
                      <strong className="font-mono text-indigo-700 font-bold">
                        {selectedResponse.parent_registration_id}
                      </strong>
                      {(() => {
                        const parentObj = responses.find(
                          (x) =>
                            x.reference.toUpperCase() ===
                              selectedResponse.parent_registration_id?.toUpperCase() ||
                            x.id === selectedResponse.parent_registration_id
                        );
                        return parentObj
                          ? ` (${parentObj.fullName} • ${getChurchName(parentObj)})`
                          : '';
                      })()}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      This registration is currently an independent primary account.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenChangeParentSingle(selectedResponse)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>
                      {selectedResponse.parent_registration_id
                        ? 'Change Parent'
                        : 'Change to Child under Someone'}
                    </span>
                  </button>
                  {selectedResponse.parent_registration_id && (
                    <button
                      onClick={() => {
                        setSelectedResponseIds([selectedResponse.id]);
                        setParentModalTarget(selectedResponse);
                        setParentActionType('unlink');
                        setTargetParentReference('');
                        setShowChangeParentModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Unlink (Make Primary)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Linked Dependents / Additional Attendees Expansion */}
            {(() => {
              const dependentsList = responses.filter(
                (r) => r.parent_registration_id === selectedResponse.reference || r.parent_registration_id === selectedResponse.id
              );
              const totalCount = 1 + dependentsList.length;

              return (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                        Linked Attendees ({totalCount} Total under Main Registrant)
                      </h4>
                      <p className="text-[11px] text-indigo-700">
                        Primary registrant and associated family members or guests.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                        {totalCount} Attendees
                      </span>
                      {canDelete && (
                        <button
                          onClick={() => handleOpenAddChildUnderParent(selectedResponse)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Add Child</span>
                        </button>
                      )}
                    </div>
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

      {/* Modal: Add Response / Register under a Parent */}
      {showAddResponseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                    isUnderParent ? 'bg-emerald-600' : 'bg-indigo-600'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">
                    {isUnderParent ? 'Add Child / Dependent Registration' : 'Add Registration Response'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isUnderParent
                      ? modalParentRef
                        ? `Registered under Parent: ${modalParentRef}`
                        : 'Register a child or family member linked to a parent account'
                      : 'Manually register an attendee under an event form'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddResponseModal(false);
                  setCreatedPassResponse(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: If pass already created, show TicketPass; else show Form */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {createdPassResponse ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-black text-emerald-950">
                          Registration Response Created Successfully!
                        </div>
                        <div className="text-[11px] text-emerald-800">
                          {createdPassResponse.parent_registration_id ? (
                            <>
                              Linked under Parent:{' '}
                              <strong className="font-mono">
                                {createdPassResponse.parent_registration_id}
                              </strong>
                            </>
                          ) : (
                            'Primary delegate pass generated.'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <TicketPass
                    response={createdPassResponse}
                    form={forms.find((f) => f.id === createdPassResponse.formId)}
                  />

                  <div className="pt-2 flex flex-wrap gap-2">
                    {isUnderParent && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalName('');
                          setModalEmail('');
                          setModalPhone('');
                          setModalCustomAnswers({});
                          setCreatedPassResponse(null);
                        }}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Another Child under This Parent</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddResponseModal(false);
                        setCreatedPassResponse(null);
                      }}
                      className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateResponseSubmit} className="space-y-4">
                  {/* Event Form Selector */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Event Form *
                    </label>
                    <select
                      value={modalFormId}
                      onChange={(e) => {
                        setModalFormId(e.target.value);
                      }}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 cursor-pointer"
                      required
                    >
                      {forms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.title} ({f.slug})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Register under Parent Toggle */}
                  <div className="p-3.5 bg-slate-50 border border-gray-200 rounded-2xl space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isUnderParent}
                        onChange={(e) => {
                          setIsUnderParent(e.target.checked);
                          if (!e.target.checked) {
                            setModalParentRef('');
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Register under an Existing Parent / Primary Registrant</span>
                      </span>
                    </label>

                    {isUnderParent && (
                      <div className="space-y-2.5 pt-2 border-t border-gray-200/80">
                        {/* Parent Dropdown / Auto-complete */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                            Select Parent Registrant for this Form
                          </label>
                          <select
                            value={modalParentRef}
                            onChange={(e) => {
                              const ref = e.target.value;
                              setModalParentRef(ref);
                              if (ref) {
                                const found = responses.find((r) => r.reference === ref || r.id === ref);
                                if (found) {
                                  const church = getChurchName(found);
                                  if (church && !modalChurch) {
                                    setModalChurch(church);
                                  }
                                }
                              }
                            }}
                            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 cursor-pointer"
                          >
                            <option value="">-- Choose Existing Registrant as Parent --</option>
                            {responses
                              .filter((r) => r.formId === modalFormId)
                              .map((p) => {
                                const church = getChurchName(p);
                                return (
                                  <option key={p.id} value={p.reference}>
                                    {p.fullName} ({p.reference}) {church ? `• ${church}` : ''}
                                  </option>
                                );
                              })}
                          </select>
                        </div>

                        {/* Or Manual Parent Reference Input */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                            Or Type / Paste Parent Registration Reference (e.g. EVT-2026-W301)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. EVT-2026-W301"
                            value={modalParentRef}
                            onChange={(e) => {
                              const ref = e.target.value.toUpperCase();
                              setModalParentRef(ref);
                              const found = responses.find((r) => r.reference.toUpperCase() === ref.trim());
                              if (found) {
                                const church = getChurchName(found);
                                if (church && !modalChurch) {
                                  setModalChurch(church);
                                }
                              }
                            }}
                            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-gray-900 tracking-wider"
                            required={isUnderParent}
                          />
                        </div>

                        {modalParentRef &&
                          (() => {
                            const matched = responses.find(
                              (r) => r.reference === modalParentRef || r.id === modalParentRef
                            );
                            return (
                              <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-[11px] text-indigo-900">
                                <span className="font-bold">Linked Parent:</span>{' '}
                                {matched ? (
                                  <span>
                                    {matched.fullName} ({matched.reference}){' '}
                                    {getChurchName(matched) ? `• Church: ${getChurchName(matched)}` : ''}
                                  </span>
                                ) : (
                                  <span className="font-mono">{modalParentRef}</span>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    )}
                  </div>

                  {/* Primary Attendee Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Samuel Adebayo"
                        value={modalName}
                        onChange={(e) => setModalName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="samuel@example.com"
                        value={modalEmail}
                        onChange={(e) => setModalEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+44 7911 123456"
                        value={modalPhone}
                        onChange={(e) => setModalPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Church / Ministry</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Grace Chapel"
                        value={modalChurch}
                        onChange={(e) => setModalChurch(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                      />
                    </div>
                  </div>

                  {/* Dynamic Questions for the target event form */}
                  {(() => {
                    const currentTargetForm = forms.find((f) => f.id === modalFormId);
                    if (!currentTargetForm) return null;

                    const extraQuestions = currentTargetForm.questions.filter((q) => {
                      const t = q.title.toLowerCase();
                      if (t.includes('name') && q.type === 'short_answer') return false;
                      if (q.type === 'email' || t.includes('email')) return false;
                      if (q.type === 'phone' || t.includes('phone')) return false;
                      if (t.includes('church') || t.includes('ministry')) return false;
                      if (q.type === 'section_header') return false;
                      return true;
                    });

                    if (extraQuestions.length === 0) return null;

                    return (
                      <div className="space-y-3 pt-3 border-t border-gray-100">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          Additional Event Form Questions
                        </div>

                        {extraQuestions.map((q) => (
                          <div key={q.id}>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              {q.title} {q.required && <span className="text-rose-500">*</span>}
                            </label>

                            {q.type === 'dropdown' && (
                              <select
                                value={modalCustomAnswers[q.id] || ''}
                                onChange={(e) =>
                                  setModalCustomAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 text-gray-800"
                                required={q.required}
                              >
                                <option value="">-- Select option --</option>
                                {(q.options || []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            )}

                            {q.type === 'multiple_choice' && (
                              <div className="space-y-1.5">
                                {(q.options || []).map((opt) => (
                                  <label
                                    key={opt}
                                    className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name={`modal_${q.id}`}
                                      checked={modalCustomAnswers[q.id] === opt}
                                      onChange={() =>
                                        setModalCustomAnswers((prev) => ({
                                          ...prev,
                                          [q.id]: opt,
                                        }))
                                      }
                                      className="text-indigo-600 focus:ring-indigo-500"
                                      required={q.required && !modalCustomAnswers[q.id]}
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.type === 'yes_no' && (
                              <div className="flex gap-2">
                                {['Yes', 'No'].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() =>
                                      setModalCustomAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: opt,
                                      }))
                                    }
                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                      modalCustomAnswers[q.id] === opt
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            )}

                            {(q.type === 'short_answer' ||
                              q.type === 'number' ||
                              q.type === 'date') && (
                              <input
                                type={
                                  q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'
                                }
                                placeholder={q.placeholder || 'Your answer'}
                                value={modalCustomAnswers[q.id] || ''}
                                onChange={(e) =>
                                  setModalCustomAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 text-gray-800"
                                required={q.required}
                              />
                            )}

                            {q.type === 'paragraph' && (
                              <textarea
                                rows={2}
                                placeholder={q.placeholder || 'Your answer'}
                                value={modalCustomAnswers[q.id] || ''}
                                onChange={(e) =>
                                  setModalCustomAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 text-gray-800"
                                required={q.required}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="pt-3 border-t border-gray-100 flex gap-2.5 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddResponseModal(false)}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingResponse}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSubmittingResponse ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Create Registration & Pass</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change / Assign Parent Modal (Without opening new form) */}
      {showChangeParentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                    <Link2 className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-black text-gray-900">
                    {parentModalTarget
                      ? `Change Parent for ${getAttendeeName(parentModalTarget)}`
                      : `Assign Parent for ${selectedResponseIds.length} Selected Attendees`}
                  </h2>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Reassign existing registration records to a parent account, change parent, or unlink to primary without creating a new form.
                </p>
              </div>
              <button
                onClick={() => setShowChangeParentModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer font-bold shrink-0 ml-2"
              >
                ✕
              </button>
            </div>

            {/* Current Target Status Overview */}
            {parentModalTarget ? (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {parentModalTarget.reference}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {parentModalTarget.formTitle}
                  </span>
                </div>
                <div className="font-bold text-gray-900 text-sm">{getAttendeeName(parentModalTarget)}</div>
                <div className="text-gray-500 text-[11px]">{parentModalTarget.email}</div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                  <span className="text-gray-500 font-semibold">Current Relationship:</span>
                  {parentModalTarget.parent_registration_id ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      Child under {parentModalTarget.parent_registration_id}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Independent Primary Registrant
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs">
                <div className="font-bold text-gray-900">
                  {selectedResponseIds.length} Registrations Selected
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  All selected registrations will be updated together with the chosen parent relationship.
                </p>
              </div>
            )}

            {/* Action Type Selection (Link vs Unlink) */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setParentActionType('link')}
                className={`p-3 rounded-2xl text-left border transition cursor-pointer ${
                  parentActionType === 'link'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-2xs'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Link as Child</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Assign under an existing parent account
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setParentActionType('unlink');
                  setTargetParentReference('');
                }}
                className={`p-3 rounded-2xl text-left border transition cursor-pointer ${
                  parentActionType === 'unlink'
                    ? 'border-rose-500 bg-rose-50/70 text-rose-900 shadow-2xs'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Unlink className="w-3.5 h-3.5 text-rose-600" />
                  <span>Unlink (Make Primary)</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Set as independent primary registrant
                </p>
              </button>
            </div>

            {/* Link Mode Controls */}
            {parentActionType === 'link' && (
              <div className="space-y-3.5 pt-1">
                {/* Search Parent Candidates */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Select Existing Parent Registrant *
                  </label>
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search parent by name, code (EVT-2026-...), church, or email..."
                      value={parentPickerSearch}
                      onChange={(e) => setParentPickerSearch(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                    />
                  </div>

                  {/* Candidate List Box */}
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-2xl p-2 space-y-1.5 bg-gray-50/50">
                    {(() => {
                      const candidates = responses.filter((candidate) => {
                        // Cannot be parent to yourself or self selection
                        if (selectedResponseIds.includes(candidate.id)) return false;
                        if (selectedResponseIds.includes(candidate.reference)) return false;
                        if (parentModalTarget && (candidate.id === parentModalTarget.id || candidate.reference === parentModalTarget.reference)) {
                          return false;
                        }
                        // Avoid circular loops: candidate cannot be already registered as child of parentModalTarget
                        if (parentModalTarget && candidate.parent_registration_id === parentModalTarget.reference) {
                          return false;
                        }

                        if (!parentPickerSearch.trim()) return true;
                        const q = parentPickerSearch.toLowerCase();
                        const church = getChurchName(candidate).toLowerCase();
                        return (
                          candidate.fullName.toLowerCase().includes(q) ||
                          candidate.reference.toLowerCase().includes(q) ||
                          candidate.email.toLowerCase().includes(q) ||
                          church.includes(q)
                        );
                      });

                      if (candidates.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-gray-400">
                            No matching parent registrants found. You can also type reference manually below.
                          </div>
                        );
                      }

                      return candidates.slice(0, 15).map((candidate) => {
                        const isSelected =
                          targetParentReference.toUpperCase() === candidate.reference.toUpperCase();
                        const church = getChurchName(candidate);
                        const childCount = responses.filter(
                          (x) => x.parent_registration_id === candidate.reference
                        ).length;

                        return (
                          <button
                            type="button"
                            key={candidate.id}
                            onClick={() => {
                              setTargetParentReference(candidate.reference);
                            }}
                            className={`w-full p-2.5 rounded-xl text-left border transition cursor-pointer flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white hover:bg-slate-100 border-gray-200 text-gray-800'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-mono font-bold text-[11px] px-1.5 py-0.2 rounded ${
                                    isSelected
                                      ? 'bg-indigo-700 text-white'
                                      : 'bg-indigo-50 text-indigo-700'
                                  }`}
                                >
                                  {candidate.reference}
                                </span>
                                <span className="font-bold truncate">{candidate.fullName}</span>
                              </div>
                              <div
                                className={`text-[11px] truncate mt-0.5 ${
                                  isSelected ? 'text-indigo-100' : 'text-gray-500'
                                }`}
                              >
                                {candidate.email} {church ? `• ${church}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              {childCount > 0 ? (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isSelected
                                      ? 'bg-indigo-700 text-white'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {childCount} child{childCount > 1 ? 'ren' : ''}
                                </span>
                              ) : (
                                <span
                                  className={`text-[10px] font-medium ${
                                    isSelected ? 'text-indigo-200' : 'text-gray-400'
                                  }`}
                                >
                                  Primary
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Direct Reference Input Fallback */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                    Or Enter Parent Registration Code Manually:
                  </label>
                  <input
                    type="text"
                    value={targetParentReference}
                    onChange={(e) => setTargetParentReference(e.target.value.toUpperCase())}
                    placeholder="e.g. EVT-2026-W301"
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 uppercase"
                  />

                  {/* Verification Pill */}
                  {targetParentReference.trim() && (() => {
                    const verifiedParent = responses.find(
                      (r) =>
                        r.reference.toUpperCase() === targetParentReference.trim().toUpperCase() ||
                        r.id === targetParentReference.trim()
                    );
                    if (verifiedParent) {
                      const church = getChurchName(verifiedParent);
                      return (
                        <div className="mt-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Verified Parent: {verifiedParent.fullName} ({verifiedParent.reference}
                            {church ? ` • ${church}` : ''})
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Code format entered. Will link to parent code upon save.</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Inherit Church Checkbox */}
                <label className="flex items-center gap-2.5 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncChurchWithParent}
                    onChange={(e) => setSyncChurchWithParent(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-indigo-950 block">
                      Inherit Parent's Church / Ministry
                    </span>
                    <span className="text-[11px] text-indigo-700">
                      Automatically syncs church affiliation to match the parent attendee.
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Unlink Mode Details */}
            {parentActionType === 'unlink' && (
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <Unlink className="w-4 h-4 text-rose-600" />
                  <span>Convert to Independent Primary Registration</span>
                </div>
                <p className="text-rose-700 text-[11px] leading-relaxed">
                  This attendee will no longer be linked under any parent account. They will be treated as an independent primary registrant with their own separate registration dashboard and pass.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-gray-100 flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowChangeParentModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveParentChange}
                disabled={isUpdatingParent || (parentActionType === 'link' && !targetParentReference.trim())}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5 ${
                  parentActionType === 'unlink'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isUpdatingParent ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Relationship...</span>
                  </>
                ) : parentActionType === 'unlink' ? (
                  <>
                    <Unlink className="w-4 h-4" />
                    <span>Confirm Unlink to Primary</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    <span>Save Parent Relationship</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
