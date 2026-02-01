// IMMEDIATE LOG - If you don't see this, JavaScript is blocked!
console.log('');
console.log('██████████████████████████████████████████████████');
console.log('🚀 KDS SCRIPT LOADED!');
console.log('If you see this, JavaScript is working!');
console.log('██████████████████████████████████████████████████');
console.log('');

// Configuration
const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
// 🌐 Dynamic Config from URL
const urlParams = new URLSearchParams(window.location.search);
const BUSINESS_ID = localStorage.getItem('businessId') || localStorage.getItem('business_id') || '22222222-2222-2222-2222-222222222222';
const STATION_KEY = 'kds_selected_station';
const ACTIVE_ORDER_STATUSES = ['pending', 'in_progress'];
const ACTIVE_ITEM_STATUSES = ['new', 'in_progress'];
let currentStation = urlParams.get('station') || localStorage.getItem('kds_station') || 'ALL';
let debugMode = urlParams.get('debug') || localStorage.getItem('kds_debug_mode') || 'in_progress';

console.log('✅ Configuration loaded');
console.log('→ Business ID:', BUSINESS_ID);
console.log('→ Station:', currentStation);

let supabaseClient = null;
let ordersData = [];
let updateInterval = null;
let realtimeChannel = null;
let wakeLock = null;
let selectedOrderIndex = -1; // Track selected order for keyboard navigation

// Icon mapping
const iconMap = {
    'קפה': '☕', 'קפוצ\'ינו': '☕', 'אספרסו': '☕', 'לאטה': '☕',
    'coffee': '☕', 'cappuccino': '☕', 'espresso': '☕', 'latte': '☕',
    'תה': '🫖', 'tea': '🫖',
    'מיץ': '🧃', 'מיץ תפוזים': '🧃', 'juice': '🧃', 'orange': '🧃',
    'לימונדה': '🥤', 'קולה': '🥤', 'soda': '🥤',
    'שייק': '🥛', 'smoothie': '🥤',
    'עוגה': '🍰', 'cake': '🍰', 'עוגיות': '🍪',
    'קרואסון': '🥐', 'מאפה': '🥐', 'croissant': '🥐',
    'סנדוויץ': '🥪', 'sandwich': '🥪',
    'סלט': '🥗', 'salad': '🥗',
    'פיצה': '🍕', 'pizza': '🍕',
    'המבורגר': '🍔', 'burger': '🍔',
    'צ\'יפס': '🍟', 'fries': '🍟',
    'שקשוקה': '🍳', 'ביצים': '🍳',
    'פלאפל': '🧆', 'חומוס': '🫘', 'שווארמה': '🌯'
};

function getIcon(name) {
    if (!name) return '🍽️';
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
        if (lower.includes(key.toLowerCase())) {
            return icon;
        }
    }
    return '🍽️';
}

function formatTime(created) {
    const now = new Date();
    const createdDate = new Date(created);
    const diff = Math.floor((now - createdDate) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getStatusText(status) {
    const map = {
        'new': 'חדש',
        'in_progress': 'בהכנה',
        'held': 'מוחזק',
        'ready': 'מוכן'
    };
    return map[status] || status;
}

function getCourseText(course) {
    if (!course) return '';
    const map = {
        'appetizer': 'ראשונה',
        'main': 'עיקרית',
        'dessert': 'קינוח',
        'drink': 'משקה'
    };
    return map[course] || course;
}

function getStationIcon(station) {
    const map = {
        'ALL': '🌐',
        'Bar': '🍸',
        'Kitchen': '🍳',
        'Desserts': '🍰',
        'Pass': '📋'
    };
    return map[station] || '📍';
}

function getStationName(station) {
    const map = {
        'ALL': 'כל התחנות',
        'Bar': 'בר',
        'Kitchen': 'מטבח',
        'Desserts': 'קינוחים',
        'Pass': 'פאס'
    };
    return map[station] || station;
}

// Keyboard Navigation
function highlightSelectedOrder() {
    // Remove previous highlights
    document.querySelectorAll('.order-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add highlight to selected order
    if (selectedOrderIndex >= 0 && selectedOrderIndex < ordersData.length) {
        const cards = document.querySelectorAll('.order-card');
        if (cards[selectedOrderIndex]) {
            cards[selectedOrderIndex].classList.add('selected');
            cards[selectedOrderIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
}

// Setup keyboard navigation
document.addEventListener('keydown', (e) => {
    if (ordersData.length === 0) return;

    if (e.key === 'ArrowLeft') {  // ◀️ חץ שמאלה = הזמנה הבאה (ימינה)
        e.preventDefault();
        // Move to next order (RIGHT)
        selectedOrderIndex = (selectedOrderIndex + 1) % ordersData.length;
        highlightSelectedOrder();
        console.log('◀️ Selected order:', selectedOrderIndex + 1, '/', ordersData.length);
    } else if (e.key === 'ArrowRight') {  // ▶️ חץ ימינה = הזמנה קודמת (שמאלה)
        e.preventDefault();
        // Move to previous order (LEFT)
        selectedOrderIndex = selectedOrderIndex <= 0
            ? ordersData.length - 1
            : selectedOrderIndex - 1;
        highlightSelectedOrder();
        console.log('▶️ Selected order:', selectedOrderIndex + 1, '/', ordersData.length);
    }
});

async function init() {
    try {
        console.log('');
        console.log('🚀 INIT START');
        console.log('→ URL:', SUPABASE_URL);
        console.log('→ Key length:', SUPABASE_ANON_KEY.length, 'chars');
        console.log('→ Business ID:', BUSINESS_ID);
        console.log('→ Station:', currentStation);
        console.log('→ Debug Mode:', debugMode);

        // Create client
        console.log('→ Creating Supabase client...');
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client created');

        // Update UI
        console.log('→ Updating UI...');
        document.getElementById('stationName').textContent =
            `${getStationIcon(currentStation)} ${getStationName(currentStation)}`;
        document.getElementById('stationSelect').value = currentStation;
        document.getElementById('businessSelect').value = BUSINESS_ID;
        document.getElementById('debugModeSelect').value = debugMode;
        console.log('✅ UI updated');

        // Request wake lock
        console.log('→ Requesting wake lock...');
        await requestWakeLock();
        console.log('✅ Wake lock handled');

        // Load orders
        console.log('→ Loading orders...');
        await loadOrders();

        // Auto refresh (fallback) - Start with 5s
        console.log('→ Setting up auto-refresh (Initial 5s)...');
        updateInterval = setInterval(loadOrders, 5000);

        // Setup realtime (this will reduce polling to 60s once active)
        console.log('→ Setting up real-time...');
        setupRealtime();
        console.log('✅ Real-time setup');

        console.log('🚀 INIT END (success)');
        console.log('');

        // Hide splash screen after initialization
        setTimeout(hideSplash, 1500);

    } catch (error) {
        console.error('');
        console.error('❌ INIT ERROR:');
        console.error('→ Error:', error);
        console.error('→ Message:', error.message);
        console.error('');
        document.getElementById('status').textContent = '❌ שגיאה: ' + error.message;
    }
}

async function loadOrders() {
    try {
        console.log('═══════════════════════════════════════');
        console.log('🔄 Loading orders (Robust Filter) - START');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log('📍 Date >=', today.toISOString());
        console.log('📍 Business:', BUSINESS_ID);
        console.log('📍 Station:', currentStation);
        console.log('═══════════════════════════════════════');

        // Step 1: Optimized query with inner joins
        // 1. Order status can be 'pending' or 'in_progress'
        // 2. Order date must be from today (or last 24h)
        // 3. Item status must be 'new' or 'in_progress'
        const { data: items, error: itemsError } = await supabaseClient
            .from('order_items')
            .select(`
                *,
                menu_item:menu_items!inner(id, name, kds_station, production_area, is_prep_required, kds_routing_logic),
                order:orders!inner(id, order_number, customer_name, customer_phone, order_status, created_at)
            `)
            .eq('business_id', BUSINESS_ID)
            .in('item_status', ACTIVE_ITEM_STATUSES)
            .in('orders.order_status', ACTIVE_ORDER_STATUSES)
            .gte('orders.created_at', today.toISOString())
            .order('created_at', { ascending: true });

        if (itemsError) throw itemsError;

        if (!items || items.length === 0) {
            ordersData = [];
            render();
            document.getElementById('status').textContent = `ℹ️ אין הזמנות פעילות להיום`;
            return;
        }

        // Step 2: Apply station & prep filtering in-memory
        const filteredItems = items.filter(item => {
            const menu = item.menu_item;

            // ❌ Skip if explicitly NOT requiring preparation (Grab & Go)
            if (menu.is_prep_required === false) return false;

            // 📍 If we have an explicit TRUE, we show it
            if (menu.is_prep_required === true) {
                // ... continue to station check
            } else {
                // 📍 Otherwise, check routing logic
                if (menu.kds_routing_logic === 'GRAB_AND_GO') return false;
                if (menu.kds_routing_logic === 'NEVER_SHOW') return false;
            }

            // 📍 Station filtering
            if (currentStation !== 'ALL') {
                const station = menu.kds_station || menu.production_area;
                if (station !== currentStation) return false;
            }

            return true;
        });

        // Step 3: Group filtered items by order
        const orderMap = {};
        filteredItems.forEach(item => {
            const order = item.order;
            if (!order) return;

            if (!orderMap[order.id]) {
                orderMap[order.id] = { ...order, items: [] };
            }
            orderMap[order.id].items.push({
                ...item,
                item_name: item.menu_item?.name || item.name || 'לא ידוע'
            });
        });

        ordersData = Object.values(orderMap);
        render();

        document.getElementById('status').textContent =
            `✅ ${ordersData.length} הזמנות • ${filteredItems.length} פריטים • ${getStationName(currentStation)} • Real-time`;

    } catch (error) {
        console.error('❌ Error in loadOrders:', error);
        document.getElementById('status').textContent = '❌ שגיאה: ' + (error.message || JSON.stringify(error));
    }
}

function setupRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel('kds-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'order_items',
            filter: `business_id=eq.${BUSINESS_ID}`
        }, (payload) => {
            console.log('⚡ Realtime update received');
            loadOrders();
        })
        .subscribe((status) => {
            console.log('→ Realtime status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Real-time active - Reducing polling rate');
                // Reduced polling for backup only
                if (updateInterval) clearInterval(updateInterval);
                updateInterval = setInterval(loadOrders, 60000);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.log('⚠️ Realtime disconnected - Increasing polling speed (fallback mode)');
                if (updateInterval) clearInterval(updateInterval);
                updateInterval = setInterval(loadOrders, 5000); // 5s fallback polling
            }
        });
}

function getOrderStatus(order) {
    const statuses = order.items.map(i => i.item_status);
    if (statuses.includes('held')) return 'held';
    if (statuses.includes('new')) return 'new';
    if (statuses.includes('in_progress')) return 'in_progress';
    if (statuses.includes('ready')) return 'ready';
    return 'new';
}

function render() {
    const container = document.getElementById('ordersContainer');
    const count = document.getElementById('orderCount');
    count.textContent = ordersData.length;

    if (ordersData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div>אין הזמנות בהכנה</div>
                <div style="font-size: 14px;">מחפש פריטים בסטטוס: in_progress</div>
                <div style="font-size: 14px;">ב-${getStationName(currentStation)}</div>
            </div>
        `;
        return;
    }

    // 🚀 Performance: Use DocumentFragment to prevent DOM Thrashing
    const fragment = document.createDocumentFragment();

    ordersData.forEach((order, idx) => {
        const cardClass = getOrderStatus(order);
        const card = document.createElement('div');
        card.className = `order-card ${cardClass}`;
        if (idx === selectedOrderIndex) card.classList.add('selected');

        card.innerHTML = `
            <div class="order-header">
                <div class="order-number">${order.order_number || '#' + order.id}</div>
                <div class="order-customer">${order.customer_name || order.customer_phone || 'אורח'}</div>
            </div>
            <div class="order-timer">⏱ ${formatTime(order.created_at)}</div>
            <div class="order-items">
                ${order.items.map(item => {
            const mods = parseMods(item.mods);
            return `
                        <div class="item">
                            <div class="item-icon">${getIcon(item.item_name)}</div>
                            <div class="item-name">${item.item_name}</div>
                            ${item.quantity > 1 ? `<div class="item-qty">✕ ${item.quantity}</div>` : ''}
                            ${mods.length > 0 ? `<div class="item-mods">🔹 ${mods.join(' • ')}</div>` : ''}
                            ${item.notes ? `<div class="item-mods">💬 ${item.notes}</div>` : ''}
                            ${item.course_stage ? `<div class="item-course">📍 ${getCourseText(item.course_stage)}</div>` : ''}
                            <div class="item-status">
                                <span class="status-badge ${item.item_status}">${getStatusText(item.item_status)}</span>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
        fragment.appendChild(card);
    });

    container.innerHTML = ''; // Single clear
    container.appendChild(fragment); // Single injection

    if (selectedOrderIndex >= ordersData.length) {
        selectedOrderIndex = ordersData.length > 0 ? 0 : -1;
    }

    if (selectedOrderIndex >= 0 && selectedOrderIndex < ordersData.length) {
        setTimeout(highlightSelectedOrder, 10);
    }
    renderSummary();
}

function renderSummary() {
    const summaryGrid = document.getElementById('summaryGrid');
    if (!summaryGrid) return;

    if (ordersData.length === 0) {
        summaryGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #00AA00; padding: 20px;">אין הזמנות פעילות</div>
        `;
        return;
    }

    const itemsMap = {};
    ordersData.forEach(order => {
        order.items.forEach(item => {
            const key = item.item_name;
            const qty = item.quantity || 1;
            if (!itemsMap[key]) {
                itemsMap[key] = { name: key, quantity: 0, count: 0, icon: getIcon(key) };
            }
            itemsMap[key].quantity += qty;
            itemsMap[key].count += 1;
        });
    });

    const itemsArray = Object.values(itemsMap).sort((a, b) => b.quantity - a.quantity);
    summaryGrid.innerHTML = itemsArray.map(item => `
        <div class="summary-item">
            <div class="summary-item-icon">${item.icon}</div>
            <div class="summary-item-info">
                <div class="summary-item-name">${item.name}</div>
                <div class="summary-item-count">${item.count} הזמנות</div>
            </div>
            <div class="summary-item-qty">×${item.quantity}</div>
        </div>
    `).join('');
}

function parseMods(mods) {
    if (!mods) return [];
    try {
        let parsed = typeof mods === 'string' ? JSON.parse(mods) : mods;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(m => !String(m).includes('__KDS_OVERRIDE__'))
            .map(m => String(m).trim())
            .filter(m => m.length > 0);
    } catch (e) {
        return [];
    }
}

function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

function saveSettings() {
    currentStation = document.getElementById('stationSelect').value;
    BUSINESS_ID = document.getElementById('businessSelect').value;
    debugMode = document.getElementById('debugModeSelect').value;

    localStorage.setItem('kds_station', currentStation);
    localStorage.setItem('kds_business_id', BUSINESS_ID);
    localStorage.setItem('kds_debug_mode', debugMode);

    document.getElementById('stationName').textContent =
        `${getStationIcon(currentStation)} ${getStationName(currentStation)}`;

    closeSettings();
    loadOrders();
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log('Wake Lock error:', err);
    }
}

function hideSplash() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.classList.add('hidden');
        console.log('✨ Splash screen dismissed');
    }
}

window.addEventListener('load', init);
window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    if (wakeLock) wakeLock.release();
});
