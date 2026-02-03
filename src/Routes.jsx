import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/NotFound";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { MusicProvider } from "@/context/MusicContext";
import SyncStatusModal from "@/components/SyncStatusModal";
import ConnectivityStatus from "@/components/ConnectivityStatus";
import MiniMusicBar from './components/music/MiniMusicBar';
import SyncManager from '@/components/SyncManager';

// Pages
import LoginScreen from "@/pages/login/LoginScreen";
import ModeSelectionScreen from "@/pages/login/ModeSelectionScreen";
import MenuOrderingInterface from './pages/menu-ordering-interface';
import KdsScreen from './pages/kds';
import DataManagerInterface from './pages/data-manager-interface';
import SuperAdminDashboard from './pages/super-admin';
import SuperAdminPortal from './pages/super-admin/SuperAdminPortal';
import DatabaseExplorer from './pages/super-admin/DatabaseExplorer';
import ManagerKDS from './components/manager/ManagerKDS';
import InventoryPage from './pages/inventory';
import PrepPage from './pages/prep';
import MusicPage from './pages/music';
import DexieAdminPanel from './pages/dexie-admin';
import MayaAssistant from './pages/maya';
import SpotifyCallback from './pages/callback/spotify';
import DexieTestPage from './pages/DexieTestPage';
import KanbanPage from './pages/kanban';
import DriverPage from './pages/driver';
import OrderTrackingPage from './pages/order-tracking';
import CompleteProfile from './pages/login/CompleteProfile';
import GoogleCallback from '@/pages/auth/GoogleCallback';
import OwnerSettings from './pages/owner-settings';
import IPadMenuEditor from './pages/ipad-menu-editor';
import WizardLayout from './pages/onboarding/components/WizardLayout';
import MenuReviewDashboard from './pages/onboarding/components/MenuReviewDashboard';
import IPadInventoryPage from './pages/ipad_inventory/IPadInventoryPage';

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: "linear" }
};

const PageTransition = ({ children }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="w-full h-full"
  >
    {children}
  </motion.div>
);

import LoadingFallback from '@/components/LoadingFallback';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser, deviceMode: stateMode, isLoading } = useAuth();
  const location = useLocation();

  // Use state mode or fallback to localStorage for immediate transitions
  const deviceMode = stateMode || localStorage.getItem('kiosk_mode');

  // Show loading state with Framer Motion (Using new Fallback)
  if (isLoading) {
    return <LoadingFallback message="טוען מערכת..." />;
  }

  // CRITICAL: If no user, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // SUPER ADMIN PATHS: Allow access without device mode
  const isSuperAdminPath = location.pathname.startsWith('/super-admin');
  if (isSuperAdminPath) {
    // Super Admin routes don't need device mode
    return <PageTransition>{children}</PageTransition>;
  }

  // User is logged in - check mode
  if (!deviceMode) {
    // Super Admin without device mode should go to their portal, not mode selection
    if (currentUser?.is_super_admin && !currentUser?.is_impersonating) {
      return <Navigate to="/super-admin" replace />;
    }

    // If no mode selected and not already on selection screen, redirect there
    if (location.pathname !== '/mode-selection') {
      return <Navigate to="/mode-selection" replace />;
    }
    // If on mode selection, allow access
    // FIX: Don't use PageTransition for mode-selection to avoid animation freezes
    return children;
  }

  // Handle root path redirect based on mode - DISABLED per user request to always allow Mode Selection
  /*
  if (location.pathname === '/' && deviceMode) {
    const params = new URLSearchParams(location.search);
    const isNavigationFromKds = params.get('from') === 'kds' || params.has('editOrderId');

    if (!isNavigationFromKds) {
      if (deviceMode === 'kds') {
        return <Navigate to="/kds" replace />;
      } else if (deviceMode === 'manager') {
        return <Navigate to="/data-manager-interface" replace />;
      } else if (deviceMode === 'music') {
        return <Navigate to="/music" replace />;
      }
    }
    // For 'kiosk' mode OR incoming KDS requests, let it fall through to MenuOrderingInterface
  }
  */

  return <PageTransition>{children}</PageTransition>;
};

const AppRoutes = () => {
  const location = useLocation();

  return (

    <RouterRoutes location={location} key={location.pathname}>
      {/* Public Routes */}
      <Route path="/login" element={<PageTransition><LoginScreen /></PageTransition>} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/admin" element={<Navigate to="/login" replace />} />
      <Route path="/manager" element={<Navigate to="/login" replace />} />
      <Route path="/super-admin" element={
        <ProtectedRoute>
          <SuperAdminPortal />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/businesses" element={
        <ProtectedRoute>
          <SuperAdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/db" element={
        <ProtectedRoute>
          <DatabaseExplorer />
        </ProtectedRoute>
      } />

      {/* Protected Routes */}
      <Route path="/mode-selection" element={
        <ProtectedRoute>
          <ModeSelectionScreen />
        </ProtectedRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute>
          <MenuOrderingInterface />
        </ProtectedRoute>
      } />

      {/* Aliases for Menu Interface */}
      <Route path="/menu-ordering-interface" element={<Navigate to="/" replace />} />

      <Route path="/kds" element={
        <ProtectedRoute>
          <KdsScreen />
        </ProtectedRoute>
      } />

      {/* Aliases for KDS */}
      <Route path="/kitchen-display-system-interface" element={<Navigate to="/kds" replace />} />

      <Route path="/mobile-kds" element={
        <ProtectedRoute>
          <ManagerKDS />
        </ProtectedRoute>
      } />

      <Route path="/inventory" element={
        <ProtectedRoute>
          <InventoryPage />
        </ProtectedRoute>
      } />

      <Route path="/ipad-inventory-test" element={
        <ProtectedRoute>
          <IPadInventoryPage />
        </ProtectedRoute>
      } />

      <Route path="/prep" element={
        <ProtectedRoute>
          <PrepPage />
        </ProtectedRoute>
      } />

      <Route path="/music" element={
        <ProtectedRoute>
          <MusicPage />
        </ProtectedRoute>
      } />

      <Route path="/maya" element={
        <ProtectedRoute>
          <MayaAssistant />
        </ProtectedRoute>
      } />

      <Route path="/data-manager-interface" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <DataManagerInterface />
          </ErrorBoundary>
        </ProtectedRoute>
      } />

      {/* Spotify Callback Route - Public */}
      <Route path="/callback/spotify" element={<SpotifyCallback />} />

      {/* Google Callback Route */}
      <Route path="/auth/callback" element={<GoogleCallback />} />

      {/* Kanban Order System */}
      <Route path="/kanban" element={
        <ProtectedRoute>
          <KanbanPage />
        </ProtectedRoute>
      } />

      <Route path="/driver" element={
        <ProtectedRoute>
          <DriverPage />
        </ProtectedRoute>
      } />

      <Route path="/owner-settings" element={
        <ProtectedRoute>
          <OwnerSettings />
        </ProtectedRoute>
      } />

      <Route path="/onboarding" element={
        <ProtectedRoute>
          <WizardLayout />
        </ProtectedRoute>
      } />

      <Route path="/menu-editor" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <MenuReviewDashboard />
          </ErrorBoundary>
        </ProtectedRoute>
      } />

      {/* Order Tracking - Public (no auth required) */}
      <Route path="/order-tracking/:id" element={<PageTransition><OrderTrackingPage /></PageTransition>} />

      {/* Debug/Internal Tools */}
      <Route path="/dexie-test" element={
        <ProtectedRoute>
          <DexieTestPage />
        </ProtectedRoute>
      } />

      <Route path="/dexie-admin" element={
        <ProtectedRoute>
          <DexieAdminPanel />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </RouterRoutes>

  );
};

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <ConnectivityStatus />
          {/* <SyncStatusModal /> - USER REQUESTED TO HIDE THIS MODAL */}
          <SyncManager />
          <MusicProvider>
            <ScrollToTop />
            <AppRoutes />
          </MusicProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;