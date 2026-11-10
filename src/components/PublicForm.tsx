import React, { useState, useEffect, useRef } from 'react';
import { EventForm, Question, FormResponse } from '../types';
import { dbService } from '../services/db';
import { TicketPass } from './TicketPass';
import { DaysToEventCounter } from './DaysToEventCounter';
import confetti from 'canvas-confetti';
import {
  Calendar,
  MapPin,
  AlertCircle,
  Send,
  Lock,
  Sparkles,
  CheckCircle2,
  Mail,
  Camera,
  Upload,
  FolderOpen,
  Check,
  ChevronDown,
  Clock,
  ShieldCheck,
  Building,
  RefreshCw,
  Users
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface PublicFormProps {
  slugOrId: string;
  isPreview?: boolean;
  parentCode?: string | null;
}

export const PublicForm: React.FC<PublicFormProps> = ({
  slugOrId,
  isPreview = false,
  parentCode = null,
}) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<EventForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionResult, setSubmissionResult] = useState<{
    response: FormResponse;
    isDuplicate: boolean;
  } | null>(null);

  // Resolved parent registration code (from prop or URL query/hash param)
  const resolvedParentCode = parentCode || (() => {
    if (typeof window === 'undefined') return null;
    const match = window.location.hash.match(/[?&]parent=([^&]+)/i) || window.location.search.match(/[?&]parent=([^&]+)/i);
    return match ? decodeURIComponent(match[1]).trim().toUpperCase() : null;
  })();

  const [parentRecord, setParentRecord] = useState<FormResponse | null>(null);

  // File input refs for image upload questions
  const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadForm() {
      setLoading(true);
      const fetched = await dbService.getFormBySlug(slugOrId);
      if (isMounted) {
        setForm(fetched);
        setLoading(false);
        if (fetched) {
          document.title = `${fetched.title} – Official Event Registration`;
        }
      }
    }
    loadForm();
    return () => {
      isMounted = false;
    };
  }, [slugOrId]);

  // Fetch parent record if resolvedParentCode exists and prefill Church/Ministry
  useEffect(() => {
    if (!resolvedParentCode) return;
    let isMounted = true;
    dbService.getResponseByReference(resolvedParentCode).then((parent) => {
      if (isMounted && parent) {
        setParentRecord(parent);
        const parentChurch =
          parent.answers?.['Church / Ministry'] ||
          parent.answers?.['q-ministry'] ||
          Object.entries(parent.answers || {}).find(
            ([k, v]) => (k.toLowerCase().includes('church') || k.toLowerCase().includes('ministry')) && typeof v === 'string'
          )?.[1] ||
          '';

        if (parentChurch) {
          setAnswers((prev) => {
            const updated = { ...prev };
            if (!updated['Church / Ministry']) {
              updated['Church / Ministry'] = parentChurch;
            }
            if (form) {
              const churchQ = form.questions.find(
                (q) => q.title.toLowerCase().includes('church') || q.title.toLowerCase().includes('ministry')
              );
              if (churchQ && !updated[churchQ.id]) {
                updated[churchQ.id] = parentChurch;
              }
            }
            return updated;
          });
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [resolvedParentCode, form]);

  const handleInputChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleCheckboxChange = (questionId: string, option: string) => {
    const current = (answers[questionId] as string[]) || [];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    handleInputChange(questionId, next);
  };

  const handlePhotoUploadForQuestion = (qId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG)', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Photo is too large (max 8MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_DIM) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          }
        } else {
          if (h > MAX_DIM) {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          handleInputChange(qId, dataUrl);
          showToast('Photo attached successfully', 'success');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    if (!form) return false;
    const newErrors: Record<string, string> = {};

    form.questions.forEach((q) => {
      if (q.type === 'section_header') return;

      const val = answers[q.id];
      if (q.required) {
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          newErrors[q.id] = 'This question requires an answer';
          return;
        }
      }

      if (val && q.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val))) {
          newErrors[q.id] = 'Please enter a valid email address';
        }
      }

      if (val && q.type === 'phone') {
        if (String(val).replace(/\D/g, '').length < 6) {
          newErrors[q.id] = 'Please enter a valid phone number';
        }
      }

      if (val && q.type === 'number') {
        if (isNaN(Number(val))) {
          newErrors[q.id] = 'Please enter a valid number';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (!validate()) {
      showToast('Please complete all required fields.', 'error');
      const firstErrorEl = document.querySelector('.has-form-error');
      firstErrorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const options: { agentId?: string; agentName?: string; parent_registration_id?: string } = {};
      if (resolvedParentCode) {
        options.parent_registration_id = resolvedParentCode;
      }

      const res = await dbService.submitResponse(form, answers, options);
      setSubmissionResult(res);

      if (!res.isDuplicate) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.55 },
        });
        showToast(
          resolvedParentCode
            ? 'Child registration confirmed! Please check email for individual registration updates.'
            : 'Registration confirmed! Official pass generated. Please check email for updates.',
          'success'
        );

        // Automatically dispatch official registration pass email to attendee
        if (res.response.email) {
          dbService.getSMTPSettings().then((smtp) => {
            fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                host: smtp.host || 'smtp.gmail.com',
                port: smtp.port || 587,
                user: smtp.user,
                pass: smtp.pass,
                fromEmail: smtp.fromEmail || smtp.user,
                fromName: smtp.fromName || 'Event Notifications',
                to: res.response.email,
                subject: `Official Event Registration Pass: ${form.title}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="background-color: ${form.themeColor || '#4f46e5'}; padding: 20px; border-radius: 12px; color: #ffffff; text-align: center;">
                      <h2 style="margin: 0; font-size: 20px; font-weight: bold;">${form.title}</h2>
                      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Official Event Registration Pass</p>
                    </div>
                    <div style="padding: 20px 0; border-bottom: 1px dashed #cbd5e1;">
                      <p style="font-size: 14px; color: #1e293b; margin: 0 0 12px 0;">Dear <strong>${res.response.fullName}</strong>,</p>
                      <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.6;">
                        Thank you for registering! Your official delegate pass has been confirmed. Please present your reference code at the entry gate upon arrival. Check your email for subsequent individual updates.
                      </p>
                    </div>
                    <div style="padding: 16px; background-color: #f8fafc; border-radius: 12px; margin: 16px 0; text-align: center;">
                      <p style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 4px 0; font-weight: bold;">Registration Reference</p>
                      <p style="font-size: 22px; font-family: monospace; font-weight: bold; color: #4f46e5; margin: 0; letter-spacing: 2px;">${res.response.reference}</p>
                    </div>
                    ${form.eventDate ? `<p style="font-size: 12px; color: #475569; margin: 4px 0;">📅 Date & Time: <strong>${new Date(form.eventDate).toLocaleString()}</strong></p>` : ''}
                    ${form.eventLocation ? `<p style="font-size: 12px; color: #475569; margin: 4px 0;">📍 Location: <strong>${form.eventLocation}</strong></p>` : ''}
                    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
                      <p style="margin: 0;">Powered by EventForm • Non-Transferable Official Delegate Pass</p>
                    </div>
                  </div>
                `,
              }),
            }).catch((err) => console.warn('Automated pass email notice:', err));
          });
        }
      } else {
        showToast('Found your existing registration pass.', 'info');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to submit form', err);
      showToast('An error occurred during registration. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setAnswers({});
    setErrors({});
    setSubmissionResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-800 font-bold text-sm">Loading registration form...</p>
          <p className="text-gray-400 text-xs mt-1">Please wait a moment...</p>
        </div>
      </div>
    );
  }

  // Not found or closed state
  if (!form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Registration Form Not Found</h2>
          <p className="text-gray-600 text-xs sm:text-sm mb-4 leading-relaxed">
            The registration link <code className="bg-gray-100 px-2 py-0.5 rounded font-mono font-bold text-gray-800">/f/{slugOrId}</code> was not found or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // Unpublished / Draft / Closed state (bypassed in admin preview mode)
  if (!isPreview && form.status !== 'published') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 text-center max-w-md w-full space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
              {form.status === 'draft' ? 'Unpublished / Draft' : form.status === 'closed' ? 'Registration Closed' : 'Archived'}
            </span>
            <h2 className="text-xl font-black text-gray-900 mt-2">{form.title}</h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-2 leading-relaxed">
              This event registration form is currently <strong>unpublished</strong> and is not accepting delegate registrations. Please check back later or contact the event administrator.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="#forms"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
            >
              Return to Events Directory
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Submission success screen with ticket pass
  if (submissionResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-6 sm:py-12 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {submissionResult.isDuplicate && (
            <div className="bg-amber-500/10 border-2 border-amber-500/30 p-5 rounded-3xl space-y-3 text-amber-950 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                    Registration Already Exists
                  </span>
                  <h3 className="text-base font-black text-amber-950 mt-1">
                    An account with "{submissionResult.response.email}" has already registered!
                  </h3>
                  <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                    Re-registering with the same email is not permitted to prevent duplicate pass creation. Your existing confirmed registration pass code is <strong className="font-mono text-amber-950">{submissionResult.response.reference}</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-amber-800 font-semibold">Your confirmed event pass is ready below:</span>
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem('eventform_quick_code', submissionResult.response.reference);
                    window.location.hash = 'portal';
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  Manage in Registrant Portal &rarr;
                </button>
              </div>
            </div>
          )}

          {submissionResult.response.parent_registration_id && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-indigo-950 text-xs sm:text-sm font-medium shadow-xs">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <strong>Child Registration Confirmed!</strong> Linked to Parent Account (<span className="font-mono font-bold text-indigo-700">{submissionResult.response.parent_registration_id}</span>).
                  <div className="text-xs text-indigo-700 mt-0.5">Please check your email for individual updates. Your parent can view and manage this pass in their portal dashboard.</div>
                </div>
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem('eventform_quick_code', submissionResult.response.parent_registration_id!);
                  window.location.hash = 'portal';
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
              >
                Open Parent Dashboard
              </button>
            </div>
          )}

          <TicketPass
            response={submissionResult.response}
            form={form}
            onRegisterAnother={handleResetForAnother}
          />
        </div>
      </div>
    );
  }

  const primaryColor = form.themeColor || '#4f46e5';

  // Calculate question progress
  const countableQuestions = form.questions.filter((q) => q.type !== 'section_header');
  const totalQuestions = countableQuestions.length;
  const answeredCount = countableQuestions.filter((q) => {
    const val = answers[q.id];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-50 py-4 sm:py-8 px-3 sm:px-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Child Registration under Parent Account Indicator Banner */}
        {resolvedParentCode && (
          <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border-2 border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider mb-1">
                  Child / Dependent Direct Link
                </span>
                <h3 className="text-base font-black text-gray-900 leading-snug">
                  Registering under Parent: <span className="text-indigo-600 font-extrabold">{parentRecord ? parentRecord.fullName : resolvedParentCode}</span>
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Parent Reference: <strong className="font-mono text-indigo-700">{resolvedParentCode}</strong>
                  {(parentRecord?.answers?.['Church / Ministry'] || answers['Church / Ministry']) && (
                    <> • Church / Ministry: <strong className="text-gray-800">{parentRecord?.answers?.['Church / Ministry'] || answers['Church / Ministry']}</strong></>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                <Check className="w-3.5 h-3.5" /> No Code Entry Required
              </span>
            </div>
          </div>
        )}

        {/* Form Cover Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200/90 overflow-hidden">
          {/* Cover Banner */}
          {form.coverImage && (
            <div className="h-44 sm:h-64 w-full overflow-hidden relative">
              <img
                src={form.coverImage}
                alt={form.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </div>
          )}

          {/* Color accent line */}
          <div className="h-3 w-full" style={{ backgroundColor: primaryColor }} />

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="px-3 py-1 rounded-full text-[11px] font-black text-white uppercase tracking-wider shadow-2xs"
                style={{ backgroundColor: primaryColor }}
              >
                Official Event Registration
              </span>
              {form.eventDate && (
                <DaysToEventCounter eventDate={form.eventDate} variant="header" />
              )}
              <span className="text-xs text-gray-400 font-semibold flex items-center gap-1 ml-auto">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Verified Pass
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight">
              {form.title}
            </h1>

            {/* Event Metadata: Date & Location */}
            {(form.eventDate || form.eventLocation) && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2.5 text-xs font-semibold text-gray-700">
                {form.eventDate && (
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-gray-100">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      {new Date(form.eventDate).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                )}
                {form.eventLocation && (
                  <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-gray-100">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{form.eventLocation}</span>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {form.description && (
              <p className="mt-4 text-gray-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                {form.description}
              </p>
            )}

            {/* Required field indicator & Progress */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-rose-600 font-bold">* Indicates required question</span>
              {totalQuestions > 0 && (
                <div className="flex items-center gap-2 text-gray-500 font-medium">
                  <span>{answeredCount} of {totalQuestions} answered</span>
                  <div className="w-20 bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%`, backgroundColor: primaryColor }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Questions Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.questions.map((q, qIndex) => {
            const hasError = !!errors[q.id];

            // Section Header rendering
            if (q.type === 'section_header') {
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-3xl p-6 border-l-6 border-indigo-600 shadow-sm border border-gray-200/80 my-6"
                >
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">{q.title}</h3>
                  {q.description && (
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{q.description}</p>
                  )}
                </div>
              );
            }

            return (
              <div
                key={q.id}
                className={`bg-white rounded-3xl p-6 sm:p-7 shadow-xs border transition-all ${
                  hasError
                    ? 'border-rose-400 ring-2 ring-rose-100 has-form-error'
                    : 'border-gray-200/90 hover:border-gray-300'
                }`}
              >
                {/* Question Header */}
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <label className="block text-sm sm:text-base font-extrabold text-gray-900 leading-snug">
                      {q.title}
                      {q.required && <span className="text-rose-600 ml-1 font-black">*</span>}
                    </label>
                  </div>
                  {q.description && (
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{q.description}</p>
                  )}
                </div>

                {/* Input Controls */}
                <div className="mt-3">
                  {/* Short Answer */}
                  {q.type === 'short_answer' && (
                    <input
                      type="text"
                      placeholder={q.placeholder || 'Your answer'}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  )}

                  {/* Paragraph */}
                  {q.type === 'paragraph' && (
                    <textarea
                      rows={3}
                      placeholder={q.placeholder || 'Your answer'}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition leading-relaxed"
                    />
                  )}

                  {/* Email */}
                  {q.type === 'email' && (
                    <div className="relative">
                      <input
                        type="email"
                        placeholder={q.placeholder || 'you@example.com'}
                        value={answers[q.id] || ''}
                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      />
                      <Mail className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    </div>
                  )}

                  {/* Phone */}
                  {q.type === 'phone' && (
                    <input
                      type="tel"
                      placeholder={q.placeholder || '+1 (555) 000-0000'}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  )}

                  {/* Number */}
                  {q.type === 'number' && (
                    <input
                      type="number"
                      placeholder={q.placeholder || '0'}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  )}

                  {/* Date */}
                  {q.type === 'date' && (
                    <input
                      type="date"
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  )}

                  {/* Multiple Choice */}
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, optIdx) => {
                        const isSelected = answers[q.id] === opt;
                        return (
                          <label
                            key={optIdx}
                            onClick={() => handleInputChange(q.id, opt)}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                              isSelected
                                ? 'bg-indigo-50/70 border-indigo-500 shadow-2xs'
                                : 'bg-slate-50/50 hover:bg-slate-100/70 border-gray-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={isSelected}
                              onChange={() => handleInputChange(q.id, opt)}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className={`text-xs sm:text-sm font-semibold ${isSelected ? 'text-indigo-950 font-bold' : 'text-gray-800'}`}>
                              {opt}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Checkboxes */}
                  {q.type === 'checkboxes' && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, optIdx) => {
                        const currentArr = (answers[q.id] as string[]) || [];
                        const isChecked = currentArr.includes(opt);
                        return (
                          <label
                            key={optIdx}
                            onClick={() => handleCheckboxChange(q.id, opt)}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                              isChecked
                                ? 'bg-indigo-50/70 border-indigo-500 shadow-2xs'
                                : 'bg-slate-50/50 hover:bg-slate-100/70 border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange(q.id, opt)}
                              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <span className={`text-xs sm:text-sm font-semibold ${isChecked ? 'text-indigo-950 font-bold' : 'text-gray-800'}`}>
                              {opt}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown */}
                  {q.type === 'dropdown' && (
                    <div className="relative">
                      <select
                        value={answers[q.id] || ''}
                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition appearance-none cursor-pointer"
                      >
                        <option value="">-- Select an option --</option>
                        {(q.options || []).map((opt, optIdx) => (
                          <option key={optIdx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}

                  {/* Yes / No */}
                  {q.type === 'yes_no' && (
                    <div className="grid grid-cols-2 gap-3">
                      {['Yes', 'No'].map((choice) => {
                        const isChosen = answers[q.id] === choice;
                        return (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => handleInputChange(q.id, choice)}
                            className={`py-3 px-4 rounded-2xl text-sm font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                              isChosen
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 text-gray-800 border-gray-200'
                            }`}
                          >
                            {isChosen && <Check className="w-4 h-4 text-white" />}
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Image Upload question */}
                  {q.type === 'image_upload' && (
                    <div>
                      <input
                        type="file"
                        ref={(el) => {
                          imageInputRefs.current[q.id] = el;
                        }}
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUploadForQuestion(q.id, file);
                        }}
                        className="hidden"
                      />

                      {answers[q.id] ? (
                        <div className="flex items-center gap-4 p-3 bg-slate-50 border border-gray-200 rounded-2xl">
                          <img
                            src={answers[q.id]}
                            alt="Uploaded photo"
                            className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-gray-800 block truncate">Photo attached</span>
                            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ready for pass verification
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleInputChange(q.id, undefined)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => imageInputRefs.current[q.id]?.click()}
                            className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-800 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <FolderOpen className="w-4 h-4 text-indigo-600" />
                            Select Photo from Gallery
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Validation Error Message */}
                {hasError && (
                  <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors[q.id]}
                  </p>
                )}
              </div>
            );
          })}

          {/* Universal Church / Ministry Question if not already in form definition */}
          {!form.questions.some((q) => q.title.toLowerCase().includes('church') || q.title.toLowerCase().includes('ministry')) && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-200/90 hover:border-gray-300 transition-all">
              <div className="mb-3">
                <label className="block text-sm sm:text-base font-extrabold text-gray-900 leading-snug flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>Church / Ministry Affiliation</span>
                </label>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  {resolvedParentCode
                    ? 'Pre-filled from parent account (you may edit if different)'
                    : 'Home church, parish, or ministry denomination'}
                </p>
              </div>
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="e.g. Grace Chapel"
                  value={answers['Church / Ministry'] || ''}
                  onChange={(e) => handleInputChange('Church / Ministry', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/70 border border-gray-200 rounded-2xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>
          )}

          {/* Form Bottom Submission Bar */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500 text-center sm:text-left">
              <span className="font-semibold text-gray-700 block sm:inline">
                Instant digital QR ticket pass generated upon submission.
              </span>{' '}
              A confirmation email will be dispatched automatically.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white font-extrabold text-sm rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Pass...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Complete Registration
                </>
              )}
            </button>
          </div>
        </form>

        {/* Existing Registrant Portal Quick Access Box */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                Already Registered?
              </span>
              <h3 className="text-base font-black tracking-tight text-white">
                Register a Child or Manage Your Pass
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Enter your unique Registration Code (e.g. EVT-2026-XXXX) to open your dashboard and add a child.
              </p>
            </div>

            <button
              onClick={() => {
                window.location.hash = 'portal';
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
            >
              <span>Open Full Portal</span>
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const inputEl = (e.currentTarget.elements.namedItem('quickCode') as HTMLInputElement);
              const code = inputEl?.value?.trim().toUpperCase();
              if (code) {
                window.location.hash = `portal`;
                // Store in session storage so portal auto-loads or we can navigate via hash
                sessionStorage.setItem('eventform_quick_code', code);
              }
            }}
            className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-700/60"
          >
            <input
              type="text"
              name="quickCode"
              placeholder="Enter Registration Code (e.g. EVT-2026-X7K9)"
              className="flex-1 px-4 py-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shrink-0"
            >
              Enter Dashboard
            </button>
          </form>
        </div>

        {/* Public Footer */}
        <div className="text-center py-6 text-xs text-gray-400">
          <p>Powered by EventForm • Official Event Registration</p>
        </div>
      </div>
    </div>
  );
};
