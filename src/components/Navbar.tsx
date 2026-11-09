import React, { useState } from 'react';
import { UserRole, SiteSettings } from '../types';
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
  ShieldAlert
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
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  const allNavItems = [
    { id: 'overview', label: 'Overview', icon: Sparkles, roles: ['super_admin', 'admin'] },
    { id: 'forms', label: 'My Forms', icon: Layers, roles: ['super_admin', 'admin', 'event_officer'] },
    { id: 'builder', label: 'Create Form', icon: Plus, roles: ['super_admin', 'admin'] },
    { id: 'responses', label: 'Responses', icon: Users, roles: ['super_admin', 'admin', 'event_officer', 'agent'] },
    { id: 'bulk', label: 'Bulk Reg', icon: UserCheck, roles: ['super_admin', 'admin', 'agent'] },
    { id: 'checkin', label: 'Check-In', icon: QrCode, roles: ['super_admin', 'admin', 'checkin_officer'] },
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

      {/* MOBILE BOTTOM NAVIGATION DOCK (Restricted according to role) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-2xl px-2 py-1.5 flex items-center justify-around">
        {/* If Agent: Bulk Reg & Responses */}
        {currentRole === 'agent' && (
          <>
            <button
              onClick={() => onTabChange('bulk')}
              className={`flex flex-col items-center justify-center py-1.5 px-6 rounded-xl transition cursor-pointer ${
                activeTab === 'bulk' ? 'text-emerald-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <UserCheck className="w-5 h-5 mb-0.5" />
              <span className="text-xs">Bulk Reg</span>
            </button>
            <button
              onClick={() => onTabChange('responses')}
              className={`flex flex-col items-center justify-center py-1.5 px-6 rounded-xl transition cursor-pointer ${
                activeTab === 'responses' ? 'text-emerald-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-xs">Responses</span>
            </button>
          </>
        )}

        {/* If Check-In Officer: Only Check-In */}
        {currentRole === 'checkin_officer' && (
          <button
            onClick={() => onTabChange('checkin')}
            className="flex flex-col items-center justify-center py-1.5 px-6 rounded-xl text-amber-600 font-bold cursor-pointer"
          >
            <QrCode className="w-6 h-6 mb-0.5" />
            <span className="text-xs">Fast Check-In Scanner</span>
          </button>
        )}

        {/* If Event Officer: Forms and Responses */}
        {currentRole === 'event_officer' && (
          <>
            <button
              onClick={() => onTabChange('forms')}
              className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl transition cursor-pointer ${
                activeTab === 'forms' ? 'text-sky-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <Layers className="w-5 h-5 mb-0.5" />
              <span className="text-[11px]">Event Forms</span>
            </button>
            <button
              onClick={() => onTabChange('responses')}
              className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl transition cursor-pointer ${
                activeTab === 'responses' ? 'text-sky-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-[11px]">Attendee Responses</span>
            </button>
          </>
        )}

        {/* If Admin / Super Admin: Full bottom dock */}
        {!isRoleRestricted && (
          <>
            <button
              onClick={() => onTabChange('overview')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
                activeTab === 'overview' ? 'text-indigo-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <Sparkles className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Overview</span>
            </button>

            <button
              onClick={() => onTabChange('forms')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
                activeTab === 'forms' ? 'text-indigo-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <Layers className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Forms</span>
            </button>

            {/* Center Raised Action Button: Create Form */}
            <button
              onClick={() => onTabChange('builder')}
              className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center group-hover:scale-105 active:scale-95 transition">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-gray-700 mt-0.5">Create</span>
            </button>

            <button
              onClick={() => onTabChange('responses')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
                activeTab === 'responses' ? 'text-indigo-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Responses</span>
            </button>

            <button
              onClick={() => onTabChange('checkin')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
                activeTab === 'checkin' ? 'text-indigo-600 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <QrCode className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Check-In</span>
            </button>

            <button
              onClick={() => setShowMobileMoreMenu(true)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
                ['bulk', 'email', 'settings'].includes(activeTab)
                  ? 'text-indigo-600 font-bold'
                  : 'text-gray-400 font-medium'
              }`}
            >
              <Menu className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">More</span>
            </button>
          </>
        )}
      </nav>

      {/* Mobile "More" Drawer Modal for Admin */}
      {showMobileMoreMenu && !isRoleRestricted && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="font-black text-sm text-gray-900">Admin Modules & Operations</span>
              <button
                onClick={() => setShowMobileMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  onTabChange('bulk');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col items-start gap-2 cursor-pointer ${
                  activeTab === 'bulk' ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="font-bold text-xs text-gray-900">Bulk Registration</div>
                  <div className="text-[10px] text-gray-500">Agent fast entry desk</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onTabChange('email');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col items-start gap-2 cursor-pointer ${
                  activeTab === 'email' ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Mail className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="font-bold text-xs text-gray-900">Email Centre</div>
                  <div className="text-[10px] text-gray-500">Announcements & Delivery</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onTabChange('settings');
                  setShowMobileMoreMenu(false);
                }}
                className={`col-span-2 p-3.5 rounded-2xl border text-left flex items-center gap-3 cursor-pointer ${
                  activeTab === 'settings' ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Settings className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <div className="font-bold text-xs text-gray-900">Platform Settings & Data Cleanup</div>
                  <div className="text-[10px] text-gray-500">
                    Customize website name, delete records & manage roles
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
