import React, { useState, useEffect, useRef } from 'react';
import { EventForm, FormResponse } from '../types';
import { dbService } from '../services/db';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Mail,
  Phone,
  Ticket,
  Camera,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useToast } from '../context/ToastContext';

interface CheckInScannerProps {
  currentOfficerName?: string;
}

export const CheckInScanner: React.FC<CheckInScannerProps> = ({
  currentOfficerName = 'Officer Davis',
}) => {
  const { showToast } = useToast();
  const [forms, setForms] = useState<EventForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<FormResponse | null>(null);
  const [checkInNotice, setCheckInNotice] = useState<{
    type: 'success' | 'already_checked' | 'not_found';
    message: string;
    timestamp?: string;
    officer?: string;
  } | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const unsubForms = dbService.subscribeForms((f) => {
      setForms(f);
    });
    const unsubResponses = dbService.subscribeResponses((r) => {
      setResponses(r);
    });

    return () => {
      unsubForms();
      unsubResponses();
    };
  }, []);

  // Filtered list for attendance stats
  const activeEventResponses = selectedFormId === 'all'
    ? responses
    : responses.filter((r) => r.formId === selectedFormId);

  const totalAttendees = activeEventResponses.length;
  const checkedInCount = activeEventResponses.filter((r) => r.checkedIn).length;
  const attendanceRate = totalAttendees > 0 ? Math.round((checkedInCount / totalAttendees) * 100) : 0;

  // Manual or QR lookup
  const handleVerifyQuery = (query: string) => {
    const clean = query.trim().toLowerCase();
    if (!clean) return;

    // Search across reference code, email, full name, or phone number
    const matches = responses.filter((r) => {
      const formMatches = selectedFormId === 'all' || r.formId === selectedFormId;
      if (!formMatches) return false;
      const refMatch = r.reference.toLowerCase().includes(clean);
      const emailMatch = r.email.toLowerCase().includes(clean);
      const nameMatch = r.fullName.toLowerCase().includes(clean);
      const phoneMatch = r.phone ? r.phone.toLowerCase().includes(clean) : false;
      return refMatch || emailMatch || nameMatch || phoneMatch;
    });

    const found = matches[0];

    if (found) {
      setActiveCandidate(found);
      if (found.checkedIn) {
        setCheckInNotice({
          type: 'already_checked',
          message: 'Warning: Attendee has already been checked in!',
          timestamp: found.checkedInAt,
          officer: found.checkedInBy,
        });
        showToast(`Warning: ${found.fullName} is already checked in!`, 'error');
      } else {
        setCheckInNotice(null);
        showToast(`Found registration record for ${found.fullName}`, 'info');
      }
    } else {
      setActiveCandidate(null);
      setCheckInNotice({
        type: 'not_found',
        message: `No registration found matching "${query}". Search supports Full Name, Email, Reference Code (e.g. EVT-2026-XXXX), or Phone Number.`,
      });
      showToast(`No attendee record matching "${query}"`, 'error');
    }
  };

  const handlePerformCheckIn = async () => {
    if (!activeCandidate) return;

    if (activeCandidate.checkedIn) {
      showToast('This attendee is already marked as checked in.', 'error');
      return;
    }

    const updated = await dbService.checkInAttendee(activeCandidate.id, currentOfficerName);
    if (updated) {
      setActiveCandidate(updated);
      setCheckInNotice({
        type: 'success',
        message: `Verified! ${updated.fullName} successfully checked in.`,
        timestamp: updated.checkedInAt,
        officer: currentOfficerName,
      });

      confetti({
        particleCount: 50,
        spread: 50,
      });

      showToast(`Checked in: ${updated.fullName}`, 'success');
    }
  };

  // Camera toggle simulation for real browsers
  const toggleCamera = async () => {
    if (isCameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsCameraActive(false);
    } else {
      setIsCameraActive(true);
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn('Camera stream permission note:', err);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Stats Banner */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" />
            Live Check-In Desk
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Event Attendance & QR Check-In
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Scan attendee digital QR codes or verify reference IDs to check in guests and prevent duplicates.
          </p>
        </div>

        {/* Form Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">Filter Event:</span>
          <select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-emerald-500 text-gray-800"
          >
            <option value="all">All Events ({responses.length} total)</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Attendance Stats Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Total Registrants
          </div>
          <div className="text-2xl font-black text-gray-900 mt-1">{totalAttendees}</div>
          <div className="text-[11px] text-gray-500 mt-1">Confirmed event delegates</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            Checked In
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{checkedInCount}</div>
          <div className="text-[11px] text-emerald-700 mt-1">Verified on site</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Attendance Rate</span>
            <span className="text-indigo-600 font-extrabold">{attendanceRate}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
          <div className="text-[11px] text-gray-400 mt-2">
            {totalAttendees - checkedInCount} attendees awaiting arrival
          </div>
        </div>
      </div>

      {/* Scanner & Lookup Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Search & Quick Pick / QR Camera */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600" />
              Scanner & Reference Lookup
            </h3>

            <button
              onClick={toggleCamera}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isCameraActive
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              {isCameraActive ? 'Close Camera' : 'Open Camera'}
            </button>
          </div>

          {/* Camera Viewfinder */}
          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-indigo-500">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-dashed border-emerald-400 m-8 rounded-xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded">
                  Align QR Code within frame
                </span>
              </div>
            </div>
          )}

          {/* Manual Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyQuery(searchQuery);
            }}
            className="space-y-3"
          >
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Enter Reference (e.g. EVT-2026-W301) or Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-24 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition"
              >
                Verify
              </button>
            </div>
          </form>

          {/* Quick Simulation Bar for easy testing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                All Event Registrants ({activeEventResponses.length})
              </div>
              <span className="text-[10px] text-indigo-600 font-semibold">Click to select for verification</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {activeEventResponses.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSearchQuery(r.reference);
                    handleVerifyQuery(r.reference);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left transition cursor-pointer flex items-center gap-1.5 ${
                    activeCandidate?.id === r.id
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : r.checkedIn
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-gray-50 hover:bg-indigo-50 text-gray-700 border-gray-200'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold">{r.reference}</span>
                  <span className="truncate max-w-[110px]">{r.fullName}</span>
                  {r.checkedIn && (
                    <Check className={`w-3 h-3 shrink-0 ${activeCandidate?.id === r.id ? 'text-white' : 'text-emerald-600'}`} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Verification Candidate Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Attendee Verification Record
            </div>

            {/* Notification message */}
            {checkInNotice && (
              <div
                className={`p-4 rounded-2xl mb-4 border flex items-start gap-3 text-xs ${
                  checkInNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : checkInNotice.type === 'already_checked'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {checkInNotice.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : checkInNotice.type === 'already_checked' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{checkInNotice.message}</div>
                  {checkInNotice.timestamp && (
                    <div className="text-[11px] opacity-80 mt-1">
                      Check-in time:{' '}
                      {new Date(checkInNotice.timestamp).toLocaleTimeString()}{' '}
                      {checkInNotice.officer && `by ${checkInNotice.officer}`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeCandidate ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                      {activeCandidate.reference}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        activeCandidate.checkedIn
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {activeCandidate.checkedIn ? 'CHECKED IN' : 'CONFIRMED'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{activeCandidate.fullName}</h3>
                    <p className="text-xs text-gray-500">{activeCandidate.email}</p>
                    {activeCandidate.phone && (
                      <p className="text-xs text-gray-500">{activeCandidate.phone}</p>
                    )}
                  </div>

                  {/* Church / Ministry affiliation */}
                  {(() => {
                    const attendeeChurch =
                      activeCandidate.answers?.['Church / Ministry'] ||
                      activeCandidate.answers?.['q-ministry'] ||
                      Object.entries(activeCandidate.answers || {}).find(
                        ([k, v]) => (k.toLowerCase().includes('church') || k.toLowerCase().includes('ministry')) && typeof v === 'string'
                      )?.[1];

                    return attendeeChurch ? (
                      <div className="text-xs text-gray-600">
                        <span className="font-bold text-gray-700">Church / Ministry:</span> {attendeeChurch}
                      </div>
                    ) : null;
                  })()}

                  {/* Child / Dependent Account Link Notice */}
                  {activeCandidate.parent_registration_id && (() => {
                    const parentRecord = responses.find(
                      (r) =>
                        r.reference === activeCandidate.parent_registration_id ||
                        r.id === activeCandidate.parent_registration_id
                    );

                    return (
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            Child / Dependent Account
                          </span>
                          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                            Parent: {activeCandidate.parent_registration_id}
                          </span>
                        </div>
                        <div className="text-xs text-indigo-950">
                          Parent Account: <strong>{parentRecord ? parentRecord.fullName : activeCandidate.parent_registration_id}</strong>
                          {parentRecord && (
                            <span className="ml-2 text-[11px] text-gray-500">
                              ({parentRecord.checkedIn ? '✅ Parent Checked In' : '⏳ Parent Pending Arrival'})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Linked Children Registered under this Parent */}
                  {(() => {
                    const linkedChildren = responses.filter(
                      (r) =>
                        r.parent_registration_id === activeCandidate.reference ||
                        r.parent_registration_id === activeCandidate.id
                    );

                    if (linkedChildren.length === 0) return null;

                    return (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            Registered Children ({linkedChildren.length})
                          </span>
                          <span className="text-[10px] font-bold text-indigo-700">
                            Family Account
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {linkedChildren.map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-indigo-100 text-xs"
                            >
                              <div>
                                <span className="font-bold text-gray-900">{child.fullName}</span>
                                <span className="font-mono text-[10px] text-gray-400 ml-1.5">{child.reference}</span>
                              </div>
                              <div>
                                {child.checkedIn ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Checked In
                                  </span>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      const updated = await dbService.checkInAttendee(child.id, currentOfficerName);
                                      if (updated) {
                                        showToast(`Checked in child ${child.fullName}`, 'success');
                                      }
                                    }}
                                    className="text-[10px] font-bold px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                                  >
                                    Check In
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 border-t border-gray-200 text-xs text-gray-600">
                    <div className="font-semibold text-gray-800">{activeCandidate.formTitle}</div>
                    <div className="text-[11px] text-gray-400">
                      Registered: {new Date(activeCandidate.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs">
                Scan a QR code or search by full name, email address, or reference code to verify an attendee.
              </div>
            )}
          </div>

          {/* Action buttons */}
          {activeCandidate && (
            <div className="pt-2">
              {activeCandidate.checkedIn ? (
                <div className="bg-gray-100 p-3 rounded-2xl text-center text-xs font-semibold text-gray-600 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Already Checked In • Duplicate Entry Prevented
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePerformCheckIn}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Attendee Check-In
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Live Searchable Attendance Directory */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Complete Event Attendees Directory ({activeEventResponses.length})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Instant check-in desk list. Search by Name, Email, Phone, or Pass Reference Code.
            </p>
          </div>

          {/* Directory Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Name, Email, Code..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim().length > 1) {
                  handleVerifyQuery(e.target.value);
                }
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>

        {/* Directory List Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">Pass Reference</th>
                <th className="px-4 py-3">Attendee Name</th>
                <th className="px-4 py-3">Email / Contact</th>
                <th className="px-4 py-3">Event Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {activeEventResponses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No attendee records found.
                  </td>
                </tr>
              ) : (
                activeEventResponses.map((r) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-indigo-50/50 transition ${
                      activeCandidate?.id === r.id ? 'bg-indigo-50/80 font-semibold' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {r.reference}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      <div>{r.fullName}</div>
                      {r.parent_registration_id && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                          Child Account ({r.parent_registration_id})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{r.email}</div>
                      {r.phone && <div className="text-[10px] text-gray-400">{r.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]">
                      {r.formTitle}
                    </td>
                    <td className="px-4 py-3">
                      {r.checkedIn ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Arrival
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          setActiveCandidate(r);
                          if (!r.checkedIn) {
                            const updated = await dbService.checkInAttendee(r.id, currentOfficerName);
                            if (updated) {
                              setActiveCandidate(updated);
                              showToast(`Checked in: ${updated.fullName}`, 'success');
                              confetti({ particleCount: 40, spread: 40 });
                            }
                          } else {
                            showToast(`${r.fullName} is already checked in.`, 'info');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          r.checkedIn
                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                      >
                        {r.checkedIn ? 'View Record' : 'Check In Now'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
