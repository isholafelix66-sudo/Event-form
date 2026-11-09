import React, { useState, useEffect } from 'react';
import { EventForm, FormResponse, SiteSettings } from '../types';
import { dbService } from '../services/db';
import {
  FileText,
  Users,
  CheckCircle2,
  TrendingUp,
  Plus,
  ArrowRight,
  ExternalLink,
  QrCode,
  Calendar,
  Sparkles,
  Ticket,
  Clock,
  Copy,
  ChevronRight,
  UserCheck,
  Send,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { DaysToEventCounter } from './DaysToEventCounter';

interface DashboardOverviewProps {
  onCreateForm: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenPublicLink: (slug: string) => void;
  onViewResponses: (formId: string) => void;
  siteSettings: SiteSettings;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onCreateForm,
  onNavigateTab,
  onOpenPublicLink,
  onViewResponses,
  siteSettings,
}) => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);

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
    });

    return () => {
      unsubForms();
      unsubResponses();
    };
  }, []);

  const totalForms = forms.length;
  const publishedForms = forms.filter((f) => f.status === 'published').length;
  const totalRegistrations = responses.length;
  const checkedInToday = responses.filter((r) => r.checkedIn).length;
  const attendanceRate = totalRegistrations > 0 ? Math.round((checkedInToday / totalRegistrations) * 100) : 0;
  const recentResponses = responses.slice(0, 6);

  const handleCopyLink = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}/#f=${slug}`;
    navigator.clipboard.writeText(link);
    showToast('Public link copied to clipboard!', 'success');
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Executive Command Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md text-indigo-200 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{siteSettings.organizationName}</span>
              <span className="text-white/40">•</span>
              <span className="text-white">Active Production</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              {siteSettings.siteName} Command Center
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Real-time monitoring of event registrations, attendee attendance verification, digital QR passes, and automated participant email communications.
            </p>
          </div>

          {/* Quick Action Dock */}
          <div className="flex flex-wrap lg:flex-col gap-2.5 shrink-0">
            <button
              onClick={onCreateForm}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Event Form
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => onNavigateTab('checkin')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-2xl text-xs font-bold border border-white/10 transition cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                Check-In Desk
              </button>

              <button
                onClick={() => onNavigateTab('bulk')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-2xl text-xs font-bold border border-white/10 transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-amber-400" />
                Bulk Reg
              </button>
            </div>
          </div>
        </div>

        {/* Ambient glow decoration */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stat Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Metric 1 */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Total Registrations
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">
            {totalRegistrations}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Across {totalForms} event forms</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Checked In
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight">
            {checkedInToday}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            <span>{totalRegistrations - checkedInToday} attendees pending arrival</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Attendance Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">
            {attendanceRate}%
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-1">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Published Forms
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">
            {publishedForms}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            <span>{totalForms - publishedForms} in draft mode</span>
          </div>
        </div>
      </div>

      {/* Main Content Split: Event Forms Cards & Live Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Column: Top Event Forms (2 Columns on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">
                Active Registration Portals
              </h2>
              <p className="text-xs text-gray-500">
                Click any form to view delegates or copy unique public links.
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('forms')}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
            >
              <span>View All ({forms.length})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {forms.slice(0, 4).map((f) => {
              const regCount = responses.filter((r) => r.formId === f.id).length;
              return (
                <div
                  key={f.id}
                  onClick={() => onViewResponses(f.id)}
                  className="bg-white rounded-3xl border border-gray-200/90 shadow-xs hover:shadow-md transition overflow-hidden cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Banner Thumbnail */}
                    <div className="h-32 relative overflow-hidden bg-gray-100">
                      {f.coverImage ? (
                        <img
                          src={f.coverImage}
                          alt={f.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white"
                          style={{ backgroundColor: f.themeColor || '#4f46e5' }}
                        >
                          <Sparkles className="w-8 h-8 opacity-40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-2xs ${
                            f.status === 'published' ? 'bg-emerald-600' : 'bg-amber-600'
                          }`}
                        >
                          {f.status}
                        </span>

                        <span className="text-[10px] font-mono font-bold bg-black/60 text-white px-2 py-0.5 rounded-lg">
                          /f/{f.slug}
                        </span>
                      </div>

                      <div className="absolute bottom-2.5 left-3 right-3 text-white">
                        <h3 className="font-black text-sm line-clamp-1 leading-snug">
                          {f.title}
                        </h3>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-4 space-y-2">
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {f.description}
                      </p>

                      <div className="text-[11px] text-gray-500 font-medium flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="font-bold text-gray-800">
                          {regCount} registered
                        </span>
                        <span>{f.questions.length} questions</span>
                      </div>
                      {f.eventDate && new Date(f.eventDate).getTime() > Date.now() && (
                        <div className="pt-1">
                          <DaysToEventCounter eventDate={f.eventDate} compact={true} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-xs">
                    <button
                      onClick={(e) => handleCopyLink(f.slug, e)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 hover:text-indigo-600 transition cursor-pointer"
                      title="Copy Public Link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Link
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPublicLink(f.slug);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    >
                      <span>Open Form</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Registrant Stream (1 Column) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">
                Live Activity Stream
              </h2>
              <p className="text-xs text-gray-500">Recent participant submissions</p>
            </div>

            <button
              onClick={() => onNavigateTab('responses')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              All
            </button>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/90 shadow-xs space-y-3">
            {recentResponses.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No recent registrations logged yet.
              </div>
            ) : (
              recentResponses.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onViewResponses(r.formId)}
                  className="p-3 bg-gray-50 hover:bg-indigo-50/60 rounded-2xl border border-gray-100 hover:border-indigo-200 transition cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                      {getAttendeeName(r).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-gray-900 truncate leading-snug">
                        {getAttendeeName(r)}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">{r.formTitle}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-[10px] font-black text-indigo-700">
                      {r.reference}
                    </div>
                    <span
                      className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md mt-0.5 ${
                        r.checkedIn
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200/80 text-gray-600'
                      }`}
                    >
                      {r.checkedIn ? 'Checked In' : 'Confirmed'}
                    </span>
                  </div>
                </div>
              ))
            )}

            <button
              onClick={() => onNavigateTab('responses')}
              className="w-full py-2.5 text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-gray-50 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            >
              Manage All Attendee Records →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
