import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
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
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === ADMIN_PASSCODE) {
      setAdminSessionUnlocked(true);
      showToast('Admin session unlocked successfully', 'success');
      setPasscode('');
      onSuccess();
    } else {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
      showToast('Incorrect passcode. Access denied.', 'error');
      setPasscode('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden transition-all ${
          errorShake ? 'animate-shake ring-2 ring-rose-500' : ''
        }`}
      >
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500" />

        {/* Lock Icon Header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-2">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              Administrative Security Lock
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Admin App Lock
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Enter the administrator passcode to access administrative controls and settings.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Passcode
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                autoFocus
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-slate-900"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? 'Hide passcode' : 'Show passcode'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Unlock Admin Access</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

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
