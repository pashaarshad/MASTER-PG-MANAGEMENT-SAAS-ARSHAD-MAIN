import React, { useState } from 'react';
import { PGProvider, usePG } from './context/PGContext';
import { Navbar } from './components/Navbar';
import { DesktopSidebar } from './components/DesktopSidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { RoomsView } from './components/RoomsView';
import { ResidentsView } from './components/ResidentsView';
import { ApplicationsView } from './components/ApplicationsView';
import { PaymentsView } from './components/PaymentsView';
import { RulesView } from './components/RulesView';
import { SettingsView } from './components/SettingsView';
import { ReportsView } from './components/ReportsView';
import { NotificationsView } from './components/NotificationsView';
import { MonthlyCalculationView } from './components/MonthlyCalculationView';
import { TenantOnboardingView } from './components/TenantOnboardingView';
import { InviteTenantModal } from './components/InviteTenantModal';
import { AdminLoginView } from './components/AdminLoginView';

const AppContent: React.FC = () => {
  const { activeView, setActiveView, isPublicPortalMode, setPublicPortalMode, isAdminLoggedIn } = usePG();

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [paymentResidentId, setPaymentResidentId] = useState<string | null>(null);

  // If in public tenant portal mode (e.g. tenant clicked an onboarding link /join/:id or toggle)
  if (isPublicPortalMode) {
    return <TenantOnboardingView />;
  }

  // If admin is NOT logged in, show the Admin Login Screen
  if (!isAdminLoggedIn) {
    return <AdminLoginView />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
      {/* Desktop Sidebar attached directly to the left edge */}
      <DesktopSidebar onOpenInviteModal={() => setShowInviteModal(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar onOpenInviteModal={() => setShowInviteModal(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {activeView === 'dashboard' && (
            <DashboardView
              onOpenInviteModal={() => setShowInviteModal(true)}
              onOpenPaymentModal={() => {
                setPaymentResidentId(null);
                setActiveView('payments');
              }}
            />
          )}

          {activeView === 'rooms' && <RoomsView />}

          {activeView === 'residents' && (
            <ResidentsView
              onOpenInviteModal={() => setShowInviteModal(true)}
              onOpenPaymentModalForResident={(residentId) => {
                setPaymentResidentId(residentId);
                setActiveView('payments');
              }}
            />
          )}

          {activeView === 'applications' && <ApplicationsView />}

          {activeView === 'payments' && (
            <PaymentsView
              initialResidentIdForPayment={paymentResidentId}
              onClearInitialResidentId={() => setPaymentResidentId(null)}
            />
          )}

          {activeView === 'rules' && <RulesView />}

          {activeView === 'reports' && <ReportsView />}

          {activeView === 'notifications' && <NotificationsView />}

          {activeView === 'expenses' && <MonthlyCalculationView />}

          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Bottom Bar Navigation */}
      <MobileBottomNav onOpenInviteModal={() => setShowInviteModal(true)} />

      {/* Global Tenant Onboarding Link Generator Modal */}
      <InviteTenantModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onOpenPortalDirectly={() => {
          setShowInviteModal(false);
          setPublicPortalMode(true);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <PGProvider>
      <AppContent />
    </PGProvider>
  );
}
