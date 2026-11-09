import React from 'react';
import { ShieldAlert, KeyRound, ArrowLeft, ExternalLink } from 'lucide-react';

interface NotFoundPageProps {
  onOpenPortal?: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onOpenPortal }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500" />

        {/* 404 Badge */}
        <div className="mx-auto w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 shadow-inner">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <span className="inline-block px-3 py-1 bg-slate-700/60 border border-slate-600/50 rounded-full text-xs font-mono font-semibold text-indigo-300 uppercase tracking-widest mb-3">
          Event Registration Platform
        </span>

        <h1 className="text-3xl font-black tracking-tight text-white mb-2">
          Registrant Portal & Events
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Access your existing registration pass and manage your dependents using your unique Registration Code, or explore active event registration forms.
        </p>

        <div className="space-y-3 pt-4 border-t border-slate-700/50">
          <button
            onClick={() => {
              window.location.hash = 'portal';
              if (onOpenPortal) onOpenPortal();
              else window.location.reload();
            }}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <KeyRound className="w-4 h-4" />
            <span>Open Registrant Portal</span>
          </button>

          <button
            onClick={() => {
              window.location.hash = 'f=worship-encounter-3';
              window.location.reload();
            }}
            className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Worship Encounter 3 Form</span>
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-6 font-mono">
        Event Management Platform • Main Registrant & Dependent System
      </p>
    </div>
  );
};
