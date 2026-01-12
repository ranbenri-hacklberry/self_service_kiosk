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

    return (
        <div className="h-full p-6 overflow-hidden flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-800">🛠️ כלי דיאגנוסטיקה (Admin Only)</h1>
                <p className="text-slate-500">בדיקות עומק, סימולציות ובדיקת עומס</p>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                {/* Control Panel */}
                <div className="md:col-span-1 space-y-4">

                    {/* Health Check Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100"
                    >
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">בדיקת בריאות מהירה</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            מריצה הזמנה אחת: יצירה, סנכרון, עדכון ומחיקה. מוודאת לוגיקה תקינה.
                        </p>
                        <button
                            onClick={handleRunHealthCheck}
                            disabled={isRunning}
                            className={`w-full py-3 px-4 rounded-xl font-bold transition-all ${isRunning
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 shadow-xl hover:shadow-2xl'
                                }`}
                        >
                            {isRunning && activeProcess === 'health' ? 'בודק...' : 'הרץ בדיקה כעת'}
                        </button>
                    </motion.div>

                    {/* Simulation Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100"
                    >
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">סימולטור עומס לילה</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            יוצר 10 הזמנות מגוונות ושומר בהיסטוריה.
                        </p>
                        <button
                            onClick={handleRunTrafficSim}
                            disabled={isRunning}
                            className={`w-full py-3 px-4 rounded-xl font-bold transition-all ${isRunning
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-xl hover:shadow-2xl'
                                }`}
                        >
                            {isRunning && activeProcess === 'traffic' ? 'מבצע סימולציה...' : 'הרץ סימולציה (10 הזמנות)'}
                        </button>
                    </motion.div>

                </div>

                {/* Console Output */}
                <div className="md:col-span-2 bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono text-sm border border-slate-700 h-[600px] max-h-full">
                    <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center shrink-0">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <span className="text-slate-400">System Logs output</span>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto space-y-2 text-slate-300">
                        {logs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p>Ready for command...</p>
                            </div>
                        )}

                        {logs.map((log, idx) => (
                            <div key={idx} className="flex gap-3 border-b border-slate-800/50 pb-1 last:border-0 hover:bg-slate-800/30">
                                <span className="text-slate-500 select-none">[{log.time}]</span>
                                <span className={`${log.msg.includes('❌') ? 'text-red-400 font-bold' :
                                        log.msg.includes('✅') ? 'text-emerald-400 font-bold' :
                                            log.msg.includes('⚠️') ? 'text-amber-400' :
                                                'text-slate-300'
                                    }`}>{log.msg}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemDiagnostics;
