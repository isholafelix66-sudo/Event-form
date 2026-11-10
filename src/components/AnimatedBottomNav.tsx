import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
}

interface AnimatedBottomNavProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  currentRole: UserRole;
  onOpenMoreMenu: () => void;
  accentColor?: string; // Lime green default like reference image
}

export const AnimatedBottomNav: React.FC<AnimatedBottomNavProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onOpenMoreMenu,
  accentColor = '#84cc16', // Neon Lime matching reference image
}) => {
  // Build available items depending on role
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
      { id: 'builder', label: 'Create', icon: Plus },
      { id: 'responses', label: 'Responses', icon: Users },
      { id: 'checkin', label: 'Check-In', icon: QrCode },
      { id: 'more', label: 'More', icon: Menu },
    ];
  }

  // Find active index
  let activeIndex = items.findIndex((item) => item.id === activeTab);
  if (activeIndex === -1) {
    if (['bulk', 'email', 'settings'].includes(activeTab)) {
      activeIndex = items.findIndex((item) => item.id === 'more');
    }
    if (activeIndex === -1) activeIndex = 0;
  }

  const count = items.length;
  // Calculate percentage center for active index (0 to 100)
  const activePercent = count > 0 ? ((activeIndex + 0.5) / count) * 100 : 50;

  // Notch SVG path width calculation
  const notchHalfWidth = Math.min(10, 80 / count);
  const leftBound = Math.max(8, activePercent - notchHalfWidth);
  const rightBound = Math.min(92, activePercent + notchHalfWidth);

  // Dynamic SVG path for navbar with inverted dip cutout notch at active position
  const svgPath = `
    M 0 16
    C 0 7, 7 0, 16 0
    L ${leftBound - 2} 0
    C ${leftBound + 2} 0, ${activePercent - 4} 18, ${activePercent} 18
    C ${activePercent + 4} 18, ${rightBound - 2} 0, ${rightBound} 0
    L 84 0
    C 93 0, 100 7, 100 16
    L 100 44
    C 100 53, 93 60, 84 60
    L 16 60
    C 7 60, 0 53, 0 44
    Z
  `;

  return (
    <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 pointer-events-auto">
      {/* Outer shadow wrapper */}
      <div className="relative w-full h-[60px] filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.45)]">
        {/* Animated SVG navbar background with morphing dip curve */}
        <svg
          className="absolute inset-0 w-full h-full overflow-visible"
          viewBox="0 0 100 60"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="navBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#18181b" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
          </defs>
          <motion.path
            d={svgPath}
            fill="url(#navBgGrad)"
            stroke="#27272a"
            strokeWidth="0.5"
            animate={{ d: svgPath }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 30,
            }}
          />
        </svg>

        {/* Floating Active Neon Circle Badge */}
        <motion.div
          className="absolute -top-4 w-12 h-12 rounded-full flex items-center justify-center pointer-events-none z-30"
          style={{
            left: `calc(${activePercent}% - 24px)`,
            backgroundColor: accentColor,
            boxShadow: `0 8px 24px -2px ${accentColor}90, 0 0 12px ${accentColor}50`,
          }}
          animate={{
            left: `calc(${activePercent}% - 24px)`,
          }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 30,
          }}
        >
          <AnimatePresence mode="wait">
            {(() => {
              const ActiveIcon = items[activeIndex]?.icon || Sparkles;
              return (
                <motion.div
                  key={items[activeIndex]?.id}
                  initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.4, rotate: 20, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <ActiveIcon className="w-6 h-6 text-slate-950 stroke-[2.5]" />
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </motion.div>

        {/* Interactive Tab Buttons overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-around px-2">
          {items.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIndex;

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
                className="flex-1 flex flex-col items-center justify-center h-full cursor-pointer focus:outline-none transition group"
              >
                {!isActive ? (
                  <motion.div
                    whileTap={{ scale: 0.85 }}
                    className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors"
                  >
                    <Icon className="w-5 h-5 stroke-[1.8]" />
                    <span className="text-[9px] font-bold mt-0.5 tracking-tight opacity-80">
                      {item.label}
                    </span>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-end pb-1.5 h-full">
                    <span
                      className="text-[10px] font-black tracking-wider uppercase drop-shadow-xs"
                      style={{ color: accentColor }}
                    >
                      {item.label}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
