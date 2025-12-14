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
import ManagerAuthenticationScreen from './pages/manager-authentication-screen';

import DataManagerInterface from './pages/data-manager-interface';
import SuperAdminDashboard from './pages/super-admin';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser, deviceMode, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!currentUser) {
        navigate('/login');
      } else if (!deviceMode && location.pathname !== '/mode-selection') {
        navigate('/mode-selection');
      }
    }
  }, [currentUser, deviceMode, isLoading, navigate, location]);

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">טוען...</div>;
  if (!currentUser) return null;

  return children;
};

const AppRoutes = () => {
  return (
    <RouterRoutes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/admin" element={<ManagerAuthenticationScreen />} />
      <Route path="/admin" element={<ManagerAuthenticationScreen />} />
      <Route path="/manager" element={<ManagerAuthenticationScreen />} />
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

      {/* Other Protected Pages */}
      <Route path="/customer-phone-input-screen" element={<ProtectedRoute><CustomerPhoneInputScreen /></ProtectedRoute>} />
      <Route path="/new-customer-name-collection-screen" element={<ProtectedRoute><NewCustomerNameCollectionScreen /></ProtectedRoute>} />
      <Route path="/returning-customer-welcome-screen" element={<ProtectedRoute><ReturningCustomerWelcomeScreen /></ProtectedRoute>} />
      <Route path="/menu-ordering-interface" element={<ProtectedRoute><MenuOrderingInterface /></ProtectedRoute>} />
      <Route path="/kitchen-display-system-interface" element={<ProtectedRoute><KdsScreen /></ProtectedRoute>} />
      <Route path="/manager-authentication-screen" element={<ManagerAuthenticationScreen />} />
      <Route path="/data-manager-interface" element={<DataManagerInterface />} />

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