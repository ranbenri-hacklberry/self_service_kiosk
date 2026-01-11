import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Database,
    Table,
    Key,
    Link,
    Shield,
    Play,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    RefreshCw,
    Search,
    Copy,
    Check,
    AlertTriangle,
    Columns,
    Lock,
    Unlock,
    ArrowLeft
} from 'lucide-react';

/**
 * DatabaseExplorer - A lightweight DB admin panel for SuperAdmin
 * Shows tables, columns, relationships, RLS policies, and allows running SQL
 */
const DatabaseExplorer = () => {
    const navigate = useNavigate();
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [tableDetails, setTableDetails] = useState(null);
    const [rlsPolicies, setRlsPolicies] = useState([]);
    const [foreignKeys, setForeignKeys] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const [queryResult, setQueryResult] = useState(null);
    const [queryError, setQueryError] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedSql, setCopiedSql] = useState(false);
    const [copiedItem, setCopiedItem] = useState(null); // Track what was copied
    const [activeTab, setActiveTab] = useState('schema'); // 'schema' | 'sql'
    const [tableData, setTableData] = useState(null);
    const [dataLimit, setDataLimit] = useState(50);
    const [loadingData, setLoadingData] = useState(false);

    // Fetch all tables
    const fetchTables = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_all_tables');
            if (error) {
                // Fallback to direct query if RPC doesn't exist
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('information_schema.tables')
                    .select('table_name')
                    .eq('table_schema', 'public')
                    .eq('table_type', 'BASE TABLE');

                if (fallbackError) throw fallbackError;
                setTables(fallbackData?.map(t => ({ name: t.table_name })) || []);
            } else {
                setTables(data || []);
            }
        } catch (err) {
            console.error('Error fetching tables:', err);
            // Try raw SQL approach
            await runQuery(`
                SELECT table_name as name, 
                       (SELECT relrowsecurity FROM pg_class WHERE relname = table_name) as rls_enabled
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `, true);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch table details (columns, types, constraints)
    const fetchTableDetails = useCallback(async (tableName) => {
        console.log('📊 Fetching details for table:', tableName);
        try {
            // Get columns
            const columnsQuery = `
                SELECT 
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    c.character_maximum_length,
                    CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
                FROM information_schema.columns c
                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.table_name = '${tableName}' 
                    AND tc.constraint_type = 'PRIMARY KEY'
                ) pk ON c.column_name = pk.column_name
                WHERE c.table_name = '${tableName}'
                AND c.table_schema = 'public'
                ORDER BY c.ordinal_position
            `;

            console.log('🔍 Running columns query...');
            const { data: columnsData, error: columnsError } = await supabase.rpc('run_sql', {
                query_text: columnsQuery
            });

            console.log('📊 Columns result:', { columnsData, columnsError });

            if (columnsError) throw columnsError;

            // Get RLS status
            const rlsQuery = `
                SELECT relrowsecurity as rls_enabled
                FROM pg_class
                WHERE relname = '${tableName}'
            `;

            const { data: rlsData } = await supabase.rpc('run_sql', { query_text: rlsQuery });

            // Get policies
            const policiesQuery = `
                SELECT policyname, cmd, permissive, roles, qual, with_check
                FROM pg_policies
                WHERE tablename = '${tableName}'
                ORDER BY policyname
            `;

            const { data: policiesData } = await supabase.rpc('run_sql', { query_text: policiesQuery });

            // Get foreign keys
            const fkQuery = `
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table,
                    ccu.column_name AS foreign_column,
                    tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.table_name = '${tableName}'
                AND tc.constraint_type = 'FOREIGN KEY'
            `;

            const { data: fkData } = await supabase.rpc('run_sql', { query_text: fkQuery });

            setTableDetails({
                name: tableName,
                columns: columnsData || [],
                rlsEnabled: rlsData?.[0]?.rls_enabled || false
            });
            setRlsPolicies(policiesData || []);
            setForeignKeys(fkData || []);

        } catch (err) {
            console.error('Error fetching table details:', err);
        }
    }, []);

    // Run SQL query
    const runQuery = async (query = sqlQuery, silent = false) => {
        if (!query.trim()) return;

        setIsRunning(true);
        setQueryError(null);

        try {
            const { data, error } = await supabase.rpc('run_sql', {
                query_text: query
            });

            if (error) throw error;

            if (!silent) {
                setQueryResult(data);
            } else if (data && Array.isArray(data)) {
                setTables(data);
            }
        } catch (err) {
            console.error('Query error:', err);
            setQueryError(err.message);
            if (!silent) setQueryResult(null);
        } finally {
            setIsRunning(false);
        }
    };

    // Copy SQL to clipboard
    const copyToClipboard = (text, itemId = 'sql') => {
        navigator.clipboard.writeText(text);
        setCopiedItem(itemId);
        setCopiedSql(true);
        setTimeout(() => {
            setCopiedSql(false);
            setCopiedItem(null);
        }, 2000);
    };

    // Mini copy button component
    const CopyBtn = ({ text, id, size = 12, className = '' }) => (
        <button
            onClick={(e) => { e.stopPropagation(); copyToClipboard(text, id); }}
            className={`p-1 hover:bg-slate-600 rounded transition-colors ${className}`}
            title="Copy"
        >
            {copiedItem === id ? <Check size={size} className="text-green-400" /> : <Copy size={size} className="text-slate-500 hover:text-white" />}
        </button>
    );

    // Initial load
    useEffect(() => {
        fetchTables();
    }, [fetchTables]);

    // Load table details when selected
    useEffect(() => {
        if (selectedTable) {
            fetchTableDetails(selectedTable);
        }
    }, [selectedTable, fetchTableDetails]);

    // Filter tables by search (prefix match)
    const filteredTables = tables.filter(t =>
        t.name?.toLowerCase().startsWith(searchTerm.toLowerCase())
    );

    // View table data
    const viewTableData = async (tableName, limit = dataLimit) => {
        setLoadingData(true);
        setTableData(null);
        try {
            const { data, error } = await supabase.rpc('run_sql', {
                query_text: `SELECT * FROM "${tableName}" LIMIT ${limit}`
            });
            if (error) throw error;
            setTableData({ tableName, rows: data || [], limit });
        } catch (err) {
            console.error('Error fetching table data:', err);
            setTableData({ tableName, rows: [], error: err.message });
        } finally {
            setLoadingData(false);
        }
    };

    // Quick queries
    const quickQueries = [
        { label: 'All Tables', query: `SELECT table_name, (SELECT relrowsecurity FROM pg_class WHERE relname = table_name) as rls FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name` },
        { label: 'All RLS Policies', query: `SELECT tablename, policyname, cmd, permissive, roles FROM pg_policies ORDER BY tablename, policyname` },
        { label: 'All Foreign Keys', query: `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' ORDER BY tc.table_name` },
        { label: 'Row Counts', query: `SELECT schemaname, relname as table_name, n_tup_ins as inserts, n_live_tup as live_rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC` },
    ];

    return (
        <div className="h-full flex flex-col bg-slate-900 text-white" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800">
                {/* Right Side: Back Button + Title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white flex items-center gap-2"
                        title="חזרה"
                    >
                        <ChevronRight size={20} />
                        <span className="text-sm font-bold">חזרה</span>
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-xl">
                        <Database className="text-purple-400" size={20} />
                        <h1 className="text-lg font-bold">צפייה בבסיס נתונים</h1>
                    </div>
                </div>
                {/* Left Side: Refresh */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchTables}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                        title="רענון"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        <span className="text-sm">רענן</span>
                    </button>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-slate-700 bg-slate-800">
                <button
                    onClick={() => setActiveTab('schema')}
                    className={`px-6 py-3 font-medium transition-colors ${activeTab === 'schema'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-slate-400 hover:text-white'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Table size={16} />
                        Schema
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('sql')}
                    className={`px-6 py-3 font-medium transition-colors ${activeTab === 'sql'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-slate-400 hover:text-white'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Play size={16} />
                        SQL Editor
                    </div>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'schema' ? (
                    <>
                        {/* Tables Sidebar - STICKY */}
                        <div className="w-64 border-r border-slate-700 flex flex-col bg-slate-850 sticky top-0 h-full overflow-hidden">
                            {/* Search */}
                            <div className="p-3 border-b border-slate-700 shrink-0">
                                <div className="relative">
                                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="חיפוש טבלאות..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pr-9 pl-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            {/* Table List */}
                            <div className="flex-1 overflow-y-auto">
                                {filteredTables.map((table) => (
                                    <button
                                        key={table.name}
                                        onClick={() => setSelectedTable(table.name)}
                                        className={`w-full px-4 py-2.5 text-right flex items-center gap-2 transition-colors ${selectedTable === table.name
                                            ? 'bg-purple-600/20 text-purple-300 border-l-2 border-purple-500'
                                            : 'hover:bg-slate-800 text-slate-300'
                                            }`}
                                    >
                                        <Table size={14} className="text-slate-500" />
                                        <span className="text-sm truncate flex-1">{table.name}</span>
                                        {table.rls_enabled && (
                                            <Shield size={12} className="text-green-500" title="RLS Enabled" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Table Count */}
                            <div className="p-3 border-t border-slate-700 text-center text-xs text-slate-500 shrink-0">
                                {filteredTables.length} טבלאות
                            </div>
                        </div>

                        {/* Table Details or Dashboard */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {tableDetails ? (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-bold">{tableDetails.name}</h2>
                                            <CopyBtn text={tableDetails.name} id="table-name" size={16} />
                                            {tableDetails.rlsEnabled ? (
                                                <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                                    <Lock size={12} /> RLS On
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                                                    <Unlock size={12} /> RLS Off
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={dataLimit}
                                                onChange={(e) => setDataLimit(Number(e.target.value))}
                                                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm"
                                            >
                                                <option value={10}>10 rows</option>
                                                <option value={50}>50 rows</option>
                                                <option value={100}>100 rows</option>
                                                <option value={500}>500 rows</option>
                                            </select>
                                            <button
                                                onClick={() => viewTableData(tableDetails.name)}
                                                disabled={loadingData}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm flex items-center gap-2 transition-colors"
                                            >
                                                {loadingData ? <RefreshCw size={14} className="animate-spin" /> : <Table size={14} />}
                                                View Data
                                            </button>
                                        </div>
                                    </div>

                                    {/* Table Data */}
                                    {tableData && tableData.tableName === tableDetails.name && (
                                        <div className="bg-slate-800 rounded-xl overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Database size={16} className="text-blue-400" />
                                                    <h3 className="font-medium">Data ({tableData.rows.length} rows)</h3>
                                                </div>
                                                {tableData.rows.length >= tableData.limit && (
                                                    <span className="text-xs text-orange-400">Limited to {tableData.limit} rows</span>
                                                )}
                                            </div>
                                            {tableData.error ? (
                                                <div className="p-4 text-red-400">{tableData.error}</div>
                                            ) : tableData.rows.length > 0 ? (
                                                <div className="overflow-x-auto max-h-96">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-750 sticky top-0">
                                                            <tr className="text-left text-slate-400">
                                                                {Object.keys(tableData.rows[0]).map((key) => (
                                                                    <th key={key} className="px-3 py-2 font-mono whitespace-nowrap">{key}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {tableData.rows.map((row, idx) => (
                                                                <tr key={idx} className="border-t border-slate-700 hover:bg-slate-750">
                                                                    {Object.values(row).map((val, valIdx) => (
                                                                        <td key={valIdx} className="px-3 py-1.5 font-mono text-slate-300 max-w-[200px] truncate">
                                                                            {val === null ? (
                                                                                <span className="text-slate-600 italic">null</span>
                                                                            ) : typeof val === 'boolean' ? (
                                                                                val ? '✓' : '✗'
                                                                            ) : typeof val === 'object' ? (
                                                                                <span className="text-purple-300">{JSON.stringify(val).slice(0, 50)}...</span>
                                                                            ) : (
                                                                                String(val).slice(0, 100)
                                                                            )}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="p-4 text-center text-slate-500">No data in table</div>
                                            )}
                                        </div>
                                    )}

                                    {/* Columns */}
                                    <div className="bg-slate-800 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Columns size={16} className="text-purple-400" />
                                                <h3 className="font-medium">Columns ({tableDetails.columns.length})</h3>
                                            </div>
                                            <CopyBtn
                                                text={tableDetails.columns.map(c => c.column_name).join(', ')}
                                                id="all-columns"
                                                size={14}
                                            />
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-750">
                                                <tr className="text-left text-slate-400">
                                                    <th className="px-4 py-2">Name</th>
                                                    <th className="px-4 py-2">Type</th>
                                                    <th className="px-4 py-2">Nullable</th>
                                                    <th className="px-4 py-2">Default</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableDetails.columns.map((col, idx) => (
                                                    <tr key={idx} className="border-t border-slate-700 hover:bg-slate-750 group">
                                                        <td className="px-4 py-2 font-mono">
                                                            <div className="flex items-center gap-2">
                                                                {col.is_primary_key && <Key size={12} className="text-yellow-500" />}
                                                                <span>{col.column_name}</span>
                                                                <CopyBtn
                                                                    text={col.column_name}
                                                                    id={`col-${col.column_name}`}
                                                                    size={10}
                                                                    className="opacity-0 group-hover:opacity-100"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-slate-400">
                                                            {col.data_type}
                                                            {col.character_maximum_length && `(${col.character_maximum_length})`}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            {col.is_nullable === 'YES' ? (
                                                                <span className="text-slate-500">nullable</span>
                                                            ) : (
                                                                <span className="text-orange-400">required</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-slate-500 font-mono text-xs truncate max-w-[200px]">
                                                            {col.column_default || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Foreign Keys */}
                                    {foreignKeys.length > 0 && (
                                        <div className="bg-slate-800 rounded-xl overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                                                <Link size={16} className="text-blue-400" />
                                                <h3 className="font-medium">Foreign Keys ({foreignKeys.length})</h3>
                                            </div>
                                            <div className="p-4 space-y-2">
                                                {foreignKeys.map((fk, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                                        <span className="font-mono text-purple-300">{fk.column_name}</span>
                                                        <ChevronLeft size={14} className="text-slate-500" />
                                                        <span className="font-mono text-blue-300">{fk.foreign_table}.{fk.foreign_column}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* RLS Policies */}
                                    {rlsPolicies.length > 0 && (
                                        <div className="bg-slate-800 rounded-xl overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Shield size={16} className="text-green-400" />
                                                    <h3 className="font-medium">RLS Policies ({rlsPolicies.length})</h3>
                                                </div>
                                                <CopyBtn
                                                    text={JSON.stringify(rlsPolicies, null, 2)}
                                                    id="all-policies"
                                                    size={14}
                                                />
                                            </div>
                                            <div className="divide-y divide-slate-700">
                                                {rlsPolicies.map((policy, idx) => (
                                                    <div key={idx} className="p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="font-medium text-green-300">{policy.policyname}</span>
                                                            <CopyBtn text={policy.policyname} id={`policy-${idx}`} size={10} />
                                                            <span className="px-2 py-0.5 bg-slate-700 text-xs rounded">{policy.cmd}</span>
                                                            <span className="px-2 py-0.5 bg-slate-700 text-xs rounded">{policy.permissive}</span>
                                                        </div>
                                                        {policy.qual && (
                                                            <div className="mt-2 relative group">
                                                                <span className="text-xs text-slate-500">USING:</span>
                                                                <CopyBtn
                                                                    text={policy.qual}
                                                                    id={`qual-${idx}`}
                                                                    size={10}
                                                                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100"
                                                                />
                                                                <pre className="mt-1 p-2 bg-slate-900 rounded text-xs font-mono text-slate-400 overflow-x-auto">
                                                                    {policy.qual}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {policy.with_check && (
                                                            <div className="mt-2 relative group">
                                                                <span className="text-xs text-slate-500">WITH CHECK:</span>
                                                                <CopyBtn
                                                                    text={policy.with_check}
                                                                    id={`check-${idx}`}
                                                                    size={10}
                                                                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100"
                                                                />
                                                                <pre className="mt-1 p-2 bg-slate-900 rounded text-xs font-mono text-slate-400 overflow-x-auto">
                                                                    {policy.with_check}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Dashboard - Default View */
                                <div className="space-y-6">
                                    <div className="text-center mb-8">
                                        <Database size={48} className="mx-auto mb-4 text-purple-400" />
                                        <h2 className="text-2xl font-bold mb-2">דשבורד בסיס נתונים</h2>
                                        <p className="text-slate-400">בחר טבלה מהרשימה לצפייה בפרטים</p>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-800 rounded-xl p-4 text-center">
                                            <div className="text-3xl font-black text-purple-400">{tables.length}</div>
                                            <div className="text-sm text-slate-400 mt-1">טבלאות</div>
                                        </div>
                                        <div className="bg-slate-800 rounded-xl p-4 text-center">
                                            <div className="text-3xl font-black text-green-400">
                                                {tables.filter(t => t.rls_enabled).length}
                                            </div>
                                            <div className="text-sm text-slate-400 mt-1">עם RLS</div>
                                        </div>
                                        <div className="bg-slate-800 rounded-xl p-4 text-center">
                                            <div className="text-3xl font-black text-red-400">
                                                {tables.filter(t => !t.rls_enabled).length}
                                            </div>
                                            <div className="text-sm text-slate-400 mt-1">בלי RLS</div>
                                        </div>
                                        <div className="bg-slate-800 rounded-xl p-4 text-center">
                                            <div className="text-3xl font-black text-blue-400">
                                                {filteredTables.length !== tables.length ? filteredTables.length : '~'}
                                            </div>
                                            <div className="text-sm text-slate-400 mt-1">מסוננות</div>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="bg-slate-800 rounded-xl p-4">
                                        <h3 className="font-bold mb-3 text-slate-300">טבלאות פופולריות</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {['orders', 'menu_items', 'customers', 'businesses', 'employees', 'inventory_items'].map(tableName => (
                                                tables.find(t => t.name === tableName) && (
                                                    <button
                                                        key={tableName}
                                                        onClick={() => setSelectedTable(tableName)}
                                                        className="px-3 py-1.5 bg-slate-700 hover:bg-purple-600/30 hover:text-purple-300 rounded-lg text-sm transition-colors"
                                                    >
                                                        {tableName}
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* SQL Editor Tab */
                    <div className="flex-1 flex flex-col p-6">
                        {/* Quick Queries */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                            {quickQueries.map((q, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setSqlQuery(q.query);
                                        setQueryResult(null);
                                        setQueryError(null);
                                    }}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                                >
                                    {q.label}
                                </button>
                            ))}
                        </div>

                        {/* SQL Input */}
                        <div className="relative mb-4">
                            <textarea
                                value={sqlQuery}
                                onChange={(e) => setSqlQuery(e.target.value)}
                                placeholder="-- Enter SQL query here..."
                                className="w-full h-40 p-4 bg-slate-800 border border-slate-600 rounded-xl font-mono text-sm focus:outline-none focus:border-purple-500 resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        runQuery();
                                    }
                                }}
                            />
                            <div className="absolute bottom-3 right-3 flex gap-2">
                                <button
                                    onClick={() => copyToClipboard(sqlQuery)}
                                    className="p-2 hover:bg-slate-700 rounded transition-colors"
                                    title="Copy"
                                >
                                    {copiedSql ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                </button>
                                <button
                                    onClick={() => runQuery()}
                                    disabled={isRunning || !sqlQuery.trim()}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    {isRunning ? (
                                        <RefreshCw size={16} className="animate-spin" />
                                    ) : (
                                        <Play size={16} />
                                    )}
                                    Run (⌘+Enter)
                                </button>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="flex-1 overflow-auto">
                            {queryError && (
                                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 mb-4">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                                        <pre className="text-sm font-mono whitespace-pre-wrap">{queryError}</pre>
                                    </div>
                                </div>
                            )}

                            {queryResult && Array.isArray(queryResult) && queryResult.length > 0 && (
                                <div className="bg-slate-800 rounded-xl overflow-hidden">
                                    <div className="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
                                        {queryResult.length} rows
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-750">
                                                <tr className="text-left text-slate-400">
                                                    {Object.keys(queryResult[0]).map((key) => (
                                                        <th key={key} className="px-4 py-2 font-mono">{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {queryResult.map((row, idx) => (
                                                    <tr key={idx} className="border-t border-slate-700 hover:bg-slate-750">
                                                        {Object.values(row).map((val, valIdx) => (
                                                            <td key={valIdx} className="px-4 py-2 font-mono text-slate-300">
                                                                {val === null ? (
                                                                    <span className="text-slate-600 italic">null</span>
                                                                ) : typeof val === 'boolean' ? (
                                                                    val ? '✓' : '✗'
                                                                ) : typeof val === 'object' ? (
                                                                    JSON.stringify(val)
                                                                ) : (
                                                                    String(val)
                                                                )}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {queryResult && Array.isArray(queryResult) && queryResult.length === 0 && (
                                <div className="p-8 text-center text-slate-500">
                                    Query executed successfully, no rows returned.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default DatabaseExplorer;
