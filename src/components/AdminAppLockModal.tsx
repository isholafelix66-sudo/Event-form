import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, ShieldAlert, ArrowRight, Eye, EyeOff, AlertTriangle, RefreshCw, CheckCircle2, Mail, Key } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface AdminAppLockModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancelToRole?: (role: string) => void;
}

export const ADMIN_PASSCODE = 'Worship123';
export const ADMIN_SESSION_KEY = 'eventform_admin_unlocked';

export const isAdminSessionUnlocked = (): boolean => {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  } catch (e) {
    return false;
  }
};

export const setAdminSessionUnlocked = (unlocked: boolean): void => {
  try {
    if (unlocked) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch (e) {}
};

export const AdminAppLockModal: React.FC<AdminAppLockModalProps> = ({
  isOpen,
  onSuccess,
  onCancelToRole,
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  
  // Security lock & suspension states from backend
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState<number>(0);
  const [isSuspended, setIsSuspended] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const { showToast } = useToast();

  // Check server security status on mount and when modal opens
  const fetchSecurityStatus = async () => {
    try {
      const res = await fetch('/api/admin/status');
      if (res.ok) {
        const data = await res.json();
        setFailedAttempts(data.failedAttempts || 0);
        setIsSuspended(!!data.isSuspended);
        setIsLocked(!!data.isLocked);
        if (data.lockoutRemainingMs && data.lockoutRemainingMs > 0) {
          setLockoutRemainingMs(data.lockoutRemainingMs);
        } else {
          setLockoutRemainingMs(0);
        }
        if (data.message && data.isLocked) {
          setServerMessage(data.message);
        }
      }
    } catch (e) {
      console.warn('Could not query admin security status from server:', e);
    }
  };

  // Automatically parse and process recovery token from URL query string or hash
  const checkUrlRecoveryToken = async () => {
    let token: string | null = null;
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('recovery_token') || urlParams.get('token');

    if (!token && window.location.hash.includes('recovery_token=')) {
      const match = window.location.hash.match(/recovery_token=([^&]+)/);
      if (match) token = match[1];
    }

    if (token) {
      await handleRecoveryWithToken(token);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSecurityStatus();
      checkUrlRecoveryToken();
    }
  }, [isOpen]);

  // Countdown timer effect for 10-minute lockout
  useEffect(() => {
    if (lockoutRemainingMs <= 0) {
      if (isLocked) {
        setIsLocked(false);
        setServerMessage(null);
        fetchSecurityStatus();
      }
      return;
    }

    const interval = setInterval(() => {
      setLockoutRemainingMs((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          setIsLocked(false);
          setServerMessage(null);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutRemainingMs, isLocked]);

  if (!isOpen) return null;

  const handleRecoveryWithToken = async (tokenToUse: string) => {
    setIsSubmitting(true);
    setServerMessage(null);
    try {
      const res = await fetch('/api/admin/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToUse.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Admin account access successfully restored!', 'success');
        setIsSuspended(false);
        setIsLocked(false);
        setLockoutRemainingMs(0);
        setFailedAttempts(0);
        setServerMessage(null);
        setShowRecoveryForm(false);
        setManualToken('');

        // Clean up URL token without page reload
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname + (window.location.hash || '#admin');
          window.history.replaceState(null, '', cleanUrl);
        }
      } else {
        setServerMessage(data.message || 'Invalid or expired recovery token.');
        showToast(data.message || 'Recovery failed.', 'error');
      }
    } catch (e: any) {
      setServerMessage('Failed to verify recovery token with security server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isSuspended) return;

    setIsSubmitting(true);
    setServerMessage(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAdminSessionUnlocked(true);
        showToast('Admin session unlocked successfully', 'success');
        setPasscode('');
        onSuccess();
      } else {
        setErrorShake(true);
        setTimeout(() => setErrorShake(false), 500);
        setPasscode('');
        
        setFailedAttempts(data.failedAttempts || failedAttempts + 1);
        
        if (data.status === 'locked' || data.isLocked) {
          setIsLocked(true);
          const remaining = data.lockoutRemainingMs || (10 * 60 * 1000);
          setLockoutRemainingMs(remaining);
          setServerMessage(data.message || 'Login locked for 10 minutes due to failed attempts.');
          showToast('Account locked for 10 minutes.', 'error');
        } else if (data.status === 'suspended' || data.isSuspended) {
          setIsSuspended(true);
          setServerMessage(data.message || 'Admin login suspended due to 4 failed attempts. Security email dispatched.');
          showToast('Admin account suspended! Security email sent.', 'error');
        } else {
          setServerMessage(data.message || 'Incorrect passcode. Access denied.');
          showToast(data.message || 'Incorrect passcode.', 'error');
        }
      }
    } catch (err) {
      // Fallback local verification if server is unreachable
      if (passcode.trim() === ADMIN_PASSCODE) {
        setAdminSessionUnlocked(true);
        showToast('Admin session unlocked', 'success');
        setPasscode('');
        onSuccess();
      } else {
        setErrorShake(true);
        setTimeout(() => setErrorShake(false), 500);
        showToast('Incorrect passcode.', 'error');
        setPasscode('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCountdown = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden transition-all ${
          errorShake ? 'animate-shake ring-2 ring-rose-500' : ''
        }`}
      >
        {/* Top Accent Gradient */}
        <div
          className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${
            isSuspended
              ? 'from-rose-600 via-rose-500 to-red-600'
              : isLocked
              ? 'from-amber-600 via-amber-500 to-yellow-500'
              : 'from-indigo-600 via-purple-600 to-amber-500'
          }`}
        />

        {/* Lock Icon Header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center shadow-inner transition-colors ${
              isSuspended
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : isLocked
                ? 'bg-amber-50 border-amber-200 text-amber-600'
                : 'bg-indigo-50 border-indigo-100 text-indigo-600'
            }`}
          >
            {isSuspended ? (
              <ShieldAlert className="w-8 h-8 animate-pulse text-rose-600" />
            ) : isLocked ? (
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </div>

          <div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border ${
                isSuspended
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : isLocked
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              {isSuspended
                ? 'Account Suspended (4 Failed Attempts)'
                : isLocked
                ? '10-Minute Lockout Active'
                : 'Administrative Security Lock'}
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Admin Gateway
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              {isSuspended
                ? 'Admin login access has been suspended. A single-use recovery link was sent to your administrator email.'
                : isLocked
                ? 'Server security protocol engaged. Too many incorrect attempts.'
                : 'Enter the administrator passcode to access administrative controls and settings.'}
            </p>
          </div>
        </div>

        {/* Dynamic Status / Warning Banner */}
        {serverMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              isSuspended
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : isLocked
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{serverMessage}</div>
          </div>
        )}

        {/* Lockout Countdown Timer */}
        {isLocked && lockoutRemainingMs > 0 && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
              Lockout Expires In
            </p>
            <div className="text-3xl font-mono font-black text-amber-900 tracking-widest">
              {formatCountdown(lockoutRemainingMs)}
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              Backend enforced. Refreshing or changing browsers will not reset the timer.
            </p>
          </div>
        )}

        {/* Account Suspended Recovery UI */}
        {isSuspended ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <Mail className="w-4 h-4 text-rose-600" />
                <span>Security Recovery Email Sent</span>
              </div>
              <p className="leading-relaxed">
                Check your administrator email inbox (e.g., <span className="font-semibold text-rose-950 underline">isholafelix609@gmail.com</span>) for your 15-minute single-use recovery link.
              </p>
            </div>

            {showRecoveryForm ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualToken) handleRecoveryWithToken(manualToken);
                }}
                className="space-y-3 pt-2"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Enter Recovery Token
                  </label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste single-use recovery token"
                    className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono tracking-wider text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !manualToken.trim()}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  <span>Verify Recovery Token</span>
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowRecoveryForm(true)}
                className="w-full py-2.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold underline text-center cursor-pointer"
              >
                Have a recovery token? Enter manually
              </button>
            )}
          </div>
        ) : (
          /* Password Form */
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Admin Passcode
                </label>
                {failedAttempts > 0 && (
                  <span className="text-[11px] font-semibold text-amber-600 font-mono">
                    Attempt {failedAttempts} of 4
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter admin passcode"
                  disabled={isLocked || isSubmitting}
                  autoFocus
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLocked || isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer disabled:opacity-40"
                  title={showPassword ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLocked || isSubmitting || !passcode.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Unlock Admin Access</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Alternate Portals Links */}
        {onCancelToRole && (
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 mb-2">Looking for staff portals?</p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onCancelToRole('agent')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
              >
                /Agent Portal
              </button>
              <button
                type="button"
                onClick={() => onCancelToRole('event_officer')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
              >
                /Eventofficer Portal
              </button>
              <button
                type="button"
                onClick={() => onCancelToRole('checkin_officer')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
              >
                /checkiofficer Desk
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
