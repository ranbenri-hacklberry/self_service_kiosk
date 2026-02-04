import React, { useState, useRef, useEffect } from 'react';
import { runSystemDiagnostics, simulateNightlyTraffic } from '@/services/healthCheck';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import DeploymentChecklist from '@/components/manager/DeploymentChecklist';

// 🛠️ Force local backend for diagnostics if we're on localhost
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:8081`
    : (import.meta.env.VITE_MUSIC_API_URL || `http://${window.location.hostname}:8081`);

const SystemDiagnostics = ({ businessId }) => {
    const { currentUser } = useAuth();
    const targetBusinessId = businessId || currentUser?.business_id;

    const [view, setView] = useState('checklist'); // 'logs' or 'checklist'
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [activeProcess, setActiveProcess] = useState(null); // 'health', 'traffic', 'e2e'
    const [liveScreenshot, setLiveScreenshot] = useState(null);
    const [e2eLogs, setE2eLogs] = useState([]);
    const [isWatchingE2E, setIsWatchingE2E] = useState(false);
    const [uptimeStats, setUptimeStats] = useState([]);
    const [uptimeDays, setUptimeDays] = useState(1);
    const [isUptimeLoading, setIsUptimeLoading] = useState(false);
    const logsEndRef = useRef(null);
    const e2eIntervalRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (msg) => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
    };

    const handleRunHealthCheck = async () => {
        if (isRunning) return;
        if (!targetBusinessId) {
            addLog('❌ No Business ID found');
            return;
        }
        setIsRunning(true);
        setActiveProcess('health');
        setLogs([]);
        addLog(`🚀 Starting Fast Health Check for Business: ${targetBusinessId.substring(0, 8)}...`);

        const result = await runSystemDiagnostics(targetBusinessId);

        if (result.logs) {
            result.logs.forEach(l => addLog(typeof l === 'string' ? l : l.msg));
        }

        setIsRunning(false);
        setActiveProcess(null);
    };

    const handleRunTrafficSim = async () => {
        if (isRunning) return;
        if (!targetBusinessId) {
            addLog('❌ No Business ID found');
            return;
        }
        setIsRunning(true);
        setActiveProcess('traffic');
        setLogs([]);
        addLog(`🌙 Starting Nightly Traffic Simulation (10 Orders) for Business: ${targetBusinessId.substring(0, 8)}...`);
        addLog('⏳ This process takes about 20-30 seconds...');

        const result = await simulateNightlyTraffic(targetBusinessId, 10);

        if (result.logs) {
            result.logs.forEach(l => addLog(l));
        }

        setIsRunning(false);
        setActiveProcess(null);
    };

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const text = logs.map(l => `[${l.time}] ${l.msg}`).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const fetchUptimeData = async () => {
        if (!targetBusinessId) return;
        setIsUptimeLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_device_uptime_stats', {
                p_business_id: targetBusinessId,
                p_days: uptimeDays
            });
            if (error) throw error;
            setUptimeStats(data || []);
        } catch (err) {
            console.error('Error fetching uptime:', err);
        } finally {
            setIsUptimeLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'logs') {
            fetchUptimeData();
        }
    }, [view, uptimeDays, targetBusinessId]);

    return (
        <div className="h-full overflow-hidden flex flex-col">
            {/* View Switcher Tabs */}
            <div className="px-6 pt-6 flex gap-1 bg-slate-950">
                <button
                    onClick={() => setView('checklist')}
                    className={`px-6 py-2 rounded-t-xl font-bold transition-all ${view === 'checklist' ? 'bg-[#000] text-[#00ff00] border-t border-l border-r border-[#00ff00]' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    📟 DEPLOYMENT CHECKLIST
                </button>
                <button
                    onClick={() => setView('logs')}
                    className={`px-6 py-2 rounded-t-xl font-bold transition-all ${view === 'logs' ? 'bg-slate-900 text-white border-t border-l border-r border-slate-700' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    🛠️ ADVANCED DIAGNOSTICS
                </button>
            </div>

            {view === 'checklist' ? (
                <div className="flex-1 min-h-0 bg-black">
                    <DeploymentChecklist businessId={targetBusinessId} />
                </div>
            ) : (
                <div className="flex-1 p-4 md:p-6 overflow-auto flex flex-col gap-4 bg-slate-900">
                    <div className="text-center md:text-right">
                        <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                            🛠️ כלי דיאגנוסטיקה מתקדמים
                        </h1>
                        <p className="text-slate-500 text-sm">בדיקות עומק, סימולציות ובדיקת מערכת הנאמנות</p>
                    </div>

                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                        <div className="lg:col-span-1 flex flex-col gap-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 shadow-lg border border-purple-100"
                            >
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-200">
                                    <span className="text-2xl">☕</span>
                                </div>
                                <h3 className="text-lg font-bold text-purple-800 mb-1">סימולציית 10 הזמנות</h3>
                                <p className="text-xs text-purple-600/70 mb-4">יוצר הזמנות עם נקודות נאמנות</p>
                                <button
                                    onClick={handleRunTrafficSim}
                                    disabled={isRunning}
                                    className={`w-full py-3 px-4 rounded-xl font-bold transition-all transform ${isRunning ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-300 hover:scale-[1.02] active:scale-[0.98]'}`}
                                >
                                    {isRunning && activeProcess === 'traffic' ? '⏳ מסמלץ...' : '🎰 הרץ סימולציה'}
                                </button>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 shadow-lg border border-emerald-100"
                            >
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-200">
                                    <span className="text-2xl">🎬</span>
                                </div>
                                <h3 className="text-lg font-bold text-emerald-800 mb-1">בדיקת E2E לייב</h3>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={async () => {
                                            setIsWatchingE2E(true);
                                            try {
                                                const response = await fetch(`${API_URL}/api/run-e2e`, { method: 'POST' });
                                                if (!response.ok) throw new Error('כבר רץ');
                                            } catch (err) {
                                                addLog(`❌ שגיאת הפעלה: ${err.message}`);
                                            }
                                        }}
                                        disabled={isWatchingE2E}
                                        className={`w-full py-3 px-4 rounded-xl font-bold transition-all ${isWatchingE2E ? 'bg-slate-200 text-slate-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'}`}
                                    >
                                        🚀 הרץ בדיקה
                                    </button>
                                </div>
                            </motion.div>

                            {/* Connectivity Uptime Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 rounded-2xl p-5 shadow-lg border border-blue-500/30 text-white"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shadow-inner">
                                        <span className="text-xl">📡</span>
                                    </div>
                                    <div className="flex bg-slate-800/80 p-1 rounded-lg text-[10px] font-bold">
                                        <button
                                            onClick={() => setUptimeDays(1)}
                                            className={`px-2 py-1 rounded ${uptimeDays === 1 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                                        >24H</button>
                                        <button
                                            onClick={() => setUptimeDays(7)}
                                            className={`px-2 py-1 rounded ${uptimeDays === 7 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                                        >7D</button>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-blue-100 mb-1">זמינות המערכת (Uptime)</h3>
                                <p className="text-[10px] text-blue-300/70 mb-4">* בשעות הפעילות של העסק בלבד</p>

                                <div className="space-y-4">
                                    {isUptimeLoading ? (
                                        <div className="animate-pulse flex flex-col gap-2">
                                            <div className="h-2 bg-slate-700 rounded-full w-full"></div>
                                            <div className="h-2 bg-slate-700 rounded-full w-2/3"></div>
                                        </div>
                                    ) : uptimeStats.length === 0 ? (
                                        <p className="text-xs text-slate-500 text-center py-4 italic">אין נתוני היסטוריית חיבור עדיין</p>
                                    ) : (
                                        uptimeStats.map((stat, i) => {
                                            const percent = parseFloat(stat.uptime_percentage);
                                            const colorClass = percent > 95 ? 'bg-emerald-500' : percent > 80 ? 'bg-amber-500' : 'bg-red-500';
                                            const textColorClass = percent > 95 ? 'text-emerald-400' : percent > 80 ? 'text-amber-400' : 'text-red-400';

                                            return (
                                                <div key={i} className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-bold">
                                                        <span className="truncate max-w-[120px] opacity-80">{stat.device_type?.toUpperCase()} - {stat.device_id?.slice(-4)}</span>
                                                        <span className={textColorClass}>{percent}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${percent}%` }}
                                                            className={`h-full ${colorClass}`}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] text-slate-500">
                                                        <span>{stat.total_active_hours} שעות פעילות</span>
                                                        <span>מתוך {stat.expected_hours}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <button
                                    onClick={fetchUptimeData}
                                    className="mt-4 w-full py-1.5 text-[10px] font-bold text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-all uppercase tracking-wider"
                                >
                                    רענן נתונים 🔄
                                </button>
                            </motion.div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono text-sm border border-slate-600"
                        >
                            <div className="bg-slate-800/80 backdrop-blur px-4 py-3 border-b border-slate-600 flex justify-between items-center">
                                <span className="text-slate-400 text-xs">📟 System Logs</span>
                                {logs.length > 0 && (
                                    <button onClick={handleCopy} className="bg-amber-500 text-white px-3 py-1 rounded text-xs">📋 העתק</button>
                                )}
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto text-slate-300">
                                {logs.map((log, idx) => (
                                    <div key={idx} className="flex gap-2 py-0.5">
                                        <span className="text-slate-500 text-[10px]">[{log.time}]</span>
                                        <span className={log.msg.includes('❌') ? 'text-red-400' : log.msg.includes('✅') ? 'text-emerald-400' : ''}>
                                            {log.msg}
                                        </span>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemDiagnostics;
