import React, { useState, useEffect } from 'react';
import { EventForm, UserRole, SiteSettings } from './types';
import { dbService, DEFAULT_SITE_SETTINGS } from './services/db';
import { Navbar } from './components/Navbar';
import { DashboardOverview } from './components/DashboardOverview';
import { FormsList } from './components/FormsList';
import { FormBuilder } from './components/FormBuilder';
import { ResponsesManager } from './components/ResponsesManager';
import { BulkRegistration } from './components/BulkRegistration';
import { CheckInScanner } from './components/CheckInScanner';
import { EmailCentre } from './components/EmailCentre';
import { SettingsView } from './components/SettingsView';
import { PublicForm } from './components/PublicForm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToast } from './context/ToastContext';
import {
  AdminAppLockModal,
  isAdminSessionUnlocked,
  setAdminSessionUnlocked,
} from './components/AdminAppLockModal';

function AppContent() {
  const { showToast } = useToast();
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'overview';
    const rawHash = window.location.hash.toLowerCase();
    const rawPath = window.location.pathname.toLowerCase();
    if (rawHash.startsWith('#builder')) return 'builder';
    if (rawHash === '#agent' || rawPath === '/agent') return 'bulk';
    if (rawHash === '#eventofficer' || rawPath === '/eventofficer') return 'forms';
    if (rawHash === '#checkiofficer' || rawPath === '/checkiofficer' || rawHash === '#checkin' || rawPath === '/checkin') return 'checkin';
    return 'overview';
  });
  const [publicFormSlug, setPublicFormSlug] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const rawHash = window.location.hash;
    if (rawHash.startsWith('#builder')) {
      const match = rawHash.match(/id=([^&]+)/);
      if (match) return match[1];
    }
    return sessionStorage.getItem('eventform_editing_form_id');
  });
  const [filterResponseFormId, setFilterResponseFormId] = useState<string | null>(null);
  const [formsList, setFormsList] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>('super_admin');
  const [currentUserEmail] = useState<string>('isholafelix609@gmail.com');
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [showAdminLockModal, setShowAdminLockModal] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(isAdminSessionUnlocked());

  // Check URL pathname and hash for routes: /Agent, /Eventofficer, /checkiofficer, /admin, and /#f=<slug>
  const checkUrlRouting = () => {
    const rawHash = window.location.hash;
    const hash = rawHash.toLowerCase();
    const rawPath = window.location.pathname;
    const path = rawPath.toLowerCase();

    // 1. Direct Public Form Link (e.g. #f=worship-encounter-3 or /f/worship-encounter-3)
    if (rawHash.startsWith('#f=')) {
      const slug = rawHash.replace('#f=', '').trim();
      if (slug) {
        setPublicFormSlug(slug);
        return;
      }
    }
    if (rawPath.startsWith('/f/')) {
      const slug = rawPath.replace('/f/', '').trim();
      if (slug) {
        setPublicFormSlug(slug);
        return;
      }
    }

    setPublicFormSlug(null);

    // Form builder routing: #builder or #builder&id=...
    if (hash.startsWith('#builder')) {
      const match = rawHash.match(/id=([^&]+)/);
      const formId = match ? match[1] : sessionStorage.getItem('eventform_editing_form_id');
      if (formId) {
        setEditingFormId(formId);
      }
      setCurrentRole('super_admin');
      setCurrentTab('builder');
      return;
    }

    // 2. Role Route: /Agent or #agent -> Registration Agent
    if (path === '/agent' || hash === '#agent') {
      setCurrentRole('agent');
      setCurrentTab('bulk');
      return;
    }

    // 3. Role Route: /Eventofficer or #eventofficer -> Event Officer
    if (path === '/eventofficer' || hash === '#eventofficer') {
      setCurrentRole('event_officer');
      setCurrentTab('forms');
      return;
    }

    // 4. Role Route: /checkiofficer or #checkiofficer or #checkin -> Check-In Officer
    if (
      path === '/checkiofficer' ||
      hash === '#checkiofficer' ||
      path === '/checkin' ||
      hash === '#checkin'
    ) {
      setCurrentRole('checkin_officer');
      setCurrentTab('checkin');
      return;
    }

    // 5. Admin Route: /admin or #admin
    if (path === '/admin' || hash === '#admin') {
      if (!isAdminSessionUnlocked()) {
        setShowAdminLockModal(true);
      } else {
        setCurrentRole('super_admin');
        setCurrentTab('overview');
      }
      return;
    }

    // Default route: if user has super_admin role and is not unlocked, show lock modal
    if (!isAdminSessionUnlocked()) {
      setShowAdminLockModal(true);
    }
  };

  useEffect(() => {
    checkUrlRouting();
    window.addEventListener('hashchange', checkUrlRouting);
    window.addEventListener('popstate', checkUrlRouting);

    // Real-time live data listeners for instant synchronization across all tabs and roles
    const unsubForms = dbService.subscribeForms((forms) => {
      setFormsList(forms.map((f) => ({ id: f.id, slug: f.slug, title: f.title })));
    });

    const unsubSettings = dbService.subscribeSiteSettings((settings) => {
      setSiteSettings(settings);
      document.title = `${settings.siteName} – ${settings.siteTagline}`;
    });

    return () => {
      unsubForms();
      unsubSettings();
      window.removeEventListener('hashchange', checkUrlRouting);
      window.removeEventListener('popstate', checkUrlRouting);
    };
  }, []);

  const handleOpenPublicLink = (slug: string) => {
    window.location.hash = `f=${slug}`;
    setPublicFormSlug(slug);
  };

  const handleEditForm = (formId: string) => {
    setEditingFormId(formId);
    sessionStorage.setItem('eventform_editing_form_id', formId);
    window.location.hash = `builder&id=${formId}`;
    setCurrentTab('builder');
  };

  const handleCreateNewForm = () => {
    setEditingFormId(null);
    sessionStorage.removeItem('eventform_editing_form_id');
    window.location.hash = 'builder';
    setCurrentTab('builder');
  };

  const handleViewResponsesForForm = (formId: string) => {
    setFilterResponseFormId(formId);
    setCurrentTab('responses');
  };

  const handleSaveSiteSettings = (newSettings: SiteSettings) => {
    setSiteSettings(newSettings);
    document.title = `${newSettings.siteName} – ${newSettings.siteTagline}`;
  };

  const handleRoleChange = (role: UserRole) => {
    if (role === 'super_admin' || role === 'admin') {
      if (!isAdminSessionUnlocked()) {
        setShowAdminLockModal(true);
        return;
      }
      setCurrentRole(role);
      setCurrentTab('overview');
      window.location.hash = 'admin';
    } else if (role === 'agent') {
      setCurrentRole('agent');
      setCurrentTab('bulk');
      window.location.hash = 'agent';
    } else if (role === 'event_officer') {
      setCurrentRole('event_officer');
      setCurrentTab('forms');
      window.location.hash = 'eventofficer';
    } else if (role === 'checkin_officer') {
      setCurrentRole('checkin_officer');
      setCurrentTab('checkin');
      window.location.hash = 'checkiofficer';
    }
  };

  const handleLockAdmin = () => {
    setAdminSessionUnlocked(false);
    setIsAdminUnlocked(false);
    setShowAdminLockModal(true);
    showToast('Administrator session locked', 'info');
  };

  const handleAdminUnlockSuccess = () => {
    setIsAdminUnlocked(true);
    setShowAdminLockModal(false);
    setCurrentRole('super_admin');
    setCurrentTab('overview');
  };

  const handleCancelToRole = (role: string) => {
    setShowAdminLockModal(false);
    handleRoleChange(role as UserRole);
  };

  // 1. PUBLIC FORM VIEW: Render the public form page
  if (publicFormSlug) {
    return <PublicForm slugOrId={publicFormSlug} />;
  }

  // 2. Tab selection guard based on active role
  const isRoleRestricted = currentRole !== 'super_admin' && currentRole !== 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">
      {/* Admin App Lock Modal */}
      <AdminAppLockModal
        isOpen={showAdminLockModal}
        onSuccess={handleAdminUnlockSuccess}
        onCancelToRole={handleCancelToRole}
      />

      {/* Top Navigation & Mobile Bottom Dock */}
      <Navbar
        activeTab={currentTab}
        onTabChange={(tab) => {
          // If switching to admin-only tabs while not unlocked, prompt lock
          const adminOnlyTabs = ['overview', 'builder', 'email', 'settings'];
          if (adminOnlyTabs.includes(tab) && !isAdminSessionUnlocked()) {
            setShowAdminLockModal(true);
            return;
          }
          if (tab === 'builder' && currentTab !== 'builder') {
            setEditingFormId(null);
          }
          setCurrentTab(tab);
        }}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        userEmail={currentUserEmail}
        onOpenPublicLink={handleOpenPublicLink}
        forms={formsList}
        siteSettings={siteSettings}
        isAdminLocked={!isAdminUnlocked}
        onLockAdmin={handleLockAdmin}
        onRequestAdminUnlock={() => setShowAdminLockModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12">
        <ErrorBoundary>
          {/* Agent Role: Bulk Registration & Attendee Responses */}
          {currentRole === 'agent' && (
            <>
              {currentTab === 'responses' ? (
                <ResponsesManager
                  initialFormId={filterResponseFormId}
                  currentRole={currentRole}
                />
              ) : (
                <BulkRegistration
                  currentAgentName="Registration Agent"
                  currentAgentId="agent-1"
                />
              )}
            </>
          )}

          {/* Check-In Officer Role: Dedicated Scanner & Entry Desk Only */}
          {currentRole === 'checkin_officer' && (
            <CheckInScanner currentOfficerName="Check-In Officer" />
          )}

          {/* Event Officer Role: Forms and Responses Only */}
          {currentRole === 'event_officer' && (
            <>
              {currentTab === 'responses' ? (
                <ResponsesManager
                  initialFormId={filterResponseFormId}
                  currentRole={currentRole}
                />
              ) : (
                <FormsList
                  onCreateNew={() => {}}
                  onEditForm={() => {}}
                  onViewResponses={handleViewResponsesForForm}
                  onOpenPublicLink={handleOpenPublicLink}
                  currentRole={currentRole}
                />
              )}
            </>
          )}

          {/* Administrator Role: All 8 Modules & Full Deletion */}
          {!isRoleRestricted && (
            <>
              {currentTab === 'overview' && (
                <DashboardOverview
                  onCreateForm={handleCreateNewForm}
                  onNavigateTab={setCurrentTab}
                  onOpenPublicLink={handleOpenPublicLink}
                  onViewResponses={handleViewResponsesForForm}
                  siteSettings={siteSettings}
                />
              )}

              {currentTab === 'forms' && (
                <FormsList
                  onCreateNew={handleCreateNewForm}
                  onEditForm={handleEditForm}
                  onViewResponses={handleViewResponsesForForm}
                  onOpenPublicLink={handleOpenPublicLink}
                  currentRole={currentRole}
                />
              )}

              {currentTab === 'builder' && (
                <FormBuilder
                  initialFormId={editingFormId}
                  onFormSaved={() => {
                    dbService.getForms().then((forms) => {
                      setFormsList(forms.map((f) => ({ id: f.id, slug: f.slug, title: f.title })));
                    });
                  }}
                  onOpenPublicLink={handleOpenPublicLink}
                />
              )}

              {currentTab === 'responses' && (
                <ResponsesManager
                  initialFormId={filterResponseFormId}
                  currentRole={currentRole}
                />
              )}

              {currentTab === 'bulk' && (
                <BulkRegistration
                  currentAgentName="Admin Agent"
                  currentAgentId="admin-1"
                />
              )}

              {currentTab === 'checkin' && (
                <CheckInScanner currentOfficerName="Admin Officer" />
              )}

              {currentTab === 'email' && <EmailCentre />}

              {currentTab === 'settings' && (
                <SettingsView
                  currentRole={currentRole}
                  onRoleChange={handleRoleChange}
                  currentUserEmail={currentUserEmail}
                  siteSettings={siteSettings}
                  onSaveSiteSettings={handleSaveSiteSettings}
                />
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* Global Footer (Desktop / Laptop) */}
      <footer className="hidden md:block bg-white border-t border-gray-200 py-4 px-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong className="text-gray-700">{siteSettings.siteName}</strong> • {siteSettings.footerText}
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <span>
              Role:{' '}
              <strong className="text-indigo-600 capitalize">
                {currentRole.replace('_', ' ')}
              </strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
