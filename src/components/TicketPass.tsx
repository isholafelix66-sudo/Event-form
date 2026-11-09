import React, { useEffect, useState } from 'react';
import { FormResponse, EventForm } from '../types';
import { generateQRCode } from '../lib/qr';
import {
  Calendar,
  MapPin,
  CheckCircle2,
  Share2,
  Ticket,
  Sparkles,
  Printer,
  MailCheck,
  Download
} from 'lucide-react';

interface TicketPassProps {
  response: FormResponse;
  form?: EventForm | null;
  onClose?: () => void;
  onRegisterAnother?: () => void;
}

export const TicketPass: React.FC<TicketPassProps> = ({
  response,
  form,
  onRegisterAnother,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // Generate QR code encoding the reference code and event verification
    const qrPayload = JSON.stringify({
      ref: response.reference,
      formId: response.formId,
      name: response.fullName,
      email: response.email,
    });
    generateQRCode(qrPayload).then((url) => setQrCodeUrl(url));
  }, [response]);

  const handlePrint = () => {
    window.print();
  };

  const handleAddToCalendar = () => {
    const title = response.formTitle;
    const location = form?.eventLocation || '';
    const description = form?.description || `Registration pass: ${response.reference}`;
    const startDate = form?.eventDate ? new Date(form.eventDate) : new Date();
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatICSDate = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EventForm//Event Pass//EN',
      'BEGIN:VEVENT',
      `UID:${response.reference}@eventform.io`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `LOCATION:${location.replace(/\n/g, '\\n')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${response.formSlug || 'event'}-pass.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    const shareText = `Here is my confirmed event pass for ${response.formTitle} (Reference: ${response.reference})!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: response.formTitle,
          text: shareText,
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Event ticket reference copied to clipboard!');
    }
  };

  return (
    <div className="max-w-xl mx-auto my-4 sm:my-6 p-2 sm:p-4">
      {/* Success & Email Notification */}
      <div className="mb-6 bg-emerald-50/90 border border-emerald-200 rounded-3xl p-5 sm:p-6 text-center shadow-xs">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl mb-3 shadow-2xs">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
          Registration Confirmed!
        </h2>
        <p className="text-emerald-800 text-xs sm:text-sm mt-1 max-w-md mx-auto leading-relaxed">
          {form?.confirmationMessage ||
            'Your registration has been successfully received. Present this digital pass or QR code at entry.'}
        </p>

        {/* Confirmation Email Badge */}
        <div className="mt-4 pt-3 border-t border-emerald-200/80 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-white/70 px-4 py-2 rounded-xl shadow-2xs">
          <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Confirmation email dispatched to <strong>{response.email}</strong>
          </span>
        </div>
      </div>

      {/* The Ticket Pass Card */}
      <div
        id="printable-ticket"
        className="bg-white rounded-3xl shadow-xl border border-gray-200/80 overflow-hidden relative"
      >
        {/* Top Header Banner */}
        <div
          className="p-6 text-white relative overflow-hidden"
          style={{
            backgroundColor: form?.themeColor || '#4f46e5',
            backgroundImage: form?.coverImage
              ? `linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.8)), url(${form.coverImage})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20">
              <Ticket className="w-3.5 h-3.5" />
              OFFICIAL EVENT PASS
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-2xs">
              {response.status}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2 leading-snug">
            {response.formTitle}
          </h3>

          <div className="flex flex-col gap-1.5 text-xs text-white/90 font-medium">
            {form?.eventDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>
                  {new Date(form.eventDate).toLocaleString('en-US', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            )}
            {form?.eventLocation && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>{form.eventLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Perforated ticket punch divider */}
        <div className="relative h-6 bg-gray-50 flex items-center justify-between px-3 border-y border-dashed border-gray-200">
          <div className="w-5 h-5 rounded-full bg-slate-100 -ml-5.5 border-r border-gray-200" />
          <div className="text-[11px] font-mono font-bold tracking-widest text-gray-500 uppercase">
            REF: {response.reference}
          </div>
          <div className="w-5 h-5 rounded-full bg-slate-100 -mr-5.5 border-l border-gray-200" />
        </div>

        {/* Ticket Body */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          {/* Attendee Details */}
          <div className="sm:col-span-2 space-y-3.5">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                Attendee Name
              </div>
              <div className="text-lg font-black text-gray-900">
                {response.fullName && response.fullName !== 'Attendee'
                  ? response.fullName
                  : (Object.entries(response.answers || {}).find(
                      ([k, v]) => typeof v === 'string' && v.length > 2 && !v.includes('@') && !v.startsWith('+') && !/^\d+$/.test(v) && v !== 'Yes' && v !== 'No'
                    )?.[1] as string || 'Attendee')}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                Email
              </div>
              <div className="text-xs font-semibold text-gray-700 truncate">{response.email}</div>
            </div>

            {response.phone && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  Contact Phone
                </div>
                <div className="text-xs font-semibold text-gray-700">{response.phone}</div>
              </div>
            )}

            <div className="pt-2 flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Registered {new Date(response.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-2xl border border-gray-200/70">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt={`QR code for ${response.reference}`}
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl object-contain shadow-xs bg-white p-1.5"
              />
            ) : (
              <div className="w-32 h-32 bg-gray-200 animate-pulse rounded-xl flex items-center justify-center text-xs text-gray-400">
                Generating QR...
              </div>
            )}
            <span className="mt-2 text-[11px] font-mono font-black text-gray-900 tracking-wider">
              {response.reference}
            </span>
            <span className="text-[9px] text-gray-400 text-center font-medium">Scan at entry desk</span>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="px-6 py-3 bg-slate-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="font-medium">
            Powered by <strong>EventForm</strong>
          </span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Non-Transferable
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-2.5 justify-center">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print / Save Pass
        </button>

        <button
          onClick={handleAddToCalendar}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-indigo-600" />
          Add to Calendar (.ics)
        </button>

        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          Share Pass
        </button>

        {onRegisterAnother && (
          <button
            onClick={onRegisterAnother}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Register Another Person
          </button>
        )}
      </div>
    </div>
  );
};
