import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useManagerLogic } from '@/hooks/useManagerLogic';
import MenuDisplay from '@/components/manager/MenuDisplay';
import ItemDetails from '@/components/manager/ItemDetails';
import InventoryScreen from '@/components/manager/InventoryScreen';
import SalesDashboard from '@/components/manager/SalesDashboard';
import TasksManager from '@/components/manager/TasksManager';
import ConnectionStatusBar from '../../components/ConnectionStatusBar';
import MiniMusicPlayer from '../../components/music/MiniMusicPlayer';
import { useAuth } from '@/context/AuthContext';
import ManagerHeader from '@/components/manager/ManagerHeader';
import { LogOut } from 'lucide-react';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [menuView, setMenuView] = useState('grid'); // 'grid' | 'details'

  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else {
      const accessLevel = (currentUser.access_level || '').toLowerCase();
      if (accessLevel !== 'admin' && accessLevel !== 'manager' && !currentUser.is_admin) {
        navigate('/mode-selection');
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

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('send_kds_heartbeat');
      } catch (err) {
        // Silent fail
      }
    };
    sendHeartbeat();
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

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const authKey = localStorage.getItem('manager_auth_key');
    if (!authKey) return;
    window.history.pushState(null, document.title, window.location.href);
    const handlePopState = (event) => {
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
    <div className="h-screen flex flex-col bg-slate-50" dir="rtl">
      <ManagerHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        isImpersonating={isImpersonating}
        setShowLogoutConfirm={setShowLogoutConfirm}
      />

      <main className="flex-1 overflow-y-auto bg-slate-50">
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
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-sm w-full text-center border border-slate-100"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500 shadow-inner">
                <LogOut size={40} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">לצאת מהמערכת?</h2>
              <p className="text-slate-500 text-sm font-medium mb-8">פעולה זו תנתק אותך מממשק הניהול ותחזיר אותך למסך הפתיחה.</p>
              <div className="flex gap-4">
                <button onClick={handleLogout} className="flex-1 bg-red-600 text-white font-bold h-14 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95">כן, צא</button>
                <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold h-14 rounded-2xl hover:bg-slate-200 transition-all active:scale-95">ביטול</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManagerDashboard;
