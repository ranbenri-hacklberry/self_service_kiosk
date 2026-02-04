import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database,
    Table,
    Cloud,
    HardDrive,
    Monitor,
    Trash2,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Columns,
    Search,
    Info,
    ArrowLeft,
    Shield,
    DatabaseZap,
    Copy,
    Check,
    ListFilter,
    Eye,
    AlertTriangle,
    Server
} from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/context/AuthContext';
import { getBackendApiUrl } from '@/utils/apiUtils';

// Configuration for the three layers
const CLOUD_URL = import.meta.env.VITE_SUPABASE_URL;
const CLOUD_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use intelligent guess for Docker URL (similar to supabase.js)
const dockerHostname = window.location.hostname;
const DOCKER_URL = (dockerHostname === 'localhost' || dockerHostname === '127.0.0.1')
    ? 'http://127.0.0.1:54321'
    : `http://${dockerHostname}:54321`;

const DOCKER_KEY = import.meta.env.VITE_LOCAL_SUPABASE_ANON_KEY || CLOUD_KEY;

// Create clients
const cloudSupabase = createClient(CLOUD_URL, CLOUD_KEY);
const dockerSupabase = createClient(DOCKER_URL, DOCKER_KEY);

const COMPARABLE_TABLES = [
    { id: 'businesses', label: 'פרופיל עסק', dexie: 'businesses' },
    { id: 'employees', label: 'עובדים', dexie: 'employees' },
    { id: 'item_category', label: 'קטגוריות', dexie: 'item_category' },
    { id: 'menu_items', label: 'פריטי תפריט', dexie: 'menu_items' },
    { id: 'optiongroups', label: 'קבוצות תוספות', dexie: 'optiongroups' },
    { id: 'optionvalues', label: 'ערכי תוספות', dexie: 'optionvalues', noBusinessId: true },
    { id: 'menuitemoptions', label: 'קישורי תוספות', dexie: 'menuitemoptions', noBusinessId: true },
    { id: 'inventory_items', label: 'פריטי מלאי', dexie: 'inventory_items' },
    { id: 'prepared_items_inventory', label: 'מלאי מוכנים', dexie: 'prepared_items_inventory' },
    { id: 'recurring_tasks', label: 'משימות מחזוריות', dexie: 'recurring_tasks' },
    { id: 'tasks', label: 'משימות', dexie: 'tasks' },
    { id: 'task_completions', label: 'ביצועי משימות', dexie: 'task_completions' },
    { id: 'customers', label: 'לקוחות', dexie: 'customers' },
    { id: 'loyalty_cards', label: 'כרטיסי מועדון', dexie: 'loyalty_cards' },
    { id: 'loyalty_transactions', label: 'עסקאות מועדון', dexie: 'loyalty_transactions' },
    { id: 'orders', label: 'הזמנות', dexie: 'orders' },
    { id: 'order_items', label: 'פריטי הזמנה', dexie: 'order_items' },
    { id: 'suppliers', label: 'ספקים', dexie: 'suppliers' },
    { id: 'discounts', label: 'הנחות', dexie: 'discounts' },
];

const DatabaseExplorer = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({});
    const [selectedTable, setSelectedTable] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 100, message: '' });
    const [copyingTable, setCopyingTable] = useState(null); // { id, target }
    const [showSyncQueue, setShowSyncQueue] = useState(false);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflicts, setConflicts] = useState([]); // Array of { tableId, tableName, cloud, docker, dexie, selected: 'cloud'|'docker' }
    const [syncLogs, setSyncLogs] = useState([]); // Terminal-style logs
    const [showSyncTerminal, setShowSyncTerminal] = useState(false);

    // Sync Queue Modal Component
    const SyncQueueModal = ({ onClose }) => {
        const [queueData, setQueueData] = useState([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            fetch('/api/admin/sync-queue')
                .then(res => res.json())
                .then(data => {
                    setQueueData(Array.isArray(data) ? data : []);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch queue", err);
                    setLoading(false);
                });
        }, []);

        // Helper to clean up payload for display
        const formatPayload = (payload) => {
            if (!payload || typeof payload !== 'object') return payload;

            // Create a clean copy
            const clean = { ...payload };

            // Remove standard/technical fields to reduce noise
            delete clean.business_id;
            delete clean.created_at;
            delete clean.updated_at;
            delete clean.last_updated;
            delete clean.last_counted_at;
            delete clean.location;
            delete clean.supplier_id;
            delete clean.catalog_item_id;

            // If it's an update, maybe show only what changed? 
            // (Hard to know without previous state, but we can show non-null/non-empty values)

            return clean;
        };

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                <div onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
                <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[30px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                                <ListFilter size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white">תור סנכרון (Sync Queue)</h3>
                                <p className="text-slate-400 text-sm">שינויים שממתינים בסרבר המקומי (Docker)</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl"><ArrowLeft className="rotate-180" /></button>
                    </div>

                    <div className="flex-1 overflow-auto p-6">
                        {loading ? (
                            <div className="text-center py-20 text-slate-500">טוען תור...</div>
                        ) : queueData.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center gap-4">
                                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h4 className="text-xl font-bold text-white">התור ריק!</h4>
                                <p className="text-slate-400">כל השינויים סונכרנו בהצלחה לענן.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {queueData.map((item) => (
                                    <div key={item.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex gap-4 hover:bg-slate-800 transition-colors">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${item.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'}`}>
                                            {item.retries || 0}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-bold text-white uppercase">{item.action}</span>
                                                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{item.table_name}</span>
                                                <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
                                            </div>

                                            {/* Smart Payload Display */}
                                            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                                                <div className="flex flex-wrap gap-2 text-xs font-mono text-slate-300">
                                                    {item.payload?.name && (
                                                        <span className="bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                                                            name: {item.payload.name}
                                                        </span>
                                                    )}
                                                    {item.payload?.current_stock && (
                                                        <span className="bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                            stock: {item.payload.current_stock}
                                                        </span>
                                                    )}
                                                    {item.payload?.total_amount && (
                                                        <span className="bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                            total: ₪{item.payload.total_amount}
                                                        </span>
                                                    )}
                                                </div>
                                                <pre className="text-[10px] text-slate-500 mt-2 overflow-x-auto">
                                                    {JSON.stringify(formatPayload(item.payload), null, 2)}
                                                </pre>
                                            </div>

                                            {item.error_message && (
                                                <div className="mt-2 text-xs text-red-400 bg-red-950/20 p-2 rounded border border-red-900/30">
                                                    שגיאה: {item.error_message}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // 🔄 CONFLICT RESOLUTION MODAL
    const ConflictResolutionModal = ({ onClose, conflictData, onResolve }) => {
        const [selections, setSelections] = useState(() => {
            // Smart defaults: if Cloud=0 and Docker>0, select Docker; otherwise select Cloud
            const initial = {};
            conflictData.forEach(c => {
                if (c.cloud === 0 && c.docker > 0) {
                    initial[c.tableId] = 'docker';
                } else {
                    initial[c.tableId] = 'cloud'; // Default to cloud as master
                }
            });
            return initial;
        });
        const [resolving, setResolving] = useState(false);

        const selectAll = (source) => {
            const newSelections = {};
            conflictData.forEach(c => {
                newSelections[c.tableId] = source;
            });
            setSelections(newSelections);
        };

        const handleResolve = async () => {
            setResolving(true);
            await onResolve(selections);
            setResolving(false);
            onClose();
        };

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                <div onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
                <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[30px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-amber-900/20 to-orange-900/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white">פתרון חוסר התאמות</h3>
                                <p className="text-slate-400 text-sm">נמצאו {conflictData.length} טבלאות עם הבדלים בין הענן לדוקר</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl">
                            <ArrowLeft className="rotate-180" />
                        </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
                        <span className="text-sm text-slate-400">בחירה מהירה:</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => selectAll('cloud')}
                                className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <Cloud size={14} />
                                בחר ענן לכולם
                            </button>
                            <button
                                onClick={() => selectAll('docker')}
                                className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <Server size={14} />
                                בחר דוקר לכולם
                            </button>
                        </div>
                    </div>

                    {/* Conflicts Table */}
                    <div className="flex-1 overflow-auto p-6">
                        <table className="w-full">
                            <thead>
                                <tr className="text-slate-500 text-xs uppercase tracking-wide">
                                    <th className="text-right py-3 px-4">טבלה</th>
                                    <th className="text-center py-3 px-4">ענן (Cloud)</th>
                                    <th className="text-center py-3 px-4">דוקר (Docker)</th>
                                    <th className="text-center py-3 px-4">בחירה</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conflictData.map(c => (
                                    <tr key={c.tableId} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white">{c.tableName}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">{c.tableId}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-lg font-bold text-sm ${c.cloud === 0 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {c.cloud}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-lg font-bold text-sm ${c.docker === 0 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                {c.docker}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => setSelections(p => ({ ...p, [c.tableId]: 'cloud' }))}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selections[c.tableId] === 'cloud' ? 'bg-blue-500 text-white ring-2 ring-blue-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                >
                                                    ענן
                                                </button>
                                                <button
                                                    onClick={() => setSelections(p => ({ ...p, [c.tableId]: 'docker' }))}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selections[c.tableId] === 'docker' ? 'bg-orange-500 text-white ring-2 ring-orange-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                >
                                                    דוקר
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
                        <p className="text-sm text-slate-500">
                            הנתונים שתבחר יהפכו למקור האמת ויסונכרנו לכל השכבות
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={resolving}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {resolving ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        מסנכרן...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        החל שינויים
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 💻 SYNC TERMINAL MODAL - Matrix-style log display
    const SyncTerminalModal = ({ logs, onClose, isRunning }) => {
        const terminalRef = React.useRef(null);

        useEffect(() => {
            // Auto-scroll to bottom when new logs arrive
            if (terminalRef.current) {
                terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }
        }, [logs]);

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                <div onClick={!isRunning ? onClose : undefined} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />
                <div className="relative w-full max-w-4xl bg-black border border-green-900/50 rounded-2xl shadow-2xl shadow-green-500/10 overflow-hidden flex flex-col max-h-[85vh]">
                    {/* Terminal Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-green-950 to-black border-b border-green-900/50 flex items-center gap-3">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                        </div>
                        <span className="text-green-500 font-mono text-sm flex-1">sync_terminal — root@kds-server</span>
                        {!isRunning && (
                            <button onClick={onClose} className="text-green-500/50 hover:text-green-500 transition-colors">
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Terminal Body */}
                    <div
                        ref={terminalRef}
                        className="flex-1 overflow-auto p-4 font-mono text-sm bg-black min-h-[400px] text-left"
                        style={{ textShadow: '0 0 10px rgba(0, 255, 0, 0.5)', direction: 'ltr' }}
                    >
                        {logs.map((log, idx) => (
                            <div key={idx} className={`leading-relaxed ${log.type === 'error' ? 'text-red-400' :
                                log.type === 'warning' ? 'text-yellow-400' :
                                    log.type === 'success' ? 'text-green-400' :
                                        log.type === 'info' ? 'text-cyan-400' :
                                            'text-green-500'
                                }`}>
                                <span className="text-green-700">[{log.time}]</span> {log.message}
                            </div>
                        ))}
                        {isRunning && (
                            <div className="text-green-500 animate-pulse">▌</div>
                        )}
                    </div>

                    {/* Terminal Footer */}
                    <div className="px-4 py-3 bg-gradient-to-r from-black to-green-950/30 border-t border-green-900/50 flex justify-between items-center">
                        <span className="text-green-600/60 text-xs font-mono">
                            {logs.length} log entries • {isRunning ? 'Syncing...' : 'Completed'}
                        </span>
                        {!isRunning && (
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-400 text-xs font-mono transition-all"
                            >
                                $ close_terminal
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const copyTableMetadata = async (tableId, label, target = 'cloud') => {
        setCopyingTable({ id: tableId, target });
        try {
            let text = '';

            if (target === 'dexie') {
                const dexieTable = db[tableId] || db[COMPARABLE_TABLES.find(t => t.id === tableId)?.dexie];
                if (!dexieTable) throw new Error('Dexie table not found');

                const schema = dexieTable.schema;
                text = `
Dexie Table Info: ${label} (${tableId})
========================================
PRIMARY KEY: ${schema.primKey.name}
INDEXES: ${schema.indexes.map(idx => idx.name).join(', ') || 'NONE'}
                `.trim();
            } else {
                const response = await fetch(`/api/admin/table-metadata?table=${tableId}&target=${target}`);
                const meta = await response.json();

                if (meta.error) throw new Error(meta.error);

                text = `
${target.toUpperCase()} Table Info: ${label} (${tableId})
========================================
TOTAL ROWS IN LAYER: ${meta.totalRows || 0}
METADATA SOURCE: ${meta.metadata_source}

COLUMNS & TYPES:
${meta.columns.map(c => ` - ${c.column_name}: ${c.data_type} (Nullable: ${c.is_nullable}, Default: ${c.column_default || '?'})`).join('\n')}

RLS POLICIES:
${meta.policies.length > 0 ? meta.policies.map(p => ` - ${p.policyname} [${p.cmd}]: ${p.qual}`).join('\n') : ' - NONE (Accessible to all)'}

RELATIONSHIPS:
${meta.relationships.length > 0 ? meta.relationships.map(r => ` - ${r.column_name} (Constraint: ${r.constraint_name})`).join('\n') : ' - NONE'}

DIAGNOSTICS:
- Catalog Error: ${meta.diagnostics?.catalogError || 'NONE'}
- Sample Error: ${meta.diagnostics?.sampleError || 'NONE'}
- Has Sample Data: ${meta.diagnostics?.hasSample ? 'YES' : 'NO'}
                `.trim();
            }

            // Fix for "Document is not focused" error
            window.focus();
            try {
                await navigator.clipboard.writeText(text);
            } catch (clipErr) {
                console.warn('Clipboard API failed, trying fallback:', clipErr);
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            setTimeout(() => setCopyingTable(null), 1500);
        } catch (e) {
            console.error('Copy failed:', e);
            alert(`Copy failed: ${e.message}`);
            setCopyingTable(null);
        }
    };

    /**
     * Inspect Dexie Table Data (Copy to Clipboard)
     */
    const inspectDexieTable = async (tableId) => {
        try {
            const dexieKey = COMPARABLE_TABLES.find(t => t.id === tableId)?.dexie;
            if (!dexieKey || !db[dexieKey]) {
                alert('Dexie table not found in schema');
                return;
            }

            const data = await db[dexieKey].toArray();
            console.log(`🔍 Inspecting Dexie [${dexieKey}]:`, data);

            // Format nice JSON
            const previewText = JSON.stringify(data, null, 2);

            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(previewText);
                alert(`✅ הועתקו ${data.length} רשומות ללוח!`);
            } catch (clipErr) {
                // Fallback if clipboard API fails (rare but possible in some contexts)
                console.warn("Clipboard copy failed", clipErr);
                const textArea = document.createElement("textarea");
                textArea.value = previewText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert(`✅ הועתקו ${data.length} רשומות ללוח! (Fallback)`);
            }

        } catch (e) {
            console.error('Inspect failed:', e);
            alert(`Inspect failed: ${e.message}`);
        }
    };

    // Fetch stats for all tables from all 3 layers
    const fetchAllStats = useCallback(async () => {
        if (!currentUser?.business_id) return;
        setIsGlobalRefreshing(true);
        setError(null);

        const newStats = {};

        try {
            await Promise.all(COMPARABLE_TABLES.map(async (table) => {
                const tableId = table.id;
                newStats[tableId] = {
                    label: table.label,
                    cloud: { count: 0, columns: 0, loading: true },
                    docker: { count: 0, columns: 0, loading: true },
                    dexie: { count: 0, columns: 0, loading: true }
                };

                // Helper to get column count from a sample record
                const getColumnCount = (data) => {
                    if (Array.isArray(data) && data.length > 0) return Object.keys(data[0]).length;
                    if (data && typeof data === 'object' && !Array.isArray(data)) return Object.keys(data).length;
                    return 0;
                };

                // 1 & 2. Cloud and Docker (Using Trusted Stats API to bypass RLS)
                try {
                    const response = await fetch(`/api/admin/trusted-stats?table=${tableId}&businessId=${currentUser.business_id}&noBusinessId=${!!table.noBusinessId}`);
                    // Parsing response which now includes optional 'dockerRecent' for orders/order_items
                    const { cloud, docker, dockerRecent, error } = await response.json();

                    if (error) {
                        newStats[tableId].cloud = { count: 'ERR', columns: 0, loading: false, error };
                        newStats[tableId].docker = { count: 'ERR', columns: 0, loading: false, error };
                    } else {
                        newStats[tableId].cloud = { count: cloud || 0, columns: 0, loading: false };
                        // Store dockerRecent if available
                        newStats[tableId].docker = {
                            count: docker || 0,
                            recent: dockerRecent, // Optional: Logic for 3-day sync validation
                            columns: 0,
                            loading: false
                        };
                    }
                } catch (e) {
                    newStats[tableId].cloud = { count: 'ERR', columns: 0, loading: false, error: e.message };
                    newStats[tableId].docker = { count: 'ERR', columns: 0, loading: false, error: e.message };
                }

                // 3. Dexie
                try {
                    if (db[table.dexie]) {
                        let count = 0;
                        let sampleData = null;

                        if (table.dexie === 'order_items') {
                            // Specialized join-count for order_items
                            const orderIds = await db.orders.where('business_id').equals(currentUser.business_id).primaryKeys();
                            count = await db.order_items.where('order_id').anyOf(orderIds).count();
                            sampleData = await db.order_items.where('order_id').anyOf(orderIds.slice(0, 1)).first();
                        } else if (table.dexie === 'optionvalues' || table.dexie === 'menuitemoptions') {
                            // These are join tables, they don't have business_id index.
                            // We count them all or skip filtering to avoid Dexie error.
                            count = await db[table.dexie].count();
                            sampleData = await db[table.dexie].limit(1).toArray();
                        } else if (db[table.dexie].schema.indexes.some(idx => idx.name === 'business_id') && table.dexie !== 'prepared_items_inventory') {
                            // Standard business filtering
                            count = await db[table.dexie].where('business_id').equals(currentUser.business_id).count();

                            // If count is 0, maybe try counting everything? Useful for super admin debugging
                            if (count === 0) {
                                const totalCount = await db[table.dexie].count();
                                if (totalCount > 0) {
                                    // Hack: show total count with a mark if mismatch
                                    // count = `${count} / ${totalCount}`; 
                                    // Actually better to just show total if we are in super admin context likely
                                    console.warn(`[Dexie] ${table.dexie} filtered count is 0 but total is ${totalCount}. Context: ${currentUser.business_id}`);
                                }
                            }

                            sampleData = await db[table.dexie].where('business_id').equals(currentUser.business_id).first();
                        } else if (table.dexie === 'prepared_items_inventory') {
                            // SPECIAL CASE: prepared_items_inventory in Dexie has business_id but we might want to see ALL for debug
                            count = await db[table.dexie].count();
                            sampleData = await db[table.dexie].limit(1).toArray();
                        } else if (table.dexie === 'businesses') {
                            count = await db.businesses.where('id').equals(currentUser.business_id).count();
                            sampleData = await db.businesses.get(currentUser.business_id);
                        } else {
                            // Fallback to total count for global tables
                            count = await db[table.dexie].count();
                            sampleData = await db[table.dexie].limit(1).toArray();
                        }

                        newStats[tableId].dexie = {
                            count: count,
                            columns: getColumnCount(sampleData),
                            loading: false
                        };
                    } else {
                        newStats[tableId].dexie = { count: '-', columns: 0, loading: false };
                    }
                } catch (e) {
                    console.warn(`Dexie count failed for ${table.id}:`, e);
                    newStats[tableId].dexie = { count: 'ERR', columns: 0, loading: false, error: e.message };
                }

                setStats({ ...newStats });
            }));
        } catch (err) {
            console.error('Global refresh failed:', err);
            setError('נכשלה טעינת הנתונים המשולבת. וודא שחיבור ה-מקומי (Docker) פעיל.');
        } finally {
            setIsGlobalRefreshing(false);
        }
    }, [currentUser?.business_id]);

    /**
     * UNIFIED SYNC: Docker -> Dexie (Single Source of Truth)
     * With Terminal logging and Conflict Detection
     */
    const purgeDockerTable = async (tableId) => {
        if (!window.confirm(`⚠️ האם אתה בטוח שברצונך למחוק את כל הנתונים בטבלת [${tableId}] מה-Docker המקומי? פעולה זו אינה הפיכה.`)) return;

        try {
            const API_URL = getBackendApiUrl();
            const res = await fetch(`${API_URL}/api/admin/purge-docker-table`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table: tableId })
            });
            const result = await res.json();
            if (result.success) {
                alert(`✅ הטבלה ${tableId} נוקתה לחלוטין!`);
                fetchAllStats(); // Refresh counts
            } else {
                throw new Error(result.error);
            }
        } catch (e) {
            alert(`❌ ניקוי נכשל: ${e.message}`);
        }
    };

    const resolveConflict = async (tableId, source) => {
        await handleResolveConflicts({ [tableId]: source });
    };

    const triggerFullVerticalSync = async () => {
        if (!currentUser?.business_id || syncLoading) return;
        setSyncLoading(true);
        setError(null);

        const businessId = currentUser.business_id;
        // 🛡️ Disable background sync while we work
        localStorage.setItem('block_background_sync', 'true');

        setShowSyncTerminal(true);
        setSyncLogs([]);
        const addLog = (message, type = 'default') => {
            const time = new Date().toLocaleTimeString('he-IL');
            setSyncLogs(prev => [...prev, { message, type, time }]);
        };

        addLog('🚀 STARTING FULL VERTICAL SYNC (Nuclear)', 'info');
        addLog('─────────────────────────────────', 'info');
        addLog(`Business ID: ${businessId}`, 'default');

        try {
            // Step 1: Cloud -> Docker (background)
            addLog('🌐 Triggering Cloud → Docker sync (background)...', 'default');
            setSyncProgress({ current: 5, total: 100, message: 'מסנכרן ענן לדוקר (רקע)...' });

            try {
                const API_URL = getBackendApiUrl();

                await fetch(`${API_URL}/api/sync-cloud-to-local`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessId })
                });
                await new Promise(r => setTimeout(r, 2000));
                addLog('✓ Cloud sync triggered', 'success');
            } catch (cloudErr) {
                addLog(`⚠ Cloud sync skipped: ${cloudErr.message}`, 'warning');
            }

            try {
                // Step 2: Wipe Dexie completely
                setSyncProgress({ current: 15, total: 100, message: 'מנקה נתונים ישנים מהדפדפן...' });
                addLog('🧹 Dexie: Wiping all local tables...', 'warning');
                await db.transaction('rw', db.tables, async () => {
                    await Promise.all(db.tables.map(table => table.clear()));
                });
                addLog('✓ Dexie cleared completely', 'success');
            } catch (dexieWipeErr) {
                addLog(`❌ Dexie wipe failed: ${dexieWipeErr.message}`, 'error');
                throw dexieWipeErr; // Re-throw to stop sync if wipe fails
            }

            // Step 3: Fetch from Docker
            addLog('', 'default');
            addLog('📥 FETCHING FROM DOCKER:', 'info');
            addLog('─────────────────────────────────', 'info');

            const SYNC_TABLES = [
                { remote: 'businesses', local: 'businesses' },
                { remote: 'employees', local: 'employees' },
                { remote: 'menu_items', local: 'menu_items' },
                { remote: 'customers', local: 'customers' },
                { remote: 'optiongroups', local: 'optiongroups' },
                { remote: 'optionvalues', local: 'optionvalues' },
                { remote: 'menuitemoptions', local: 'menuitemoptions' },
                { remote: 'discounts', local: 'discounts' },
                { remote: 'loyalty_cards', local: 'loyalty_cards' },
                { remote: 'loyalty_transactions', local: 'loyalty_transactions', recentDays: 3 },
                { remote: 'orders', local: 'orders', recentDays: 3 },
                { remote: 'order_items', local: 'order_items', recentDays: 3 },
                { remote: 'suppliers', local: 'suppliers' },
                { remote: 'recurring_tasks', local: 'recurring_tasks' },
                { remote: 'task_completions', local: 'task_completions' },
                { remote: 'inventory_items', local: 'inventory_items' },
                { remote: 'prepared_items_inventory', local: 'prepared_items_inventory' }
            ];

            const syncResults = {};

            for (let i = 0; i < SYNC_TABLES.length; i++) {
                const t = SYNC_TABLES[i];
                const progress = Math.round(15 + ((i + 1) / SYNC_TABLES.length) * 70);

                // Specific logic for historical tables
                const historicalTables = ['orders', 'order_items', 'loyalty_transactions'];
                const isHistorical = historicalTables.includes(t.remote);
                const label = isHistorical ? `${t.remote} (3d)` : t.remote;

                setSyncProgress({ current: progress, total: 100, message: `טוען ${label} מהדוקר...` });

                try {
                    const queryParams = new URLSearchParams({ businessId });
                    if (isHistorical) queryParams.append('recentDays', '3');

                    const res = await fetch(`/api/admin/docker-dump/${t.remote}?${queryParams.toString()}`);
                    const json = await res.json();

                    if (json.success && json.data && Array.isArray(json.data)) {
                        addLog(`  📥 Received ${json.data.length} rows for ${t.remote}${isHistorical ? ' (3-day filter)' : ''}`, 'default');
                        if (db[t.local]) {
                            // Double clear for safety
                            await db[t.local].clear();
                            if (json.data.length > 0) {
                                await db[t.local].bulkPut(json.data);
                            }
                        }
                        addLog(`  ✓ ${t.remote.padEnd(25)} → ${json.data.length} rows saved`, 'success');
                        syncResults[t.remote] = json.data.length;
                    } else {
                        addLog(`  ○ ${t.remote.padEnd(25)} → 0 rows`, 'default');
                        syncResults[t.remote] = 0;
                    }
                } catch (tableErr) {
                    addLog(`  ✗ ${t.remote.padEnd(25)} → ERROR: ${tableErr.message}`, 'error');
                    syncResults[t.remote] = 'ERROR';
                }
            }

            // Step 4: Conflict Detection
            addLog('', 'default');
            addLog('🔍 DETECTING CONFLICTS (Cloud ↔ Docker):', 'info');
            addLog('─────────────────────────────────', 'info');
            setSyncProgress({ current: 90, total: 100, message: 'בודק חוסר התאמות...' });

            const detectedConflicts = [];
            for (const table of COMPARABLE_TABLES) {
                try {
                    const statsRes = await fetch(`/api/admin/trusted-stats?table=${table.id}&businessId=${businessId}&noBusinessId=${!!table.noBusinessId}`);
                    const { cloud, docker } = await statsRes.json();

                    if (cloud !== docker && cloud !== undefined && docker !== undefined) {
                        detectedConflicts.push({
                            tableId: table.id,
                            tableName: table.label,
                            cloud: cloud || 0,
                            docker: docker || 0
                        });
                        addLog(`  ⚠ ${table.id.padEnd(25)} Cloud: ${cloud} ≠ Docker: ${docker}`, 'warning');
                    }
                } catch (e) {
                    // Skip
                }
            }

            // Step 5: Complete
            addLog('', 'default');
            addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
            if (detectedConflicts.length > 0) {
                addLog(`⚠️ FOUND ${detectedConflicts.length} CONFLICTS`, 'warning');
                addLog('Click "פתור קונפליקטים" to resolve', 'warning');
                setConflicts(detectedConflicts);
            } else {
                addLog('✅ SYNC COMPLETED - NO CONFLICTS', 'success');
            }
            addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

            setSyncProgress({ current: 100, total: 100, message: '✅ סנכרון הושלם בהצלחה!' });
            setTimeout(() => {
                setSyncProgress({ current: 0, total: 0, message: '' });
                fetchAllStats();
            }, 2000);

        } catch (err) {
            addLog(`❌ FATAL ERROR: ${err.message}`, 'error');
            setError(`סנכרון נכשל: ${err.message}`);
        } finally {
            setSyncLoading(false);
            // Re-enable background sync after a short delay
            setTimeout(() => {
                localStorage.removeItem('block_background_sync');
                console.log('🔓 [Sync] Background sync re-enabled');
            }, 5000);
        }
    };

    /**
     * RESOLVE CONFLICTS: Apply user's choices - Actually sync the data
     */
    const handleResolveConflicts = async (selections) => {
        const addLog = (message, type = 'default') => {
            const time = new Date().toLocaleTimeString('he-IL');
            setSyncLogs(prev => [...prev, { time, message, type }]);
        };

        setShowSyncTerminal(true);
        setSyncLoading(true);
        addLog('', 'default');
        addLog('🔧 RESOLVING CONFLICTS:', 'info');
        addLog('─────────────────────────────────', 'info');

        const businessId = currentUser.business_id;
        let successCount = 0;
        let errorCount = 0;

        // PRIORITY ORDER FOR RESOLVE: Parent tables must come before children
        const PRIORITY_ORDER = [
            'businesses',
            'employees',
            'recurring_tasks',
            'loyalty_cards',
            'suppliers',
            'menu_items',
            'optiongroups',
            'optionvalues',
            'menuitemoptions',
            'orders',
            'order_items',
            'loyalty_transactions',
            'task_completions',
            'prepared_items_inventory',
            'inventory_items'
        ];

        const sortedSelections = Object.entries(selections).sort((a, b) => {
            const indexA = PRIORITY_ORDER.indexOf(a[0]);
            const indexB = PRIORITY_ORDER.indexOf(b[0]);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });

        const API_URL = getBackendApiUrl();

        for (const [tableId, source] of sortedSelections) {
            const conflict = conflicts.find(c => c.tableId === tableId);
            if (!conflict) continue;

            try {
                addLog(`  → ${tableId}: Syncing from ${source}...`, 'default');

                // Call the resolve-conflict API using absolute path
                const res = await fetch(`${API_URL}/api/admin/resolve-conflict`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ table: tableId, source, businessId })
                });

                const result = await res.json();

                if (result.success) {
                    addLog(`  ✓ ${tableId}: ${result.synced} rows synced (${source} → ${result.target})`, 'success');
                    successCount++;

                    // Also update Dexie from Docker (the unified source)
                    try {
                        // Tables that require 3-day limit
                        const historicalTables = ['orders', 'order_items', 'loyalty_transactions'];
                        const isHistorical = historicalTables.includes(tableId);
                        const queryParams = new URLSearchParams({ businessId });
                        if (isHistorical) queryParams.append('recentDays', '3');

                        const dexieRes = await fetch(`/api/admin/docker-dump/${tableId}?${queryParams.toString()}`);
                        const dexieData = await dexieRes.json(); // Assuming this returns { success: boolean, data: array }

                        if (dexieData.success && dexieData.data && Array.isArray(dexieData.data)) {
                            addLog(`  📥 Received ${dexieData.data.length} rows for ${tableId}${isHistorical ? ' (Last 3 Days)' : ''}`, 'default');
                            const tableConfig = COMPARABLE_TABLES.find(t => t.id === tableId);
                            if (tableConfig && db[tableConfig.dexie]) {
                                await db[tableConfig.dexie].clear();
                                if (dexieData.data.length > 0) {
                                    await db[tableConfig.dexie].bulkPut(dexieData.data);
                                }
                                addLog(`    ↳ Dexie updated: ${dexieData.data.length} rows`, 'success');
                            }
                        }
                    } catch (dexieErr) {
                        addLog(`    ↳ Dexie update warning: ${dexieErr.message}`, 'warning');
                    }
                } else {
                    addLog(`  ✗ ${tableId}: ${result.error || 'Unknown error'}`, 'error');
                    errorCount++;
                }
            } catch (e) {
                addLog(`  ✗ ${tableId}: Failed - ${e.message}`, 'error');
                errorCount++;
            }
        }

        addLog('', 'default');
        addLog('─────────────────────────────────', 'info');
        if (errorCount === 0) {
            addLog(`✅ ALL ${successCount} CONFLICTS RESOLVED SUCCESSFULLY`, 'success');
        } else {
            addLog(`⚠️ Resolved: ${successCount}, Errors: ${errorCount}`, 'warning');
        }
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

        setConflicts([]);
        setSyncLoading(false);
        await fetchAllStats();
    };

    /**
     * PRUNE DATA: Clear old Dexie data (Orders & Order Items older than 3 days)
     * AND Wipe Join Tables (menuitemoptions, optionvalues) to force re-sync
     */
    const pruneDexieData = async () => {
        if (!window.confirm('האם אתה בטוח שברצונך לנקות נתונים מהדפדפן? \n\n1. הזמנות ישנות מ-3 ימים יימחקו.\n2. טבלאות קישור (menuitemoptions/optionvalues) ינוקו לגמרי כדי להכריח סנכרון מחדש.\n\nהמידע יישאר בטוח בענן וב-Docker.')) return;

        setIsGlobalRefreshing(true);
        try {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const isoDate = threeDaysAgo.toISOString();

            // 1. Prune Old Orders
            const oldOrders = await db.orders
                .where('created_at')
                .below(isoDate)
                .toArray();

            let orderMsg = 'לא היו הזמנות ישנות.';
            if (oldOrders.length > 0) {
                const ids = oldOrders.map(o => o.id);
                await db.orders.bulkDelete(ids);
                await db.order_items.where('order_id').anyOf(ids).delete();
                orderMsg = `${ids.length} הזמנות הוסרו.`;
            }

            // 2. Wipe Join Tables (to fix the sync issue)
            await db.menuitemoptions.clear();
            await db.optionvalues.clear();
            await db.optiongroups.clear(); // Clear groups too to be safe
            await db.prepared_items_inventory.clear(); // Wipe prepared items to fix stuck 0

            alert(`✅ בוצע ניקוי Dexie!\n\n- ${orderMsg}\n- כל טבלאות התוספות והמלאי נוקו.\n\nכעת לחץ על 'סנכרון אנכי מלא' כדי למשוך נתונים נקיים מה-Docker.`);

            await fetchAllStats();
        } catch (err) {
            setError(`ניקוי נכשל: ${err.message}`);
        } finally {
            setIsGlobalRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAllStats();
    }, [fetchAllStats]);

    const filteredTables = COMPARABLE_TABLES.filter(t =>
        t.label.includes(searchTerm) || t.id.includes(searchTerm)
    );

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-purple-500/30" dir="rtl">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/mode-selection')}
                            className="p-2 hover:bg-slate-800 rounded-xl transition-all group"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:-translate-x-1" />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                השוואת בסיסי נתונים
                            </h1>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Cloud • Local Docker • Browser Cache
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={pruneDexieData}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 font-bold text-xs border border-slate-700 transition-all flex items-center gap-2"
                            title="מנקה נתונים ישנים מהדפדפן בלבד"
                        >
                            <Monitor className="w-4 h-4" />
                            ניקוי Dexie
                        </button>

                        <button
                            onClick={async () => {
                                if (!window.confirm("⚠️ סנכרון גרעיני!\n\nפעולה זו תמחק את כל הנתונים בדפדפן\nותטען אותם **ישירות מהדוקר** (לא מהענן).\n\nזה יבטיח זהות מושלמת ל-Docker.\n\nהאם להמשיך?")) return;

                                try {
                                    setIsGlobalRefreshing(true);
                                    setSyncLoading(true);
                                    setSyncProgress({ current: 5, total: 100, message: 'מוחק נתונים ישנים...' });

                                    // Step 1: WIPE ALL DEXIE TABLES
                                    await db.transaction('rw', db.tables, async () => {
                                        await Promise.all(db.tables.map(table => table.clear()));
                                    });
                                    console.log('✅ Dexie wiped completely');

                                    // Step 2: Fetch from Docker and inject into Dexie
                                    const businessId = currentUser?.business_id || localStorage.getItem('kds_business_id');
                                    if (!businessId) throw new Error("Missing business_id!");

                                    const tablesToSync = [
                                        { remote: 'businesses', local: 'businesses' },
                                        { remote: 'employees', local: 'employees' },
                                        { remote: 'menu_items', local: 'menu_items' },
                                        { remote: 'customers', local: 'customers' },
                                        { remote: 'optiongroups', local: 'optiongroups' },
                                        { remote: 'optionvalues', local: 'optionvalues' },
                                        { remote: 'menuitemoptions', local: 'menuitemoptions' },
                                        { remote: 'discounts', local: 'discounts' },
                                        { remote: 'loyalty_cards', local: 'loyalty_cards' },
                                        { remote: 'loyalty_transactions', local: 'loyalty_transactions', recentDays: 3 },
                                        { remote: 'orders', local: 'orders', recentDays: 3 },
                                        { remote: 'order_items', local: 'order_items', recentDays: 3 },
                                        { remote: 'suppliers', local: 'suppliers' },
                                        { remote: 'recurring_tasks', local: 'recurring_tasks' },
                                        { remote: 'task_completions', local: 'task_completions' },
                                        { remote: 'inventory_items', local: 'inventory_items' },
                                        { remote: 'prepared_items_inventory', local: 'prepared_items_inventory' }
                                    ];

                                    for (let i = 0; i < tablesToSync.length; i++) {
                                        const t = tablesToSync[i];
                                        const progress = Math.round(((i + 1) / tablesToSync.length) * 90) + 5;
                                        const label = t.recentDays ? `${t.remote} (${t.recentDays} ימים)` : t.remote;
                                        setSyncProgress({ current: progress, total: 100, message: `טוען ${label} מהדוקר...` });

                                        try {
                                            let url = `/api/admin/docker-dump/${t.remote}?businessId=${businessId}`;
                                            if (t.recentDays) url += `&recentDays=${t.recentDays}`;

                                            const res = await fetch(url);
                                            const json = await res.json();
                                            if (json.success && json.data && json.data.length > 0) {
                                                await db[t.local].bulkPut(json.data);
                                                console.log(`✅ Loaded ${json.data.length} rows into ${t.local}${t.recentDays ? ` (last ${t.recentDays} days)` : ''}`);
                                            } else {
                                                console.log(`⚠️ No data for ${t.local} (or empty)`);
                                            }
                                        } catch (tableErr) {
                                            console.warn(`❌ Failed to sync ${t.remote}:`, tableErr.message);
                                        }
                                    }

                                    setSyncProgress({ current: 100, total: 100, message: '✅ סנכרון מהדוקר הושלם!' });
                                    setTimeout(() => {
                                        setSyncProgress({ current: 0, total: 0, message: '' });
                                        fetchAllStats();
                                    }, 2000);

                                } catch (e) {
                                    alert("שגיאה: " + e.message);
                                    console.error(e);
                                } finally {
                                    setIsGlobalRefreshing(false);
                                    setSyncLoading(false);
                                }
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 hover:text-emerald-200 font-bold text-xs border border-emerald-900/30 transition-all flex items-center gap-2"
                        >
                            <DatabaseZap className="w-4 h-4" />
                            סנכרון מדוקר (Nuclear)
                        </button>
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="חיפוש טבלה..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-800/50 border border-slate-700/50 rounded-xl pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all w-64"
                            />
                        </div>
                        <button
                            onClick={triggerFullVerticalSync}
                            disabled={syncLoading}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-purple-900/40 ${syncLoading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                            {syncLoading ? 'מסנכרן את כל השכבות...' : 'סנכרון אנכי מלא'}
                        </button>

                        <button
                            onClick={() => setShowSyncQueue(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-bold text-sm transition-all"
                        >
                            <ListFilter size={16} />
                            תור סנכרון
                        </button>

                        {/* Conflict Resolution Button - Shows when conflicts exist */}
                        {conflicts.length > 0 && (
                            <button
                                onClick={() => setShowConflictModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-sm transition-all animate-pulse"
                            >
                                <AlertTriangle size={16} />
                                פתור קונפליקטים ({conflicts.length})
                            </button>
                        )}
                    </div>
                </div>
                {/* Sync Progress Overlay */}
                <AnimatePresence>
                    {syncProgress.total > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-purple-600/10 border-b border-purple-500/20 overflow-hidden"
                        >
                            <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs font-bold text-purple-300">{syncProgress.message}</span>
                                </div>
                                <div className="text-[10px] font-mono text-purple-400 font-bold uppercase">
                                    {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                                </div>
                            </div>
                            <div className="h-[2px] bg-slate-800 w-full">
                                <motion.div
                                    className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            <main className="max-w-7xl mx-auto p-6 relative">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
                    >
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </motion.div>
                )}

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatusCard
                        icon={<Cloud className="text-blue-400" />}
                        title="Cloud Supabase"
                        status="מחובר"
                        sub="בסיס נתונים מרכזי"
                        color="blue"
                    />
                    <StatusCard
                        icon={<DatabaseZap className="text-orange-400" />}
                        title="Local Docker"
                        status="פעיל"
                        sub="Supabase Edge Node"
                        color="orange"
                    />
                    <StatusCard
                        icon={<HardDrive className="text-emerald-400" />}
                        title="Dexie (Browser)"
                        status="תקין"
                        sub="זכרון מטמון מקומי"
                        color="emerald"
                    />
                </div>

                {/* Comparison Table */}
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-800">
                                <tr className="border-b border-slate-800/50">
                                    <th rowSpan="2" className="px-6 py-4">שם הטבלה</th>
                                    <th colSpan="2" className="px-6 py-2 text-center bg-blue-500/5 border-x border-slate-800">Cloud (ענן)</th>
                                    <th colSpan="2" className="px-6 py-2 text-center bg-orange-500/5 border-x border-slate-800">Docker (מקומי)</th>
                                    <th colSpan="2" className="px-6 py-2 text-center bg-emerald-500/5 border-x border-slate-800">Dexie (דפדפן)</th>
                                    <th rowSpan="2" className="px-6 py-4 text-center">סטטוס סנכרון</th>
                                    <th rowSpan="2" className="px-6 py-4"></th>
                                </tr>
                                <tr>
                                    <th className="px-2 py-2 text-[9px] text-center border-l border-slate-800">רשומות</th>
                                    <th className="px-2 py-2 text-[9px] text-center border-r border-slate-800">עמודות</th>
                                    <th className="px-2 py-2 text-[9px] text-center border-l border-slate-800">רשומות</th>
                                    <th className="px-2 py-2 text-[9px] text-center border-r border-slate-800">עמודות</th>
                                    <th className="px-2 py-2 text-[9px] text-center border-l border-slate-800">רשומות</th>
                                    <th className="px-2 py-2 text-[9px] text-center border-r border-slate-800">עמודות</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredTables.map((table) => {
                                    const layerStats = stats[table.id] || {
                                        cloud: { loading: true, columns: 0 },
                                        docker: { loading: true, columns: 0 },
                                        dexie: { loading: true, columns: 0 }
                                    };


                                    const counts = [
                                        layerStats.cloud.count,
                                        layerStats.docker.count,
                                        layerStats.dexie.count
                                    ];

                                    // Default Match Logic
                                    let allMatched = counts.every(c => c === counts[0] && c !== 'ERR' && c !== '-');
                                    let isRecentMatched = false;
                                    const hasError = counts.some(c => c === 'ERR');

                                    // Special Logic for 3-Day Window Tables (Historical Tables)
                                    if (table.isHistorical && !hasError && layerStats.dexie.count !== '-') {
                                        const recentCount = layerStats.docker.recent;
                                        // If available, compare Dexie against recentCount instead of total
                                        if (recentCount !== undefined && recentCount !== null) {
                                            if (layerStats.dexie.count === recentCount) {
                                                allMatched = true;
                                                isRecentMatched = true;
                                            } else {
                                                // Double check: if Dexie has MORE than recent (e.g. didn't prune yet), it's technically fully synced+extra.
                                                // But user wants explicit confirmation of 3 days.
                                                allMatched = false;
                                            }
                                        }
                                    }

                                    return (
                                        <tr key={table.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-100 group-hover:text-white transition-colors">
                                                        {table.label}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-500 font-mono">
                                                            {table.id}
                                                        </span>
                                                        {table.isHistorical && (
                                                            <span className="text-[9px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                                3 ימים
                                                            </span>
                                                        )}
                                                        {/* Nuclear Wipe Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                purgeDockerTable(table.id);
                                                            }}
                                                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors group relative"
                                                            title="ניקוי רדיקלי (Docker)"
                                                        >
                                                            <Trash2 size={16} />
                                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-red-500/30">
                                                                ניקוי רדיקלי (Docker)
                                                            </span>
                                                        </button>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                resolveConflict(table.id, 'cloud');
                                                            }}
                                                            className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded-lg border border-blue-500/30 transition-all flex items-center gap-2"
                                                        >
                                                            <Cloud size={14} />
                                                            עדכן מהענן
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 py-5 border-l border-slate-800/30">
                                                <div className="flex flex-col items-center gap-1">
                                                    <CountBadge count={layerStats.cloud.count} loading={layerStats.cloud.loading} />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); copyTableMetadata(table.id, table.label, 'cloud'); }}
                                                        className={`p-1 rounded-md transition-all text-[9px] flex items-center gap-1 ${copyingTable?.id === table.id && copyingTable?.target === 'cloud' ? 'text-emerald-400' : 'text-slate-600 hover:text-blue-400'}`}
                                                    >
                                                        {copyingTable?.id === table.id && copyingTable?.target === 'cloud' ? <Check size={10} /> : <Copy size={10} />}
                                                        META
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-2 py-5 text-center border-r border-slate-800/30">
                                                <span className="text-[10px] font-mono text-slate-500">{layerStats.cloud.columns || '0'}</span>
                                            </td>
                                            <td className="px-2 py-5 border-l border-slate-800/30">
                                                <div className="flex flex-col items-center gap-1">
                                                    <CountBadge count={layerStats.docker.count} loading={layerStats.docker.loading} color="orange" />
                                                    {/* Show Recent Count if different and exists */}
                                                    {layerStats.docker.recent !== undefined && layerStats.docker.recent !== layerStats.docker.count && (
                                                        <span className="text-[9px] text-slate-500 font-mono">
                                                            (3d: {layerStats.docker.recent})
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); copyTableMetadata(table.id, table.label, 'docker'); }}
                                                        className={`p-1 rounded-md transition-all text-[9px] flex items-center gap-1 ${copyingTable?.id === table.id && copyingTable?.target === 'docker' ? 'text-emerald-400' : 'text-slate-600 hover:text-orange-400'}`}
                                                    >
                                                        {copyingTable?.id === table.id && copyingTable?.target === 'docker' ? <Check size={10} /> : <Copy size={10} />}
                                                        META
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-2 py-5 text-center border-r border-slate-800/30">
                                                <span className="text-[10px] font-mono text-slate-500">{layerStats.docker.columns || '0'}</span>
                                            </td>
                                            <td className="px-2 py-5 border-l border-slate-800/30">
                                                <div className="flex flex-col items-center gap-1">
                                                    <CountBadge count={layerStats.dexie.count} loading={layerStats.dexie.loading} color="emerald" />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); copyTableMetadata(table.id, table.label, 'dexie'); }}
                                                        className={`p-1 rounded-md transition-all text-[9px] flex items-center gap-1 ${copyingTable?.id === table.id && copyingTable?.target === 'dexie' ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}
                                                    >
                                                        {copyingTable?.id === table.id && copyingTable?.target === 'dexie' ? <Check size={10} /> : <Copy size={10} />}
                                                        META
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); inspectDexieTable(table.id); }}
                                                        className="p-1 rounded-md transition-all text-[9px] flex items-center gap-1 text-slate-600 hover:text-purple-400"
                                                        title="הצג נתונים גולמיים"
                                                    >
                                                        <Eye size={10} />
                                                        DATA
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-2 py-5 text-center border-r border-slate-800/30">
                                                <span className="text-[10px] font-mono text-slate-500">{layerStats.dexie.columns || '0'}</span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                {allMatched ? (
                                                    <div className={`flex items-center justify-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full border ${isRecentMatched ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                                                        <CheckCircle2 size={12} />
                                                        {isRecentMatched ? 'סונכרן (3 ימים)' : 'מסונכרן'}
                                                    </div>
                                                ) : hasError ? (
                                                    <div className="flex items-center justify-center gap-1.5 text-red-400 text-[11px] font-black bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                                                        <AlertCircle size={12} />
                                                        שגיאת חיבור
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1.5 text-orange-400 text-[11px] font-black bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                                                        <RefreshCw size={12} />
                                                        ממתין לעדכון
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 text-left">
                                                <button
                                                    onClick={() => setSelectedTable(table.id)}
                                                    className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-500 hover:text-white transition-all"
                                                >
                                                    <Info size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Table Details Modal */}
            <AnimatePresence>
                {selectedTable && (
                    <TableDetailsModal
                        table={COMPARABLE_TABLES.find(t => t.id === selectedTable)}
                        stats={stats[selectedTable]}
                        onClose={() => setSelectedTable(null)}
                        businessId={currentUser?.business_id}
                    />
                )}
            </AnimatePresence>

            {/* Sync Queue Modal */}
            <AnimatePresence>
                {showSyncQueue && (
                    <SyncQueueModal onClose={() => setShowSyncQueue(false)} />
                )}
            </AnimatePresence>

            {/* Sync Terminal Modal */}
            <AnimatePresence>
                {showSyncTerminal && (
                    <SyncTerminalModal
                        logs={syncLogs}
                        onClose={() => setShowSyncTerminal(false)}
                        isRunning={syncLoading}
                    />
                )}
            </AnimatePresence>

            {/* Conflict Resolution Modal */}
            <AnimatePresence>
                {showConflictModal && conflicts.length > 0 && (
                    <ConflictResolutionModal
                        onClose={() => setShowConflictModal(false)}
                        conflictData={conflicts}
                        onResolve={handleResolveConflicts}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Sub-Components ---

const StatusCard = ({ icon, title, status, sub, color }) => {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
        orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/20',
        emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20'
    };

    return (
        <div className={`p-6 rounded-3xl border bg-gradient-to-br ${colorClasses[color]} relative overflow-hidden group hover:scale-[1.02] transition-all`}>
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-150 group-hover:rotate-12 transition-transform duration-700">
                {React.cloneElement(icon, { size: 64 })}
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-slate-900 rounded-2xl border border-white/5">
                        {React.cloneElement(icon, { size: 20 })}
                    </div>
                    <div>
                        <h3 className="font-black text-white leading-none">{title}</h3>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{sub}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse bg-current" style={{ color: color === 'blue' ? '#60a5fa' : color === 'orange' ? '#fb923c' : '#34d399' }} />
                    <span className="text-sm font-bold">{status}</span>
                </div>
            </div>
        </div>
    );
};

const CountBadge = ({ count, loading, color = 'blue' }) => {
    if (loading) return (
        <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
        </div>
    );

    const colors = {
        blue: 'text-blue-400 bg-blue-500/5 border-blue-500/20',
        orange: 'text-orange-400 bg-orange-500/5 border-orange-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20'
    };

    return (
        <div className="flex items-center justify-center">
            <span className={`px-4 py-1.5 rounded-2xl border font-black text-sm font-mono tracking-tighter shadow-sm ${colors[color]} min-w-[60px] text-center`}>
                {count?.toLocaleString() || '0'}
            </span>
        </div>
    );
};

const TableDetailsModal = ({ table, stats, onClose, businessId }) => {
    const [activeLayer, setActiveLayer] = useState('cloud');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [columns, setColumns] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let result;
            const isNoBusinessId = table.noBusinessId || table.id === 'order_items';

            if (activeLayer === 'cloud') {
                let query = cloudSupabase.from(table.id).select('*');
                if (table.id === 'businesses') query = query.eq('id', businessId);
                else if (!isNoBusinessId) query = query.eq('business_id', businessId);

                result = await query.limit(20);
            } else if (activeLayer === 'docker') {
                let query = dockerSupabase.from(table.id).select('*');
                if (table.id === 'businesses') query = query.eq('id', businessId);
                else if (!isNoBusinessId) query = query.eq('business_id', businessId);

                result = await query.limit(20);
            } else {
                const dexieTable = table.dexie;
                let dexieData;

                if (table.id === 'order_items') {
                    const oIds = await db.orders.where('business_id').equals(businessId).primaryKeys();
                    dexieData = await db.order_items.where('order_id').anyOf(oIds.slice(0, 100)).limit(20).toArray();
                } else if (db[dexieTable].schema.indexes.some(idx => idx.name === 'business_id')) {
                    dexieData = await db[dexieTable].where('business_id').equals(businessId).limit(20).toArray();
                } else {
                    dexieData = await db[dexieTable].limit(20).toArray();
                }
                result = { data: dexieData };
            }

            if (result.data) {
                setData(result.data);
                if (result.data.length > 0) {
                    setColumns(Object.keys(result.data[0]));
                }
            }
        } catch (e) {
            console.error('Fetch detail error:', e);
        } finally {
            setLoading(false);
        }
    }, [table.id, table.dexie, table.noBusinessId, activeLayer, businessId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-full"
            >
                {/* Modal Header */}
                <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-purple-600/20 rounded-3xl flex items-center justify-center border border-purple-500/20">
                            <Table size={32} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white">{table.label}</h2>
                            <p className="text-slate-500 font-mono text-sm tracking-widest uppercase">{table.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 hover:bg-slate-800 rounded-2xl transition-all">
                        <ArrowLeft className="w-6 h-6 rotate-180" />
                    </button>
                </div>

                {/* Layer Switcher */}
                <div className="px-8 py-6 bg-slate-900/50 flex items-center gap-4">
                    <button
                        onClick={() => setActiveLayer('cloud')}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all border ${activeLayer === 'cloud' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                    >
                        <Cloud size={16} /> Cloud Supabase
                    </button>
                    <button
                        onClick={() => setActiveLayer('docker')}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all border ${activeLayer === 'docker' ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-900/40' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                    >
                        <DatabaseZap size={16} /> Local Docker
                    </button>
                    <button
                        onClick={() => setActiveLayer('dexie')}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all border ${activeLayer === 'dexie' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                    >
                        <HardDrive size={16} /> Dexie Browser
                    </button>
                </div>

                {/* Data Inspector */}
                <div className="flex-1 p-8 overflow-auto min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                            <p className="text-slate-400 font-bold animate-pulse">טוען נתונים מהשכבה...</p>
                        </div>
                    ) : data.length > 0 ? (
                        <div className="bg-slate-950/50 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-slate-900/80 sticky top-0">
                                        <tr>
                                            {columns.map(col => (
                                                <th key={col} className="px-4 py-3 font-mono text-slate-500 text-xs border-b border-slate-800 whitespace-nowrap">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {data.map((row, i) => (
                                            <tr key={i} className="hover:bg-white/[0.01]">
                                                {columns.map(col => (
                                                    <td key={col} className="px-4 py-2.5 font-mono text-slate-300">
                                                        {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
                            <Monitor size={64} className="mb-4" />
                            <p className="text-xl font-bold">אין נתונים בשכבה הזו</p>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>מספר עמודות בטבלה: {columns.length}</span>
                    <span>מזהה עסק פעיל: {businessId}</span>
                </div>
            </motion.div>
        </div>
    );
};

export default DatabaseExplorer;
