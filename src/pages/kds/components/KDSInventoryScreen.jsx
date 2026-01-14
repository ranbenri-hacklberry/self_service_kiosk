import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Search, Truck, Plus, X, ArrowRight, Package, Save, Check, RefreshCw, ChevronLeft, ChevronRight, Trash2, Edit2, AlertTriangle, ChevronDown, ChevronUp, Clock, House, Camera, Upload, ScanLine } from 'lucide-react';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import ConnectionStatusBar from '../../../components/ConnectionStatusBar';
import BusinessInfoBar from '../../../components/BusinessInfoBar';
import MiniMusicPlayer from '../../../components/music/MiniMusicPlayer';
import TripleCheckCard from '../../../components/manager/TripleCheckCard';
import { useInvoiceOCR } from '@/hooks/useInvoiceOCR';

/**
 * KDS Inventory Screen - Redesigned Layout
 * 3-Column Layout:
 * - Right (1/3): Suppliers List
 * - Left (2/3): Items Grid (2 columns)
 */

// Helper: Levenshtein Distance for fuzzy string matching
const levenshteinDistance = (str1, str2) => {
    const m = str1.length, n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = str1[i - 1] === str2[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
};

// Scanning Animation with Pixar-style warehouse clerk images
const SCANNING_STEPS = [
    { title: 'מעלה תמונה...', subtitle: 'מכין את הקובץ לעיבוד', image: '/clerk_1.png' },
    { title: 'מנתח חשבונית...', subtitle: 'AI סורק את המסמך', image: '/clerk_2.png' },
    { title: 'מזהה פריטים...', subtitle: 'מחפש שמות מוצרים', image: '/clerk_3.png' },
    { title: 'בודק כמויות...', subtitle: 'מתאים יחידות מידה', image: '/clerk_4.png' },
    { title: 'מביא את החשבונית!', subtitle: 'עוד שנייה...', video: '/doginvoice.mp4' },
];

const ScanningAnimation = ({ isDataReady, onComplete }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [localProgress, setLocalProgress] = useState(0);
    const [hasReached95, setHasReached95] = useState(false);

    const STEP_DURATION = 3500; // Slightly faster steps for better UX
    const STEPS_COUNT = SCANNING_STEPS.length;

    useEffect(() => {
        const startTime = Date.now();
        const duration = STEP_DURATION * STEPS_COUNT;

        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;

            let currentProgress = 0;
            const eightyPercentTime = STEP_DURATION * 4;

            if (elapsed < eightyPercentTime) {
                currentProgress = (elapsed / eightyPercentTime) * 80;
                setStepIndex(Math.floor(elapsed / STEP_DURATION));
            } else if (elapsed < duration) {
                currentProgress = 80 + ((elapsed - eightyPercentTime) / STEP_DURATION) * 15;
                setStepIndex(STEPS_COUNT - 1);
            } else {
                currentProgress = 95;
                setStepIndex(STEPS_COUNT - 1);
                setHasReached95(true);
            }

            setLocalProgress(prev => Math.max(prev, currentProgress));
        }, 50);

        return () => clearInterval(timer);
    }, [STEPS_COUNT]);

    useEffect(() => {
        if (hasReached95 && isDataReady) {
            const start = localProgress;
            const startTime = Date.now();
            const finishTimer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const p = Math.min(1, elapsed / 600);
                const nextProgress = start + (100 - start) * p;
                setLocalProgress(nextProgress);

                if (p >= 1) {
                    clearInterval(finishTimer);
                    setTimeout(onComplete, 300);
                }
            }, 30);
            return () => clearInterval(finishTimer);
        }
    }, [hasReached95, isDataReady, onComplete, localProgress]);

    const currentStep = SCANNING_STEPS[stepIndex];

    return (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-50/50">
            {/* Main Visual Container */}
            <div className="relative mb-12">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full animate-pulse" />

                <AnimatePresence mode="wait">
                    <motion.div
                        key={stepIndex}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="relative z-10"
                    >
                        <div className="w-64 h-64 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-4 border-white flex items-center justify-center p-6 bg-gradient-to-b from-white to-slate-50">
                            <motion.div
                                className="text-7xl"
                                animate={{
                                    y: [0, -20, 0],
                                    rotate: [0, 5, -5, 0]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            >
                                {currentStep.title.includes('חשבונית') ? '📜' :
                                    currentStep.title.includes('פריטים') ? '📦' :
                                        currentStep.title.includes('שמות') ? '🔍' :
                                            currentStep.title.includes('מחירים') ? '💰' : '✨'}
                            </motion.div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Content Section */}
            <div className="w-full max-w-sm text-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={stepIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mb-6"
                    >
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{currentStep.title}</h3>
                        <p className="text-slate-400 font-medium mt-1">אנחנו מעבדים את הנתונים שלך...</p>
                    </motion.div>
                </AnimatePresence>

                {/* Progress Bar Container */}
                <div className="space-y-3">
                    <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner p-1">
                        <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full shadow-lg"
                            initial={{ width: 0 }}
                            animate={{ width: `${localProgress}%` }}
                            transition={{ duration: 0.2 }}
                        />
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-black text-slate-400">PROGRESS</span>
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">{Math.round(localProgress)}%</span>
                    </div>
                </div>

                {/* Status Dots */}
                <div className="flex justify-center gap-2.5 mt-8">
                    {SCANNING_STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-2 rounded-full transition-all duration-500 ${i === stepIndex ? 'w-8 bg-indigo-500' :
                                i < stepIndex ? 'w-2 bg-indigo-200' : 'w-2 bg-slate-200'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};


const KDSInventoryScreen = ({ onExit }) => {
    const { currentUser } = useAuth();
    // Tabs: 'counts' | 'incoming'
    const [activeTab, setActiveTab] = useState('counts');

    const [selectedSupplierId, setSelectedSupplierId] = useState(null);
    const [items, setItems] = useState([]); // inventory_items
    const [globalCatalog, setGlobalCatalog] = useState([]); // Master catalog_items
    const [supplierCatalog, setSupplierCatalog] = useState([]); // catalog_item_suppliers mapping
    const [suppliers, setSuppliers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Incoming Orders State
    const [incomingOrders, setIncomingOrders] = useState([]);

    // Stock Updates State: { [itemId]: newQuantity }
    const [stockUpdates, setStockUpdates] = useState({});
    const [saving, setSaving] = useState(false);

    // Incoming Order Logic State
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [receiptDrafts, setReceiptDrafts] = useState({}); // { [orderId]: { [itemId]: { qty: number, status: 'received'|'missing'|'backorder' } } }
    const [expandedItems, setExpandedItems] = useState({}); // { [itemId]: boolean }

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'info',
        confirmText: 'אישור',
        cancelText: 'ביטול'
    });

    // 🆕 Scanner Modal State
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [scannerStep, setScannerStep] = useState('choose'); // 'choose' | 'scanning' | 'results'
    const [successMessage, setSuccessMessage] = useState(null); // { title: string, message: string }

    // ⚙️ Invoice OCR Hook
    const { scanInvoice, isProcessing: isScanning, error: scanError, ocrResult, imagePreview, resetOCR } = useInvoiceOCR();
    const [uiScanning, setUiScanning] = useState(false);

    // Sync uiScanning with isScanning but let it finish gracefully
    useEffect(() => {
        if (isScanning) {
            setUiScanning(true);
        }
    }, [isScanning]);

    // 🆕 Triple-Check Receiving Session
    const [receivingSession, setReceivingSession] = useState(() => {
        // Restore from localStorage on mount
        try {
            const saved = localStorage.getItem('receivingSession');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only restore if it's for the same business
                if (parsed && parsed.businessId === currentUser?.business_id) {
                    // Clean "מארז" from units in restored session
                    if (parsed.items) {
                        parsed.items = parsed.items.map(item => ({
                            ...item,
                            unit: (item.unit || '').replace(/מארז/g, 'חבילה').replace(/יח׳|יחידה|יח['׳]?/g, '').replace(/['׳]$/g, '').trim()
                        }));
                    }
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Error restoring receiving session:', e);
        }
        return null;
    });
    const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
    const [showFullscreenInvoice, setShowFullscreenInvoice] = useState(false);

    // Save receivingSession to localStorage whenever it changes
    useEffect(() => {
        if (receivingSession) {
            try {
                localStorage.setItem('receivingSession', JSON.stringify({
                    ...receivingSession,
                    businessId: currentUser?.business_id
                }));
            } catch (e) {
                console.error('Error saving receiving session:', e);
            }
        } else {
            localStorage.removeItem('receivingSession');
        }
    }, [receivingSession, currentUser?.business_id]);

    // Helper to init draft when selecting an order
    useEffect(() => {
        if (selectedOrderId) {
            const order = incomingOrders.find(o => o.id === selectedOrderId);
            if (order && !receiptDrafts[order.id]) {
                const draft = {};
                order.items.forEach(item => {
                    // Default: Received = Ordered Qty
                    draft[item.inventory_item_id || item.name] = {
                        qty: item.qty,
                        status: 'received',
                        originalQty: item.qty,
                        name: item.name,
                        unit: item.unit,
                        itemId: item.inventory_item_id
                    };
                });
                setReceiptDrafts(prev => ({ ...prev, [order.id]: draft }));
            }
        }
    }, [selectedOrderId, incomingOrders]);

    const handleReceiptChange = (orderId, itemId, field, value) => {
        setReceiptDrafts(prev => ({
            ...prev,
            [orderId]: {
                ...prev[orderId],
                [itemId]: { ...prev[orderId][itemId], [field]: value }
            }
        }));
    };

    const promptProcessReceipt = (orderId, actionType) => {
        const isSplit = actionType === 'split';
        setConfirmModal({
            isOpen: true,
            title: isSplit ? 'אישור קבלה חלקית' : 'אישור קבלת סחורה',
            message: isSplit
                ? 'האם אתה בטוח שברצונך לאשר את הפריטים שהתקבלו וליצור הזמנה חדשה (Backorder) עבור הפריטים החסרים?'
                : 'האם אתה בטוח שברצונך לאשר את קבלת הסחורה ולסגור את ההזמנה?',
            variant: isSplit ? 'warning' : 'success',
            confirmText: isSplit ? 'אשר וצור הזמנה' : 'אשר קבלה',
            onConfirm: () => executeProcessReceipt(orderId, actionType)
        });
    };

    const executeProcessReceipt = async (orderId, actionType = 'complete') => {
        // actionType: 'complete' (finish all), 'split' (create backorder for missing)
        const draft = receiptDrafts[orderId];
        if (!draft) return;

        setSaving(true);
        try {
            // 1. Update Inventory for Received Items
            const updates = [];
            const timestamp = new Date();

            Object.values(draft).forEach(itemData => {
                if (itemData.status === 'received' && itemData.qty > 0 && itemData.itemId) {
                    // FIX: Multiply by package size (weight_per_unit) to update inventory in base units
                    const item = items.find(i => i.id === itemData.itemId);
                    let multiplier = 1;
                    if (item) {
                        if (item.weight_per_unit > 0) {
                            multiplier = item.weight_per_unit;
                        } else if (['גרם', 'מ״ל', 'מ"ל'].includes(item.unit)) {
                            multiplier = 1000; // Default factor for weight/volume if not explicit
                        }
                    }

                    const actualQtyToAdd = itemData.qty * multiplier;
                    updates.push(supabase.rpc('increment_stock', { p_item_id: itemData.itemId, p_delta: actualQtyToAdd }));
                }
            });

            await Promise.all(updates);

            // 2. Handle Order Logic
            if (actionType === 'split') {
                // Determine missing items
                const missingItems = [];
                Object.values(draft).forEach(item => {
                    const remaining = item.originalQty - (item.status === 'received' ? item.qty : 0);
                    if (remaining > 0) {
                        missingItems.push({
                            inventory_item_id: item.itemId,
                            quantity: remaining
                        });
                    }
                });

                if (missingItems.length > 0) {
                    // Create Backorder
                    // We need supplier_id. Try to find it from the items cache
                    const sampleItemId = missingItems[0]?.inventory_item_id;
                    const foundItem = items.find(i => i.id === sampleItemId);
                    const supplierId = foundItem?.supplier_id || null;

                    const { data: newOrder, error: boError } = await supabase
                        .rpc('create_supplier_order', {
                            p_business_id: currentUser.business_id,
                            p_supplier_id: supplierId,
                            p_items: missingItems.map(m => ({ itemId: m.inventory_item_id, qty: m.quantity }))
                        });

                    if (boError) console.error('Backorder creation failed', boError);
                }
            }

            // 3. Close Original Order
            const { error: closeError } = await supabase.rpc('close_supplier_order', { p_order_id: orderId });

            if (closeError) throw closeError;

            // 4. Cleanup
            setReceiptDrafts(prev => { const n = { ...prev }; delete n[orderId]; return n; });
            fetchIncomingOrders(); // Refresh list
            setSelectedOrderId(null);
            setSuccessMessage({
                title: 'הקבלה אושרה!',
                message: 'המלאי עודכן וההזמנה נסגרה בהצלחה.'
            });

        } catch (err) {
            console.error('Receipt processing failed:', err);
            setConfirmModal({
                isOpen: true,
                title: 'שגיאה',
                message: 'אירעה שגיאה בעיבוד הקבלה. אנא נסה שנית.',
                variant: 'danger',
                confirmText: 'סגור',
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setSaving(false);
        }
    };

    const promptDeleteOrder = (orderId) => {
        setConfirmModal({
            isOpen: true,
            title: 'מחיקת הזמנה',
            message: 'האם אתה בטוח שברצונך למחוק את ההזמנה לצמיתות? פעולה זו אינה הפיכה.',
            variant: 'danger',
            confirmText: 'מחק הזמנה',
            onConfirm: () => executeDeleteOrder(orderId)
        });
    };

    const executeDeleteOrder = async (orderId) => {
        try {
            const { error } = await supabase.rpc('delete_supplier_order', { p_order_id: orderId });
            if (error) throw error;

            setIncomingOrders(prev => prev.filter(o => o.id !== orderId));
            if (selectedOrderId === orderId) setSelectedOrderId(null);
        } catch (e) {
            console.error(e);
            alert("שגיאה במחיקת ההזמנה");
        }
    };

    const fetchData = useCallback(async () => {
        if (!currentUser?.business_id) return;
        setLoading(true);
        try {
            const { data: suppliersData, error: supError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('business_id', currentUser.business_id)  // CRITICAL: Filter by business
                .order('name');

            if (supError) throw supError;
            setSuppliers(suppliersData || []);

            const { data: itemsData, error: itemError } = await supabase
                .from('inventory_items')
                .select(`*, supplier:suppliers(*)`)
                .eq('business_id', currentUser.business_id)
                .order('name')
                .range(0, 2000);

            if (itemError) throw itemError;
            setItems(itemsData || []);

            // 3. Fetch Global Catalog
            console.log('Fetching global catalog...');
            const { data: catalogData, error: catalogError } = await supabase
                .from('catalog_items')
                .select('*')
                .order('name');

            if (catalogError) {
                console.error('Failed to fetch global catalog:', catalogError);
            } else {
                console.log(`Successfully fetched ${catalogData?.length || 0} catalog items`);
                setGlobalCatalog(catalogData || []);
            }

            // 4. Fetch supplier catalog mappings (supplier_name -> catalog_item_id)
            const { data: supplierCatalogData, error: scError } = await supabase
                .from('catalog_item_suppliers')
                .select('catalog_item_id, supplier_name, occurrence_count')
                .order('occurrence_count', { ascending: false });

            if (!scError && supplierCatalogData) {
                setSupplierCatalog(supplierCatalogData);
            }
        } catch (err) {
            console.error('Error fetching inventory:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.business_id]);

    const fetchIncomingOrders = useCallback(async () => {
        if (!currentUser?.business_id) return;
        try {
            const { data, error } = await supabase
                .rpc('get_my_supplier_orders', { p_business_id: currentUser.business_id });

            if (error) throw error;

            const formatted = (data || []).map(order => ({
                id: order.id,
                created_at: order.created_at,
                supplier_name: order.supplier_name || 'ספק כללי',
                items: order.items || []
            }));
            setIncomingOrders(formatted);
        } catch (e) {
            console.error('Error fetching incoming orders (KDS):', e);
        }
    }, [currentUser?.business_id]);

    // 🆕 Triple-Check Functions
    const initializeReceivingSession = useCallback((ocrData, orderId = null, supplierId = null, overrideImage = null) => {
        if (!ocrData?.items) return;

        const order = orderId ? incomingOrders.find(o => o.id === orderId) : null;
        const orderItems = order?.items || [];

        // Fuzzy matching helper - find best catalog match
        const findBestCatalogMatch = (invoiceName) => {
            const normalizedInvoiceName = invoiceName.toLowerCase().trim();

            // 0. PRIORITY CHECK: Match against existing inventory items' supplier_product_name
            // This is the "Learning" feature - if we saved this invoice name before, we match it instantly!
            const inventorySupplierNameMatch = items.find(i =>
                i.supplier_product_name && (
                    i.supplier_product_name.toLowerCase() === normalizedInvoiceName ||
                    (i.supplier_product_name.length > 3 && normalizedInvoiceName.includes(i.supplier_product_name.toLowerCase()))
                )
            );

            if (inventorySupplierNameMatch) {
                console.log(`🎯 Found direct inventory match by supplier name: ${invoiceName} -> ${inventorySupplierNameMatch.name}`);
                return { ...inventorySupplierNameMatch, inInventory: true };
            }

            // 1. FIRST CHECK: Look for exact match in supplier catalog mappings
            const supplierMatch = supplierCatalog.find(sc =>
                sc.supplier_name.toLowerCase() === normalizedInvoiceName ||
                normalizedInvoiceName.includes(sc.supplier_name.toLowerCase()) ||
                sc.supplier_name.toLowerCase().includes(normalizedInvoiceName)
            );

            if (supplierMatch) {
                const catalogItem = globalCatalog.find(item => item.id === supplierMatch.catalog_item_id);
                if (catalogItem) return catalogItem;
            }

            // 2. EXTRACTION: Find indicators of weight/volume in the invoice name
            // (e.g., "1 קילו", "500 גרם", "1l", "2kg")
            const weightMatch = normalizedInvoiceName.match(/(\d+(?:\.\d+)?)\s?(קילו|ק"ג|גרם|מל|ליטר|kg|gr|ml|lt|l)/i);
            const identifiedWeight = weightMatch ? {
                value: parseFloat(weightMatch[1]),
                unit: weightMatch[2].toLowerCase()
            } : null;

            // Convert identified weight to normalized "count step" if it's grams/kilos
            let normalizedWeightInGrams = null;
            if (identifiedWeight) {
                if (['קילו', 'ק"ג', 'kg'].includes(identifiedWeight.unit)) {
                    normalizedWeightInGrams = identifiedWeight.value * 1000;
                } else if (['גרם', 'gr'].includes(identifiedWeight.unit)) {
                    normalizedWeightInGrams = identifiedWeight.value;
                } else if (['ליטר', 'lt', 'l'].includes(identifiedWeight.unit)) {
                    normalizedWeightInGrams = identifiedWeight.value * 1000; // treating ml as equivalent to grams for matching
                } else if (['מל', 'ml'].includes(identifiedWeight.unit)) {
                    normalizedWeightInGrams = identifiedWeight.value;
                }
            }

            // 3. FALLBACK: Fuzzy matching with catalog items (Search both inventory and global catalog)
            // Combine items and global catalog, favoring already-in-inventory items
            const allPossibleItems = [
                ...items.map(i => ({ ...i, inInventory: true })),
                ...globalCatalog.filter(gc => !items.some(i => i.catalog_item_id === gc.id)).map(gc => ({ ...gc, inInventory: false }))
            ];

            const stopWords = ['קילו', 'ק"ג', 'גרם', 'ליטר', 'מל', 'יח', 'יחידות', 'חבילה', 'ארגז', 'גדולות', 'קטנות', 'מוסדי', 'קרטון', 'מקפיא', 'מחסן', 'מדף', 'קפוא', 'קפואה', 'טרי', 'טריה', 'סוג', 'א', 'ב', 'ג'];

            // CLEAN NAME: Focus on Hebrew tokens to bypass numeric codes and English noise
            const hebrewTokens = normalizedInvoiceName.match(/[\u0590-\u05FF]+/g) || [];
            const cleanName = hebrewTokens.filter(t => !stopWords.includes(t)).join(' ');

            // Fallback to original cleaning if no Hebrew found (unlikely but safe)
            if (hebrewTokens.length === 0) {
                cleanName = normalizedInvoiceName
                    .replace(/^[\d\-\.\/\|\*\#]+\s+/, '')
                    .replace(/[()\[\]{}]/g, ' ')
                    .replace(/\d+/g, '')
                    .trim();
            }

            const invoiceTokens = hebrewTokens.filter(t => t.length > 1 && !stopWords.includes(t.toLowerCase()));

            // Log for debugging (only if not found or low score initially) or just once per batch
            // console.log(`🔎 Matching for: "${normalizedInvoiceName}" (Clean: "${cleanName}") - Candidates: ${allPossibleItems.length}`);

            let bestMatch = null;
            let bestScore = 0;

            allPossibleItems.forEach(catalogItem => {
                const catalogName = catalogItem.name.toLowerCase().trim();
                let itemScore = 0;

                // Exact match check first
                if (catalogName === normalizedInvoiceName) {
                    itemScore = 100;
                } else if (normalizedInvoiceName.includes(catalogName)) {
                    // Check if catalog name is contained in invoice name
                    itemScore = (catalogName.length / normalizedInvoiceName.length) * 80;
                } else if (catalogName.includes(normalizedInvoiceName)) {
                    // Check if invoice name is contained in catalog name (e.g. "Mango" inside "Frozen Mango 1kg")
                    itemScore = (normalizedInvoiceName.length / catalogName.length) * 80;
                } else {
                    // Tokenize catalog name
                    const catalogTokens = catalogName.split(/[\s,.-]+/)
                        .filter(w => w.length > 1 && !stopWords.includes(w.toLowerCase()));

                    let matchingTokens = 0;
                    catalogTokens.forEach(catToken => {
                        if (invoiceTokens.some(invToken =>
                            invToken === catToken || invToken.includes(catToken) || catToken.includes(invToken)
                        )) {
                            matchingTokens++;
                        }
                    });

                    if (catalogTokens.length > 0 && matchingTokens > 0) {
                        // Base score on percentage of catalog tokens matched
                        const catalogCoverage = matchingTokens / catalogTokens.length;
                        // ALSO check percentage of invoice tokens matched (Crucial for "Mango" -> "Storage - Mango")
                        const invoiceCoverage = matchingTokens / invoiceTokens.length;

                        // Use the better coverage to help match
                        const bestCoverage = Math.max(catalogCoverage, invoiceCoverage);

                        itemScore = bestCoverage * 75;

                        // Boost if ALL invoice tokens are found in catalog (Strong indicator)
                        if (invoiceCoverage >= 1.0) {
                            itemScore += 20;
                        }
                    }
                }

                // WEIGHT BONUS: If we identified a weight, and this item has a matching count step, give a big boost
                if (identifiedWeight && itemScore >= 30) {
                    const itemCountStep = parseFloat(catalogItem.inventory_count_step || 1);
                    if (normalizedWeightInGrams !== null && Math.abs(itemCountStep - normalizedWeightInGrams) < 1) {
                        itemScore += 30; // Big boost for matching weight
                    }
                }

                if (itemScore >= 35 && itemScore > bestScore) {
                    bestScore = itemScore;
                    bestMatch = catalogItem;
                }
            });

            return bestMatch;
        };

        const cleanUnit = (u) => {
            if (!u) return '';
            // Aggressively remove marks of 'יח׳', 'יח', 'יח'', or solo apostrophes
            let cleaned = (u || '').replace(/מארז/g, 'חבילה').replace(/יח׳|יחידה|יח['׳]?/g, '').replace(/['׳]$/g, '').trim();
            if (cleaned === 'חבילה') return '';
            return cleaned;
        };

        const sessionItems = ocrData.items.map(ocrItem => {
            const name = ocrItem.name || ocrItem.description || 'פריט ללא שם';
            const invoicedQty = parseFloat(ocrItem.quantity || ocrItem.amount || 0);
            const unitPrice = parseFloat(ocrItem.price || ocrItem.cost_per_unit || 0);

            // Try to match with catalog using fuzzy matching
            const matchedItem = findBestCatalogMatch(name); // Returns item object (Inventory or Global)

            // ROBUST DETECTION: Check if it's really an inventory item
            // Inventory IDs are Integers (e.g. 118574), Global IDs are UUIDs (e.g. "a0e...")
            const isRealInventoryItem = matchedItem && (
                matchedItem.inInventory === true ||
                Number.isInteger(matchedItem.id) ||
                (typeof matchedItem.id === 'string' && /^\d+$/.test(matchedItem.id))
            );

            // Try to match with order items
            const matchedOrderItem = orderItems.find(oi =>
                oi.inventory_item_id === matchedItem?.id ||
                oi.name.toLowerCase() === name.toLowerCase() ||
                oi.name.includes(name) ||
                name.includes(oi.name)
            );

            const inventoryItemId = isRealInventoryItem ? matchedItem.id : (matchedOrderItem?.inventory_item_id || matchedItem?.inventory_item_id || null);

            // ALWAYS prefer catalog_item_id (UUID)
            // If it's an inventory item, use its catalog_item_id field.
            // If it's a global catalog item (isRealInventoryItem = false), then ITS OWN id is the catalog_item_id.
            const catalogItemId = matchedItem?.catalog_item_id || (!isRealInventoryItem ? matchedItem?.id : null) || matchedOrderItem?.catalog_item_id || null;

            return {
                id: ocrItem.id || `temp-${Date.now()}-${Math.random()}`,
                name,
                unit: cleanUnit(ocrItem.unit || matchedItem?.unit || matchedOrderItem?.unit || 'יח׳'),
                invoicedQty,
                actualQty: invoicedQty,
                unitPrice,
                catalogPrice: matchedItem?.cost_per_unit || matchedItem?.default_cost_per_unit || matchedOrderItem?.unit_price || 0,
                countStep: matchedItem?.count_step || matchedItem?.inventory_count_step || matchedOrderItem?.count_step || 1,
                inventoryItemId,
                catalogItemId,
                catalogItemName: matchedItem?.name || matchedOrderItem?.name || null,
                isNew: !inventoryItemId && !catalogItemId,
                orderedQty: orderId ? (matchedOrderItem?.qty || 0) : null,
                matchType: matchedItem ? (isRealInventoryItem ? 'inventory' : 'catalog') : 'none'
            };
        });

        const missingItemsFromOrder = orderItems.filter(oi =>
            !sessionItems.some(si => si.inventoryItemId === oi.inventory_item_id)
        ).map(oi => ({
            id: `missing-${oi.inventory_item_id || oi.name}-${Date.now()}`,
            name: oi.name,
            unit: oi.unit || '',
            invoicedQty: 0,
            actualQty: 0,
            unitPrice: oi.unit_price || 0,
            catalogPrice: oi.unit_price || 0,
            countStep: oi.count_step || 1,
            inventoryItemId: oi.inventory_item_id,
            isNew: false,
            orderedQty: oi.qty,
            isMissingFromInvoice: true
        }));

        const finalItems = [...sessionItems, ...missingItemsFromOrder];
        const documentType = ocrData.document_type || ocrData.documentType || 'invoice';

        // Get supplier info - IMPROVED Fuzzy Matching for OCR errors
        let supplier = null;
        if (supplierId) {
            supplier = suppliers.find(s => s.id === supplierId);
        } else if (order?.supplier_id) {
            supplier = suppliers.find(s => s.id === order.supplier_id);
        } else if (ocrData.supplier_name) {
            // Fuzzy matching for supplier name (handles OCR errors like missing letters)
            const ocrName = ocrData.supplier_name.toLowerCase().trim();
            const ocrTokens = ocrName.split(/[\s,.-]+/).filter(t => t.length > 1);

            let bestMatch = null;
            let bestScore = 0;

            suppliers.forEach(s => {
                const supplierName = s.name.toLowerCase().trim();
                const supplierTokens = supplierName.split(/[\s,.-]+/).filter(t => t.length > 1);

                // Score 1: Direct include check
                if (supplierName.includes(ocrName) || ocrName.includes(supplierName)) {
                    if (supplierName.length > bestScore) {
                        bestScore = supplierName.length + 100; // High priority
                        bestMatch = s;
                    }
                    return;
                }

                // Score 2: Token matching (handles "ברכת הא מה" vs "ברכת האדמה")
                let matchingTokens = 0;
                supplierTokens.forEach(sToken => {
                    ocrTokens.forEach(oToken => {
                        // Check if tokens overlap significantly (at least 2 chars match)
                        if (sToken.includes(oToken) || oToken.includes(sToken) ||
                            (sToken.length >= 3 && oToken.length >= 3 &&
                                (sToken.slice(0, 3) === oToken.slice(0, 3) || // Same prefix
                                    levenshteinDistance(sToken, oToken) <= 2))) { // Small edit distance
                            matchingTokens++;
                        }
                    });
                });

                const score = (matchingTokens / Math.max(supplierTokens.length, 1)) * 100;
                if (score >= 40 && score > bestScore) { // At least 40% match
                    bestScore = score;
                    bestMatch = s;
                }
            });

            supplier = bestMatch;
            if (supplier) {
                console.log(`🔍 Fuzzy matched supplier: "${ocrData.supplier_name}" → "${supplier.name}" (score: ${bestScore.toFixed(0)})`);
            }
        }

        const finalSupplierId = supplierId || order?.supplier_id || supplier?.id;
        console.log('🏪 Supplier assignment:', {
            paramSupplierId: supplierId,
            orderSupplierId: order?.supplier_id,
            matchedSupplierId: supplier?.id,
            matchedSupplierName: supplier?.name,
            finalSupplierId,
            ocrSupplierName: ocrData.supplier_name
        });

        setReceivingSession({
            items: finalItems,
            orderId,
            supplierId: finalSupplierId,
            supplierName: supplier?.name || ocrData.supplier_name || order?.supplier_name || 'ספק לא מזוהה',
            supplierPhone: supplier?.phone || null,
            documentType,
            documentNumber: ocrData.invoice_number || ocrData.document_number || null,
            documentDate: ocrData.invoice_date || ocrData.document_date || new Date().toISOString(),
            totalInvoiced: parseFloat(ocrData.total_amount || sessionItems.reduce((sum, i) => sum + (i.invoicedQty * i.unitPrice), 0)),
            orderTotal: order?.total_amount || orderItems.reduce((sum, i) => sum + (i.qty * i.unit_price), 0),
            invoiceImage: overrideImage || imagePreview || null
        });
    }, [items, globalCatalog, incomingOrders, supplierCatalog, suppliers, imagePreview]);

    const updateActualQuantity = useCallback((itemId, newQty) => {
        setReceivingSession(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? { ...item, actualQty: newQty } : item
                )
            };
        });
    }, []);

    // Handler for when user manually selects a catalog item from suggestions
    const updateCatalogItemMapping = useCallback((itemId, selectedCatalogItem) => {
        setReceivingSession(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                items: prev.items.map(item => {
                    if (item.id !== itemId) return item;

                    if (!selectedCatalogItem) {
                        // Keep as new item
                        return {
                            ...item,
                            inventoryItemId: null,
                            catalogItemName: null,
                            catalogPrice: 0,
                            isNew: true,
                            matchType: 'new'
                        };
                    }

                    // Map to selected catalog item
                    return {
                        ...item,
                        inventoryItemId: selectedCatalogItem.inventory_item_id || null, // Might be null if only in global catalog
                        catalogItemId: selectedCatalogItem.id,
                        catalogItemName: selectedCatalogItem.name,
                        catalogPrice: selectedCatalogItem.cost_per_unit || selectedCatalogItem.default_cost_per_unit || 0,
                        countStep: selectedCatalogItem.count_step || selectedCatalogItem.inventory_count_step || 1,
                        unit: selectedCatalogItem.unit || item.unit,
                        isNew: false,
                        matchType: 'manual' // Mark as manually mapped
                    };
                })
            };
        });
    }, []);

    const confirmReceipt = async () => {
        if (!receivingSession || !currentUser?.business_id) return;

        setIsConfirmingReceipt(true);
        try {
            // 1. 🧬 AUTO-CREATE: If items are matched to catalog (have catalogItemId) but not in inventory yet, create them!
            const workingItems = [...receivingSession.items]; // Clone to modify locally

            // DEBUG LOGGING - Stringified for visibility
            console.log('🧐 DEBUG ITEMS BEFORE SAVE:', JSON.stringify(workingItems.map(i => ({
                name: i.name,
                invId: i.inventoryItemId,
                catId: i.catalogItemId,
                catName: i.catalogItemName,
                isNew: i.isNew
            })), null, 2));

            // 0. 🚑 ID RECOVERY: If inventoryItemId is missing but we have a catalogItemName that matches a real inventory item, recover the ID!
            workingItems.forEach(item => {
                // CRITICAL FIX: Do NOT try to recover ID if user explicitly mapped it manually or marked as new
                if (item.matchType === 'manual' || item.matchType === 'new') return;

                if (!item.inventoryItemId) {
                    // Method A: Try by catalogItemName (Standard link)
                    let foundInInventory = null;
                    if (item.catalogItemName) {
                        foundInInventory = items.find(i => i.name === item.catalogItemName);
                    }

                    // Method B: Try by original item name (Often "200..." matches exactly what's in DB)
                    if (!foundInInventory && item.name) {
                        foundInInventory = items.find(i => i.name === item.name);
                    }

                    // Method C: Ultra-Fuzzy Name Match (Strip all garbage)
                    if (!foundInInventory && item.name) {
                        const normalizeForIdRecovery = (str) => {
                            return (str || '')
                                .replace(/^[\u0590-\u05FF]{3,}\s?-?\s?\d+\s?-?\s?/, '') // Strip things like "מקפיא - 5 -"
                                .replace(/^[\d\-\.\/\|\*\#]+\s+/, '') // Strip leading codes
                                .replace(/[\s\-\*\"\'\(\)\[\]]/g, '')
                                .toLowerCase();
                        };
                        const searchNorm = normalizeForIdRecovery(item.name);

                        foundInInventory = items.find(i =>
                            normalizeForIdRecovery(i.name) === searchNorm ||
                            normalizeForIdRecovery(i.supplier_product_name) === searchNorm
                        );
                    }

                    if (foundInInventory) {
                        console.log(`🚑 Recovered Inventory ID for "${item.name}": ${foundInInventory.id}`);
                        item.inventoryItemId = foundInInventory.id;
                        item.isNew = false;
                    }
                }
            });

            const itemsToCreate = workingItems.filter(item => item.catalogItemId && !item.inventoryItemId);

            if (itemsToCreate.length > 0) {
                console.log(`🔨 Creating ${itemsToCreate.length} missing inventory items from catalog matches...`);

                // Create them one by one (or Promise.all)
                await Promise.all(itemsToCreate.map(async (item) => {
                    try {
                        let validCatalogId = item.catalogItemId;

                        // DATA SANITIZATION: Validate UUID format
                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                        if (!uuidRegex.test(validCatalogId)) {
                            console.warn(`⚠️ Invalid UUID for creation: ${validCatalogId}. Trying to find real UUID from global catalog...`);
                            // Try to find correct UUID from globalCatalog cache
                            let realCatalogItem = globalCatalog.find(gc =>
                                gc.id === validCatalogId ||
                                gc.name === item.catalogItemName ||
                                gc.name === item.name ||
                                item.name.includes(gc.name)
                            );

                            // If not in cache, try fetching from DB directly!
                            if (!realCatalogItem) {
                                console.log(`🕵️ Not in cache, searching DB for catalog item: "${item.catalogItemName || item.name}"...`);
                                // Clean name for DB lookup (remove everything except Hebrew)
                                const searchName = (item.catalogItemName || item.name).match(/[\u0590-\u05FF]+/g)?.join(' ') || item.name;
                                const { data: dbItem } = await supabase
                                    .from('catalog_items')
                                    .select('id, name')
                                    .or(`name.eq."${item.catalogItemName}",name.eq."${item.name}",name.ilike."%${searchName}%"`)
                                    .limit(1)
                                    .maybeSingle();

                                if (dbItem) realCatalogItem = dbItem;
                            }

                            if (realCatalogItem && realCatalogItem.id) {
                                validCatalogId = realCatalogItem.id;
                                console.log(`✅ Found valid UUID locally/remotely for ${item.name}: ${validCatalogId}`);
                            } else {
                                console.error(`❌ Could not find valid UUID for ${item.name} in global catalog. Skipping creation.`);
                                return;
                            }
                        }

                        // Robust handling for supplierId (Check if it's a valid UUID)
                        let preparedSupplierId = receivingSession.supplierId;
                        const validUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                        const isSupplierUuid = (str) => typeof str === 'string' && validUuidRegex.test(str);

                        const supplierIdToPass = isSupplierUuid(preparedSupplierId) ? preparedSupplierId : null;

                        console.log(`🛠️ Creating Item RPC Params:`, {
                            name: item.catalogItemName || item.name,
                            catalogId: validCatalogId,
                            supplierIdSource: preparedSupplierId,
                            supplierIdFinal: supplierIdToPass
                        });

                        // Use RPC to bypass RLS restrictions
                        const { data: newItemId, error } = await supabase
                            .rpc('create_missing_inventory_item', {
                                p_business_id: currentUser.business_id,
                                p_catalog_item_id: validCatalogId,
                                p_name: item.catalogItemName || item.name,
                                p_unit: item.unit || 'יח׳',
                                p_cost_per_unit: item.catalogPrice || 0,
                                p_supplier_id: supplierIdToPass
                            });

                        if (error) throw error;

                        if (newItemId) {
                            console.log(`✅ Created inventory item for "${item.name}" -> ID: ${newItemId}`);
                            item.inventoryItemId = newItemId;
                            item.isNew = false;
                        }
                    } catch (err) {
                        console.error(`❌ Failed to create inventory item for ${item.name}:`, err);
                    }
                }));
            }

            // 2. Filter valid items (Must have inventoryItemId now)
            // Still skip truly unknown items (no catalog match AND no inventory match)
            const validItems = workingItems.filter(item => item.inventoryItemId);
            const skippedItems = workingItems.filter(item => !item.inventoryItemId);

            console.log('🔍 Processing Summary:', {
                total: workingItems.length,
                created: itemsToCreate.length,
                valid: validItems.length,
                skipped: skippedItems.length
            });

            if (skippedItems.length > 0) {
                console.warn(`⚠️ Skipping ${skippedItems.length} unrecognized items (no catalog match):`, skippedItems.map(i => i.name));
            }

            if (validItems.length === 0) {
                alert('⚠️ לא נמצאו פריטים מזוהים לעדכון. המערכת לא הצליחה לזהות או ליצור פריטי מלאי.');
                setIsConfirmingReceipt(false);
                return;
            }

            // Build RPC items list
            const rpcItems = validItems.map(item => ({
                inventory_item_id: item.inventoryItemId,
                catalog_item_id: item.catalogItemId,
                actual_qty: item.actualQty,
                invoiced_qty: item.invoicedQty,
                unit_price: item.unitPrice
            }));

            const { data, error } = await supabase.rpc('receive_inventory_shipment', {
                p_items: rpcItems,
                p_order_id: receivingSession.orderId,
                p_supplier_id: receivingSession.supplierId,
                p_notes: null,
                p_business_id: currentUser.business_id
            });

            if (error) throw error;

            // Save manual/fuzzy mappings to catalog_item_suppliers for future matching
            const mappingsToSave = receivingSession.items
                .filter(item => item.catalogItemId && item.name !== item.catalogItemName)
                .map(item => ({
                    catalog_item_id: item.catalogItemId,
                    supplier_name: item.name, // The item name as it appears on the invoice
                    invoice_supplier_name: receivingSession.supplierName || null, // The supplier's name
                    occurrence_count: 1
                }));

            if (mappingsToSave.length > 0) {
                // Upsert mappings - increment occurrence_count if exists
                for (const mapping of mappingsToSave) {
                    const { data: existing } = await supabase
                        .from('catalog_item_suppliers')
                        .select('occurrence_count')
                        .eq('catalog_item_id', mapping.catalog_item_id)
                        .eq('supplier_name', mapping.supplier_name)
                        .maybeSingle();

                    if (existing) {
                        await supabase
                            .from('catalog_item_suppliers')
                            .update({ occurrence_count: existing.occurrence_count + 1 })
                            .eq('catalog_item_id', mapping.catalog_item_id)
                            .eq('supplier_name', mapping.supplier_name);
                    } else {
                        await supabase
                            .from('catalog_item_suppliers')
                            .insert(mapping);
                    }
                }
                console.log(`💾 Saved ${mappingsToSave.length} item mappings for future matching`);
            }

            // 🧠 NEW: Learn supplier names for existing items (Direct Inventory Match)
            // 🧠 NEW: Learn supplier names for ALL processed items (Direct Inventory Match)
            // Use 'validItems' which includes newly created items with their IDs
            const existingItemsToLearn = validItems.filter(item => item.inventoryItemId && item.name);

            if (existingItemsToLearn.length > 0) {
                console.log(`🧠 Learning ${existingItemsToLearn.length} supplier product names for existing items...`);
                for (const item of existingItemsToLearn) {
                    await supabase.from('inventory_items')
                        .update({ supplier_product_name: item.name })
                        .eq('id', item.inventoryItemId);
                }
            }

            if (data?.success) {
                const skippedCount = skippedItems.length;
                setReceivingSession(null);
                setShowScannerModal(false);
                setScannerStep('choose');
                resetOCR();
                await fetchData();
                await fetchIncomingOrders();

                // Show Success Modal instead of alert
                setSuccessMessage({
                    title: 'הקבלה נקלטה בהצלחה!',
                    message: `${data.items_processed} פריטים עודכנו במלאי.${skippedCount > 0 ? ` (${skippedCount} לא זוהו)` : ''}`
                });
            } else {
                throw new Error(data?.error || 'Unknown error');
            }
        } catch (err) {
            console.error('Error confirming receipt:', err);
            alert('שגיאה באישור הקבלה: ' + err.message);
        } finally {
            setIsConfirmingReceipt(false);
        }
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setScannerStep('scanning');
        try {
            const { result, base64Image } = await scanInvoice(file, currentUser?.business_id);
            // Optionally initialize session automatically if you want,
            // but for now we wait for user to click "Start Triple-Check" in the results view
            // to maintain the flow.
            // However, we need to make sure the results view call passes the image.
            setScannerStep('results');
        } catch (err) {
            console.error('Scan failed:', err);
            setScannerStep('choose');
            alert('שגיאה בסריקה: ' + err.message);
        }
    };


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (items.length > 0) {
            fetchIncomingOrders();
        }
    }, [items, fetchIncomingOrders]);

    const isDeliveryToday = (supplier) => {
        if (!supplier || !supplier.delivery_days) return false;
        const todayIndex = new Date().getDay();
        const days = String(supplier.delivery_days).split(',').map(d => parseInt(d.trim()));
        return days.includes(todayIndex);
    };

    const supplierGroups = useMemo(() => {
        const groups = {};
        // Build a Set of valid supplier IDs for quick lookup
        const validSupplierIds = new Set(suppliers.map(s => s.id));

        suppliers.forEach(s => {
            groups[s.id] = {
                id: s.id,
                name: s.name,
                supplier: s,
                count: 0,
                isToday: isDeliveryToday(s)
            };
        });
        groups['uncategorized'] = { id: 'uncategorized', name: 'כללי / ללא ספק', supplier: { id: 'uncategorized', name: 'כללי / ללא ספק' }, count: 0, isToday: false };

        items.forEach(item => {
            let supId = item.supplier_id || 'uncategorized';

            // CRITICAL FIX: If supplier_id exists but is NOT in our valid suppliers list,
            // treat it as uncategorized to prevent phantom supplier groups
            if (supId !== 'uncategorized' && !validSupplierIds.has(supId)) {
                console.warn(`⚠️ [KDS] Item "${item.name}" (id=${item.id}) has invalid supplier_id=${supId}. Moving to uncategorized.`);
                supId = 'uncategorized';
            }

            if (groups[supId]) groups[supId].count++;
            else groups['uncategorized'].count++;
        });

        return Object.values(groups)
            .filter(g => g.count > 0)
            .sort((a, b) => {
                if (a.isToday && !b.isToday) return -1;
                if (!a.isToday && b.isToday) return 1;
                return a.name.localeCompare(b.name);
            });
    }, [items, suppliers]);

    const filteredItems = useMemo(() => {
        if (!selectedSupplierId) return [];

        // Build valid supplier IDs set (same logic as supplierGroups)
        const validSupplierIds = new Set(suppliers.map(s => s.id));

        return items.filter(i => {
            let itemSupId = i.supplier_id || 'uncategorized';
            // If supplier_id is invalid, treat as uncategorized
            if (itemSupId !== 'uncategorized' && !validSupplierIds.has(itemSupId)) {
                itemSupId = 'uncategorized';
            }
            return itemSupId === selectedSupplierId;
        }).filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
    }, [items, selectedSupplierId, search, suppliers]);


    // Handle Local Stock Change with Smart Rounding
    // First step snaps to the nearest grid multiple, then continues in even steps
    const handleStockChange = (itemId, change) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const step = Math.abs(change); // The step size (e.g., 500 for grams)
        const isIncrement = change > 0;

        setStockUpdates(prev => {
            const currentVal = prev[itemId] !== undefined
                ? prev[itemId]
                : (item.current_stock || 0);

            let newVal;

            // Check if current value is already on a step multiple
            const epsilon = 0.001; // For floating point comparison
            const isOnGrid = Math.abs(currentVal % step) < epsilon || Math.abs((currentVal % step) - step) < epsilon;

            if (isOnGrid) {
                // Already on grid, just add/subtract the step
                newVal = currentVal + change;
            } else {
                // Not on grid - snap to nearest grid point in the direction of change
                if (isIncrement) {
                    // Snap UP to next grid point
                    newVal = Math.ceil(currentVal / step) * step;
                } else {
                    // Snap DOWN to previous grid point
                    newVal = Math.floor(currentVal / step) * step;
                }
            }

            // Ensure we don't go below 0
            newVal = Math.max(0, newVal);

            // Round to 2 decimal places to avoid floating point issues
            newVal = Math.round(newVal * 100) / 100;

            return { ...prev, [itemId]: newVal };
        });
    };

    // Save Stock Update
    const saveStockUpdate = async (itemId) => {
        const newValue = stockUpdates[itemId];
        if (newValue === undefined) return;

        setSaving(true);
        try {
            console.log('📦 KDS: Updating stock via RPC:', itemId, newValue);
            const { data, error } = await supabase.rpc('update_inventory_stock', {
                p_item_id: itemId,
                p_new_stock: newValue,
                p_counted_by: currentUser?.id || null,
                p_source: 'manual'
            });

            if (error) throw error;

            console.log('✅ KDS: Stock updated successfully:', data);
            setItems(prev => prev.map(i => i.id === itemId ? {
                ...i,
                current_stock: newValue,
                last_counted_at: new Date().toISOString(),
                last_counted_by_name: data?.counted_by_name || currentUser?.name,
                last_count_source: 'manual'
            } : i));
            setStockUpdates(prev => { const next = { ...prev }; delete next[itemId]; return next; });

        } catch (err) {
            console.error('Error saving stock:', err);
            alert('שגיאה בעדכון המלאי: ' + err.message);
        } finally {
            setSaving(false);
        }
    };



    // Render Suppliers List (Right Column)
    const renderSuppliersList = () => (
        <div className="flex flex-col gap-3 overflow-y-auto p-2 pb-20">
            {supplierGroups.map(group => {
                const isActive = selectedSupplierId === group.id;
                return (
                    <motion.div
                        key={group.id}
                        onClick={() => setSelectedSupplierId(group.id)}
                        whileTap={{ scale: 0.98 }}
                        className={`relative p-4 rounded-xl cursor-pointer border transition-all duration-200 overflow-hidden ${isActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 border-blue-500 scale-[1.02]'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-100 shadow-sm'
                            }`}
                    >
                        <div className="flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-3">
                                <Truck size={20} className={isActive ? 'text-blue-200' : (group.isToday ? 'text-green-500' : 'text-gray-400')} />
                                <div>
                                    <h3 className={`font-bold text-lg ${isActive ? 'text-white' : 'text-slate-700'}`}>{group.name}</h3>
                                    {group.isToday && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                                            אספקה היום!
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Count Badge */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm ${isActive ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                {group.count}
                            </div>
                        </div>

                        {/* Active Indicator Background Effect */}
                        {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />}
                    </motion.div>
                );
            })}
        </div>
    );

    // Render Items Grid (Left/Center Column)
    const renderItemsGrid = () => (
        <div className="h-full min-h-0 overflow-y-auto p-2 pb-20">
            {!selectedSupplierId ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <ArrowRight size={64} className="mb-6 animate-pulse" />
                    <h3 className="text-2xl font-bold">בחר ספק מהרשימה</h3>
                    <p>כדי לצפות ולעדכן פריטי מלאי</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 auto-rows-max pb-24">
                    {/* Search Bar inside Grid area if needed, or stick to top */}
                    {filteredItems.map(item => {
                        const currentStock = stockUpdates[item.id] !== undefined ? stockUpdates[item.id] : item.current_stock;
                        const isChanged = stockUpdates[item.id] !== undefined && stockUpdates[item.id] !== item.current_stock;

                        // Get package size from weight_per_unit (e.g., 1000 for 1kg/1L items)
                        const packageSize = item.weight_per_unit || 1000; // Default 1000 (1 kg or 1 liter)
                        // Determine Step Size
                        // 1. Use explicit DB step if defined
                        // 2. If 'single unit' (packageSize=1), step by 1
                        // 3. Otherwise (weight/volume), step by half package (0.5)
                        let countStep;
                        if (item.count_step && item.count_step > 0) {
                            countStep = item.count_step;
                        } else if (packageSize === 1) {
                            countStep = 1;
                        } else {
                            countStep = packageSize * 0.5;
                        }

                        // Smart Price Display - show per package (per kg/per liter)
                        let priceDisplay = null;
                        if (item.cost_per_unit > 0) {
                            if (item.unit === 'גרם' || item.unit === 'מ״ל') {
                                // Price per package (kg or liter)
                                const pricePerPackage = (item.cost_per_unit * packageSize).toFixed(2);
                                const unitLabel = item.unit === 'גרם' ? 'ק״ג' : 'ליטר';
                                priceDisplay = `₪${pricePerPackage}/${unitLabel}`;
                            } else {
                                priceDisplay = `₪${item.cost_per_unit}`;
                            }
                        }

                        // Convert to package units for display
                        const stockInPackageUnits = currentStock / packageSize;

                        // Worker display: Round to nearest 0.5
                        const roundToHalf = (num) => Math.round(num * 2) / 2;
                        const displayStock = roundToHalf(stockInPackageUnits);

                        // Determine display unit label
                        let displayUnit = item.unit;
                        if (item.unit === 'גרם') displayUnit = 'ק״ג';
                        else if (item.unit === 'מ״ל') displayUnit = 'ליטר';

                        return (
                            <div key={item.id} className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-300 transition-colors group">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex flex-col">
                                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h4>
                                        {item.location && (
                                            <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                                                <span>📍</span>
                                                <span>{item.location}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                        <button
                                            onClick={() => handleStockChange(item.id, -countStep)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition active:scale-95"
                                        >
                                            <span className="text-xl font-bold leading-none mb-1">-</span>
                                        </button>

                                        <div className="w-16 text-center">
                                            <span className={`font-mono text-lg font-black ${isChanged ? 'text-blue-600' : 'text-slate-700'}`}>
                                                {displayStock}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleStockChange(item.id, countStep)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-500 hover:text-green-600 hover:bg-green-50 transition active:scale-95"
                                        >
                                            <Plus size={16} strokeWidth={3} />
                                        </button>
                                    </div>

                                    <div className="w-10 flex justify-center">
                                        {isChanged && (
                                            <motion.button
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                onClick={() => saveStockUpdate(item.id)}
                                                disabled={saving}
                                                className="w-10 h-10 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-200 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all"
                                            >
                                                <Save size={18} />
                                            </motion.button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredItems.length === 0 && (
                        <div className="col-span-2 text-center py-20 text-gray-400">
                            <p>לא נמצאו פריטים</p>
                        </div>

                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 font-heebo" dir="rtl">
            {/* Header & Tabs - Responsive Layout */}
            <div className="bg-white shadow-sm z-20 shrink-0 px-4 md:px-6 py-2 md:py-3 flex flex-col md:flex-row items-center border-b border-gray-200 gap-3 md:gap-6">

                {/* Right Side: Home + Tabs */}
                <div className="flex items-center gap-3 w-full md:flex-1">
                    {/* Home button - rightmost in RTL */}
                    {onExit && (
                        <button
                            onClick={onExit}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                            title="יציאה למסך הראשי"
                        >
                            <House size={22} />
                        </button>
                    )}

                    {/* Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-xl flex-1 md:flex-none overflow-x-auto no-scrollbar">
                        <button onClick={() => { setActiveTab('counts'); setSelectedSupplierId(null); }} className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'counts' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Package size={16} /> ספירה ודיווח
                        </button>
                        <button onClick={() => { setActiveTab('incoming'); setSelectedOrderId(null); }} className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'incoming' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Truck size={16} /> משלוחים בדרך
                            {incomingOrders.length > 0 && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px]">{incomingOrders.length}</span>}
                        </button>
                        <button onClick={fetchData} className="px-2 text-gray-400 hover:text-blue-500 transition" title="רענן נתונים">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Center - Clock & Connection (Hidden on very small screens if needed, or compact) */}
                <div className="hidden md:flex items-center gap-3 px-4 border-l border-r border-gray-100">
                    <div className="text-lg font-black text-slate-700">
                        {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <ConnectionStatusBar isIntegrated={true} />
                </div>

                {/* Left Side (RTL = far left): Music - Hidden on mobile header to save space */}
                <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
                    <MiniMusicPlayer />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'counts' && (
                        <motion.div
                            key="counts"
                            className="h-full flex flex-col md:flex-row"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Right Column: Suppliers (Full on mobile, 1/3 on desktop) */}
                            <div className={`${(selectedSupplierId && !isDesktop) ? 'hidden' : 'w-full md:w-1/3'} border-l border-gray-200 bg-white h-full min-h-0 flex flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]`}>
                                <div className="p-4 bg-gray-50/50 border-b border-gray-100 shrink-0">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">ספקים ({supplierGroups.length})</h3>
                                </div>
                                <div className="flex-1 min-h-0">
                                    {renderSuppliersList()}
                                </div>
                            </div>

                            {/* Left/Center Column: Items (Full on mobile if entry selected, 2/3 on desktop) */}
                            <div className={`${(!selectedSupplierId && !isDesktop) ? 'hidden' : 'w-full md:w-2/3'} h-full min-h-0 bg-slate-50/50 p-2 md:p-4 flex flex-col`}>
                                {/* Mobile Back Button */}
                                {!isDesktop && selectedSupplierId && (
                                    <button
                                        onClick={() => setSelectedSupplierId(null)}
                                        className="mb-3 flex items-center gap-2 text-blue-600 font-bold bg-white p-3 rounded-xl shadow-sm border border-blue-100 active:scale-95 transition-all"
                                    >
                                        <ChevronRight size={20} />
                                        <span>חזרה לרשימת ספקים</span>
                                    </button>
                                )}
                                <div className="flex-1 min-h-0">
                                    {renderItemsGrid()}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'incoming' && (
                        <motion.div
                            key="incoming"
                            className="h-full flex flex-col md:flex-row"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Right Column: Orders List OR Supplier Info when session active */}
                            <div className={`${(receivingSession || selectedOrderId) && !isDesktop ? 'hidden' : 'w-full md:w-1/3'} border-l border-gray-200 bg-white h-full flex flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]`}>
                                {receivingSession ? (
                                    // Show supplier and document info when session is active
                                    <div className="h-full flex flex-col">
                                        <div className="p-3 bg-purple-50/50 border-b border-purple-100">
                                            <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                                                <Package size={14} /> פרטי מסמך
                                            </h3>
                                        </div>
                                        {/* Compact supplier info - scrollable */}
                                        <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '180px' }}>
                                            {/* Row 1: Supplier + Document Type */}
                                            <div className="flex gap-2">
                                                <div className="flex-1 bg-white rounded-lg border border-gray-100 p-2 shadow-sm">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">ספק</div>
                                                    <div className="font-bold text-sm text-slate-800 truncate">{receivingSession.supplierName}</div>
                                                </div>
                                                <div className="bg-white rounded-lg border border-gray-100 p-2 shadow-sm">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">סוג</div>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${receivingSession.documentType === 'invoice'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : receivingSession.documentType === 'delivery_note'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {receivingSession.documentType === 'invoice' ? 'חשבונית'
                                                            : receivingSession.documentType === 'delivery_note' ? 'ת.משלוח'
                                                                : 'הזמנה'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Row 2: Doc Number + Date + Total */}
                                            <div className="flex gap-2">
                                                {receivingSession.documentNumber && (
                                                    <div className="bg-white rounded-lg border border-gray-100 p-2 shadow-sm">
                                                        <div className="text-[9px] font-bold text-slate-400 uppercase">מס׳</div>
                                                        <div className="font-mono font-bold text-xs text-slate-800">{receivingSession.documentNumber}</div>
                                                    </div>
                                                )}
                                                <div className="bg-white rounded-lg border border-gray-100 p-2 shadow-sm">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">תאריך</div>
                                                    <div className="font-bold text-xs text-slate-800">
                                                        {new Date(receivingSession.documentDate).toLocaleDateString('he-IL')}
                                                    </div>
                                                </div>
                                                <div className="flex-1 bg-white rounded-lg border border-gray-100 p-2 shadow-sm">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">סה״כ</div>
                                                    <div className="font-black text-sm text-slate-900">₪{(receivingSession.totalInvoiced || 0).toFixed(2)}</div>
                                                </div>
                                            </div>

                                            {/* Row 3: Items count */}
                                            <div className="flex gap-2 text-xs">
                                                <span className="text-slate-500">{receivingSession.items.length} פריטים</span>
                                                {receivingSession.items.filter(i => i.isNew).length > 0 && (
                                                    <span className="text-purple-600 font-bold">
                                                        ({receivingSession.items.filter(i => i.isNew).length} חדשים)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Invoice Image Preview - Takes remaining space */}
                                        {receivingSession.invoiceImage && (
                                            <div className="flex-1 p-3 border-t border-gray-100 min-h-0 flex flex-col">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">תצוגת חשבונית</div>
                                                    <button
                                                        onClick={() => setShowFullscreenInvoice(true)}
                                                        className="text-[10px] text-purple-600 font-bold hover:underline"
                                                    >
                                                        הגדל
                                                    </button>
                                                </div>
                                                <div
                                                    className="flex-1 relative rounded-lg overflow-hidden border border-gray-200 cursor-zoom-in hover:shadow-lg transition-shadow bg-gray-50"
                                                    onClick={() => setShowFullscreenInvoice(true)}
                                                >
                                                    <img
                                                        src={receivingSession.invoiceImage}
                                                        alt="חשבונית"
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // Show orders list when no session
                                    <>
                                        <div className="p-4 bg-green-50/50 border-b border-green-100 flex items-center justify-between">
                                            <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-2">
                                                <Truck size={14} /> משלוחים בדרך ({incomingOrders.length})
                                            </h3>
                                            <label className="p-2 -ml-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                />
                                                <ScanLine size={16} />
                                                <span>סרוק</span>
                                            </label>
                                        </div>
                                        <div className="h-full overflow-y-auto p-2 space-y-2">
                                            {incomingOrders.length === 0 ? (
                                                <div className="text-center py-10 opacity-50"><p>אין משלוחים</p></div>
                                            ) : incomingOrders.map(order => (
                                                <div
                                                    key={order.id}
                                                    onClick={() => setSelectedOrderId(order.id)}
                                                    className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedOrderId === order.id ? 'bg-green-600 text-white shadow-lg shadow-green-200 border-green-500' : 'bg-white hover:bg-gray-50 border-gray-100'}`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-lg">{order.supplier_name}</h4>
                                                            <div className={`text-xs mt-1 flex items-center gap-1 ${selectedOrderId === order.id ? 'text-green-100' : 'text-gray-400'}`}>
                                                                <Clock size={10} />
                                                                {new Date(order.created_at).toLocaleDateString('he-IL')}
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${selectedOrderId === order.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                                                            #{order.id.toString().slice(-4)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <span className={`text-xs px-2 py-1 rounded-md font-bold ${selectedOrderId === order.id ? 'bg-green-700 text-white' : 'bg-green-50 text-green-700'}`}>
                                                            {order.items.length} פריטים
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Center Column: Triple-Check OR Order Details */}
                            <div className={`${(!receivingSession && !selectedOrderId) && !isDesktop ? 'hidden' : 'w-full md:w-2/3'} h-full bg-slate-50/50 p-2 md:p-4 overflow-hidden flex flex-col`}>
                                {/* Mobile Back Button */}
                                {!isDesktop && (receivingSession || selectedOrderId) && (
                                    <button
                                        onClick={() => {
                                            if (receivingSession) {
                                                setConfirmModal({
                                                    isOpen: true,
                                                    title: 'ביטול קבלה',
                                                    message: 'האם אתה בטוח שברצונך לצאת? הנתונים שנקלטו יישמרו כטיוטה.',
                                                    variant: 'warning',
                                                    confirmText: 'צא',
                                                    onConfirm: () => {
                                                        setReceivingSession(null);
                                                        setSelectedOrderId(null);
                                                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                    }
                                                });
                                            } else {
                                                setSelectedOrderId(null);
                                            }
                                        }}
                                        className="mb-3 flex items-center gap-2 text-blue-600 font-bold bg-white p-3 rounded-xl shadow-sm border border-blue-100 active:scale-95 transition-all shrink-0"
                                    >
                                        <ChevronRight size={20} />
                                        <span>חזרה לרשימת משלוחים</span>
                                    </button>
                                )}
                                {/* Scanning State */}
                                {uiScanning && (
                                    <ScanningAnimation
                                        isDataReady={!isScanning && (!!ocrResult || !!scanError)}
                                        onComplete={() => {
                                            setUiScanning(false);
                                            // Skip identified screen and go straight to session
                                            if (ocrResult && !receivingSession && !scanError) {
                                                initializeReceivingSession(ocrResult, selectedOrderId, null, imagePreview);
                                            }
                                        }}
                                    />
                                )}

                                {/* Triple-Check Active */}
                                {!uiScanning && receivingSession && (
                                    <div className="h-full flex flex-col">
                                        {/* Header */}
                                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4 shrink-0">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                                        <Package className="text-purple-600" size={24} />
                                                        Triple-Check - קבלת סחורה
                                                    </h2>
                                                    <p className="text-sm text-gray-500 mt-1">{receivingSession.items.length} פריטים מהחשבונית</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {receivingSession.items.some(i => i.isNew) && (
                                                        <span className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded-full font-bold">
                                                            <AlertTriangle size={14} />
                                                            {receivingSession.items.filter(i => i.isNew).length} חדשים
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>


                                        {/* Items List - Scrollable */}
                                        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                                            {receivingSession.items.map((item) => (
                                                <TripleCheckCard
                                                    key={item.id}
                                                    item={item}
                                                    orderedQty={item.orderedQty}
                                                    invoicedQty={item.invoicedQty}
                                                    actualQty={item.actualQty}
                                                    onActualChange={(newQty) => updateActualQuantity(item.id, newQty)}
                                                    unitPrice={item.unitPrice}
                                                    catalogPrice={item.catalogPrice}
                                                    catalogItemName={item.catalogItemName}
                                                    catalogItemId={item.catalogItemId}
                                                    isNew={item.isNew}
                                                    countStep={item.countStep}
                                                    catalogItems={globalCatalog}
                                                    onCatalogItemSelect={updateCatalogItemMapping}
                                                />
                                            ))}
                                        </div>

                                        {/* Footer - Total & Actions */}
                                        <div className="shrink-0 space-y-4 pt-4 border-t border-gray-200 bg-white -mx-4 px-4 sticky bottom-0 z-30">
                                            {/* Compact Summary Grid aligned with Cards */}
                                            <div className={`grid ${receivingSession.orderId ? 'grid-cols-3 md:grid-cols-[3fr_80px_80px_130px_1fr]' : 'grid-cols-3 md:grid-cols-[3fr_80px_130px_1fr]'} gap-3 items-start px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 shadow-inner`}>
                                                {/* Col 1: Counts */}
                                                <div className="text-right">
                                                    <span className="font-black text-sm text-slate-700 block">
                                                        {receivingSession.items.length} שורות
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                        {(() => {
                                                            const totalUnits = receivingSession.items.reduce((sum, i) => sum + (Math.round((i.actualQty || 0) / (i.countStep || 1) * 100) / 100), 0);
                                                            return totalUnits % 1 === 0 ? totalUnits : totalUnits.toFixed(1);
                                                        })()} יחידות
                                                    </span>
                                                </div>

                                                {/* Col 2: Ordered Total */}
                                                {receivingSession.orderId && (
                                                    <div className="text-center">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase block">הוזמן</span>
                                                        <span className="font-black text-sm text-slate-600">
                                                            {(() => {
                                                                const total = receivingSession.items.reduce((sum, i) => sum + (i.orderedQty || 0), 0);
                                                                return total % 1 === 0 ? total : total.toFixed(1);
                                                            })()}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Col 3: Invoice Total Qty */}
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-blue-400 uppercase block">חשבונית</span>
                                                    <span className="font-black text-sm text-blue-700">
                                                        {(() => {
                                                            const total = receivingSession.items.reduce((sum, i) => sum + (i.invoicedQty || 0), 0);
                                                            return total % 1 === 0 ? total : total.toFixed(1);
                                                        })()}
                                                    </span>
                                                </div>

                                                {/* Col 4: Actual Total Qty */}
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-green-500 uppercase block">בפועל</span>
                                                    <span className="font-black text-sm text-green-700">
                                                        {(() => {
                                                            const total = receivingSession.items.reduce((sum, i) => sum + (i.actualQty || 0), 0);
                                                            return total % 1 === 0 ? total : total.toFixed(1);
                                                        })()}
                                                    </span>
                                                </div>

                                                {/* Col 5: Financial Total */}
                                                <div className="text-left">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">לתשלום</span>
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-sm text-slate-900 leading-none">
                                                            ₪{(() => {
                                                                const total = receivingSession.totalInvoiced || 0;
                                                                return total % 1 === 0 ? total : total.toFixed(2);
                                                            })()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        setReceivingSession(null);
                                                        resetOCR();
                                                        setSelectedOrderId(null);
                                                    }}
                                                    className="hidden md:block px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                                                >
                                                    ביטול
                                                </button>
                                                <button
                                                    onClick={confirmReceipt}
                                                    disabled={isConfirmingReceipt}
                                                    className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-black shadow-lg shadow-green-200 hover:shadow-xl active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
                                                >
                                                    {isConfirmingReceipt ? (
                                                        <>
                                                            <RefreshCw size={22} className="animate-spin" />
                                                            מעדכן מלאי...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check size={22} strokeWidth={3} />
                                                            אשר ועדכן מלאי
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* OCR Completed (no receivingSession yet) */}
                                {!isScanning && !receivingSession && scanError && (
                                    <div className="h-full flex flex-col items-center justify-center p-6">
                                        <div className="bg-white border-2 border-red-100 rounded-[2rem] p-10 text-center max-w-md shadow-2xl shadow-red-100 relative overflow-hidden">
                                            {/* Decorative background */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16" />

                                            <div className="relative z-10">
                                                <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600">
                                                    <AlertTriangle size={40} strokeWidth={2.5} />
                                                </div>
                                                <h4 className="font-black text-slate-900 mb-3 text-2xl tracking-tight">אופס! משהו השתבש</h4>
                                                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                                                    {scanError.includes('לא נמצא') ? 'המערכת לא זיהתה את מודל הבינה המלאכותית. פנה לתמיכה.' : scanError}
                                                </p>

                                                <div className="flex flex-col gap-3">
                                                    <label className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2">
                                                        <input type="file" accept="image/*,application/pdf" onChange={handleImageUpload} className="hidden" />
                                                        <RefreshCw size={20} />
                                                        נסיון נוסף
                                                    </label>
                                                    <button
                                                        onClick={() => setScannerStep('choose')}
                                                        className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                                                    >
                                                        חזרה להתחלה
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}


                                {/* Default: Show order details OR empty state */}
                                {!isScanning && !receivingSession && !ocrResult && (
                                    !selectedOrderId ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                            <Truck size={64} className="mb-6 animate-pulse" />
                                            <h3 className="text-2xl font-bold">בחר משלוח לטיפול</h3>
                                            <p className="mt-2">או לחץ "סרוק" להתחיל קבלה חדשה</p>
                                        </div>
                                    ) : (
                                        (() => {
                                            const order = incomingOrders.find(o => o.id === selectedOrderId);
                                            const draft = receiptDrafts[selectedOrderId] || {};
                                            const hasChanges = Object.values(draft).some(i => i.qty !== i.originalQty || i.status !== 'received');
                                            const hasMissing = Object.values(draft).some(i => i.qty < i.originalQty);

                                            const formatValue = (num) => {
                                                if (num % 1 === 0) return num;
                                                return num.toFixed(1);
                                            };

                                            return (
                                                <>
                                                    {/* Header Actions */}
                                                    <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                        <div>
                                                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                                                {order.supplier_name}
                                                                <span className="text-sm font-normal text-gray-400">#{order.id}</span>
                                                            </h2>
                                                            <p className="text-sm text-gray-500">נא לאשר או לעדכן כמויות שהתקבלו בפועל</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => promptDeleteOrder(order.id)}
                                                                className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                                title="מחק הזמנה"
                                                            >
                                                                <Trash2 size={20} />
                                                            </button>
                                                            {hasMissing ? (
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => promptProcessReceipt(order.id, 'complete')} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 text-sm">
                                                                        סגור (מחק יתרה)
                                                                    </button>
                                                                    <button onClick={() => promptProcessReceipt(order.id, 'split')} className="px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 text-sm flex items-center gap-2">
                                                                        <RefreshCw size={16} /> אשר וצור השלמה
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => promptProcessReceipt(order.id, 'complete')} className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2">
                                                                    <Check size={20} /> אשר קבלה מלאה
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Items Grid */}
                                                    <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-20">
                                                        {order.items.map((item) => {
                                                            const itemId = item.inventory_item_id || item.name;
                                                            const itemDraft = draft[itemId] || { qty: item.qty, status: 'received' };
                                                            const isExpanded = expandedItems[itemId];
                                                            const isMissing = itemDraft.qty < item.qty;

                                                            const unitStr = item.unit || '';
                                                            const lowerUnit = unitStr.toLowerCase().trim();
                                                            // Hide units for "יח׳" or similar generic units and trailing apostrophes
                                                            const isGeneric = ['יח׳', 'יחידה', 'יח', 'units', 'unit', 'pcs', 'pc'].some(u => lowerUnit.includes(u)) ||
                                                                !unitStr ||
                                                                ['\'', '׳'].includes(lowerUnit);

                                                            return (
                                                                <div key={itemId} className={`bg-white border rounded-xl overflow-hidden transition-all ${isMissing ? 'border-amber-200 shadow-amber-50' : 'border-gray-100 hover:border-blue-200'}`}>
                                                                    {/* Summary View */}
                                                                    <div className="p-3 flex justify-between items-center cursor-pointer" onClick={() => setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))} >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`p-2 rounded-lg ${isMissing ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                                <Package size={20} />
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                                                                                <div className="flex items-center gap-2 text-xs">
                                                                                    <span className="text-gray-500">הוזמן: {item.qty} {item.unit}</span>
                                                                                    {isMissing && <span className="text-amber-600 font-bold bg-amber-50 px-1 rounded">חסר: {item.qty - itemDraft.qty}</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <div className="font-mono font-black text-lg text-slate-700">
                                                                                {isGeneric ? formatValue(itemDraft.qty) : `${formatValue(itemDraft.qty)} ${unitStr}`}
                                                                            </div>
                                                                            <span className="text-[10px] text-blue-500 flex items-center justify-end gap-1">ערוך <ChevronDown size={10} className={`transform transition ${isExpanded ? 'rotate-180' : ''}`} /></span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Edit View */}
                                                                    <AnimatePresence>
                                                                        {isExpanded && (
                                                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-gray-50 border-t border-gray-100">
                                                                                <div className="p-4 space-y-4">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <label className="text-xs font-bold text-gray-500">כמות שהתקבלה:</label>
                                                                                        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
                                                                                            <button onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', Math.max(0, itemDraft.qty - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-slate-600 font-bold">-</button>
                                                                                            <span className="w-12 text-center font-mono font-bold text-lg">{itemDraft.qty}</span>
                                                                                            <button onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', itemDraft.qty + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-slate-600 font-bold">+</button>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex gap-2">
                                                                                        <button
                                                                                            onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', 0)}
                                                                                            className="flex-1 py-2 bg-white border border-red-100 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50"
                                                                                        >
                                                                                            לא הגיע כלל
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', item.qty)}
                                                                                            className="flex-1 py-2 bg-white border border-green-100 text-green-600 text-xs font-bold rounded-lg hover:bg-green-50"
                                                                                        >
                                                                                            הגיע מלא ({item.qty})
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        })
                                                        }
                                                    </div>
                                                </>
                                            );
                                        })()
                                    )
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
            />

            {/* Fullscreen Invoice Modal */}
            <AnimatePresence>
                {showFullscreenInvoice && receivingSession?.invoiceImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
                        onClick={() => setShowFullscreenInvoice(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative max-w-full max-h-full overflow-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={receivingSession.invoiceImage}
                                alt="חשבונית מוגדלת"
                                className="max-w-[90vw] max-h-[90vh] object-contain"
                                style={{ touchAction: 'pinch-zoom' }}
                            />
                            <button
                                onClick={() => setShowFullscreenInvoice(false)}
                                className="absolute top-4 right-4 p-3 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
                            >
                                <X size={24} className="text-slate-800" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success Modal */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500" />
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 shadow-inner">
                                <Check size={40} strokeWidth={3} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2">{successMessage.title}</h2>
                            <p className="text-gray-500 mb-6 font-medium leading-relaxed">{successMessage.message}</p>
                            <button
                                onClick={() => setSuccessMessage(null)}
                                className="w-full py-3.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all shadow-lg shadow-slate-200 active:scale-95"
                            >
                                מעולה, תודה!
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default KDSInventoryScreen;
