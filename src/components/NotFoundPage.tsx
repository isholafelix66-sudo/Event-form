import React from 'react';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500" />

        {/* 404 Badge */}
        <div className="mx-auto w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400 mb-6 shadow-inner">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <span className="inline-block px-3 py-1 bg-slate-700/60 border border-slate-600/50 rounded-full text-xs font-mono font-semibold text-rose-300 uppercase tracking-widest mb-3">
          Error 404 • Page Not Found
        </span>

        <h1 className="text-3xl font-black tracking-tight text-white mb-2">
          Invalid Event Link
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          The event registration page or resource you are looking for could not be found or has been moved. Please double-check the event link provided by your organizers.
        </p>

        <div className="pt-4 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '#f=worship-encounter-3';
              }
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-6 font-mono">
        Event Management Platform • Isolated Access Mode
      </p>
    </div>
  );
};
