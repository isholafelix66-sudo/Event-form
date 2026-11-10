import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { UserRole } from '../types';
import {
  Sparkles,
  Layers,
  Plus,
  Users,
  QrCode,
  UserCheck,
  Mail,
  Settings,
} from 'lucide-react';

export interface NavTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isAction?: boolean;
}

interface AnimatedBottomNavProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  currentRole: UserRole;
  onOpenMoreMenu?: () => void;
  accentColor?: string;
}

export const AnimatedBottomNav: React.FC<AnimatedBottomNavProps> = ({
  activeTab,
  onTabChange,
  currentRole,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Define tab items according to active role
  let items: NavTabItem[] = [];

  if (currentRole === 'agent') {
    items = [
      { id: 'bulk', label: 'Bulk Reg', icon: UserCheck },
      { id: 'responses', label: 'Responses', icon: Users },
    ];
  } else if (currentRole === 'checkin_officer') {
    items = [
      { id: 'checkin', label: 'Fast Check-In', icon: QrCode },
    ];
  } else if (currentRole === 'event_officer') {
    items = [
      { id: 'forms', label: 'Event Forms', icon: Layers },
      { id: 'responses', label: 'Responses', icon: Users },
    ];
  } else {
    // Admin / Super Admin - ALL 8 modules directly accessible in one mobile bar
    items = [
      { id: 'overview', label: 'Overview', icon: Sparkles },
      { id: 'forms', label: 'My Forms', icon: Layers },
      { id: 'builder', label: 'Create Form', icon: Plus, isAction: true },
      { id: 'responses', label: 'Responses', icon: Users },
      { id: 'checkin', label: 'Check-In Desk', icon: QrCode },
      { id: 'bulk', label: 'Bulk Reg', icon: UserCheck },
      { id: 'email', label: 'Email Centre', icon: Mail },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];
  }

  // Scroll active tab into view when activeTab changes
  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeTab]);

  return (
    <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 pointer-events-auto select-none">
      {/* Scrollable Floating Dock Bar */}
      <div className="relative bg-slate-950/95 backdrop-blur-xl border border-slate-800/90 text-white rounded-2xl shadow-2xl p-1.5">
        {/* Left/Right Gradient Fades indicating horizontal scrollability */}
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none rounded-l-2xl" />
        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none rounded-r-2xl" />

        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-1 py-0.5 max-w-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                data-active={isActive ? 'true' : 'false'}
                onClick={() => onTabChange(item.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all duration-200 cursor-pointer focus:outline-none active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-500 text-white shadow-md border border-indigo-400/30'
                    : item.isAction
                    ? 'bg-indigo-950/70 text-indigo-300 hover:bg-indigo-900/80 border border-indigo-800/50'
                    : 'bg-slate-900/80 hover:bg-slate-800/90 text-slate-300 hover:text-white border border-slate-800/50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive ? 'scale-110 text-white stroke-[2.2]' : 'text-slate-400 stroke-[1.8]'
                  }`}
                />
                <span className="whitespace-nowrap tracking-tight">{item.label}</span>

                {/* Subtle active glow pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeDockGlow"
                    className="absolute inset-0 rounded-xl bg-indigo-500/20 pointer-events-none"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
