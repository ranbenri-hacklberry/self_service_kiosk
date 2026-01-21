import React, { useState, useRef, useEffect } from 'react';
import { runSystemDiagnostics, simulateNightlyTraffic } from '../../services/healthCheck';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

// 🛠️ Force local backend for diagnostics if we're on localhost
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:8081`
    : (import.meta.env.VITE_MUSIC_API_URL || `http://${window.location.hostname}:8081`);

const SystemDiagnostics = ({ businessId }) => {
    const { currentUser } = useAuth();
    // Use the prop if passed (from Super Admin dashboard), otherwise fallback to current user's business
    const targetBusinessId = businessId || currentUser?.business_id;

    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [activeProcess, setActiveProcess] = useState(null); // 'health', 'traffic', 'e2e'
    const [liveScreenshot, setLiveScreenshot] = useState(null);
    const [e2eLogs, setE2eLogs] = useState([]);
    const [isWatchingE2E, setIsWatchingE2E] = useState(false);
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
        setLogs([]); // Clear previous logs
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

    return (
        <div className="h-full p-4 md:p-6 overflow-auto flex flex-col gap-4">
            {/* Header */}
            <div className="text-center md:text-right">
                <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                    🛠️ כלי דיאגנוסטיקה
                </h1>
                <p className="text-slate-500 text-sm">בדיקות עומק, סימולציות ובדיקת מערכת הנאמנות</p>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                {/* Control Panel */}
                <div className="lg:col-span-1 flex flex-col gap-4">

                    {/* Simulation Card */}

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 shadow-lg border border-purple-100"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-200">
                            <span className="text-2xl">☕</span>
                        </div>
                        <h3 className="text-lg font-bold text-purple-800 mb-1">סימולציית 10 הזמנות</h3>
                        <p className="text-xs text-purple-600/70 mb-4">
                            יוצר הזמנות עם נקודות נאמנות - הרץ שוב לבדוק צבירה!
                        </p>
                        <button
                            onClick={handleRunTrafficSim}
                            disabled={isRunning}
                            className={`w-full py-3 px-4 rounded-xl font-bold transition-all transform ${isRunning
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                        >
                            {isRunning && activeProcess === 'traffic' ? '⏳ מסמלץ...' : '🎰 הרץ סימולציה'}
                        </button>
                    </motion.div>

                    {/* E2E Live Test Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 shadow-lg border border-emerald-100"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-200">
                            <span className="text-2xl">🎬</span>
                        </div>
                        <h3 className="text-lg font-bold text-emerald-800 mb-1">בדיקת E2E לייב</h3>
                        <p className="text-xs text-emerald-600/70 mb-4">
                            צפה בבדיקה בזמן אמת עם צילומי מסך
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={async () => {
                                    setIsWatchingE2E(true);
                                    setE2eLogs([{ time: new Date().toISOString(), msg: '🚀 טוען בדיקה...', type: 'info' }]);

                                    try {
                                        const response = await fetch(`${API_URL}/api/run-e2e`, { method: 'POST' });
                                        if (!response.ok) throw new Error('כבר רץ או שגיאה בשרת');

                                        // Start polling if not already
                                        if (!e2eIntervalRef.current) {
                                            e2eIntervalRef.current = setInterval(() => {
                                                setLiveScreenshot(`/screenshots/live.png?t=${Date.now()}`);
                                                fetch(`/screenshots/log.json?t=${Date.now()}`)
                                                    .then(r => r.ok ? r.json() : [])
                                                    .then(data => setE2eLogs(data || []))
                                                    .catch(() => { });
                                            }, 1000);
                                        }
                                    } catch (err) {
                                        addLog(`❌ שגיאת הפעלה: ${err.message}`);
                                    }
                                }}
                                disabled={isWatchingE2E}
                                className={`w-full py-3 px-4 rounded-xl font-bold transition-all transform ${isWatchingE2E
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                            >
                                {isWatchingE2E ? '⚙️ בדיקה רצה...' : '🚀 הרץ בדיקה אוטומטית'}
                            </button>

                            <button
                                onClick={() => {
                                    setIsWatchingE2E(!isWatchingE2E);
                                    if (!isWatchingE2E) {
                                        // Start polling only
                                        setLiveScreenshot(`/screenshots/live.png?t=${Date.now()}`);
                                        e2eIntervalRef.current = setInterval(() => {
                                            setLiveScreenshot(`/screenshots/live.png?t=${Date.now()}`);
                                            fetch(`/screenshots/log.json?t=${Date.now()}`)
                                                .then(r => r.ok ? r.json() : [])
                                                .then(data => setE2eLogs(data || []))
                                                .catch(() => { });
                                        }, 1000);
                                    } else {
                                        if (e2eIntervalRef.current) clearInterval(e2eIntervalRef.current);
                                    }
                                }}
                                className={`w-full py-2 px-4 rounded-xl font-bold transition-all text-sm ${isWatchingE2E
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                    }`}
                            >
                                {isWatchingE2E ? '⏹️ הפסק צפייה' : '👁️ צפה בלבד'}
                            </button>
                        </div>
                        <p className="text-[10px] text-emerald-500 mt-2 text-center">
                            הרץ בטרמינל: <code className="bg-emerald-100 px-1 rounded">node tests/e2e-live.test.js</code>
                        </p>
                    </motion.div>

                </div>

                {/* Console Output */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono text-sm border border-slate-600 min-h-[300px] max-h-[500px] lg:max-h-full"
                >
                    {/* Console Header */}
                    <div className="bg-slate-800/80 backdrop-blur px-4 py-3 border-b border-slate-600 flex justify-between items-center shrink-0">
                        <div className="flex gap-2">
                            <div className={`w-3 h-3 rounded-full ${isWatchingE2E ? 'bg-red-500 animate-pulse' : 'bg-red-500'} shadow-lg shadow-red-500/50`} />
                            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-xs">
                                {isWatchingE2E ? '🎬 E2E Live View' : '📟 System Logs'}
                            </span>
                            {isWatchingE2E && (
                                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs animate-pulse">
                                    ● REC
                                </span>
                            )}
                            {logs.length > 0 && !isWatchingE2E && (
                                <button
                                    onClick={handleCopy}
                                    className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all transform hover:scale-105 active:scale-95 ${copied
                                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                                        : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-400/50 hover:from-amber-500 hover:to-orange-600'
                                        }`}
                                >
                                    {copied ? '✅ הועתק!' : '📋 העתק הכל'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Console Body - Switch between logs and E2E view */}
                    <div className="flex-1 p-4 overflow-y-auto text-slate-300 min-h-0">
                        {isWatchingE2E ? (
                            /* E2E Live View */
                            <div className="h-full flex flex-col lg:flex-row gap-4">
                                {/* Screenshot */}
                                <div className="flex-1 bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
                                    {liveScreenshot ? (
                                        <img
                                            src={liveScreenshot}
                                            alt="Live Screenshot"
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                e.target.src = '';
                                                e.target.alt = 'ממתין לצילום...';
                                            }}
                                        />
                                    ) : (
                                        <div className="text-slate-500 text-center">
                                            <div className="text-4xl mb-2">📸</div>
                                            <p>ממתין לצילום מסך...</p>
                                        </div>
                                    )}
                                </div>

                                {/* Live Log */}
                                <div className="lg:w-64 shrink-0 bg-slate-800 rounded-xl p-3 overflow-y-auto font-mono text-xs max-h-[200px] lg:max-h-full">
                                    <div className="text-slate-400 mb-2 text-[10px] uppercase tracking-wider">
                                        📋 Log ({e2eLogs.length})
                                    </div>
                                    {e2eLogs.length === 0 ? (
                                        <div className="text-slate-500 text-center py-4">
                                            <p>הרץ: node tests/e2e-live.test.js</p>
                                        </div>
                                    ) : (
                                        e2eLogs.slice(-15).map((log, idx) => (
                                            <div
                                                key={idx}
                                                className={`py-0.5 ${log.type === 'success' ? 'text-emerald-400' :
                                                    log.type === 'error' ? 'text-red-400' :
                                                        'text-slate-300'
                                                    }`}
                                            >
                                                {log.msg}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Regular Logs View */
                            <div className="space-y-1">
                                {logs.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                        <div className="text-6xl mb-4 animate-pulse">🖥️</div>
                                        <p className="text-lg font-bold">מוכן לפקודות...</p>
                                        <p className="text-xs text-slate-600 mt-1">לחץ על אחד הכפתורים להתחלה</p>
                                    </div>
                                )}

                                {logs.map((log, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`flex gap-3 py-1 px-2 rounded-lg ${log.msg.includes('📊') || log.msg.includes('====')
                                            ? 'bg-purple-900/30 border-l-2 border-purple-400'
                                            : 'hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <span className="text-slate-500 select-none text-xs">[{log.time}]</span>
                                        <span className={`flex-1 ${log.msg.includes('❌') ? 'text-red-400 font-bold' :
                                            log.msg.includes('✅') ? 'text-emerald-400' :
                                                log.msg.includes('⚠️') ? 'text-amber-400' :
                                                    log.msg.includes('📊') ? 'text-purple-300 font-bold' :
                                                        log.msg.includes('🎉') ? 'text-pink-400 font-bold' :
                                                            log.msg.includes('💡') ? 'text-yellow-300' :
                                                                log.msg.includes('📱') ? 'text-cyan-300' :
                                                                    'text-slate-300'
                                            }`}>{log.msg}</span>
                                    </motion.div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default SystemDiagnostics;
