/**
 * Dexie Test Page
 * Use this page to test and debug the offline-first database
 * 
 * Access via: /dexie-test
 */

import React, { useState } from 'react';
import { db, clearAllData, getSyncStatus, isDatabaseReady } from '../db/database';
import { initialLoad, syncOrders, isOnline } from '../services/syncService';
import { syncQueue, getQueueStats, getPendingActions } from '../services/offlineQueue';
import { useOrders, useMenuItems, useSyncStatus, useHasLocalData } from '../hooks/useLocalDB';
import { useAuth } from '../context/AuthContext';
import { Database, RefreshCw, Trash2, Download, Wifi, WifiOff, CheckCircle, XCircle, Upload, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const DexieTestPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [dbStats, setDbStats] = useState(null);
    const [queueStats, setQueueStats] = useState({ pending: 0, failed: 0, completed: 0 });
    const [directOrders, setDirectOrders] = useState([]); // Direct from Dexie, not via hook
    const [expandedTable, setExpandedTable] = useState(null); // Which table is expanded
    const [tableData, setTableData] = useState([]); // Data for expanded table
    const [orderItemsMap, setOrderItemsMap] = useState({});

    // Live queries - these auto-update!
    const orders = useOrders();
    const menuItems = useMenuItems();
    const syncStatus = useSyncStatus();
    const hasLocalData = useHasLocalData();

    useEffect(() => {
        const fetchItems = async () => {
            if (directOrders.length === 0) return;

            const orderIds = directOrders.map(o => o.id);
            const items = await db.order_items.where('order_id').anyOf(orderIds).toArray();

            // Group by order_id
            const map = {};
            items.forEach(item => {
                if (!map[item.order_id]) map[item.order_id] = [];
                map[item.order_id].push(item);
            });

            // Also need menu items for names
            const menuItems = await db.menu_items.toArray();
            const menuMap = {};
            menuItems.forEach(m => menuMap[m.id] = m);

            // Enrich items with names
            Object.keys(map).forEach(oid => {
                map[oid] = map[oid].map(item => ({
                    ...item,
                    menu_item_name: menuMap[item.menu_item_id]?.name || 'Unknown Item'
                }));
            });

            setOrderItemsMap(map);
        };

        fetchItems();
    }, [directOrders]);

    const businessId = currentUser?.business_id;

    // Load queue stats
    const updateQueueStats = async () => {
        const stats = await getQueueStats();
        setQueueStats(stats);
    };

    // Manual sync queue (push offline orders to Supabase)
    const manualSyncQueue = async () => {
        setLoading(true);
        setMessage('🔄 Syncing offline queue to Supabase...');

        try {
            const pending = await getPendingActions();
            console.log('Pending actions:', pending);

            if (pending.length === 0) {
                setMessage('✅ No pending actions to sync');
                setLoading(false);
                return;
            }

            const result = await syncQueue();
            setMessage(`✅ Synced ${result.synced} actions, ${result.failed} failed`);
            await updateQueueStats();
        } catch (e) {
            setMessage(`❌ Sync error: ${e.message}`);
            console.error('Sync error:', e);
        }

        setLoading(false);
    };

    // Test database connection
    const testConnection = async () => {
        setLoading(true);
        try {
            const ready = await isDatabaseReady();
            setMessage(ready ? '✅ Database connection OK!' : '❌ Database connection failed');
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }
        setLoading(false);
    };

    // Load all data from Supabase
    const loadFromSupabase = async () => {
        if (!businessId) {
            setMessage('❌ No business ID - please log in first');
            return;
        }

        setLoading(true);
        setMessage('🔄 Loading data from Supabase...');

        try {
            const result = await initialLoad(businessId);
            if (result.success) {
                setMessage(`✅ Loaded in ${result.duration}s!`);
                await updateStats();
            } else {
                setMessage(`⚠️ ${result.reason || 'Load failed'}`);
            }
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }

        setLoading(false);
    };

    // Sync only orders
    const syncOrdersOnly = async () => {
        if (!businessId) {
            setMessage('❌ No business ID');
            return;
        }

        setLoading(true);
        setMessage('🔄 Syncing orders...');

        try {
            const result = await syncOrders(businessId);
            setMessage(`✅ Synced ${result.ordersCount || 0} orders`);
            await updateStats();
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }

        setLoading(false);
    };

    // Clear all local data
    const clearData = async () => {
        if (!window.confirm('Are you sure you want to clear all local data?')) return;

        setLoading(true);
        try {
            await clearAllData();
            setMessage('🗑️ All local data cleared');
            await updateStats();
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }
        setLoading(false);
    };

    // Update database stats
    const updateStats = async () => {
        const stats = {};
        for (const table of db.tables) {
            stats[table.name] = await table.count();
        }
        setDbStats(stats);
    };

    // Initial stats load
    React.useEffect(() => {
        updateStats();
        updateQueueStats();

        // AUTO-CHECK: Immediately query Dexie for orders on page load
        // Using DYNAMIC import to match what KDS uses
        (async () => {
            try {
                const { db: dynamicDb } = await import('../db/database');
                await dynamicDb.open(); // Ensure DB is open
                const ordersInDexie = await dynamicDb.orders.count();
                const allOrders = await dynamicDb.orders.toArray();
                console.log(`🔍 [DexieTestPage] Dexie: Found ${ordersInDexie} orders`);
                setDirectOrders(allOrders);

                // NATIVE IndexedDB check (bypass Dexie completely)
                const nativeRequest = indexedDB.open('KDSDatabase');
                nativeRequest.onsuccess = (e) => {
                    const nativeDb = e.target.result;
                    const tx = nativeDb.transaction('orders', 'readonly');
                    const store = tx.objectStore('orders');
                    const countReq = store.count();
                    countReq.onsuccess = () => {
                        console.log(`🔍 [DexieTestPage] NATIVE IndexedDB: Found ${countReq.result} orders`);
                    };
                };
                nativeRequest.onerror = (e) => {
                    console.error('Native IndexedDB error:', e);
                };
            } catch (err) {
                console.error('❌ [DexieTestPage] DB Error:', err);
            }
        })();
    }, []);

    // Manual refresh stats (direct from DB, not hooks)
    const manualRefreshStats = async () => {
        setLoading(true);
        setMessage('🔄 Counting records directly from Dexie...');
        const stats = {};
        for (const table of db.tables) {
            stats[table.name] = await table.count();
        }
        setDbStats(stats);

        // Get orders directly and update state
        const allOrders = await db.orders.toArray();
        setDirectOrders(allOrders);
        console.log('📊 DIRECT Dexie Orders:', allOrders.length, allOrders.slice(0, 5).map(o => ({ id: o.id, order_number: o.order_number, status: o.order_status })));

        setMessage(`✅ Found ${stats.orders || 0} orders in Dexie`);
        setLoading(false);
    };

    // Clean up stale local orders (L-prefix or numeric ID) that are stuck
    const cleanupStaleOrders = async () => {
        setLoading(true);
        try {
            const { db: dynamicDb } = await import('../db/database');
            const allOrders = await dynamicDb.orders.toArray();

            // Find orders with L-prefix order_number or non-UUID ids
            const staleOrders = allOrders.filter(o =>
                (o.order_number && String(o.order_number).startsWith('L')) ||
                (o.id && !String(o.id).includes('-'))
            );

            console.log(`🧹 Found ${staleOrders.length} stale orders to clean:`,
                staleOrders.map(o => ({ id: o.id, order_number: o.order_number })));

            if (staleOrders.length > 0) {
                for (const order of staleOrders) {
                    await dynamicDb.orders.delete(order.id);
                    // Also clean related items
                    await dynamicDb.order_items.where('order_id').equals(order.id).delete();
                }
                setMessage(`🧹 Cleaned ${staleOrders.length} stale local orders`);
            } else {
                setMessage('✅ No stale orders to clean');
            }

            await manualRefreshStats();
        } catch (e) {
            setMessage(`❌ Cleanup error: ${e.message}`);
        }
        setLoading(false);
    };

    // Clear completed queue entries
    const clearCompletedQueue = async () => {
        setLoading(true);
        try {
            const { db: dynamicDb } = await import('../db/database');
            if (dynamicDb.offline_queue_v2) {
                const completed = await dynamicDb.offline_queue_v2.where('status').equals('completed').count();
                await dynamicDb.offline_queue_v2.where('status').equals('completed').delete();
                setMessage(`🗑️ Cleared ${completed} completed queue entries`);
            }
            await updateQueueStats();
        } catch (e) {
            setMessage(`❌ Queue cleanup error: ${e.message}`);
        }
        setLoading(false);
    };

    // Load data for selected table
    const handleTableClick = async (tableName) => {
        setLoading(true);
        try {
            const table = db.table(tableName);
            const data = await table.toArray();
            setExpandedTable(tableName);
            setTableData(data);
            setMessage(`📂 Loaded ${data.length} records from ${tableName}`);
        } catch (e) {
            setMessage(`❌ Error loading table ${tableName}: ${e.message}`);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6" dir="ltr">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/login')}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2"
                                title="Back to Login"
                            >
                                <ArrowLeft size={24} className="text-gray-600" />
                            </button>
                            <Database size={32} className="text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">Dexie.js Test Page</h1>
                                <p className="text-gray-500 text-sm">Offline-first database testing</p>
                            </div>
                        </div>

                        {/* Online/Offline indicator */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isOnline() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {isOnline() ? <Wifi size={18} /> : <WifiOff size={18} />}
                            <span className="font-medium">{isOnline() ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                        <strong>User:</strong> {currentUser?.name || 'Not logged in'} |
                        <strong> Business:</strong> {businessId || 'None'}
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`mt-4 p-3 rounded-lg text-sm ${message.includes('✅') ? 'bg-green-100 text-green-700' :
                            message.includes('❌') ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                            {message}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <button
                        onClick={testConnection}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <CheckCircle size={24} className="text-green-600" />
                        <span className="font-medium">Test DB</span>
                    </button>

                    <button
                        onClick={loadFromSupabase}
                        disabled={loading || !businessId}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Download size={24} className="text-blue-600" />
                        <span className="font-medium">Initial Load</span>
                    </button>

                    <button
                        onClick={syncOrdersOnly}
                        disabled={loading || !businessId}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <RefreshCw size={24} className={`text-purple-600 ${loading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">Sync Orders</span>
                    </button>

                    <button
                        onClick={clearData}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Trash2 size={24} className="text-red-600" />
                        <span className="font-medium">Clear All</span>
                    </button>

                    <button
                        onClick={manualSyncQueue}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50 relative"
                    >
                        <Upload size={24} className="text-orange-600" />
                        <span className="font-medium">Push Queue</span>
                        {queueStats.pending > 0 && (
                            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                                {queueStats.pending}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={manualRefreshStats}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Database size={24} className="text-teal-600" />
                        <span className="font-medium">Direct Count</span>
                    </button>

                    <button
                        onClick={cleanupStaleOrders}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Trash2 size={24} className="text-amber-600" />
                        <span className="font-medium">Cleanup L-Orders</span>
                    </button>

                    <button
                        onClick={clearCompletedQueue}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Trash2 size={24} className="text-gray-500" />
                        <span className="font-medium">Clear Queue Done</span>
                    </button>
                </div>

                {/* Database Stats used as Navigation */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">📊 Select Table to View Data</h2>

                    {dbStats ? (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                            {Object.entries(dbStats).map(([table, count]) => (
                                <button
                                    key={table}
                                    onClick={() => handleTableClick(table)}
                                    className={`p-3 rounded-lg text-center transition ${expandedTable === table
                                        ? 'bg-blue-100 ring-2 ring-blue-500'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                        }`}
                                >
                                    <div className="text-2xl font-bold text-blue-600">{count}</div>
                                    <div className="text-xs text-gray-500 truncate">{table}</div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">Click "Test DB" to load stats</p>
                    )}
                </div>

                {/* Expanded Table View */}
                {expandedTable && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">
                                📂 Table: {expandedTable}
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                    {tableData.length} records
                                </span>
                            </h2>
                            <button
                                onClick={() => setExpandedTable(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            {tableData.length > 0 ? (
                                <table className="min-w-full text-xs text-left">
                                    <thead className="bg-gray-50 uppercase font-medium text-gray-500">
                                        <tr>
                                            {Object.keys(tableData[0]).slice(0, 8).map(key => (
                                                <th key={key} className="px-4 py-2 border-b">{key}</th>
                                            ))}
                                            <th className="px-4 py-2 border-b">RAW</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {tableData.slice(0, 50).map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50 font-mono">
                                                {Object.keys(tableData[0]).slice(0, 8).map(key => (
                                                    <td key={key} className="px-4 py-2 truncate max-w-[150px]">
                                                        {typeof row[key] === 'object' ? JSON.stringify(row[key]).substring(0, 30) + '...' : String(row[key])}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-2">
                                                    <details>
                                                        <summary className="cursor-pointer text-blue-500">JSON</summary>
                                                        <pre className="text-[10px] mt-1 p-2 bg-gray-100 rounded">{JSON.stringify(row, null, 2)}</pre>
                                                    </details>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-gray-400 italic">Table is empty</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Detailed Orders List - Full Width */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800">
                            📦 Orders in Dexie
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                {directOrders.length} total
                            </span>
                        </h2>
                        <button
                            onClick={manualRefreshStats}
                            className="text-xs bg-teal-100 text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-200 font-medium"
                        >
                            🔄 Refresh
                        </button>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {directOrders.length > 0 ? (
                            directOrders.map(order => (
                                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                    {/* Order Header */}
                                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl font-bold text-blue-600">#{order.order_number || 'N/A'}</span>
                                            <span className="text-gray-600">{order.customer_name || 'Guest'}</span>
                                            {order.is_offline && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Offline</span>}
                                            {order.pending_sync && <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">⏳ Pending Sync</span>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${order.order_status === 'completed' ? 'bg-green-100 text-green-700' :
                                                order.order_status === 'ready' ? 'bg-blue-100 text-blue-700' :
                                                    order.order_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {order.order_status}
                                            </span>
                                            <span className="text-lg font-bold text-gray-800">
                                                ₪{order.total_amount || '0'}
                                            </span>
                                            {order.is_paid ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">✓ Paid</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Unpaid</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Order Details */}
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                                        <div><strong>ID:</strong> {String(order.id).substring(0, 20)}...</div>
                                        <div><strong>Phone:</strong> {order.customer_phone || 'N/A'}</div>
                                        <div><strong>Created:</strong> {new Date(order.created_at).toLocaleString('he-IL')}</div>
                                        <div><strong>Updated:</strong> {order.updated_at ? new Date(order.updated_at).toLocaleString('he-IL') : 'N/A'}</div>
                                    </div>

                                    {/* Items Display */}
                                    <div className="bg-gray-50 rounded p-3 mt-3">
                                        <div className="text-xs font-bold text-gray-600 mb-2 border-b border-gray-200 pb-1">
                                            ITEMS ({orderItemsMap[order.id]?.length || 0})
                                        </div>
                                        {orderItemsMap[order.id]?.length > 0 ? (
                                            <div className="space-y-1">
                                                {orderItemsMap[order.id].map(item => (
                                                    <div key={item.id} className="flex justify-between text-xs">
                                                        <span>
                                                            <span className="font-bold">{item.quantity}x</span> {item.menu_item_name}
                                                        </span>
                                                        <span className={`px-1.5 rounded text-[10px] ${item.item_status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                item.item_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-gray-200 text-gray-600'
                                                            }`}>
                                                            {item.item_status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-red-400 italic">
                                                No items found for this order in Dexie!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-400 mb-2">No orders in Dexie</p>
                                <p className="text-xs text-gray-300">Click "Sync Orders" or "Initial Load" to populate</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-2 gap-6">

                    {/* Menu Items (Live) */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">
                            🍽️ Menu Items (Live Query)
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                {menuItems?.length || 0} records
                            </span>
                        </h2>

                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {menuItems && menuItems.length > 0 ? (
                                menuItems.slice(0, 10).map(item => (
                                    <div key={item.id} className="p-2 bg-gray-50 rounded text-sm flex justify-between">
                                        <span>{item.name}</span>
                                        <span className="text-gray-500">{item.category}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-center py-8">No menu items cached locally</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sync Status */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">🔄 Sync Status</h2>

                    {Object.keys(syncStatus).length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(syncStatus).map(([table, status]) => (
                                <div key={table} className="bg-gray-50 rounded-lg p-3">
                                    <div className="font-medium text-sm">{table}</div>
                                    <div className="text-xs text-gray-500">
                                        {status.recordCount} records
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {new Date(status.lastSynced).toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No sync history yet</p>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DexieTestPage;
