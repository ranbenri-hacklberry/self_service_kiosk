import React, { useState, useRef, useEffect } from 'react';
import { runSystemDiagnostics, simulateNightlyTraffic } from '../../services/healthCheck';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';

const SystemDiagnostics = ({ businessId }) => {
    const { currentUser } = useAuth();
    // Use the prop if passed (from Super Admin dashboard), otherwise fallback to current user's business
    const targetBusinessId = businessId || currentUser?.business_id;

    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [activeProcess, setActiveProcess] = useState(null); // 'health', 'traffic'
    const logsEndRef = useRef(null);

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

                    {/* Health Check Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 shadow-lg border border-blue-100"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                            <span className="text-2xl">🔍</span>
                        </div>
                        <h3 className="text-lg font-bold text-blue-800 mb-1">בדיקת בריאות מהירה</h3>
                        <p className="text-xs text-blue-600/70 mb-4">
                            יצירה, סנכרון, עדכון ומחיקה של הזמנת בדיקה
                        </p>
                        <button
                            onClick={handleRunHealthCheck}
                            disabled={isRunning}
                            className={`w-full py-3 px-4 rounded-xl font-bold transition-all transform ${isRunning
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                        >
                            {isRunning && activeProcess === 'health' ? '⏳ בודק...' : '🚀 הרץ בדיקה'}
                        </button>
                    </motion.div>

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
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-xs">📟 System Logs</span>
                            {logs.length > 0 && (
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

                    {/* Console Body */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-1 text-slate-300 min-h-0">
                        {logs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500">
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
                </motion.div>
            </div>
        </div>
    );
};

export default SystemDiagnostics;
