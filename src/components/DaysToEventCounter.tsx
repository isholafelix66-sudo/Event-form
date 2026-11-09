import React, { useState, useEffect } from 'react';
import { Clock, Timer } from 'lucide-react';

interface DaysToEventCounterProps {
  eventDate: string;
  compact?: boolean;
  variant?: 'default' | 'compact' | 'header' | 'banner';
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export const DaysToEventCounter: React.FC<DaysToEventCounterProps> = ({
  eventDate,
  compact = false,
  variant,
  className = '',
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
  });

  useEffect(() => {
    if (!eventDate) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(eventDate).getTime();
      const diff = target - now;

      if (isNaN(target) || diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000); // Live tick every second

    return () => clearInterval(interval);
  }, [eventDate]);

  if (!eventDate || timeLeft.isPast) return null;

  const pad = (num: number) => String(num).padStart(2, '0');
  const mode = variant || (compact ? 'compact' : 'default');

  // Formatted string: e.g. "5d : 04h : 48m : 22s"
  const formattedCountdown = `${timeLeft.days}d : ${pad(timeLeft.hours)}h : ${pad(timeLeft.minutes)}m : ${pad(timeLeft.seconds)}s`;
  const compactCountdown = `${timeLeft.days}d ${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s`;

  if (mode === 'header') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600 text-white font-mono font-bold text-xs shadow-sm shadow-indigo-500/30 border border-indigo-400/40 ${className}`}
        title="Live event countdown"
      >
        <Timer className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
        <span className="tracking-wider">{formattedCountdown}</span>
      </div>
    );
  }

  if (mode === 'banner') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/75 backdrop-blur-md text-white font-mono font-black text-xs border border-white/20 shadow-xl ${className}`}
        title="Live event countdown"
      >
        <Clock className="w-4 h-4 text-amber-300 shrink-0" />
        <span className="tracking-widest">{formattedCountdown}</span>
      </div>
    );
  }

  if (mode === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 text-indigo-700 font-mono font-bold text-[11px] ${className}`}
        title="Live event countdown"
      >
        <Clock className="w-3 h-3 shrink-0 text-indigo-600" />
        <span>{compactCountdown}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 text-indigo-800 font-mono font-bold text-xs shadow-2xs ${className}`}
      title="Live event countdown"
    >
      <Clock className="w-4 h-4 shrink-0 text-indigo-600 animate-spin-slow" />
      <span className="tracking-wider">{formattedCountdown}</span>
    </div>
  );
};
