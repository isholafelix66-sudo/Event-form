import React, { useState, useEffect } from 'react';
import { EventForm, FormStatus } from '../types';
import { dbService } from '../services/db';
import {
  Plus,
  Search,
  ExternalLink,
  Edit3,
  Copy,
  Trash2,
  Check,
  Calendar,
  MapPin,
  Users,
  Layers,
  Sparkles,
  Archive,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../types';

interface FormsListProps {
  onCreateNew: () => void;
  onEditForm: (formId: string) => void;
  onViewResponses: (formId: string) => void;
  onOpenPublicLink: (slug: string) => void;
  currentRole?: UserRole;
}

export const FormsList: React.FC<FormsListProps> = ({
  onCreateNew,
  onEditForm,
  onViewResponses,
  onOpenPublicLink,
  currentRole = 'super_admin',
}) => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [formToDelete, setFormToDelete] = useState<EventForm | null>(null);
  const [deleteResponsesToo, setDeleteResponsesToo] = useState(true);

  const canManage = currentRole === 'super_admin' || currentRole === 'admin';

  useEffect(() => {
    setLoading(true);
    const unsub = dbService.subscribeForms((data) => {
      setForms(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDuplicate = async (formId: string) => {
    const dup = await dbService.duplicateForm(formId);
    if (dup) {
      showToast(`Duplicated form: "${dup.title}"`, 'success');
    }
  };

  const confirmDeleteForm = async () => {
    if (!formToDelete) return;
    const title = formToDelete.title;
    await dbService.deleteForm(formToDelete.id, deleteResponsesToo);
    setFormToDelete(null);
    showToast(
      deleteResponsesToo
        ? `Deleted form "${title}" and all its responses`
        : `Deleted form: "${title}"`,
      'info'
    );
  };

  const handleCopyLink = (slug: string) => {
    const link = `${window.location.origin}/#f=${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(slug);
    showToast('Public registration link copied to clipboard!', 'success');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const filteredForms = forms.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.slug.toLowerCase().includes(search.toLowerCase()) ||
      (f.eventLocation && f.eventLocation.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Event Forms
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {canManage
              ? 'Create, customize, and share registration forms for events, church services, and conferences.'
              : 'Browse active event forms, copy registration links, and monitor delegate responses.'}
          </p>
        </div>

        {canManage && (
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create New Form
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-3xl border border-gray-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by event title, location, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {['all', 'published', 'draft', 'closed', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Forms Grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-xs font-medium">
          Loading event forms...
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No forms found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {search
              ? 'Try adjusting your search criteria.'
              : 'Create your first smart event registration form to get started.'}
          </p>
          <button
            onClick={onCreateNew}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Event Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredForms.map((form) => (
            <div
              key={form.id}
              className="bg-white rounded-3xl border border-gray-200/90 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between group"
            >
              <div>
                {/* Image & Status Tag */}
                <div className="h-40 relative overflow-hidden bg-gray-100">
                  {form.coverImage ? (
                    <img
                      src={form.coverImage}
                      alt={form.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: form.themeColor || '#4f46e5' }}
                    >
                      <Sparkles className="w-8 h-8 text-white/50" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-2xs ${
                        form.status === 'published'
                          ? 'bg-emerald-600'
                          : form.status === 'draft'
                          ? 'bg-amber-600'
                          : 'bg-gray-600'
                      }`}
                    >
                      {form.status}
                    </span>

                    <span className="text-[10px] font-mono font-bold bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-lg border border-white/10">
                      /f/{form.slug}
                    </span>
                  </div>

                  {/* Title overlay in banner bottom */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-black text-base line-clamp-1 leading-snug">
                      {form.title}
                    </h3>
                  </div>
                </div>

                {/* Form Details */}
                <div className="p-5 space-y-3">
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {form.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-gray-600 font-medium pt-2 border-t border-gray-100">
                    {form.eventDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">
                          {new Date(form.eventDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {form.eventLocation && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">{form.eventLocation}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-1">
                <button
                  onClick={() => onViewResponses(form.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-indigo-600 transition cursor-pointer"
                  title="View Responses"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Responses</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyLink(form.slug)}
                    className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                    title="Copy Public Registration Link"
                  >
                    {copiedSlug === form.slug ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => onOpenPublicLink(form.slug)}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                    title="Open Live Public Form"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {canManage && (
                    <>
                      <button
                        onClick={() => handleDuplicate(form.id)}
                        className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                        title="Duplicate Form"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onEditForm(form.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>

                      {/* Delete Form Button */}
                      <button
                        onClick={() => {
                          setFormToDelete(form);
                          setDeleteResponsesToo(true);
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer ml-1"
                        title="Delete Form"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Deleting Form */}
      {formToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-gray-900">Delete Event Form?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Are you sure you want to delete <strong className="text-gray-800">"{formToDelete.title}"</strong>? This action cannot be undone.
              </p>
            </div>

            {/* Toggle delete responses */}
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50/60 border border-rose-200 text-xs text-rose-950 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={deleteResponsesToo}
                onChange={(e) => setDeleteResponsesToo(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <div>
                <span className="font-bold">Also delete all attendee responses</span>
                <p className="text-[11px] text-rose-800 mt-0.5">
                  Purge all registration submissions associated with this event form.
                </p>
              </div>
            </label>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFormToDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteForm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Yes, Delete Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
