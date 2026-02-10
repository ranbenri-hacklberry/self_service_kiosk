// @ts-nocheck
/**
 * Maia Chat Overlay - Team Member Interface
 * With Quick Actions for Post Creation
 */
import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
    Sparkles, X, Minimize2, Maximize2, Send,
    Loader2, Bot, User, GripVertical, Zap,
    Instagram, MessageSquare, AlertTriangle,
    Plus, Image as ImageIcon, Square, RectangleVertical,
    RefreshCw, Settings, LogOut
} from 'lucide-react';
import ClockInModalInline from './ClockInModalInline';
import UserSettingsModal from './UserSettingsModal';
import TeamMessageModal from './TeamMessageModal';

// Safe location hook - returns fallback if outside Router
const useSafeLocation = () => {
    try {
        // Dynamic import to avoid errors outside Router
        const { useLocation } = require('react-router-dom');
        return useLocation();
    } catch {
        return { pathname: '/manager' }; // Default to showing Maya
    }
};

// Import context directly (not the hook) - this won't throw when outside provider
import AuthContext from '../../context/AuthContextCore';
import { supabase } from '../../lib/supabase';
import maiaLogo from '../../assets/maia-logo.png';
import PostCreator from '../marketing/PostCreator';

// Safe auth hook - returns null safely if outside AuthProvider
const useSafeAuth = () => {
    const ctx = useContext(AuthContext);
    // ctx will be null if outside provider (that's fine, we have fallbacks)
    return ctx || { businessId: null, currentUser: null };
};

// TypeScript Interfaces
interface Employee {
    id: string;
    name: string;
    accessLevel: string;
    isSuperAdmin: boolean;
    businessId: string;
}

interface MayaOverlayProps {
    employee?: Employee | null;
    canViewFinancialData?: boolean;
    sessionId?: string;
    onLogout?: () => void;
    needsClockIn?: boolean;           // 🆕 NEW
    isClockedIn?: boolean;             // 🆕 NEW
    onClockInComplete?: (role: string, eventId: string) => void; // 🆕 NEW
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isAutomation?: boolean;
    actions?: MessageAction[];
}

interface MessageAction {
    type: 'story' | 'sms' | 'alert';
    label: string;
    data: any;
    pending?: boolean;
    completed?: boolean;
}

interface AutomationLog {
    id: string;
    action: string;
    target: string;
    details: any;
    created_at: string;
}

// Routes where Maya should be visible
const ALLOWED_ROUTES = {
    // Manager screens (for all users)
    manager: ['/manager', '/orders', '/kitchen', '/shift', '/staff'],
    // Owner/Admin screens
    owner: ['/data', '/super-admin', '/owner-settings', '/analytics', '/marketing']
};

export const MayaOverlay: React.FC<MayaOverlayProps> = ({
    employee = null,
    canViewFinancialData = false,
    sessionId = null,
    onLogout = null,
    needsClockIn = false,           // 🆕 NEW
    isClockedIn = false,             // 🆕 NEW
    onClockInComplete = null         // 🆕 NEW
}) => {
    const auth = useSafeAuth(); // Safely get auth - won't crash outside AuthProvider
    const location = useSafeLocation(); // Safely get location - won't crash outside Router

    // Use passed employee OR fallback to current auth user
    const activeEmployee = employee || auth.currentUser;

    // iCaffe business ID (UUID format)
    const businessId = activeEmployee?.business_id || activeEmployee?.businessId || auth?.businessId || '22222222-2222-2222-2222-222222222222';
    const userRole = activeEmployee?.access_level || activeEmployee?.accessLevel || 'staff';
    const isOwner = userRole === 'owner' || userRole === 'admin' || userRole === 'Admin';

    // Check if Maya should be visible on current route
    const shouldShow = useCallback(() => {
        const path = location.pathname;

        // Manager routes - always visible
        if (ALLOWED_ROUTES.manager.some(route => path.startsWith(route))) {
            return true;
        }

        // Owner routes - only for owners/admins
        if (isOwner && ALLOWED_ROUTES.owner.some(route => path.startsWith(route))) {
            return true;
        }

        return false;
    }, [location.pathname, isOwner]);

    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position] = useState({ x: 20, y: 20 });
    const [unreadCount, setUnreadCount] = useState(0);

    // Post Creator State
    const [showPostCreator, setShowPostCreator] = useState(false);
    const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);

    // User Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [showTeamMessage, setShowTeamMessage] = useState(false);

    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Provider State
    const [provider, setProvider] = useState<'local' | 'google'>('local');
    const [localAvailable, setLocalAvailable] = useState(true);
    const [googleAvailable, setGoogleAvailable] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();

    // 🆕 Clock-In State
    const [showClockIn, setShowClockIn] = useState(needsClockIn && !isClockedIn);

    // 🆕 Sync showClockIn with props OR Fetch status
    // 🆕 Sync showClockIn with props OR Fetch status
    useEffect(() => {
        if (needsClockIn !== undefined) {
            // If prop is explicit, honor it
            setShowClockIn(needsClockIn && !isClockedIn);
        } else if (activeEmployee?.id) {
            // Otherwise, check DB for status via RPC (Reliable)
            console.log('🕰️ Maya: Checking clock status for', activeEmployee.name);
            const checkClockStatus = async () => {
                try {
                    const { data, error } = await supabase.rpc('get_employee_shift_status', {
                        p_employee_id: activeEmployee.id
                    });

                    if (!error && data) {
                        const currentlyClockedIn = data.is_clocked_in; // RPC returns { is_clocked_in: boolean }
                        console.log('🕰️ Clock Status (RPC):', currentlyClockedIn ? 'IN' : 'OUT');
                        if (!currentlyClockedIn) {
                            setShowClockIn(true);
                            // Auto-open if not clocked in
                            setIsOpen(true);
                        }
                    } else if (error) {
                        console.warn('⚠️ RPC failed, assuming clocked out:', error);
                        // Fallback logic could go here, but let's be safe
                        setShowClockIn(true);
                        setIsOpen(true);
                    }
                } catch (err) {
                    console.error('Failed to check clock status:', err);
                }
            };
            checkClockStatus();
        }
    }, [needsClockIn, isClockedIn, activeEmployee?.id, activeEmployee?.name]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Check provider availability on mount
    useEffect(() => {
        const checkProviders = async () => {
            // Check local (Ollama)
            try {
                const res = await fetch('http://localhost:8081/api/maya/health');
                const data = await res.json();
                setLocalAvailable(data.healthy === true);
                if (!data.healthy) {
                    setProvider('google'); // Switch to Google if local not available
                }
            } catch {
                setLocalAvailable(false);
                setProvider('google');
            }

            // Check if Google is configured (business has API key)
            if (businessId) {
                try {
                    const { data } = await supabase
                        .from('businesses')
                        .select('gemini_api_key')
                        .eq('id', businessId)
                        .single();
                    setGoogleAvailable(!!data?.gemini_api_key);
                } catch {
                    setGoogleAvailable(false);
                }
            }
        };
        checkProviders();
    }, [businessId]);

    // Realtime Automations Listener
    useEffect(() => {
        if (!businessId) return;

        const channel = supabase
            .channel('maia-automations')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'automation_logs',
                    filter: `business_id=eq.${businessId}`
                },
                (payload) => {
                    const log = payload.new as AutomationLog;
                    const systemMessage = createSystemMessage(log);

                    setMessages(prev => [...prev, systemMessage]);

                    if (!isOpen) {
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [businessId, isOpen]);

    const createSystemMessage = (log: AutomationLog): Message => {
        let content = '';
        let actions: MessageAction[] = [];

        switch (log.action) {
            case 'vip_order_detected':
                const vipName = log.target;
                content = `🎯 זיהיתי שנתי הזמין! הזרקתי את הקבוע שלו.`;
                actions = [
                    {
                        type: 'story',
                        label: '📸 פרסם סטורי לדנה',
                        data: { vipName: log.target, ...log.details }
                    },
                    {
                        type: 'sms',
                        label: '📱 שלח מסרון לנתי',
                        data: { target: log.target }
                    }
                ];
                break;

            case 'story_posted':
                content = `✅ הסטורי נשלח לדנה (Instagram Webhook)!`;
                break;

            case 'sms_sent':
                content = `✅ מסרון נשלח בהצלחה ל-${log.target}`;
                break;

            default:
                content = `🤖 אוטומציה: ${log.action}`;
        }

        return {
            id: `auto-${log.id}`,
            role: 'system',
            content,
            timestamp: new Date(log.created_at),
            isAutomation: true,
            actions: actions.length > 0 ? actions : undefined
        };
    };

    const sendMessage = useCallback(async () => {
        if (!input.trim() || loading || !businessId) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Prepare messages for API
            let messagesToSend = messages
                .filter(m => m.role !== 'system')
                .concat(userMessage)
                .map(m => ({ role: m.role, content: m.content }));

            // 🔒 WORKER SANITY CHECK: Prepend system instruction for non-financial users
            if (activeEmployee && !canViewFinancialData) {
                const workerInstruction = {
                    role: 'system',
                    content: `⚠️ SECURITY: You are talking to a staff member (${activeEmployee.name}, ${activeEmployee.accessLevel || activeEmployee.access_level}). DO NOT reveal any financial data, revenue, profit, sales figures, pricing strategies, or sensitive owner-only metrics. Focus on operational information like orders, inventory, and customer service.`
                };
                messagesToSend = [workerInstruction, ...messagesToSend];
            }

            // Use full URL to backend if needed, or relative /api proxy
            const response = await fetch('http://localhost:8081/api/maya/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesToSend,
                    businessId,
                    provider,
                    sessionId: sessionId || undefined, // For audit trail
                    employeeId: activeEmployee?.id || undefined
                })
            });

            const data = await response.json();

            const assistantMessage: Message = {
                id: `maia-${Date.now()}`,
                role: 'assistant',
                content: data.response || 'אופס, נתקע לי המעבד...',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Maia Error:', err);
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'סליחה רני, אני לא מצליחה להתחבר למוח שלי כרגע.',
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages, businessId, provider]);

    const handleAction = async (action: MessageAction, messageId: string) => {
        // Set Pending
        setMessages(prev => prev.map(m => {
            if (m.id === messageId && m.actions) {
                return {
                    ...m,
                    actions: m.actions.map(a => a === action ? { ...a, pending: true } : a)
                };
            }
            return m;
        }));

        try {
            if (action.type === 'story') {
                // Generate Caption
                const captionRes = await fetch('http://localhost:8081/api/marketing/generate-caption', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        context: `${action.data.vipName} הזמין את הקבוע שלו (הפוך חזק שיבולת)`,
                        style: 'עוקצני'
                    })
                });
                const { caption } = await captionRes.json();

                // Publish
                await fetch('http://localhost:8081/api/marketing/story', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        type: 'vip_order',
                        caption,
                        metadata: action.data
                    })
                });
            }

            if (action.type === 'sms') {
                // Placeholder for SMS
                await fetch('http://localhost:8081/api/marketing/sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        phone: '0501234567', // Nati's phone from DB/Env
                        message: 'הקפה שלך מוכן נתי! בוא לפני שיתקרר 😉'
                    })
                });
            }

            // Set Completed
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.actions) {
                    return {
                        ...m,
                        actions: m.actions.map(a => a === action ? { ...a, pending: false, completed: true } : a)
                    };
                }
                return m;
            }));

        } catch (err) {
            console.error('Action Failed:', err);
            // Revert pending
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.actions) {
                    return {
                        ...m,
                        actions: m.actions.map(a => a === action ? { ...a, pending: false } : a)
                    };
                }
                return m;
            }));
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        setIsMinimized(false);
        setUnreadCount(0);
    };

    // 🆕 Refresh Handler
    const handleRefresh = () => {
        setMessages([]);
        setInput('');
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Don't render if not on allowed route
    if (!shouldShow()) {
        return null;
    }

    return (
        <>
            {/* Post Creator Modal */}
            <AnimatePresence>
                {showPostCreator && (
                    <PostCreator
                        businessId={businessId}
                        onClose={() => setShowPostCreator(false)}
                    />
                )}
            </AnimatePresence>

            {/* User Settings Modal */}
            <AnimatePresence>
                {showSettings && activeEmployee && (
                    <UserSettingsModal
                        employee={activeEmployee}
                        onClose={() => setShowSettings(false)}
                    />
                )}
            </AnimatePresence>

            {/* Team Message Modal */}
            <AnimatePresence>
                {showTeamMessage && activeEmployee && (
                    <TeamMessageModal
                        businessId={businessId}
                        activeEmployee={activeEmployee}
                        onClose={() => setShowTeamMessage(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleOpen}
                        className="fixed bottom-6 left-6 z-[9999] w-16 h-16 rounded-full
                       bg-purple-600 border-4 border-purple-400
                       shadow-xl shadow-purple-500/40 flex items-center justify-center
                       hover:bg-purple-500 hover:shadow-purple-500/60 hover:border-purple-300
                       transition-all duration-200"
                    >
                        <img src={maiaLogo} alt="Maia" className="w-10 h-10 object-contain" />
                        {unreadCount > 0 && (
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
                           text-xs text-white flex items-center justify-center font-bold"
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </motion.span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            height: isMinimized ? 56 : 520,
                            width: isMinimized ? 200 : 400
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        drag
                        dragControls={dragControls}
                        dragMomentum={false}
                        dragElastic={0}
                        className="fixed z-[9999] rounded-2xl overflow-hidden
                       backdrop-blur-xl bg-slate-900/90 border border-white/10
                       shadow-2xl shadow-purple-500/20"
                        style={{ left: position.x, bottom: position.y, direction: 'rtl' }}
                    >
                        {/* Header */}
                        <div
                            className="h-14 px-4 flex items-center justify-between 
                         bg-gradient-to-r from-purple-600/50 to-pink-600/50 
                         border-b border-white/10 cursor-move"
                            onPointerDown={(e) => dragControls.start(e)}
                        >
                            <div className="flex items-center gap-3">
                                <GripVertical className="w-4 h-4 text-white/40" />
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                                    <img src={maiaLogo} alt="Maia" className="w-full h-full object-cover" />
                                </div>
                                {!isMinimized && (
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Maia AI</h3>
                                        <p className="text-xs text-white/60">חלק מהצוות</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Settings Button */}
                                {/* Settings Button */}
                                {!isMinimized && activeEmployee && (
                                    <>
                                        {/* 🕒 Clock Out Button (Only if NOT showing clock-in modal) */}
                                        {!showClockIn && (
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm('לסיים משמרת ולצאת?')) {
                                                        try {
                                                            const { error } = await supabase.rpc('handle_clock_event', {
                                                                p_employee_id: activeEmployee.id,
                                                                p_event_type: 'clock_out'
                                                            });

                                                            if (!error) {
                                                                // alert('יצאת מהמשמרת בהצלחה');
                                                                // Force re-check -> show clock-in modal
                                                                setShowClockIn(true);
                                                                handleRefresh();
                                                            } else {
                                                                alert('שגיאה ביציאה מהמשמרת');
                                                            }
                                                        } catch (e) {
                                                            console.error('Clock out error', e);
                                                        }
                                                    }
                                                }}
                                                className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition ml-1"
                                                title="סיים משמרת (Clock Out)"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                if (window.confirm('האם אתה בטוח שברצונך להחליף משתמש?')) {
                                                    auth?.logout?.(); // Call AuthContext logout if available
                                                    onLogout?.();     // Call prop onLogout if available
                                                    setIsOpen(false);
                                                }
                                            }}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition"
                                            title="החלף משתמש (Sign Out)"
                                        >
                                            <LogOut className="w-4 h-4 text-amber-400 hover:text-amber-300" />
                                        </button>

                                        <button
                                            onClick={() => setShowSettings(true)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition"
                                            title="הגדרות פרופיל"
                                        >
                                            <User className="w-4 h-4 text-white/60 hover:text-white" />
                                        </button>
                                    </>
                                )}

                                {/* 🆕 Refresh Button */}
                                {!isMinimized && !showClockIn && (
                                    <button
                                        onClick={handleRefresh}
                                        className="p-1.5 hover:bg-white/10 rounded-lg transition"
                                        title="רענן שיחה"
                                    >
                                        <RefreshCw className="w-4 h-4 text-white/60 hover:text-white" />
                                    </button>
                                )}

                                {/* Provider Toggle */}
                                {!isMinimized && (
                                    <div className="flex bg-white/10 rounded-lg p-0.5 ml-2">
                                        <button
                                            onClick={() => localAvailable && setProvider('local')}
                                            disabled={!localAvailable}
                                            className={`px-2 py-1 rounded text-xs font-medium transition ${provider === 'local'
                                                ? 'bg-purple-500 text-white'
                                                : localAvailable
                                                    ? 'text-white/60 hover:text-white'
                                                    : 'text-white/30 cursor-not-allowed'
                                                }`}
                                            title={localAvailable ? 'מקומי (Ollama)' : 'לא זמין'}
                                        >
                                            🖥️
                                        </button>
                                        <button
                                            onClick={() => googleAvailable && setProvider('google')}
                                            disabled={!googleAvailable}
                                            className={`px-2 py-1 rounded text-xs font-medium transition ${provider === 'google'
                                                ? 'bg-purple-500 text-white'
                                                : googleAvailable
                                                    ? 'text-white/60 hover:text-white'
                                                    : 'text-white/30 cursor-not-allowed'
                                                }`}
                                            title={googleAvailable ? 'Google Gemini' : 'לא מוגדר'}
                                        >
                                            ✨
                                        </button>
                                    </div>
                                )}
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition"
                                >
                                    {isMinimized ? <Maximize2 className="w-4 h-4 text-white/70" /> : <Minimize2 className="w-4 h-4 text-white/70" />}
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition"
                                >
                                    <X className="w-4 h-4 text-white/70" />
                                </motion.button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        {!isMinimized && (
                            <>
                                {/* 🆕 INLINE CLOCK-IN (if needed) */}
                                {showClockIn && activeEmployee && (
                                    <div className="flex-1 overflow-y-auto px-4 py-3">
                                        <ClockInModalInline
                                            employee={activeEmployee}
                                            onClockInSuccess={(role, eventId) => {
                                                console.log('✅ Clocked in:', { role, eventId });
                                                setShowClockIn(false);
                                                if (onClockInComplete) {
                                                    onClockInComplete(role, eventId);
                                                }
                                            }}
                                            onError={(err) => {
                                                console.error('Clock-in error:', err);
                                                // You can add a toast notification here
                                            }}
                                        />
                                    </div>
                                )}

                                {/* CHAT INTERFACE (only if NOT showing clock-in) */}
                                {!showClockIn && (
                                    <>
                                        <div className="h-[400px] overflow-y-auto p-4 space-y-3">
                                            {messages.length === 0 && (
                                                <div className="text-center text-white/40 py-6">
                                                    <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm font-medium">היי! מה נעשה היום?</p>
                                                    <p className="text-xs mb-4">בחר פעולה או דבר איתי</p>

                                                    {/* Quick Actions */}
                                                    <div className="flex flex-wrap gap-2 justify-center">
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => setShowPostCreator(true)}
                                                            className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                            צור פוסט
                                                        </motion.button>

                                                        {/* Team Message - Only for Managers+ */}
                                                        {['owner', 'admin', 'manager'].includes(userRole) && (
                                                            <motion.button
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => setShowTeamMessage(true)}
                                                                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                                הודעה לצוות
                                                            </motion.button>
                                                        )}
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => setInput('תכתבי לי טקסט שיווקי ל')}
                                                            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                        >
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            טקסט שיווקי
                                                        </motion.button>
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => setInput('מה המבצע של היום?')}
                                                            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                        >
                                                            <Zap className="w-3.5 h-3.5" />
                                                            מבצע היום
                                                        </motion.button>
                                                    </div>
                                                </div>
                                            )}

                                            <AnimatePresence mode="popLayout">
                                                {messages.map((msg) => (
                                                    <motion.div
                                                        key={msg.id}
                                                        layout
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                                                    >
                                                        {msg.role !== 'user' && (
                                                            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center 
                                          ${msg.isAutomation ? 'bg-amber-500/30' : 'bg-purple-500/30'}`}>
                                                                {msg.isAutomation ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <Bot className="w-3.5 h-3.5 text-purple-400" />}
                                                            </div>
                                                        )}

                                                        <div className="max-w-[85%] space-y-2">
                                                            <div className={`px-3 py-2 rounded-xl text-sm 
                                          ${msg.role === 'user' ? 'bg-cyan-500 text-white' :
                                                                    msg.isAutomation ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30' : 'bg-white/10 text-white'}`}>
                                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                            </div>

                                                            {msg.actions && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {msg.actions.map((action, idx) => (
                                                                        <motion.button
                                                                            key={idx}
                                                                            whileTap={{ scale: 0.95 }}
                                                                            onClick={() => handleAction(action, msg.id)}
                                                                            disabled={action.pending || action.completed}
                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors
                                             ${action.completed ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                                                        >
                                                                            {action.pending ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                                                                action.type === 'story' ? <Instagram className="w-3 h-3" /> :
                                                                                    action.type === 'sms' ? <MessageSquare className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                                            {action.completed ? 'בוצע' : action.label}
                                                                        </motion.button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {msg.role === 'user' && (
                                                            <div className="w-7 h-7 rounded-full bg-cyan-500/30 flex-shrink-0 flex items-center justify-center">
                                                                <User className="w-3.5 h-3.5 text-cyan-400" />
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            {loading && (
                                                <div className="flex gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-purple-500/30 flex items-center justify-center">
                                                        <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                                                    </div>
                                                    <div className="bg-white/10 px-3 py-2 rounded-xl">
                                                        <div className="flex gap-1">
                                                            <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" />
                                                            <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:100ms]" />
                                                            <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:200ms]" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Input Area */}
                                        <div className="p-3 border-t border-white/10">
                                            <div className="flex gap-2">
                                                {/* Quick Create Post Button */}
                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => setShowPostCreator(true)}
                                                    className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white hover:opacity-90 transition-opacity"
                                                    title="צור פוסט"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </motion.button>
                                                <input
                                                    type="text"
                                                    value={input}
                                                    onChange={(e) => setInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                                    placeholder="דבר איתי..."
                                                    disabled={loading}
                                                    className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                                                />
                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={sendMessage}
                                                    disabled={loading || !input.trim()}
                                                    className="px-3 py-2 bg-purple-500 rounded-xl text-white disabled:opacity-50 hover:bg-purple-600 transition-colors"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </motion.button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}; // Added default export

export default MayaOverlay;
