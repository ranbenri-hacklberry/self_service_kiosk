import React, { useEffect } from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, useNavigate, useLocation } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/NotFound";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Pages
import LoginScreen from "@/pages/login/LoginScreen";
import ModeSelectionScreen from "@/pages/login/ModeSelectionScreen";
import MenuOrderingInterface from './pages/menu-ordering-interface';
import KdsScreen from './pages/kds';
import CustomerPhoneInputScreen from './pages/customer-phone-input-screen';
import NewCustomerNameCollectionScreen from './pages/new-customer-name-collection-screen';
import ReturningCustomerWelcomeScreen from './pages/returning-customer-welcome-screen';

import DataManagerInterface from './pages/data-manager-interface';
import SuperAdminDashboard from './pages/super-admin';
import ManagerKDS from './components/manager/ManagerKDS';
import InventoryPage from './pages/inventory';
import PrepPage from './pages/prep';
import MusicPage from './pages/music';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser, deviceMode, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only run redirects when loading is complete
    if (isLoading) return;

    console.log('🔐 ProtectedRoute check:', {
      hasUser: !!currentUser,
      userName: currentUser?.name,
      deviceMode,
      path: location.pathname
    });

    if (!currentUser) {
      console.log('🚫 No user, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    // User is logged in - check mode
    if (!deviceMode && location.pathname !== '/mode-selection') {
      // Logged in but no mode - must select mode first
      console.log('⚠️ No device mode selected, redirecting to mode-selection');
      navigate('/mode-selection', { replace: true });
      return;
    }

    // Handle root path redirect based on mode
    if (location.pathname === '/' && deviceMode) {
      console.log('🏠 At root with mode:', deviceMode);
      if (deviceMode === 'kds') {
        navigate('/kds', { replace: true });
      } else if (deviceMode === 'manager') {
        navigate('/data-manager-interface', { replace: true });
      }
      // For 'kiosk' mode, stay on CustomerPhoneInputScreen
    }
  }, [currentUser, deviceMode, isLoading, navigate, location.pathname]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4" dir="rtl">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-lg font-bold">טוען...</p>
      </div>
    );
  }

  // No user - null will be shown briefly before redirect
  if (!currentUser) return null;

  // No mode selected and not on mode-selection page - show loading briefly
  if (!deviceMode && location.pathname !== '/mode-selection') {
    return null;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <RouterRoutes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/admin" element={<LoginScreen />} />
      <Route path="/manager" element={<LoginScreen />} />
      <Route path="/super-admin" element={<SuperAdminDashboard />} />

      {/* Protected Routes */}
      <Route path="/mode-selection" element={
        <ProtectedRoute>
          <ModeSelectionScreen />
        </ProtectedRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute>
          <CustomerPhoneInputScreen />
        </ProtectedRoute>
      } />

      <Route path="/kds" element={
        <ProtectedRoute>
          <KdsScreen />
        </ProtectedRoute>
      } />

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

      {/* Other Protected Pages */}
      <Route path="/customer-phone-input-screen" element={<ProtectedRoute><CustomerPhoneInputScreen /></ProtectedRoute>} />
      <Route path="/new-customer-name-collection-screen" element={<ProtectedRoute><NewCustomerNameCollectionScreen /></ProtectedRoute>} />
      <Route path="/returning-customer-welcome-screen" element={<ProtectedRoute><ReturningCustomerWelcomeScreen /></ProtectedRoute>} />
      <Route path="/menu-ordering-interface" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <MenuOrderingInterface />
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/kitchen-display-system-interface" element={
        <ProtectedRoute>
          <KdsScreen />
        </ProtectedRoute>
      } />
      <Route path="/data-manager-interface" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <DataManagerInterface />
          </ErrorBoundary>
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
          <ScrollToTop />
          <AppRoutes />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;