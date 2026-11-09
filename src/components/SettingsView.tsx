import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { UserRole, SiteSettings, SMTPSettings } from '../types';
import {
  ShieldCheck,
  Database,
  Download,
  Building,
  Sparkles,
  Check,
  Palette,
  Globe,
  Mail,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertCircle,
  Send,
  Save,
  UploadCloud,
  RotateCcw,
  Layers,
  Server
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface SettingsViewProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentUserEmail: string;
  siteSettings: SiteSettings;
  onSaveSiteSettings: (settings: SiteSettings) => void;
}

const ACCENT_COLORS = [
  { name: 'Royal Indigo', hex: '#4f46e5' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Sunset Amber', hex: '#d97706' },
  { name: 'Crimson Rose', hex: '#e11d48' },
  { name: 'Ocean Cyan', hex: '#0891b2' },
  { name: 'Midnight Slate', hex: '#1e293b' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentRole,
  onRoleChange,
  currentUserEmail,
  siteSettings,
  onSaveSiteSettings,
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<SiteSettings>(siteSettings);
  const [isSaving, setIsSaving] = useState(false);

  // Dedicated SMTP Configuration module state
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>({
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    pass: '',
    fromName: 'Event Notifications',
    fromEmail: '',
    enabled: true,
  });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setFormData(siteSettings);
  }, [siteSettings]);

  useEffect(() => {
    dbService.getSMTPSettings().then((settings) => {
      setSmtpSettings(settings);
    });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const updated = await dbService.saveSiteSettings(formData);
    onSaveSiteSettings(updated);
    setIsSaving(false);
    showToast('Website and branding settings updated across the platform!', 'success');
  };

  const handleSaveSMTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpStatus(null);
    try {
      await dbService.saveSMTPSettings(smtpSettings);
      setSmtpStatus({ type: 'success', text: 'Email delivery credentials saved securely!' });
      showToast('Email delivery settings saved successfully!', 'success');
    } catch (err: any) {
      setSmtpStatus({ type: 'error', text: err?.message || 'Failed to save email settings.' });
      showToast('Failed to save email settings', 'error');
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSMTP = async () => {
    setSmtpTesting(true);
    setSmtpStatus(null);
    const recipient = smtpSettings.fromEmail || smtpSettings.user || currentUserEmail;
    if (!recipient) {
      setSmtpStatus({ type: 'error', text: 'Please enter an Account Email or Sender Email Address to receive test messages.' });
      setSmtpTesting(false);
      return;
    }

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpSettings.host || 'smtp.gmail.com',
          port: smtpSettings.port || 587,
          user: smtpSettings.user,
          pass: smtpSettings.pass,
          fromEmail: smtpSettings.fromEmail || smtpSettings.user,
          fromName: smtpSettings.fromName || 'Event Notifications',
          to: recipient,
          subject: 'Gmail SMTP Verification Test',
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #4f46e5; border-radius: 12px; background-color: #f8fafc;">
              <h3 style="color: #4f46e5; margin-top: 0;">SMTP Verification Successful</h3>
              <p style="color: #334155; font-size: 14px;">Your Gmail SMTP settings are configured properly and active.</p>
              <p style="color: #64748b; font-size: 12px;">Dispatched at: ${new Date().toLocaleString()}</p>
            </div>
          `,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'SMTP Connection Test Failed.');
      }

      setSmtpStatus({ type: 'success', text: `Test message dispatched successfully to ${recipient}!` });
      showToast(`Test email dispatched successfully to ${recipient}`, 'success');
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to send test email. Check host, port, user, or password.';
      setSmtpStatus({ type: 'error', text: errMsg });
      showToast(errMsg, 'error');
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleDownloadBackup = async () => {
    const [forms, responses, emailLogs, currentSettings] = await Promise.all([
      dbService.getForms(),
      dbService.getResponses(),
      dbService.getEmailLogs(),
      dbService.getSiteSettings(),
    ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      siteSettings: currentSettings,
      forms,
      responses,
      emailLogs,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formData.siteName.toLowerCase().replace(/\s+/g, '-')}-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Exported system data backup!', 'success');
  };

  const restoreFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const res = await dbService.restoreFromBackup(text);
      setRestoring(false);
      if (res.success) {
        showToast(
          `Restored ${res.formsCount} forms and ${res.responsesCount} responses successfully!`,
          'success'
        );
      } else {
        showToast(res.message, 'error');
      }
    };
    reader.onerror = () => {
      setRestoring(false);
      showToast('Error reading backup file', 'error');
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          Platform & Website Settings
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Customize website name, branding, organization details, email triggers, and system roles.
        </p>
      </div>

      {/* Website Branding & Content Customizer Form */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-6"
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              Website Branding & Global Content
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Changes update the navigation bar, headers, receipt emails, and footer automatically.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Website Changes'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Website / Platform Name
            </label>
            <input
              type="text"
              value={formData.siteName}
              onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
              className="w-full px-4 py-2.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <span className="text-[10px] text-gray-400 mt-1 block">
              Shown in navigation bar and public headers (e.g. EventForm, Calvary Events, TechSummit Hub)
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Website Tagline / Subtitle
            </label>
            <input
              type="text"
              value={formData.siteTagline}
              onChange={(e) => setFormData({ ...formData, siteTagline: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
            <span className="text-[10px] text-gray-400 mt-1 block">
              Secondary headline displayed below the platform title
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Organization / Ministry Name
            </label>
            <input
              type="text"
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Contact & Support Email
            </label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
          </div>
        </div>

        {/* Brand Theme Color */}
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-bold text-gray-700 mb-2">
            Primary Brand Accent Color
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setFormData({ ...formData, accentColor: c.hex })}
                className={`w-9 h-9 rounded-2xl flex items-center justify-center transition cursor-pointer ${
                  formData.accentColor === c.hex
                    ? 'ring-3 ring-offset-2 ring-indigo-500 scale-105'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              >
                {formData.accentColor === c.hex && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-gray-400 font-mono">Custom:</span>
              <input
                type="color"
                value={formData.accentColor}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                className="w-8 h-8 rounded-xl cursor-pointer border-0 p-0"
              />
            </div>
          </div>
        </div>

        {/* Email Notification Trigger Toggle */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-gray-900">
              Automatic Attendee Confirmation Emails
            </div>
            <div className="text-[11px] text-gray-500">
              Dispatches a digital ticket pass confirmation email immediately upon registration.
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                enableEmailConfirmations: !formData.enableEmailConfirmations,
              })
            }
            className="cursor-pointer text-indigo-600 p-1"
          >
            {formData.enableEmailConfirmations ? (
              <ToggleRight className="w-8 h-8 text-indigo-600" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-gray-400" />
            )}
          </button>
        </div>

        {/* Custom Footer Text */}
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-bold text-gray-700 mb-1.5">
            Website Footer Notice
          </label>
          <input
            type="text"
            value={formData.footerText}
            onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
            className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>
      </form>

      {/* Dedicated Gmail SMTP Configuration Module */}
      <form
        onSubmit={handleSaveSMTP}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              Gmail & Outgoing SMTP Server Configuration
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Securely configure administrator email delivery credentials directly in the application interface.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTestSMTP}
              disabled={smtpTesting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {smtpTesting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Test Connection
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={smtpSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {smtpSaving ? 'Saving...' : 'Save SMTP Settings'}
            </button>
          </div>
        </div>

        {smtpStatus && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
              smtpStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                : 'bg-rose-50 border-rose-200 text-rose-900 font-semibold'
            }`}
          >
            {smtpStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{smtpStatus.text}</span>
          </div>
        )}

        {/* Quick Setup Guide Banner */}
        <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-2xl p-4 text-xs text-indigo-950 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-indigo-900">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            Gmail Credentials Guide
          </div>
          <p className="text-indigo-900/90 leading-relaxed">
            For <strong>Gmail</strong>: Use Host <code className="bg-indigo-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-950">smtp.gmail.com</code> and Port <code className="bg-indigo-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-950">587</code>. Enter a <strong>16-character Google App Password</strong> as your password (generated in Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Outgoing Server (Host)
            </label>
            <input
              type="text"
              placeholder="smtp.gmail.com"
              value={smtpSettings.host}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Server Port
            </label>
            <input
              type="number"
              placeholder="587"
              value={smtpSettings.port}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, port: Number(e.target.value) })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Account Email
            </label>
            <input
              type="email"
              placeholder="you@gmail.com"
              value={smtpSettings.user}
              onChange={(e) =>
                setSmtpSettings({
                  ...smtpSettings,
                  user: e.target.value,
                  fromEmail: smtpSettings.fromEmail || e.target.value,
                })
              }
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Account Password (or App Password)
            </label>
            <input
              type="password"
              placeholder="16-character App Password"
              value={smtpSettings.pass}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Sender Display Name
            </label>
            <input
              type="text"
              placeholder="Event Notifications"
              value={smtpSettings.fromName}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Sender Email Address
            </label>
            <input
              type="email"
              placeholder="you@gmail.com"
              value={smtpSettings.fromEmail}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            />
          </div>
        </div>
      </form>

      {/* Role-Based Access Control Switcher */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Role-Based Access Control (RBAC) Simulator
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Test how different members of your event team interact with EventForm.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {[
            {
              role: 'super_admin' as UserRole,
              title: 'Administrator',
              desc: 'Protected by administrator lock. Full access to forms, records, and configuration.',
              url: '/admin',
            },
            {
              role: 'agent' as UserRole,
              title: 'Registration Agent',
              desc: 'Dedicated rapid multi-attendee registration mode for reception agents.',
              url: '/Agent',
            },
            {
              role: 'event_officer' as UserRole,
              title: 'Event Officer',
              desc: 'Access to forms and responses; view attendee data & export CSV.',
              url: '/Eventofficer',
            },
            {
              role: 'checkin_officer' as UserRole,
              title: 'Check-In Officer',
              desc: 'Fast QR camera scanner, search by name/ref, and entry verification.',
              url: '/checkiofficer',
            },
          ].map((item) => (
            <button
              key={item.role}
              type="button"
              onClick={() => {
                onRoleChange(item.role);
                showToast(`Switched active role to: ${item.title}`, 'info');
              }}
              className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                currentRole === item.role
                  ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500 shadow-xs'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-xs text-gray-900">{item.title}</span>
                  {currentRole === item.role && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
                <div className="text-[10px] text-indigo-600 font-mono font-semibold mt-1">
                  {item.url}
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 mt-3 block">
                {currentRole === item.role ? 'Active Role' : 'Switch to this'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Data Backup & Restore System */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Save className="w-5 h-5 text-emerald-600" />
              Data Backup & Recovery System
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated data persistence with resilient offline caching and submission queuing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              System Active
            </span>
          </div>
        </div>

        {/* Hidden File Input for Restoring */}
        <input
          type="file"
          ref={restoreFileInputRef}
          accept=".json"
          onChange={handleRestoreBackupFile}
          className="hidden"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Card */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900 mb-1">
                <Download className="w-4 h-4 text-emerald-600" />
                Export Full Data Backup
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Download a clean, structured JSON archive of all forms, attendee registrations, questions, and transmission logs.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export JSON Backup
            </button>
          </div>

          {/* Import / Restore Card */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900 mb-1">
                <UploadCloud className="w-4 h-4 text-indigo-600" />
                Restore Data from Backup
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Restore and import your forms, questions, and delegate response records from an existing backup archive.
              </p>
            </div>

            <button
              type="button"
              disabled={restoring}
              onClick={() => restoreFileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {restoring ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Restoring Data...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Import / Restore Backup
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Admin Data Deletion & Purge Controls */}
      {(currentRole === 'super_admin' || currentRole === 'admin') && (
        <div className="bg-rose-50/50 rounded-3xl p-6 sm:p-8 border border-rose-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-black text-rose-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-rose-600" />
              Administrative Data Cleanup
            </h3>
            <p className="text-xs text-rose-700 mt-0.5">
              Admin controls to purge attendee records, clean test registrations, or reset transmission logs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-4 bg-white rounded-2xl border border-rose-200 space-y-2">
              <div className="font-bold text-xs text-gray-900">Clear All Attendee Responses</div>
              <p className="text-[11px] text-gray-500">
                Purge all registrant submissions across all event forms while preserving form configurations.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete ALL attendee responses?')) {
                    const count = await dbService.clearAllResponses();
                    showToast(`Purged ${count} attendee records`, 'info');
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Purge All Responses
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-rose-200 space-y-2">
              <div className="font-bold text-xs text-gray-900">Clear Email Delivery Logs</div>
              <p className="text-[11px] text-gray-500">
                Delete all previous transmission logs and delivery history records.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Delete all email transmission logs?')) {
                    await dbService.clearEmailLogs();
                    showToast('Email delivery logs cleared successfully', 'info');
                  }
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Clear Email Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
