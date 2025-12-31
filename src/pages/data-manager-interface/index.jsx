import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useManagerLogic } from '@/hooks/useManagerLogic';
import MenuDisplay from '@/components/manager/MenuDisplay';
import ItemDetails from '@/components/manager/ItemDetails';
import InventoryScreen from '@/components/manager/InventoryScreen';
import SalesDashboard from '@/components/manager/SalesDashboard';
import TasksManager from '@/components/manager/TasksManager';
import ConnectionStatusBar from '../../components/ConnectionStatusBar';
import MiniMusicPlayer from '../../components/music/MiniMusicPlayer';
import { useAuth } from '@/context/AuthContext';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [menuView, setMenuView] = useState('grid'); // 'grid' | 'details'

  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else {
      // Check role again - case-insensitive
      const accessLevel = (currentUser.access_level || '').toLowerCase();
      if (accessLevel !== 'admin' && accessLevel !== 'manager' && !currentUser.is_admin) {
        // If user somehow got here without being manager
        // navigate('/mode-selection');
      }
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- HEARTBEAT FOR ONLINE STATUS ---
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('send_kds_heartbeat');
      } catch (err) {
        // Silent fail
      }
    };

    // Send immediately on mount
    sendHeartbeat();

    // Loop every 60s to keep "Online" status green in Super Admin
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, []);

  const {
    menuItems,
    selectedItem,
    editingItem,
    editForm,
    setEditForm,
    statusMessage,
    errorMessage,
    isLoading,
    fetchAllData,
    openDetails,
    startEdit,
    cancelEdit,
    saveEdit,
  } = useManagerLogic();

  useEffect(() => {
    if (currentUser?.business_id) {
      fetchAllData();
    }
  }, [currentUser?.business_id]);

  // Back Button Interception
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // Only intercept back button if we are logged in
    const authKey = localStorage.getItem('manager_auth_key');
    if (!authKey) return;

    // Push a new entry to history stack when component mounts
    // This allows us to "catch" the back button action
    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = (event) => {
      // Prevent navigation
      window.history.pushState(null, document.title, window.location.href);
      setShowLogoutConfirm(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    try {
      const authKey = localStorage.getItem('manager_auth_key');
      if (authKey) {
        const decoded = JSON.parse(decodeURIComponent(atob(authKey)));
        if (decoded.isImpersonated) {
          setIsImpersonating(true);
        }
      }
    } catch (e) {
      console.error('Error parsing auth key', e);
    }
  }, []);

  const handleLogout = () => {
    // Check if we are checking out as super admin
    const wasImpersonating = isImpersonating;

    localStorage.removeItem('manager_auth_key');
    localStorage.removeItem('manager_auth_time');
    localStorage.removeItem('manager_employee_id');

    if (wasImpersonating) {
      navigate('/super-admin');
    } else {
      navigate('/mode-selection');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100" dir="rtl">
      {/* Header */}
      <header className={`text-white p-2 shadow-md shrink-0 z-20 relative ${isImpersonating ? 'bg-slate-800' : 'bg-blue-600'}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          {/* Right Side Group: Connection Status & Logo/Title (if any) & Logout */}
          <div className="flex items-center gap-3">
            {/* Mini Player & Connection Group */}
            <div className="flex items-center gap-3 bg-white/10 p-1 px-2 rounded-2xl border border-white/10">
              <MiniMusicPlayer />
              <ConnectionStatusBar isIntegrated={true} />
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all text-xs font-bold gap-1 border shadow-sm ${isImpersonating
                ? 'bg-slate-700/50 hover:bg-slate-600 border-slate-600'
                : 'bg-blue-700/50 hover:bg-red-500/80 border-blue-500/30'
                }`}
            >
              {isImpersonating ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
                  <span>חזור</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                  <span>יציאה</span>
                </>
              )}
            </button>
          </div>

          {/* Left Side: Navigation Tabs (Visual Left in RTL) */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar mr-10">
            {[
              { id: 'sales', label: 'מכירות', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" /></svg> },
              { id: 'menu', label: 'תפריט', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg> },
              { id: 'inventory', label: 'מלאי', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg> },
              { id: 'tasks', label: 'משימות', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-20 h-16 rounded-xl transition-all gap-1 ${activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-lg scale-105 font-black ring-2 ring-white/50'
                  : 'text-blue-100 hover:bg-blue-700/50 hover:text-white font-medium'
                  }`}
              >
                {tab.icon}
                <span className="text-[11px] leading-none">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-gray-100">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full flex flex-col"
          >
            {activeTab === 'sales' && <SalesDashboard />}
            {activeTab === 'menu' && <MenuDisplay />}
            {activeTab === 'inventory' && <InventoryScreen />}
            {activeTab === 'tasks' && <TasksManager />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">לצאת מהמערכת?</h2>
              <p className="text-gray-500 text-sm font-medium mb-6">פעולה זו תנתק אותך מממשק הניהול ותחזיר אותך למסך הפתיחה.</p>
              <div className="flex gap-3">
                <button onClick={handleLogout} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors">כן, צא</button>
                <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors">ביטול</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManagerDashboard;
