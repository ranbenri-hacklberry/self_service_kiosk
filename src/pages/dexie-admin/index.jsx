import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { Card, Grid, Tabs, Badge, Loading, Text, Spacer, Button, Input, GeistProvider, CssBaseline } from '@geist-ui/core';
import { Database, Users, Coffee, ShoppingCart, Activity, Wifi, Home, Search } from '@geist-ui/icons';

/**
 * Advanced Data Dashboard
 * Shows customer loyalty, menu, orders, sync status, and internet speed
 * Optimized for iPad and Desktop (hidden on mobile)
 */
const DexieAdminPanel = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('customers');
    const [loading, setLoading] = useState(true);

    // Data states
    const [customers, setCustomers] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [syncStatus, setSyncStatus] = useState({});
    const [speedTest, setSpeedTest] = useState(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load customers with loyalty points
            const customersData = await db.customers.toArray();

            console.log('Debug - Customers:', customersData.length);
            console.log('Debug - Sample customer:', customersData[0]);

            const customersWithPoints = customersData.map(c => ({
                ...c,
                points: c.loyalty_coffee_count || 0
            }));

            console.log('Debug - Customers with points:', customersWithPoints.filter(c => c.points > 0).length);
            console.log('Debug - First customer with points:', customersWithPoints.find(c => c.points > 0));

            setCustomers(customersWithPoints);

            // Load menu items
            const menu = await db.menu_items.toArray();
            setMenuItems(menu);

            // Load recent orders (last 7 days)
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            const orders = await db.orders
                .where('created_at')
                .above(cutoff.toISOString())
                .reverse()
                .limit(50)
                .toArray();
            setRecentOrders(orders);

            // Get sync status - compare Dexie vs Supabase
            const tables = ['customers', 'menu_items', 'orders', 'order_items'];
            const status = { syncing: false };

            for (const table of tables) {
                const localCount = await db[table]?.count() || 0;

                // Fetch cloud count from Supabase
                let cloudCount = null;
                try {
                    const { count, error } = await supabase
                        .from(table)
                        .select('*', { count: 'exact', head: true });

                    if (!error) cloudCount = count;
                } catch (e) {
                    console.warn(`Failed to fetch cloud count for ${table}:`, e);
                }

                status[table] = { count: localCount, cloudCount };
            }

            setSyncStatus(status);

        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const runSpeedTest = async () => {
        setSpeedTest({ testing: true });
        try {
            const start = performance.now();

            // Ping test
            const pingStart = performance.now();
            await supabase.from('businesses').select('id').limit(1);
            const ping = Math.round(performance.now() - pingStart);

            // Download test
            const dlStart = performance.now();
            await supabase.from('menu_items').select('*').limit(100);
            const dlTime = performance.now() - dlStart;

            setSpeedTest({
                ping,
                downloadSpeed: Math.round(100 / (dlTime / 1000)),
                status: ping < 200 ? 'excellent' : ping < 500 ? 'good' : 'poor'
            });
        } catch (e) {
            setSpeedTest({ error: true });
        }
    };

    // Filter data based on search
    const filteredCustomers = customers.filter(c =>
        !searchQuery ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery) ||
        c.phone_number?.includes(searchQuery)
    );

    const filteredMenu = menuItems.filter(m =>
        !searchQuery ||
        m.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredOrders = recentOrders.filter(o =>
        !searchQuery ||
        o.order_number?.toString().includes(searchQuery)
    );

    return (
        <GeistProvider>
            {/* CssBaseline is kept here to style Geist components, but restricted to this page */}
            <CssBaseline />
            <div className="min-h-screen bg-gray-50 font-heebo" dir="rtl">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                icon={<Home />}
                                auto
                                scale={0.8}
                                onClick={() => navigate('/mode-selection')}
                            />
                            <Text h3 className="m-0">מידע מתקדם</Text>
                            <Badge type="secondary">{currentUser?.business_name}</Badge>
                        </div>

                        <Input
                            icon={<Search />}
                            placeholder="חיפוש..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            clearable
                            width="250px"
                        />
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.Item label={<><Users size={16} /> לקוחות</>} value="customers">
                            {loading ? (
                                <Loading>טוען נתונים...</Loading>
                            ) : (
                                <Grid.Container gap={2}>
                                    {filteredCustomers
                                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
                                        .map(customer => (
                                            <Grid xs={24} sm={12} md={8} key={customer.id}>
                                                <Card width="100%">
                                                    <Text h4>{customer.name || 'לקוח אנונימי'}</Text>
                                                    <Text small type="secondary">
                                                        {customer.phone_number || customer.phone || 'אין טלפון'}
                                                    </Text>
                                                    <Spacer h={0.5} />
                                                    <Badge type={customer.points > 0 ? "success" : "default"}>
                                                        <Coffee size={12} /> {customer.points} נקודות
                                                    </Badge>
                                                </Card>
                                            </Grid>
                                        ))}
                                </Grid.Container>
                            )}
                        </Tabs.Item>

                        <Tabs.Item label={<><ShoppingCart size={16} /> תפריט</>} value="menu">
                            {loading ? (
                                <Loading>טוען תפריט...</Loading>
                            ) : (
                                <Grid.Container gap={2}>
                                    {filteredMenu.map(item => (
                                        <Grid xs={24} sm={12} md={6} key={item.id}>
                                            <Card width="100%">
                                                <Text h5>{item.name}</Text>
                                                <Text small type="secondary">{item.category}</Text>
                                                <Spacer h={0.5} />
                                                <Text b>₪{item.price}</Text>
                                                {!item.is_active && <Badge type="error">לא פעיל</Badge>}
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid.Container>
                            )}
                        </Tabs.Item>

                        <Tabs.Item label={<><Database size={16} /> הזמנות</>} value="orders">
                            {loading ? (
                                <Loading>טוען הזמנות...</Loading>
                            ) : (
                                <Grid.Container gap={2}>
                                    {filteredOrders.map(order => (
                                        <Grid xs={24} sm={12} key={order.id}>
                                            <Card width="100%">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <Text h5>הזמנה #{order.order_number}</Text>
                                                        <Text small type="secondary">
                                                            {new Date(order.created_at).toLocaleString('he-IL')}
                                                        </Text>
                                                    </div>
                                                    <Badge type={order.order_status === 'completed' ? 'success' : 'warning'}>
                                                        {order.order_status}
                                                    </Badge>
                                                </div>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid.Container>
                            )}
                        </Tabs.Item>

                        <Tabs.Item label={<><Activity size={16} /> סנכרון</>} value="sync">
                            <div className="mb-4 flex justify-between items-center">
                                <Text h4>מצב סנכרון</Text>
                                <Button
                                    type="secondary"
                                    auto
                                    loading={syncStatus.syncing}
                                    onClick={async () => {
                                        setSyncStatus(prev => ({ ...prev, syncing: true }));
                                        try {
                                            await loadData();
                                        } finally {
                                            setSyncStatus(prev => ({ ...prev, syncing: false }));
                                        }
                                    }}
                                >
                                    {syncStatus.syncing ? 'מסנכרן...' : 'סנכרן עכשיו'}
                                </Button>
                            </div>

                            <Grid.Container gap={2}>
                                {Object.entries(syncStatus).filter(([key]) => key !== 'syncing').map(([table, data]) => {
                                    const hasDiff = data.cloudCount !== undefined && data.count !== data.cloudCount;
                                    return (
                                        <Grid xs={24} sm={12} md={8} key={table}>
                                            <Card width="100%">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <Text h5>{table}</Text>
                                                        <Text small type="secondary">
                                                            מקומי: {data.count} | ענן: {data.cloudCount || '...'}
                                                        </Text>
                                                    </div>
                                                    {hasDiff && (
                                                        <Badge type="warning">
                                                            הבדל: {Math.abs(data.count - data.cloudCount)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </Grid.Container>
                        </Tabs.Item>

                        <Tabs.Item label={<><Wifi size={16} /> מהירות</>} value="speed">
                            <Card>
                                <Text h4>בדיקת מהירות אינטרנט</Text>
                                <Spacer />
                                {!speedTest ? (
                                    <Button onClick={runSpeedTest}>הרץ בדיקה</Button>
                                ) : speedTest.testing ? (
                                    <Loading>בודק...</Loading>
                                ) : speedTest.error ? (
                                    <Text type="error">שגיאה בבדיקה</Text>
                                ) : (
                                    <div>
                                        <Text>Ping: {speedTest.ping}ms</Text>
                                        <Text>מהירות הורדה: ~{speedTest.downloadSpeed} KB/s</Text>
                                        <Badge type={speedTest.status === 'excellent' ? 'success' : 'warning'}>
                                            {speedTest.status}
                                        </Badge>
                                    </div>
                                )}
                            </Card>
                        </Tabs.Item>
                    </Tabs>
                </div>
            </div>
        </GeistProvider>
    );
};

export default DexieAdminPanel;
