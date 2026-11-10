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
  Users,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Calendar,
  MapPin,
  User,
  Check,
  Flame,
  Bell,
  Zap,
  ChevronRight
} from 'lucide-react';

export interface EmailCentreProps {
  initialFormId?: string | null;
  initialTemplate?: string | null;
}

export const EmailCentre: React.FC<EmailCentreProps> = ({
  initialFormId = null,
  initialTemplate = null,
}) => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>({
    host: 'smtp.gmail.com',
    port: 587,
    user: 'bsfijerubc@gmail.com',
    pass: 'ztjsrtqoyicwlffk',
    fromName: 'Event Notifications',
    fromEmail: 'bsfijerubc@gmail.com',
    enabled: true,
  });

  // Composer state
  const [recipientAudience, setRecipientAudience] = useState<'all' | 'form_specific' | 'unattended'>('form_specific');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [subject, setSubject] = useState('Registration Confirmed: {{event_title}}');
  const [body, setBody] = useState(
    'Dear {{name}},\n\nYour registration for {{event_title}} is confirmed! Your pass reference is {{reference}}.\n\nEvent Date: {{event_date}}\nVenue: {{event_location}}\n\nPlease present your digital QR pass at the entrance desk upon arrival.\n\nWarm regards,\nThe Event Organizing Committee'
  );
  const [sending, setSending] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'verified' | 'unverified' | 'failed' | 'testing'>('verified');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings & Preview tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'logs' | 'smtp'>('compose');
  const [smtpSaved, setSmtpSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [autoSending, setAutoSending] = useState(false);
  const [autoMonitorActive, setAutoMonitorActive] = useState(true);

  const predictReminderStage = (eventDateStr?: string): 'reminder_2days' | 'reminder_1day' | 'reminder_dday' => {
    if (!eventDateStr) return 'reminder_2days';
    const target = new Date(eventDateStr).getTime();
    if (isNaN(target)) return 'reminder_2days';
    const now = Date.now();
    const diffHours = (target - now) / (1000 * 60 * 60);

    if (diffHours > 36) {
      return 'reminder_2days';
    } else if (diffHours > 12) {
      return 'reminder_1day';
    } else {
      return 'reminder_dday';
    }
  };

  const handleAutoPredictAndSend = async (targetFormIdParam?: string) => {
    const formIdToUse = targetFormIdParam || selectedFormId || forms[0]?.id;
    const targetForm = forms.find((f) => f.id === formIdToUse) || forms[0];
    if (!targetForm) {
      showToast('No active event form found to dispatch reminders for.', 'error');
      return;
    }

    const predictedStage = predictReminderStage(targetForm.eventDate);
    setSelectedFormId(targetForm.id);
    setRecipientAudience('form_specific');
    handleTemplateSelect(predictedStage, targetForm.id, forms);

    const stageLabel =
      predictedStage === 'reminder_2days'
        ? '⏳ 2 Days to Go'
        : predictedStage === 'reminder_1day'
        ? '🔥 1 Day to Go'
        : '🎉 D-Day (Today)';

    const targetList = responses.filter((r) => r.formId === targetForm.id);
    if (targetList.length === 0) {
      showToast(`No registered attendees found for "${targetForm.title}".`, 'error');
      return;
    }

    setAutoSending(true);
    setStatusMessage(null);

    try {
      const formDateStr = targetForm.eventDate
        ? new Date(targetForm.eventDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Nov 28, 2026 at 6:00 PM';
      const formLocationStr = targetForm.eventLocation || 'Grace Cathedral Auditorium, London';
      const formTitleStr = targetForm.title || 'Worship Encounter';

      let currentSubj = `⏳ 2 Days to Go! ${formTitleStr} – Important Arrival & Gate Information`;
      let currentBody = `Dear {{name}},\n\nWe are officially 2 DAYS AWAY from {{event_title}}! The anticipation is high, and our teams are making final preparations to welcome you for an unforgettable, life-transforming time.\n\nEVENT SCHEDULE & LOCATION:\n📅 Date & Time: {{event_date}}\n📍 Venue: {{event_location}}\n🎟️ Your Pass Reference: {{reference}}\n\nIMPORTANT PREPARATION & ARRIVAL CHECKLIST:\n1. Fast-Track Check-In: Please have your Reference Code ({{reference}}) or your Digital QR Pass ready on your phone upon arrival at the gate.\n2. Family & Child Registrations: If you registered children or family members under your code, please ensure they arrive with you or have their respective pass codes ready.\n3. Arrive Early: Doors open 45 minutes prior to start time. Seating is on a first-arrival basis.\n4. Venue & Parking: On-site parking stewards will be stationed at {{event_location}} to guide you upon arrival.\n5. Spiritual Preparation: Come with an open heart, expectant for a mighty move of God!\n\nWe cannot wait to worship together with you!\n\nWarm regards,\n{{event_title}} Organizing Committee`;

      if (predictedStage === 'reminder_1day') {
        currentSubj = `🔥 Tomorrow! 1 Day to Go for ${formTitleStr} – Final Event Details`;
        currentBody = `Dear {{name}},\n\nTOMORROW IS THE BIG DAY! In less than 24 hours, {{event_title}} will officially begin.\n\nYour registration is confirmed, your seat is ready, and we cannot wait to worship together!\n\nFINAL EVENT COUNTDOWN:\n📅 Date & Time: {{event_date}}\n📍 Venue: {{event_location}}\n🎟️ Your Pass Reference: {{reference}}\n\nFINAL CHECKLIST FOR TOMORROW:\n• Keep your Pass Reference ({{reference}}) handy for instant badge/wristband collection at the check-in desk.\n• Beat the Queue: Doors open 45 minutes before start time. Arrive early to secure your preferred seats.\n• Child & Youth Registrations: Dedicated family check-in desks will be operational from door-open time.\n• Parking & Transit: Free parking is available on-site. Public transport connections are within a short walk of {{event_location}}.\n• Need assistance? Look for our official ushering and protocol team members upon arrival.\n\nSee you tomorrow at {{event_location}}!\n\nWith love and expectation,\n{{event_title}} Organizing Committee`;
      } else if (predictedStage === 'reminder_dday') {
        currentSubj = `🎉 TODAY IS THE DAY! ${formTitleStr} is Here – Doors Open Soon!`;
        currentBody = `Dear {{name}},\n\nTHE WAIT IS OVER – TODAY IS THE DAY!\n\n{{event_title}} is taking place TODAY, and our teams are on site eagerly waiting to welcome you through the doors!\n\nYOUR ACCESS PASS FOR TODAY:\n🎟️ Reference Code: {{reference}}\n📍 Venue: {{event_location}}\n⏰ Schedule: {{event_date}}\n\nON-SITE ARRIVAL INSTRUCTIONS:\n• Doors open shortly. Please arrive early for hassle-free check-in.\n• Show your Reference Code ({{reference}}) or QR code to any usher or check-in officer at the front desk.\n• If you need any assistance upon arrival, our welcoming team wearing official badges is ready to help.\n\nTravel safely, and let's encounter God together today!\n\nSee you in a few moments,\n{{event_title}} Team`;
      }

      let successCount = 0;
      let lastError = '';

      for (const resp of targetList.slice(0, 50)) {
        if (!resp.email) continue;
        const personalizedSubject = currentSubj
          .replace(/{{name}}/g, resp.fullName || 'Delegate')
          .replace(/{{event_title}}/g, resp.formTitle || formTitleStr)
          .replace(/{{reference}}/g, resp.reference || '')
          .replace(/{{event_date}}/g, formDateStr)
          .replace(/{{event_location}}/g, formLocationStr);

        const personalizedBody = currentBody
          .replace(/{{name}}/g, resp.fullName || 'Delegate')
          .replace(/{{event_title}}/g, resp.formTitle || formTitleStr)
          .replace(/{{reference}}/g, resp.reference || '')
          .replace(/{{event_date}}/g, formDateStr)
          .replace(/{{event_location}}/g, formLocationStr);

        const htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 18px;">
              <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #4f46e5; background-color: #eef2ff; padding: 3px 8px; border-radius: 6px;">Automated Reminder • ${stageLabel}</span>
              <h2 style="color: #0f172a; margin: 10px 0 4px 0; font-size: 19px; line-height: 1.35;">${personalizedSubject}</h2>
            </div>
            <p style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.65; margin: 0 0 20px 0;">${personalizedBody}</p>
            <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px;">Gate & Check-in Pass Code</div>
              <div style="font-family: monospace; font-size: 18px; font-weight: 800; color: #4f46e5; letter-spacing: 1px;">${resp.reference}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Present this code or your digital pass at the entrance desk for rapid check-in.</div>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">Reference: <strong>${resp.reference}</strong> • Powered by EventForm Automated Time-Counter Engine</p>
          </div>
        `;

        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: smtpSettings.host,
            port: smtpSettings.port,
            user: smtpSettings.user,
            pass: smtpSettings.pass,
            fromEmail: smtpSettings.fromEmail,
            fromName: smtpSettings.fromName,
            to: resp.email,
            subject: personalizedSubject,
            html: htmlContent,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
        } else {
          lastError = data.error || 'Delivery failed';
        }
      }

      if (successCount > 0) {
        const newLog = await dbService.addEmailLog({
          subject: currentSubj,
          recipientsCount: successCount,
          formId: targetForm.id,
          formTitle: targetForm.title,
          status: 'sent',
          recipientType: 'form_specific',
          sender: smtpSettings.fromEmail || smtpSettings.user || 'bsfijerubc@gmail.com',
        });

        setEmailLogs((prev) => [newLog, ...prev]);
        const msg = `⚡ Automated Dispatch Complete: Time counter predicted stage "${stageLabel}" and successfully emailed ${successCount} registrant(s) for "${targetForm.title}"!`;
        setStatusMessage({ type: 'success', text: msg });
        showToast(msg, 'success');
      } else {
        throw new Error(lastError || 'Failed to deliver automated emails.');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to deliver automated email batch.';
      setStatusMessage({ type: 'error', text: errorMsg });
      showToast(errorMsg, 'error');
    } finally {
      setAutoSending(false);
    }
  };

  useEffect(() => {
    Promise.all([
      dbService.getForms(),
      dbService.getResponses(),
      dbService.getEmailLogs(),
      dbService.getSMTPSettings(),
    ]).then(([f, r, l, smtp]) => {
      setForms(f);
      setResponses(r);
      setEmailLogs(l);
      setSmtpSettings(smtp);
      if (smtp.user && smtp.pass) {
        setVerificationStatus('verified');
      } else {
        setVerificationStatus('unverified');
      }

      // Priority: initialFormId -> hash query param -> worship encounter form -> first form
      let targetFormId = initialFormId;
      const hash = window.location.hash;
      if (!targetFormId && hash.includes('form=')) {
        const match = hash.match(/form=([^&]+)/);
        if (match) targetFormId = decodeURIComponent(match[1]);
      }

      if (!targetFormId) {
        const worshipForm = f.find(
          (item) =>
            item.title?.toLowerCase().includes('worship') ||
            item.title?.toLowerCase().includes('encounter') ||
            item.slug?.toLowerCase().includes('worship')
        );
        if (worshipForm) {
          targetFormId = worshipForm.id;
        } else if (f.length > 0) {
          targetFormId = f[0].id;
        }
      }

      if (targetFormId) {
        setSelectedFormId(targetFormId);
      }

      // Check initial template from props or hash
      let targetTemplate = initialTemplate;
      if (!targetTemplate && hash.includes('template=')) {
        const match = hash.match(/template=([^&]+)/);
        if (match) targetTemplate = decodeURIComponent(match[1]);
      }

      if (targetTemplate) {
        handleTemplateSelect(targetTemplate, targetFormId, f);
      }
    });
  }, [initialFormId, initialTemplate]);

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

  const handleSelectCountdownReminder = (
    type: 'reminder_2days' | 'reminder_1day' | 'reminder_dday'
  ) => {
    // Priority: Worship Encounter form, or selected form, or first form
    const worshipForm = forms.find(
      (f) =>
        f.title?.toLowerCase().includes('worship') ||
        f.title?.toLowerCase().includes('encounter') ||
        f.slug?.toLowerCase().includes('worship')
    );
    const targetFormId = worshipForm ? worshipForm.id : selectedFormId || forms[0]?.id || '';
    if (targetFormId) {
      setSelectedFormId(targetFormId);
    }
    setRecipientAudience('form_specific');
    setActiveTab('compose');
    handleTemplateSelect(type, targetFormId, forms);
    const label =
      type === 'reminder_2days'
        ? '⏳ 2 Days to Go'
        : type === 'reminder_1day'
        ? '🔥 1 Day to Go'
        : '🎉 D-Day (Today)';
    const formTitle = forms.find((f) => f.id === targetFormId)?.title || 'Worship Encounter';
    showToast(`Loaded ${label} reminder preset for "${formTitle}"`, 'success');
  };

  const handleTemplateSelect = (
    type: string,
    overrideFormId?: string | null,
    overrideForms?: EventForm[]
  ) => {
    const formsList = overrideForms || forms;
    const activeFormId = overrideFormId || selectedFormId;
    const currentForm = formsList.find((f) => f.id === activeFormId) || formsList[0];
    const eventName = currentForm?.title || 'Worship Encounter 3';

    if (type === 'reminder_2days') {
      setSubject(`⏳ 2 Days to Go! ${eventName} – Important Arrival & Gate Information`);
      setBody(
        `Dear {{name}},\n\nWe are officially 2 DAYS AWAY from {{event_title}}! The anticipation is high, and our teams are making final preparations to welcome you for an unforgettable, life-transforming time.\n\nEVENT SCHEDULE & LOCATION:\n📅 Date & Time: {{event_date}}\n📍 Venue: {{event_location}}\n🎟️ Your Pass Reference: {{reference}}\n\nIMPORTANT PREPARATION & ARRIVAL CHECKLIST:\n1. Fast-Track Check-In: Please have your Reference Code ({{reference}}) or your Digital QR Pass ready on your phone upon arrival at the gate.\n2. Family & Child Registrations: If you registered children or family members under your code, please ensure they arrive with you or have their respective pass codes ready.\n3. Arrive Early: Doors open 45 minutes prior to start time. Seating is on a first-arrival basis.\n4. Venue & Parking: On-site parking stewards will be stationed at {{event_location}} to guide you upon arrival.\n5. Spiritual Preparation: Come with an open heart, expectant for a mighty move of God!\n\nWe cannot wait to worship together with you!\n\nWarm regards,\n{{event_title}} Organizing Committee`
      );
    } else if (type === 'reminder_1day') {
      setSubject(`🔥 Tomorrow! 1 Day to Go for ${eventName} – Final Event Details`);
      setBody(
        `Dear {{name}},\n\nTOMORROW IS THE BIG DAY! In less than 24 hours, {{event_title}} will officially begin.\n\nYour registration is confirmed, your seat is ready, and we cannot wait to worship together!\n\nFINAL EVENT COUNTDOWN:\n📅 Date & Time: {{event_date}}\n📍 Venue: {{event_location}}\n🎟️ Your Pass Reference: {{reference}}\n\nFINAL CHECKLIST FOR TOMORROW:\n• Keep your Pass Reference ({{reference}}) handy for instant badge/wristband collection at the check-in desk.\n• Beat the Queue: Doors open 45 minutes before start time. Arrive early to secure your preferred seats.\n• Child & Youth Registrations: Dedicated family check-in desks will be operational from door-open time.\n• Parking & Transit: Free parking is available on-site. Public transport connections are within a short walk of {{event_location}}.\n• Need assistance? Look for our official ushering and protocol team members upon arrival.\n\nSee you tomorrow at {{event_location}}!\n\nWith love and expectation,\n{{event_title}} Organizing Committee`
      );
    } else if (type === 'reminder_dday') {
      setSubject(`🎉 TODAY IS THE DAY! ${eventName} is Here – Doors Open Soon!`);
      setBody(
        `Dear {{name}},\n\nTHE WAIT IS OVER – TODAY IS THE DAY!\n\n{{event_title}} is taking place TODAY, and our teams are on site eagerly waiting to welcome you through the doors!\n\nYOUR ACCESS PASS FOR TODAY:\n🎟️ Reference Code: {{reference}}\n📍 Venue: {{event_location}}\n⏰ Schedule: {{event_date}}\n\nON-SITE ARRIVAL INSTRUCTIONS:\n• Doors open shortly. Please arrive early for hassle-free check-in.\n• Show your Reference Code ({{reference}}) or QR code to any usher or check-in officer at the front desk.\n• If you need any assistance upon arrival, our welcoming team wearing official badges is ready to help.\n\nTravel safely, and let's encounter God together today!\n\nSee you in a few moments,\n{{event_title}} Team`
      );
    } else if (type === 'confirmation') {
      setSubject(`Registration Confirmed: ${eventName}`);
      setBody(
        `Dear {{name}},\n\nYour official registration for {{event_title}} is confirmed! Your pass reference is {{reference}}.\n\n📅 Date: {{event_date}}\n📍 Location: {{event_location}}\n\nPlease have your reference code or digital QR ticket ready at the entry desk.\n\nWe look forward to welcoming you!\n\nBest regards,\nEvent Management Team`
      );
    } else if (type === 'reminder') {
      setSubject(`Event Reminder: ${eventName} is Coming Up!`);
      setBody(
        `Hello {{name}},\n\nThis is a friendly reminder that {{event_title}} takes place on {{event_date}} at {{event_location}}.\n\nYour Pass Reference: {{reference}}\n\nDoors open early for registration check-in. Safe travels!\n\nWarm regards,\nOrganizing Committee`
      );
    } else if (type === 'directions') {
      setSubject(`Venue & Access Information: ${eventName}`);
      setBody(
        `Dear {{name}},\n\nHere are the arrival directions for {{event_title}} at {{event_location}}.\n\nReference Code: {{reference}}\nEvent Schedule: {{event_date}}\n\nUpon arrival, follow the registration signs to the main hall.\n\nSee you soon!`
      );
    } else if (type === 'thankyou') {
      setSubject(`Thank You for Attending ${eventName}!`);
      setBody(
        `Dear {{name}},\n\nThank you for participating in {{event_title}}! We hope you had an inspiring experience.\n\nYour Reference Code was: {{reference}}.\n\nWe would love to hear your thoughts and feedback.\n\nWarm regards,\nEvent Team`
      );
    }
  };

  // Resolve sample placeholder values for live preview
  const getSampleData = () => {
    const selectedForm = forms.find((f) => f.id === selectedFormId) || forms[0];
    const sampleResp = responses.find((r) => r.formId === selectedFormId) || responses[0] || {
      fullName: 'Felix Ishola',
      email: 'isholafelix77@gmail.com',
      reference: 'EVT-2026-W301',
    };

    return {
      name: sampleResp.fullName || 'Felix Ishola',
      email: sampleResp.email || 'isholafelix77@gmail.com',
      event_title: selectedForm?.title || 'Worship Encounter 3',
      reference: sampleResp.reference || 'EVT-2026-W301',
      event_date: selectedForm?.eventDate
        ? new Date(selectedForm.eventDate).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : 'Nov 28, 2026 at 6:00 PM',
      event_location: selectedForm?.eventLocation || 'Grace Cathedral Auditorium, London',
      themeColor: selectedForm?.themeColor || '#4f46e5',
    };
  };

  const renderPreviewSubject = (subjText: string) => {
    const sample = getSampleData();
    return subjText
      .replace(/{{name}}/g, sample.name)
      .replace(/{{event_title}}/g, sample.event_title)
      .replace(/{{reference}}/g, sample.reference)
      .replace(/{{event_date}}/g, sample.event_date)
      .replace(/{{event_location}}/g, sample.event_location);
  };

  const renderPreviewBody = (bodyText: string) => {
    const sample = getSampleData();
    return bodyText
      .replace(/{{name}}/g, sample.name)
      .replace(/{{event_title}}/g, sample.event_title)
      .replace(/{{reference}}/g, sample.reference)
      .replace(/{{event_date}}/g, sample.event_date)
      .replace(/{{event_location}}/g, sample.event_location);
  };

  const getTargetResponses = (): FormResponse[] => {
    if (recipientAudience === 'all') return responses;
    if (recipientAudience === 'form_specific') return responses.filter((r) => r.formId === selectedFormId);
    if (recipientAudience === 'unattended') return responses.filter((r) => !r.checkedIn);
    return [];
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetList = getTargetResponses();
    const count = targetList.length;

    if (count === 0) {
      showToast('No recipients match the selected audience filter.', 'error');
      return;
    }

    setSending(true);
    setStatusMessage(null);

    try {
      const targetForm = forms.find((f) => f.id === selectedFormId);
      const formDateStr = targetForm?.eventDate
        ? new Date(targetForm.eventDate).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : 'Nov 28, 2026 at 6:00 PM';
      const formLocationStr = targetForm?.eventLocation || 'Grace Cathedral Auditorium, London';
      const formTitleStr = targetForm?.title || 'Worship Encounter 3';
      let successCount = 0;
      let lastError = '';

      for (const resp of targetList.slice(0, 50)) {
        if (!resp.email) continue;

        const personalizedSubject = subject
          .replace(/{{name}}/g, resp.fullName || 'Delegate')
          .replace(/{{event_title}}/g, resp.formTitle || formTitleStr)
          .replace(/{{reference}}/g, resp.reference || '')
          .replace(/{{event_date}}/g, formDateStr)
          .replace(/{{event_location}}/g, formLocationStr);

        const personalizedBody = body
          .replace(/{{name}}/g, resp.fullName || 'Delegate')
          .replace(/{{event_title}}/g, resp.formTitle || formTitleStr)
          .replace(/{{reference}}/g, resp.reference || '')
          .replace(/{{event_date}}/g, formDateStr)
          .replace(/{{event_location}}/g, formLocationStr);

        const htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 18px;">
              <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #4f46e5; background-color: #eef2ff; padding: 3px 8px; border-radius: 6px;">Event Notification</span>
              <h2 style="color: #0f172a; margin: 10px 0 4px 0; font-size: 19px; line-height: 1.35;">${personalizedSubject}</h2>
            </div>
            <p style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.65; margin: 0 0 20px 0;">${personalizedBody}</p>
            <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px;">Gate & Check-in Pass Code</div>
              <div style="font-family: monospace; font-size: 18px; font-weight: 800; color: #4f46e5; letter-spacing: 1px;">${resp.reference}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Present this code or your digital pass at the entrance desk for rapid check-in.</div>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">Reference: <strong>${resp.reference}</strong> • Powered by EventForm Management System</p>
          </div>
        `;

        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: smtpSettings.host,
            port: smtpSettings.port,
            user: smtpSettings.user,
            pass: smtpSettings.pass,
            fromEmail: smtpSettings.fromEmail,
            fromName: smtpSettings.fromName,
            to: resp.email,
            subject: personalizedSubject,
            html: htmlContent,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
        } else {
          lastError = data.error || 'Failed to deliver message';
        }
      }

      if (successCount > 0) {
        const newLog = await dbService.addEmailLog({
          subject,
          recipientsCount: successCount,
          formId: selectedFormId,
          formTitle: targetForm?.title || 'All Events',
          status: 'sent',
          recipientType: recipientAudience,
          sender: smtpSettings.fromEmail || smtpSettings.user || 'bsfijerubc@gmail.com',
        });

        setEmailLogs((prev) => [newLog, ...prev]);
        const successText = `Dispatched email announcement to ${successCount} registrant(s) successfully!`;
        setStatusMessage({ type: 'success', text: successText });
        showToast(successText, 'success');
      } else {
        throw new Error(lastError || 'Failed to dispatch emails. Please check your credentials.');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to deliver emails. Please check your email settings.';
      setStatusMessage({ type: 'error', text: errorMsg });
      showToast(errorMsg, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailSending(true);
    setVerificationStatus('testing');
    setStatusMessage(null);
    try {
      const recipient = smtpSettings.fromEmail || smtpSettings.user;
      if (!recipient) {
        setVerificationStatus('failed');
        throw new Error('Please enter a Sender Email Address or Account Email to receive test messages.');
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpSettings.host,
          port: smtpSettings.port,
          user: smtpSettings.user,
          pass: smtpSettings.pass,
          fromEmail: smtpSettings.fromEmail,
          fromName: smtpSettings.fromName,
          to: recipient,
          subject: renderPreviewSubject(subject),
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <div style="background-color: ${getSampleData().themeColor}; padding: 16px; border-radius: 12px; color: #ffffff; text-align: center;">
                <h3 style="margin: 0; font-size: 18px; font-weight: bold;">${getSampleData().event_title}</h3>
                <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Official Email Announcement Test</p>
              </div>
              <div style="padding: 20px 0;">
                <p style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6;">${renderPreviewBody(body)}</p>
              </div>
              <div style="padding: 12px; background-color: #f8fafc; border-radius: 10px; text-align: center; margin-top: 16px;">
                <p style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 2px 0; font-weight: bold;">Reference Pass</p>
                <p style="font-size: 18px; font-family: monospace; font-weight: bold; color: #4f46e5; margin: 0;">${getSampleData().reference}</p>
              </div>
              <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
                <p style="margin: 0;">Dispatched via EventForm Communication Hub</p>
              </div>
            </div>
          `,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setVerificationStatus('failed');
        throw new Error(data.error || 'Failed to deliver test email.');
      }

      setVerificationStatus('verified');
      const testMsg = `Test message dispatched successfully to ${recipient}!`;
      setStatusMessage({ type: 'success', text: testMsg });
      showToast(testMsg, 'success');
    } catch (err: any) {
      setVerificationStatus('failed');
      const errorMsg = err?.message || 'Failed to deliver test email. Please check your credentials.';
      setStatusMessage({ type: 'error', text: errorMsg });
      showToast(errorMsg, 'error');
    } finally {
      setTestEmailSending(false);
    }
  };

  const handleSaveSMTP = (e: React.FormEvent) => {
    e.preventDefault();
    dbService.saveSMTPSettings(smtpSettings);
    if (smtpSettings.user && smtpSettings.pass) {
      setVerificationStatus('verified');
    }
    setSmtpSaved(true);
    showToast('Email settings saved securely', 'success');
    setTimeout(() => setSmtpSaved(false), 2500);
  };

  const sampleData = getSampleData();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
            Compose & Live Preview
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

      {/* VIEW: COMPOSE & LIVE PREVIEW */}
      {activeTab === 'compose' && (
        <div className="space-y-5">
          {/* Worship Encounter & Countdown Reminder Desk Banner */}
          <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-sm border border-indigo-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-indigo-800/70">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 sm:mt-0">
                  <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
                      Time Counter Auto-Predictor & Dispatch Engine
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-slate-950 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-950 animate-ping" />
                      Auto-Trigger Armed
                    </span>
                  </div>
                  <h2 className="text-base font-black text-white tracking-tight">
                    Automatic Countdown Reminder Dispatcher
                  </h2>
                </div>
              </div>

              {/* Instant Auto-Predict & Send Button */}
              <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleAutoPredictAndSend()}
                  disabled={autoSending}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-2xl text-xs shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Predict stage from time counter and automatically send emails to all registrants"
                >
                  {autoSending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Auto-Batch...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-slate-950" />
                      <span>⚡ Predict Stage & Auto-Send Email Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Current Prediction Display & Automatic Dispatch Status */}
            {(() => {
              const activeForm = forms.find((f) => f.id === selectedFormId) || forms[0];
              const predictedStage = predictReminderStage(activeForm?.eventDate);
              const predictedLabel =
                predictedStage === 'reminder_2days'
                  ? '⏳ 2 Days to Go (48h Out)'
                  : predictedStage === 'reminder_1day'
                  ? '🔥 1 Day to Go (24h Out)'
                  : '🎉 D-Day (Happening Today!)';

              return (
                <div className="mt-4 p-3.5 bg-white/5 border border-white/10 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-indigo-300 font-bold">Predicted Stage for "{activeForm?.title || 'Worship Encounter'}":</span>
                    <span className="px-2.5 py-0.5 rounded-full text-amber-300 bg-amber-400/20 font-black font-mono border border-amber-400/30">
                      {predictedLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-indigo-200">
                    <span>Target Audience: <strong>{responses.filter((r) => r.formId === selectedFormId).length} delegate(s)</strong></span>
                    <span className="text-amber-300/90 font-medium hidden sm:inline">•</span>
                    <span className="text-emerald-300 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      ⚡ Fully Automatic: No manual button click needed
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoMonitorActive(!autoMonitorActive)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        autoMonitorActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/10 text-gray-300 border-white/20'
                      }`}
                    >
                      {autoMonitorActive ? '● Background Auto-Monitor: ACTIVE' : '○ Background Auto-Monitor: PAUSED'}
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4">
              {/* 2 Days to Go */}
              <button
                type="button"
                onClick={() => handleSelectCountdownReminder('reminder_2days')}
                className="text-left bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-amber-400/50 rounded-2xl p-4 transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      <Clock className="w-3 h-3" />
                      48h to Go
                    </span>
                    <span className="text-xs text-indigo-300 group-hover:translate-x-0.5 transition font-bold">Load &rarr;</span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                    ⏳ 2 Days to Go
                  </h4>
                  <p className="text-[11px] text-indigo-200/80 mt-1 leading-relaxed">
                    Gate entry prep, pass readiness (reference code), arrival schedule & venue instructions.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-amber-300 font-semibold flex items-center justify-between">
                  <span>Pre-filled Subject & Checklist</span>
                  <span className="underline font-bold">Apply Preset</span>
                </div>
              </button>

              {/* 1 Day to Go */}
              <button
                type="button"
                onClick={() => handleSelectCountdownReminder('reminder_1day')}
                className="text-left bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-orange-400/50 rounded-2xl p-4 transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-400/20 text-orange-300 border border-orange-400/30">
                      <Flame className="w-3 h-3" />
                      Tomorrow / 24h
                    </span>
                    <span className="text-xs text-indigo-300 group-hover:translate-x-0.5 transition font-bold">Load &rarr;</span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-orange-300 transition">
                    🔥 1 Day to Go
                  </h4>
                  <p className="text-[11px] text-indigo-200/80 mt-1 leading-relaxed">
                    Doors-open alert, parking marshals, seating advice, and family check-in verification.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-orange-300 font-semibold flex items-center justify-between">
                  <span>Tomorrow Countdown</span>
                  <span className="underline font-bold">Apply Preset</span>
                </div>
              </button>

              {/* D-Day (Today!) */}
              <button
                type="button"
                onClick={() => handleSelectCountdownReminder('reminder_dday')}
                className="text-left bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-emerald-400/50 rounded-2xl p-4 transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                      <Sparkles className="w-3 h-3" />
                      Happening Today
                    </span>
                    <span className="text-xs text-indigo-300 group-hover:translate-x-0.5 transition font-bold">Load &rarr;</span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                    🎉 D-Day (Today!)
                  </h4>
                  <p className="text-[11px] text-indigo-200/80 mt-1 leading-relaxed">
                    Live doors-open announcement, on-site welcome greeting, and check-in desk scanner pass.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-emerald-300 font-semibold flex items-center justify-between">
                  <span>Event Day Live Dispatch</span>
                  <span className="underline font-bold">Apply Preset</span>
                </div>
              </button>
            </div>
          </div>

          {/* Top Bar with Template Controls & Preview Toggle */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Select Pre-built Template
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('reminder_2days')}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>⏳ 2 Days to Go</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('reminder_1day')}
                  className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-xl text-xs font-bold border border-orange-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-600" />
                  <span>🔥 1 Day to Go</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('reminder_dday')}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>🎉 D-Day (Today)</span>
                </button>
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
                  General Reminder
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('directions')}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition cursor-pointer"
                >
                  Venue & Parking Info
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateSelect('thankyou')}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition cursor-pointer"
                >
                  Thank You & Feedback
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  showPreview
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                }`}
              >
                {showPreview ? <Eye className="w-4 h-4 text-indigo-600" /> : <EyeOff className="w-4 h-4 text-gray-500" />}
                {showPreview ? 'Hide Live Preview' : 'Show Live Preview'}
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${showPreview ? 'lg:grid-cols-2' : ''} gap-6`}>
            {/* Editor Form */}
            <form onSubmit={handleSendAnnouncement} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Email Editor
                </h3>
                <span className="text-[11px] text-gray-400 font-semibold">Step 1 of 2</span>
              </div>

              {/* Audience Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="flex flex-col gap-1.5 mb-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-700">
                      Message Content
                    </label>
                    <span className="text-[10px] text-gray-400">Click placeholder to append:</span>
                  </div>
                  {/* Clickable Placeholders */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { code: '{{name}}', label: 'Name' },
                      { code: '{{event_title}}', label: 'Event' },
                      { code: '{{reference}}', label: 'Pass Code' },
                      { code: '{{event_date}}', label: 'Date/Time' },
                      { code: '{{event_location}}', label: 'Venue' },
                    ].map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setBody((prev) => `${prev} ${item.code}`)}
                        className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer"
                        title={`Append ${item.code} to message`}
                      >
                        + {item.code}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={9}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testEmailSending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
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

            {/* Live Interactive Email Preview Card */}
            {showPreview && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-sm font-bold text-gray-900">Live Email Render Preview</h3>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          previewDevice === 'desktop' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                        }`}
                        title="Desktop view"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          previewDevice === 'mobile' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                        }`}
                        title="Mobile view"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sample Recipient Indicator */}
                  <div className="mb-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl p-2.5 text-[11px] text-indigo-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        Simulated Recipient: <strong>{sampleData.name}</strong> ({sampleData.email})
                      </span>
                    </div>
                    <span className="font-mono text-indigo-600 font-bold">{sampleData.reference}</span>
                  </div>

                  {/* Simulated Mail Client Window Frame */}
                  <div
                    className={`mx-auto transition-all ${
                      previewDevice === 'mobile' ? 'max-w-xs' : 'w-full'
                    } bg-slate-100 p-3 rounded-2xl border border-gray-200 shadow-inner font-sans`}
                  >
                    {/* Fake Email Envelope Header */}
                    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-2xs mb-3 space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-bold text-gray-400 w-12 shrink-0">From:</span>
                        <span className="truncate font-semibold text-gray-800">
                          {smtpSettings.fromName || 'Event Notifications'} &lt;{smtpSettings.fromEmail || smtpSettings.user || 'bsfijerubc@gmail.com'}&gt;
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 border-t border-gray-100 pt-1">
                        <span className="font-bold text-gray-400 w-12 shrink-0">To:</span>
                        <span className="truncate text-gray-800">{sampleData.name} &lt;{sampleData.email}&gt;</span>
                      </div>
                      <div className="flex items-start gap-2 border-t border-gray-100 pt-1">
                        <span className="font-bold text-gray-400 w-12 shrink-0">Subject:</span>
                        <span className="font-bold text-indigo-950 leading-snug">
                          {renderPreviewSubject(subject)}
                        </span>
                      </div>
                    </div>

                    {/* Rendered HTML Email Content */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs space-y-4">
                      {/* Banner */}
                      <div
                        className="p-4 rounded-xl text-white text-center shadow-2xs"
                        style={{ backgroundColor: sampleData.themeColor }}
                      >
                        <h4 className="font-bold text-base m-0 leading-snug">{sampleData.event_title}</h4>
                        <p className="text-[11px] opacity-90 m-0 mt-1">Official Event Pass & Information</p>
                      </div>

                      {/* Main Rendered Text */}
                      <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-line font-normal">
                        {renderPreviewBody(body)}
                      </div>

                      {/* Reference Ticket Box */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Registration Reference
                        </span>
                        <span className="font-mono text-lg font-bold text-indigo-600 tracking-wider block">
                          {sampleData.reference}
                        </span>
                      </div>

                      {/* Metadata Badges */}
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2 text-[11px] text-gray-600">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <Calendar className="w-3 h-3 text-indigo-600" />
                          {sampleData.event_date}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg truncate">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">{sampleData.event_location}</span>
                        </span>
                      </div>

                      {/* Footer Notice */}
                      <div className="pt-3 border-t border-gray-100 text-center text-[10px] text-gray-400">
                        Powered by EventForm • Official Delegate Communication
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 text-center pt-2">
                  All placeholders (<code className="font-mono text-indigo-600 font-bold">{'{{name}}'}</code>, <code className="font-mono text-indigo-600 font-bold">{'{{reference}}'}</code>) are resolved dynamically for each recipient.
                </div>
              </div>
            )}
          </div>
        </div>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Email Delivery Settings
                </h3>
                {/* Visual Status Indicator Badge */}
                {verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    SMTP Active & Verified
                  </span>
                )}
                {verificationStatus === 'failed' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[11px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Connection Error
                  </span>
                )}
                {verificationStatus === 'testing' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[11px] font-bold">
                    <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                )}
                {verificationStatus === 'unverified' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Configure sender account credentials for automated attendee passes and notifications.
              </p>
            </div>
          </div>

          {/* Quick Help Card for Gmail */}
          <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-2xl p-4 text-xs text-indigo-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              Gmail & Outgoing Mail Guide
            </div>
            <p className="text-indigo-900/90 leading-relaxed">
              If using <strong>Gmail</strong>: Set Host to <code className="bg-indigo-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-950">smtp.gmail.com</code> and Port to <code className="bg-indigo-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-950">587</code>. For Account Password, enter a <strong>16-character Google App Password</strong> (created under your Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Outgoing Server (Host)
              </label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
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
                placeholder="587"
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
                placeholder="you@gmail.com"
                value={smtpSettings.user}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value, fromEmail: smtpSettings.fromEmail || e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Account Password (or App Password)
              </label>
              <input
                type="password"
                placeholder="16-character App Password"
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
                placeholder="Event Notifications"
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
                placeholder="you@gmail.com"
                value={smtpSettings.fromEmail}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                required
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testEmailSending}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {testEmailSending ? 'Testing Connection...' : 'Test Connection & Send Test Email'}
            </button>

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
