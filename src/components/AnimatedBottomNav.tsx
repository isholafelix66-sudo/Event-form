import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { UserRole } from '../types';
import {
  Sparkles,
  Layers,
  Plus,
  Users,
  QrCode,
  Menu,
  UserCheck,
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
  onOpenMoreMenu: () => void;
  accentColor?: string;
}

export const AnimatedBottomNav: React.FC<AnimatedBottomNavProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onOpenMoreMenu,
  accentColor = '#4f46e5',
}) => {
  // Define tab items according to active role
  let items: NavTabItem[] = [];

  if (currentRole === 'agent') {
    items = [
      { id: 'bulk', label: 'Bulk Reg', icon: UserCheck },
      { id: 'responses', label: 'Responses', icon: Users },
    ];
  } else if (currentRole === 'checkin_officer') {
    items = [
      { id: 'checkin', label: 'Check-In', icon: QrCode },
    ];
  } else if (currentRole === 'event_officer') {
    items = [
      { id: 'forms', label: 'Forms', icon: Layers },
      { id: 'responses', label: 'Responses', icon: Users },
    ];
  } else {
    // Admin / Super Admin
    items = [
      { id: 'overview', label: 'Overview', icon: Sparkles },
      { id: 'forms', label: 'Forms', icon: Layers },
      { id: 'builder', label: 'Create', icon: Plus, isAction: true },
      { id: 'responses', label: 'Responses', icon: Users },
      { id: 'checkin', label: 'Check-In', icon: QrCode },
      { id: 'more', label: 'More', icon: Menu },
    ];
  }

  // Determine active item id
  let activeId = activeTab;
  if (['bulk', 'email', 'settings'].includes(activeTab) && !items.some((i) => i.id === activeTab)) {
    activeId = 'more';
  }

  return (
    <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 pointer-events-auto">
      {/* Modern Floating Dock */}
      <nav className="bg-slate-950/95 backdrop-blur-xl border border-slate-800/90 text-white rounded-2xl shadow-2xl p-1.5 flex items-center justify-around gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;

          // Special Center Action Button style for "Create Form"
          if (item.isAction) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className="relative flex-1 flex flex-col items-center justify-center py-1 group cursor-pointer focus:outline-none"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition transform group-hover:scale-105 active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 ring-2 ring-indigo-400'
                      : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-bold text-slate-300 mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'more') {
                  onOpenMoreMenu();
                } else {
                  onTabChange(item.id);
                }
              }}
              className="relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl cursor-pointer focus:outline-none transition group select-none"
            >
              {/* Animated active pill background */}
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-indigo-600/90 rounded-xl shadow-xs"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              {/* Icon & Label */}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <Icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive
                      ? 'text-white scale-110 stroke-[2.2]'
                      : 'text-slate-400 group-hover:text-slate-200 stroke-[1.8]'
                  }`}
                />
                <span
                  className={`text-[10px] font-bold mt-0.5 tracking-tight transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
