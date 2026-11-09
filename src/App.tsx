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
import { RegistrationPortal } from './components/RegistrationPortal';
import { NotFoundPage } from './components/NotFoundPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToast } from './context/ToastContext';
import {
  AdminAppLockModal,
  isAdminSessionUnlocked,
  setAdminSessionUnlocked,
} from './components/AdminAppLockModal';

function AppContent() {
  const { showToast } = useToast();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [publicFormSlug, setPublicFormSlug] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
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

  const [parentCode, setParentCode] = useState<string | null>(null);

  // Strict route isolation & routing check
  const checkUrlRouting = () => {
    const rawHash = window.location.hash;
    const hash = rawHash.toLowerCase();
    const rawPath = window.location.pathname;
    const path = rawPath.toLowerCase();

    // Reset default flags
    setIsNotFound(false);

    // 1. Direct Public Form Link (e.g. #f=worship-encounter-3&parent=EVT-2026-W301 or /f/worship-encounter-3?parent=EVT-2026-W301)
    if (rawHash.startsWith('#f=')) {
      const fullQuery = rawHash.replace('#f=', '').trim();
      const slug = fullQuery.split('&')[0].split('?')[0].trim();
      
      // Extract parent code if present in hash (e.g. &parent=EVT-2026-XXXX)
      const parentMatch = fullQuery.match(/[?&]parent=([^&]+)/i);
      const extractedParent = parentMatch ? decodeURIComponent(parentMatch[1]).trim().toUpperCase() : null;

      if (slug) {
        setPublicFormSlug(slug);
        setParentCode(extractedParent);
        return;
      }
    }
    if (rawPath.startsWith('/f/')) {
      const slug = rawPath.replace('/f/', '').split('/')[0].split('?')[0].trim();
      const parentMatch = window.location.search.match(/[?&]parent=([^&]+)/i);
      const extractedParent = parentMatch ? decodeURIComponent(parentMatch[1]).trim().toUpperCase() : null;

      if (slug) {
        setPublicFormSlug(slug);
        setParentCode(extractedParent);
        return;
      }
    }

    setPublicFormSlug(null);
    setParentCode(null);

    // Form builder routing: #builder or #builder&id=...
    if (hash.startsWith('#builder')) {
      const match = rawHash.match(/id=([^&]+)/);
      const formId = match ? match[1] : sessionStorage.getItem('eventform_editing_form_id');
      if (formId) {
        setEditingFormId(formId);
      }
      if (!isAdminSessionUnlocked()) {
        setShowAdminLockModal(true);
      } else {
        setCurrentRole('super_admin');
        setCurrentTab('builder');
      }
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

    // Portal Route: #portal or /portal -> Registrant Portal
    if (path === '/portal' || hash === '#portal') {
      setPublicFormSlug(null);
      setIsNotFound(false);
      return;
    }

    // 5. Admin Dashboard Route: ONLY /admin or #admin or active admin tabs (e.g. #overview, #settings, #email, #responses)
    const isAdminPathOrHash =
      path === '/admin' ||
      hash === '#admin' ||
      hash.startsWith('#admin') ||
      (rawPath === '/' && ['#overview', '#forms', '#responses', '#bulk', '#checkin', '#email', '#settings'].includes(hash));

    if (isAdminPathOrHash) {
      if (!isAdminSessionUnlocked()) {
        setShowAdminLockModal(true);
      } else {
        setCurrentRole('super_admin');
        if (hash === '#settings') setCurrentTab('settings');
        else if (hash === '#email') setCurrentTab('email');
        else if (hash === '#responses') setCurrentTab('responses');
        else if (hash === '#forms') setCurrentTab('forms');
        else if (hash === '#bulk') setCurrentTab('bulk');
        else if (hash === '#checkin') setCurrentTab('checkin');
        else setCurrentTab('overview');
      }
      return;
    }

    // 6. Base Root "/" or Unrecognized Path -> Render 404 Invalid Page Screen
    // Accessing "/" without an event identifier or removing event identifier MUST NEVER expose admin dashboard.
    setIsNotFound(true);
    setShowAdminLockModal(false);
  };

  useEffect(() => {
    checkUrlRouting();
    window.addEventListener('hashchange', checkUrlRouting);
    window.addEventListener('popstate', checkUrlRouting);

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
    setParentCode(null);
    setIsNotFound(false);
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
      window.location.hash = 'admin';
      if (!isAdminSessionUnlocked()) {
        setShowAdminLockModal(true);
        return;
      }
      setCurrentRole(role);
      setCurrentTab('overview');
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
    window.location.hash = 'admin';
    setShowAdminLockModal(true);
    showToast('Administrator session locked', 'info');
  };

  const handleAdminUnlockSuccess = () => {
    setIsAdminUnlocked(true);
    setShowAdminLockModal(false);
    setCurrentRole('super_admin');
    setCurrentTab('overview');
    setIsNotFound(false);
  };

  const handleCancelToRole = (role: string) => {
    setShowAdminLockModal(false);
    handleRoleChange(role as UserRole);
  };

  // 1. PUBLIC FORM VIEW: Render public event registration page
  if (publicFormSlug) {
    return <PublicForm slugOrId={publicFormSlug} parentCode={parentCode} />;
  }

  // 1.5 REGISTRANT PORTAL VIEW: Render portal if hash is #portal or pathname is /portal
  if (typeof window !== 'undefined' && (window.location.hash.toLowerCase() === '#portal' || window.location.pathname.toLowerCase() === '/portal')) {
    return (
      <RegistrationPortal
        onBackToHome={() => {
          window.location.hash = 'f=worship-encounter-3';
        }}
      />
    );
  }

  // 2. 404 PAGE NOT FOUND: Root "/" without event identifier or invalid URLs
  if (isNotFound) {
    return (
      <div className="relative min-h-screen">
        <NotFoundPage />
        {/* Admin Lock modal is accessible via /admin endpoint only */}
        {showAdminLockModal && (
          <AdminAppLockModal
            isOpen={showAdminLockModal}
            onSuccess={handleAdminUnlockSuccess}
            onCancelToRole={handleCancelToRole}
          />
        )}
      </div>
    );
  }

  // 3. Tab selection guard based on active role
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
          const adminOnlyTabs = ['overview', 'builder', 'email', 'settings'];
          if (adminOnlyTabs.includes(tab) && !isAdminSessionUnlocked()) {
            window.location.hash = 'admin';
            setShowAdminLockModal(true);
            return;
          }
          if (tab === 'builder' && currentTab !== 'builder') {
            setEditingFormId(null);
          }
          setCurrentTab(tab);
          window.location.hash = tab === 'overview' ? 'admin' : tab;
        }}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        userEmail={currentUserEmail}
        onOpenPublicLink={handleOpenPublicLink}
        forms={formsList}
        siteSettings={siteSettings}
        isAdminLocked={!isAdminUnlocked}
        onLockAdmin={handleLockAdmin}
        onRequestAdminUnlock={() => {
          window.location.hash = 'admin';
          setShowAdminLockModal(true);
        }}
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
                  onViewResponses={handleViewResponsesForForm}
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
                  onNavigateTab={(tab) => {
                    setCurrentTab(tab);
                    window.location.hash = tab;
                  }}
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
                  onViewResponses={handleViewResponsesForForm}
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
