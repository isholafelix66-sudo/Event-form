import React, { useState } from 'react';
import { UserRole, SiteSettings } from '../types';
import { AnimatedBottomNav } from './AnimatedBottomNav';
import {
  FileText,
  Users,
  QrCode,
  Mail,
  Settings,
  Plus,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  ChevronDown,
  UserCheck,
  Check,
  Menu,
  X,
  Lock,
  Unlock,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  userEmail: string;
  onOpenPublicLink: (slug: string) => void;
  forms: { id: string; slug: string; title: string }[];
  siteSettings: SiteSettings;
  isAdminLocked?: boolean;
  onLockAdmin?: () => void;
  onRequestAdminUnlock?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onRoleChange,
  userEmail,
  onOpenPublicLink,
  forms,
  siteSettings,
  isAdminLocked = false,
  onLockAdmin,
  onRequestAdminUnlock,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showPublicMenu, setShowPublicMenu] = useState(false);

  const allNavItems = [
    { id: 'overview', label: 'Overview', icon: Sparkles, roles: ['super_admin', 'admin'] },
    { id: 'forms', label: 'My Forms', icon: Layers, roles: ['super_admin', 'admin', 'event_officer'] },
    { id: 'builder', label: 'Create Form', icon: Plus, roles: ['super_admin', 'admin'] },
    { id: 'responses', label: 'Responses', icon: Users, roles: ['super_admin', 'admin', 'event_officer', 'agent'] },
    { id: 'bulk', label: 'Bulk Reg', icon: UserCheck, roles: ['super_admin', 'admin', 'agent'] },
    { id: 'checkin', label: 'Check-In', icon: QrCode, roles: ['super_admin', 'admin', 'checkin_officer'] },
    { id: 'helpdesk', label: 'AI Help Desk', icon: HelpCircle, roles: ['super_admin', 'admin'] },
    { id: 'email', label: 'Email Centre', icon: Mail, roles: ['super_admin', 'admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'admin'] },
  ];


  // Restrict navigation items strictly to current role permissions
  const availableNavItems = allNavItems.filter((item) =>
    item.roles.includes(currentRole)
  );

  const roleLabels: Record<UserRole, { title: string; color: string; path: string }> = {
    super_admin: { title: 'Administrator', color: 'bg-indigo-600 text-white', path: '/admin' },
    admin: { title: 'Administrator', color: 'bg-indigo-600 text-white', path: '/admin' },
    agent: { title: 'Registration Agent', color: 'bg-emerald-600 text-white', path: '/Agent' },
    event_officer: { title: 'Event Officer', color: 'bg-sky-600 text-white', path: '/Eventofficer' },
    checkin_officer: { title: 'Check-In Officer', color: 'bg-amber-600 text-white', path: '/checkiofficer' },
  };

  const isRoleRestricted = currentRole !== 'super_admin' && currentRole !== 'admin';

  return (
    <>
      {/* Top Header for Desktop, Laptop & Mobile Top Strip */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/90 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Custom Site Name */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (availableNavItems.length > 0) {
                    onTabChange(availableNavItems[0].id);
                  }
                }}
                className="flex items-center gap-2.5 text-left cursor-pointer group"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm shadow-sm group-hover:scale-105 transition"
                  style={{ backgroundColor: siteSettings.accentColor || '#4f46e5' }}
                >
                  {siteSettings.siteName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-black text-base sm:text-lg tracking-tight text-gray-900 flex items-center gap-1.5 leading-none">
                    {siteSettings.siteName}
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 tracking-wider">
                      {isRoleRestricted ? roleLabels[currentRole].title.toUpperCase() : 'PRO'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium truncate max-w-[180px] sm:max-w-xs mt-0.5">
                    {isRoleRestricted
                      ? `Dedicated Portal: ${roleLabels[currentRole].path}`
                      : siteSettings.siteTagline}
                  </div>
                </div>
              </button>
            </div>

            {/* Right Controls: Role & Public Links */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Public Forms Quick Preview Dropdown (for testing links) */}
              <div className="relative">
                <button
                  onClick={() => setShowPublicMenu(!showPublicMenu)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Public Forms</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>

                {showPublicMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">
                      Open Live Public Registration Form:
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {forms.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            onOpenPublicLink(f.slug);
                            setShowPublicMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-indigo-50 hover:text-indigo-700 transition flex items-center justify-between group cursor-pointer"
                        >
                          <span className="font-bold text-gray-800 truncate">{f.title}</span>
                          <span className="text-[10px] text-gray-400 font-mono">/f/{f.slug}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Lock / Unlock Indicator */}
              {(currentRole === 'super_admin' || currentRole === 'admin') && (
                <button
                  onClick={onLockAdmin}
                  title="Lock admin session"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden md:inline">Lock Admin</span>
                </button>
              )}

              {/* Role Switcher Pill with direct URL routes */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition cursor-pointer"
                >
                  <span className={`w-2 h-2 rounded-full ${roleLabels[currentRole].color.split(' ')[0]}`} />
                  <span className="text-gray-900 hidden sm:inline">{roleLabels[currentRole].title}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>

                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">
                      Role Portals & URLs:
                    </div>

                    {/* Admin role */}
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        if (currentRole !== 'super_admin' && currentRole !== 'admin') {
                          if (onRequestAdminUnlock) {
                            onRequestAdminUnlock();
                          } else {
                            onRoleChange('super_admin');
                          }
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                        currentRole === 'super_admin' || currentRole === 'admin'
                          ? 'bg-indigo-50 text-indigo-900 font-bold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-indigo-600" />
                        <div>
                          <div className="font-bold">Administrator</div>
                          <div className="text-[10px] text-gray-400">Protected • /admin</div>
                        </div>
                      </div>
                      {(currentRole === 'super_admin' || currentRole === 'admin') && (
                        <Check className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                    </button>

                    {/* Agent Role */}
                    <button
                      onClick={() => {
                        window.location.hash = 'agent';
                        onRoleChange('agent');
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                        currentRole === 'agent'
                          ? 'bg-emerald-50 text-emerald-900 font-bold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <div>
                        <div className="font-bold">Registration Agent</div>
                        <div className="text-[10px] text-gray-400">URL: /Agent • Bulk Entry Only</div>
                      </div>
                      {currentRole === 'agent' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>

                    {/* Event Officer Role */}
                    <button
                      onClick={() => {
                        window.location.hash = 'eventofficer';
                        onRoleChange('event_officer');
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                        currentRole === 'event_officer'
                          ? 'bg-sky-50 text-sky-900 font-bold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <div>
                        <div className="font-bold">Event Officer</div>
                        <div className="text-[10px] text-gray-400">URL: /Eventofficer • Forms & Responses</div>
                      </div>
                      {currentRole === 'event_officer' && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </button>

                    {/* Check-In Officer Role */}
                    <button
                      onClick={() => {
                        window.location.hash = 'checkiofficer';
                        onRoleChange('checkin_officer');
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                        currentRole === 'checkin_officer'
                          ? 'bg-amber-50 text-amber-900 font-bold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <div>
                        <div className="font-bold">Check-In Officer</div>
                        <div className="text-[10px] text-gray-400">URL: /checkiofficer • Fast Scanner</div>
                      </div>
                      {currentRole === 'checkin_officer' && (
                        <Check className="w-3.5 h-3.5 text-amber-600" />
                      )}
                    </button>

                    <div className="border-t border-gray-100 mt-1 pt-1.5 px-2 text-[10px] text-gray-400">
                      User: <span className="font-mono text-gray-600">{userEmail}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop & Laptop Horizontal Tab Navigation */}
          <nav className="hidden md:flex space-x-1 py-2 border-t border-gray-100 overflow-x-auto">
            {availableNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION DOCK (Direct 1-tap access to all 8 modules for Admin) */}
      <AnimatedBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        currentRole={currentRole}
      />
    </>
  );
};
