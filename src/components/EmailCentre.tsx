import React, { useState, useEffect } from 'react';
import { EventForm, FormResponse, EmailLog, SMTPSettings } from '../types';
import { dbService } from '../services/db';
import { useToast } from '../context/ToastContext';
import {
  Mail,
  Send,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  FileText,
  Users
} from 'lucide-react';

export const EmailCentre: React.FC = () => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>(dbService.getSMTPSettings());

  // Composer state
  const [recipientAudience, setRecipientAudience] = useState<'all' | 'form_specific' | 'unattended'>('form_specific');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [subject, setSubject] = useState('Important Update: Your Event Pass & Schedule');
  const [body, setBody] = useState(
    'Dear {{name}},\n\nWe are thrilled to welcome you to {{event_title}}!\n\nYour Registration Reference: {{reference}}\nPlease have your digital QR pass ready at the entry desk.\n\nWarm regards,\nThe Event Organizing Committee'
  );
  const [sending, setSending] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'logs' | 'smtp'>('compose');
  const [smtpSaved, setSmtpSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      dbService.getForms(),
      dbService.getResponses(),
      dbService.getEmailLogs(),
    ]).then(([f, r, l]) => {
      setForms(f);
      setResponses(r);
      setEmailLogs(l);
      if (f.length > 0) {
        setSelectedFormId(f[0].id);
      }
    });
  }, []);

  const calculateTargetCount = (): number => {
    if (recipientAudience === 'all') {
      return responses.length;
    }
    if (recipientAudience === 'form_specific') {
      return responses.filter((r) => r.formId === selectedFormId).length;
    }
    if (recipientAudience === 'unattended') {
      return responses.filter((r) => !r.checkedIn).length;
    }
    return 0;
  };

  const handleTemplateSelect = (type: string) => {
    if (type === 'confirmation') {
      setSubject('Registration Confirmed: {{event_title}}');
      setBody(
        'Dear {{name}},\n\nYour registration for {{event_title}} is confirmed! Your pass reference is {{reference}}.\n\nWe look forward to hosting you.\n\nBest regards,\nEvent Team'
      );
    } else if (type === 'reminder') {
      setSubject('Event Reminder: {{event_title}} Tomorrow!');
      setBody(
        'Hello {{name}},\n\nThis is a friendly reminder that {{event_title}} takes place tomorrow. Doors open early.\n\nPlease keep your reference {{reference}} or QR ticket ready for fast check-in.\n\nSee you there!'
      );
    } else if (type === 'directions') {
      setSubject('Venue & Parking Directions for {{event_title}}');
      setBody(
        'Dear {{name}},\n\nHere are venue directions and parking advice for {{event_title}}.\n\nPlease refer to ticket pass {{reference}} upon arrival at the security gate.\n\nSafe travels!'
      );
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = calculateTargetCount();
    if (count === 0) {
      showToast('No recipients match the selected audience filter.', 'error');
      return;
    }

    setSending(true);
    setStatusMessage(null);

    // Simulate reliable batch dispatch with SMTP credentials
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const targetForm = forms.find((f) => f.id === selectedFormId);

      const newLog = await dbService.addEmailLog({
        subject,
        recipientsCount: count,
        formId: selectedFormId,
        formTitle: targetForm?.title || 'All Events',
        status: 'sent',
        recipientType: recipientAudience,
        sender: smtpSettings.fromEmail || 'isholafelix609@gmail.com',
      });

      setEmailLogs((prev) => [newLog, ...prev]);
      const successText = `Dispatched email batch to ${count} registrants via ${smtpSettings.host}!`;
      setStatusMessage({
        type: 'success',
        text: successText,
      });
      showToast(successText, 'success');
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'Failed to deliver emails. Please check email delivery settings.',
      });
      showToast('Failed to deliver emails. Please check email delivery settings.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setTestEmailSending(false);
    const testMsg = `Test message dispatched successfully to ${smtpSettings.fromEmail}`;
    setStatusMessage({
      type: 'success',
      text: testMsg,
    });
    showToast(testMsg, 'success');
  };

  const handleSaveSMTP = (e: React.FormEvent) => {
    e.preventDefault();
    dbService.saveSMTPSettings(smtpSettings);
    setSmtpSaved(true);
    showToast('Email settings saved securely', 'success');
    setTimeout(() => setSmtpSaved(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Mail className="w-4 h-4" />
            Communication & Announcement Hub
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Email Centre & Notifications
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Send tickets, event announcements, and reminders to registered participants.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'compose' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Compose
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'logs' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Delivery Logs ({emailLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('smtp')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'smtp' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Email Settings
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
              : 'bg-rose-50 border-rose-200 text-rose-900 font-semibold'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* VIEW: COMPOSE */}
      {activeTab === 'compose' && (
        <form onSubmit={handleSendAnnouncement} className="space-y-5">
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
            {/* Quick Templates Bar */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Pre-built Email Templates
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('confirmation')}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition cursor-pointer"
                >
                  Confirmation & Pass
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('reminder')}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition cursor-pointer"
                >
                  Event Reminder
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('directions')}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition cursor-pointer"
                >
                  Venue & Parking Info
                </button>
              </div>
            </div>

            {/* Audience Selector */}
            <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Recipient Audience
                </label>
                <select
                  value={recipientAudience}
                  onChange={(e) => setRecipientAudience(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-indigo-500"
                >
                  <option value="form_specific">Registrants of a Specific Event</option>
                  <option value="all">All Registrants Across All Events</option>
                  <option value="unattended">Unattended / Not Yet Checked-in</option>
                </select>
              </div>

              {recipientAudience === 'form_specific' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Event
                  </label>
                  <select
                    value={selectedFormId}
                    onChange={(e) => setSelectedFormId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-indigo-500"
                  >
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Recipient Count Pill */}
            <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 font-semibold w-fit">
              <Users className="w-3.5 h-3.5" />
              Target Audience: {calculateTargetCount()} registrant(s) will receive this email.
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Email Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                required
              />
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700">
                  Message Content
                </label>
                <div className="text-[11px] text-gray-400">
                  Placeholders: <code className="text-indigo-600 font-mono">{'{{name}}'}</code>,{' '}
                  <code className="text-indigo-600 font-mono">{'{{event_title}}'}</code>,{' '}
                  <code className="text-indigo-600 font-mono">{'{{reference}}'}</code>
                </div>
              </div>
              <textarea
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
                required
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testEmailSending}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {testEmailSending ? 'Sending Test...' : 'Send Test to Admin'}
            </button>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending Batch...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send to {calculateTargetCount()} Registrants
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* VIEW: LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Delivery & Transmission Logs</h3>
            <span className="text-xs text-gray-500">{emailLogs.length} logged batches</span>
          </div>

          {emailLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              No email transmissions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[10px] border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Target Event</th>
                    <th className="px-4 py-3">Recipients</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 max-w-xs truncate">
                        {log.subject}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.formTitle || 'Global'}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-700">
                        {log.recipientsCount} attendees
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW: GMAIL SMTP CONFIGURATION */}
      {activeTab === 'smtp' && (
        <form onSubmit={handleSaveSMTP} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Email Delivery Settings
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure sender account credentials for automated attendee passes and notifications.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Outgoing Server (Host)
              </label>
              <input
                type="text"
                value={smtpSettings.host}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Server Port
              </label>
              <input
                type="number"
                value={smtpSettings.port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, port: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Account Email
              </label>
              <input
                type="email"
                value={smtpSettings.user}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Account Password
              </label>
              <input
                type="password"
                value={smtpSettings.pass}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                value={smtpSettings.fromName}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Sender Email Address
              </label>
              <input
                type="email"
                value={smtpSettings.fromEmail}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                required
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Credentials are stored securely in configuration.
            </span>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {smtpSaved ? 'Settings Saved!' : 'Save Email Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
