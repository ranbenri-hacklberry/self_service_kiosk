import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, User, Check, Loader2, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NumericKeypad from '@/components/NumericKeypad';

/**
 * CustomerInfoModal - Unified modal for collecting/editing customer phone and name
 * Replaces full-page phone/name screens with a popup accessible from cart and KDS
 * 
 * @param {boolean} isOpen - Modal visibility
 * @param {function} onClose - Close callback
 * @param {'phone' | 'name' | 'phone-then-name'} mode - Initial entry mode
 * @param {object} currentCustomer - Existing customer data {phone, name, id}
 * @param {function} onCustomerUpdate - Callback with updated customer data
 * @param {string} orderId - Optional order ID for KDS flow (updates order directly)
 */
const CustomerInfoModal = ({
    isOpen,
    onClose,
    mode = 'phone',
    currentCustomer = null,
    onCustomerUpdate,
    orderId = null
}) => {
    const { currentUser } = useAuth();
    const [step, setStep] = useState('phone'); // 'phone' | 'name' | 'lookup' | 'complete'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [lookupResult, setLookupResult] = useState(null);
    const nameInputRef = useRef(null);
    const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
    const [pendingCustomer, setPendingCustomer] = useState(null);

    const wasOpen = useRef(false);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen && !wasOpen.current) {
            // Reset state
            const rawPhone = currentCustomer?.phone || '';
            const cleanPhone = rawPhone.replace(/\D/g, '');
            // Only pre-fill if it's a REAL 10-digit phone starting with 05
            // Avoid pre-filling internal GUEST_ IDs or UUIDs
            if (cleanPhone.length === 10 && cleanPhone.startsWith('05')) {
                setPhoneNumber(cleanPhone);
            } else {
                setPhoneNumber('');
            }

            // Clear name if it's a generic placeholder or starts with #
            const genericNames = ['הזמנה מהירה', 'אורח', 'אורח/ת', 'אורח כללי', 'אורח אנונימי'];
            const name = currentCustomer?.name || '';
            const isGeneric = genericNames.includes(name) || name.startsWith('#') || name.startsWith('GUEST_');
            setCustomerName(isGeneric ? '' : name);
            setError('');
            setLookupResult(null);
            setIsLoading(false);

            // Set initial step based on mode
            if (mode === 'phone' || mode === 'phone-then-name') {
                setStep('phone');
            } else if (mode === 'name') {
                setStep('name');
                // Focus name input after a short delay
                setTimeout(() => nameInputRef.current?.focus(), 100);
            }
        }
        wasOpen.current = isOpen;
    }, [isOpen, mode, currentCustomer]);

    if (!isOpen) return null;

    // Format phone number for display
    const formatPhoneDisplay = (phone) => {
        const digits = phone?.replace(/[^0-9]/g, '')?.split('') || [];
        if (digits.length > 3) digits.splice(3, 0, '-');
        if (digits.length > 7) digits.splice(7, 0, '-');
        return digits.join('');
    };

    // Handle phone keypad input
    const handleKeypadPress = (value) => {
        setError('');

        if (value === 'delete') {
            setPhoneNumber(prev => prev.slice(0, -1));
        } else if (value === '*') {
            return;
        } else if (phoneNumber.length < 10) {
            const newPhone = `${phoneNumber}${value}`;

            // Validation: Check if starts with 05
            if (newPhone.length >= 2 && !newPhone.startsWith('05')) {
                setError('מספר נייד חייב להתחיל ב-05');
            }

            setPhoneNumber(newPhone);
        }
    };

    // Lookup customer by phone
    const handlePhoneLookup = async () => {
        const cleanPhone = phoneNumber.replace(/\D/g, '');

        // Validation
        if (cleanPhone.length !== 10) {
            setError('אנא הכנס מספר נייד תקין בן 10 ספרות');
            return;
        }

        if (!cleanPhone.startsWith('05')) {
            setError('מספר נייד חייב להתחיל ב-05');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { data, error: lookupError } = await supabase.rpc('lookup_customer', {
                p_phone: cleanPhone,
                p_business_id: currentUser?.business_id || null
            });

            if (lookupError) throw lookupError;

            setLookupResult(data);

            if (data?.success && !data?.isNewCustomer) {
                // Existing customer found
                const foundCustomer = {
                    id: data.customer.id,
                    phone: cleanPhone,
                    name: data.customer.name,
                    loyalty_coffee_count: data.customer.loyalty_coffee_count || 0
                };

                // Trigger switch confirmation if it's a guest order OR if it's a different customer ID
                const isGuest = !currentCustomer?.id || ['הזמנה מהירה', 'אורח', 'אורח/ת', 'אורח כללי', 'אורח אנונימי'].includes(currentCustomer?.name) || (typeof currentCustomer?.name === 'string' && currentCustomer.name.startsWith('#'));
                const isDifferentCustomer = (currentCustomer?.id && currentCustomer.id !== foundCustomer.id) || isGuest;

                if (isDifferentCustomer) {
                    // Show custom confirmation modal
                    setPendingCustomer(foundCustomer);
                    setShowSwitchConfirm(true);
                    setIsLoading(false);
                    return;
                }

                // If editing an order (KDS flow), update it
                if (orderId) {
                    await updateOrderCustomer(orderId, foundCustomer);
                }

                // Return customer data
                onCustomerUpdate?.(foundCustomer);
                onClose();
            } else {
                // New customer - advance to name entry
                if (mode === 'phone-then-name') {
                    setStep('name');
                    setTimeout(() => nameInputRef.current?.focus(), 100);
                } else {
                    // Just phone mode - use existing name if available, otherwise 'אורח'
                    const customer = {
                        id: currentCustomer?.id || null,
                        phone: cleanPhone,
                        name: currentCustomer?.name || 'אורח',
                        loyalty_coffee_count: 0
                    };
                    onCustomerUpdate?.(customer);
                    onClose();
                }
            }
        } catch (err) {
            console.error('Phone lookup error:', err);
            setError('שגיאה בחיפוש לקוח. אנא נסה שוב.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle customer switch confirmation
    const handleConfirmSwitch = async () => {
        if (!pendingCustomer) return;

        try {
            // If editing an order (KDS flow), update it
            if (orderId) {
                await updateOrderCustomer(orderId, pendingCustomer);
            }

            // Return customer data
            onCustomerUpdate?.(pendingCustomer);
            setShowSwitchConfirm(false);
            setPendingCustomer(null);
            onClose();
        } catch (err) {
            console.error('Error switching customer:', err);
            setError('שגיאה בהחלפת לקוח');
        }
    };

    const handleCancelSwitch = () => {
        setShowSwitchConfirm(false);
        setPendingCustomer(null);
    };

    // Handle name submission
    const handleNameSubmit = async () => {
        if (!customerName.trim()) {
            setError('אנא הכנס שם');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            const existingPhone = currentCustomer?.phone?.replace(/\D/g, '');
            const phoneToUse = cleanPhone.length === 10 ? cleanPhone : (existingPhone?.length === 10 ? existingPhone : null);

            let finalCustomerId = currentCustomer?.id;

            console.log('👤 [CustomerInfoModal] Submitting name:', {
                name: customerName.trim(),
                phoneToUse,
                existingId: finalCustomerId,
                orderId
            });

            // Step 1: Handle Customer Table Link (Only if phone is present)
            if (phoneToUse) {
                const { data: customerId, error: rpcError } = await supabase.rpc('upsert_customer_v2', {
                    p_phone: phoneToUse,
                    p_name: customerName.trim(),
                    p_business_id: currentUser?.business_id
                });
                if (rpcError) throw rpcError;
                finalCustomerId = customerId;
                console.log('✅ Customer linked via phone:', finalCustomerId);
            } else if (finalCustomerId && !finalCustomerId.toString().startsWith('local-')) {
                // If it's an existing DB customer ID (not a local temp ID) but no phone, try to update name
                // Ignore errors here as RLS might block non-admin updates to the customers table
                try {
                    await supabase
                        .from('customers')
                        .update({ name: customerName.trim() })
                        .eq('id', finalCustomerId);
                } catch (e) {
                    console.warn('Silent failure updating customers table (expected for guest orders/non-admins):', e);
                }
            }

            const customer = {
                id: finalCustomerId,
                phone: phoneToUse,
                name: customerName.trim(),
                loyalty_coffee_count: currentCustomer?.loyalty_coffee_count || 0
            };

            // Step 2: Direct Order Update (CRITICAL for KDS visibility)
            // This RPC bypasses RLS and updates the orders.customer_name field immediately
            if (orderId) {
                console.log('📝 Updating order record...', orderId);
                await updateOrderCustomer(orderId, customer);
                console.log('✅ Order record updated');
            }

            // Step 3: Local state update
            onCustomerUpdate?.(customer);
            onClose();
        } catch (err) {
            console.error('Name submission error:', err);
            setError('שגיאה בשמירת הנתונים. אנא נסה שוב.');
        } finally {
            setIsLoading(false);
        }
    };

    // Update order with customer info (KDS flow) - Uses RPC to bypass RLS
    const updateOrderCustomer = async (orderId, customer) => {
        try {
            // Validate UUID or set to null for guests
            const isUuid = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
            const validCustomerId = isUuid(customer.id) ? customer.id : null;

            console.log('📡 [CustomerInfoModal] Calling update_order_customer RPC:', {
                orderId,
                validCustomerId,
                name: customer.name
            });

            // Use RPC to bypass RLS
            const { error } = await supabase.rpc('update_order_customer', {
                p_order_id: orderId,
                p_customer_id: validCustomerId,
                p_customer_phone: customer.phone,
                p_customer_name: customer.name
            });

            if (error) {
                console.error('RPC update_order_customer failed:', error);
                // Fallback attempt
                const { error: directError } = await supabase
                    .from('orders')
                    .update({
                        customer_id: validCustomerId,
                        customer_phone: customer.phone,
                        customer_name: customer.name
                    })
                    .eq('id', orderId);

                if (directError) throw directError;
            }
        } catch (err) {
            console.error('Failed to update order customer:', err);
            throw err;
        }
    };

    // Render phone entry step
    const renderPhoneStep = () => (
        <>
            {/* Content - No header */}
            <div className="p-4 space-y-3">
                {/* Phone Display */}
                <div
                    className={`w-full h-14 bg-gray-50 rounded-xl border-2 flex items-center justify-center transition-colors ${error ? 'border-red-200 bg-red-50' : 'border-gray-100'
                        }`}
                >
                    {phoneNumber ? (
                        <div className="text-2xl font-mono font-bold text-gray-800 tracking-wider" dir="ltr">
                            {formatPhoneDisplay(phoneNumber)}
                        </div>
                    ) : (
                        <div className="text-lg font-bold text-gray-400">
                            הקלד טלפון לקוח
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="text-red-600 text-sm font-bold text-center flex items-center justify-center gap-1">
                        <span>⚠️</span>
                        {error}
                    </div>
                )}

                {/* Keypad */}
                <NumericKeypad onKeyPress={handleKeypadPress} />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex flex-col gap-3">
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold text-lg hover:bg-gray-300 transition"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handlePhoneLookup}
                        disabled={phoneNumber.length !== 10 || isLoading}
                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 ${phoneNumber.length === 10 && !isLoading
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                בודק...
                            </>
                        ) : (
                            'המשך'
                        )}
                    </button>
                </div>

                {/* Option for Name Only */}
                {!isLoading && (
                    <button
                        onClick={() => {
                            setStep('name');
                            setError('');
                            // Clear phone if it's incomplete
                            if (phoneNumber.length < 10) setPhoneNumber('');
                            setTimeout(() => nameInputRef.current?.focus(), 100);
                        }}
                        className="w-full py-3.5 border-2 border-orange-100 text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition flex items-center justify-center gap-2"
                    >
                        <User size={20} />
                        המשך עם שם בלבד
                    </button>
                )}
            </div>
        </>
    );

    // Render name entry step
    const renderNameStep = () => (
        <>
            {/* Content - No header */}
            <div className="p-4 space-y-3">
                {/* Name Input */}
                <input
                    ref={nameInputRef}
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                        setCustomerName(e.target.value);
                        setError('');
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && customerName.trim()) {
                            handleNameSubmit();
                        }
                    }}
                    placeholder="הכנס שם..."
                    className={`w-full h-14 bg-gray-50 rounded-xl border-2 px-4 text-xl font-bold text-gray-800 text-center transition-colors ${error ? 'border-red-200 bg-red-50' : 'border-gray-100 focus:border-purple-400'
                        } outline-none`}
                    dir="rtl"
                />

                {/* Error Message */}
                {error && (
                    <div className="text-red-600 text-sm font-bold text-center flex items-center justify-center gap-1">
                        <span>⚠️</span>
                        {error}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                    onClick={onClose}
                    className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold text-lg hover:bg-gray-300 transition"
                >
                    ביטול
                </button>
                <button
                    onClick={handleNameSubmit}
                    disabled={!customerName.trim() || isLoading}
                    className={`flex-1 py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 ${customerName.trim() && !isLoading
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            שומר...
                        </>
                    ) : (
                        <>
                            <Check className="w-5 h-5" />
                            אישור
                        </>
                    )}
                </button>
            </div>
        </>
    );

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
            onClick={onClose}
            dir="rtl"
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {step === 'phone' && renderPhoneStep()}
                {step === 'name' && renderNameStep()}
            </div>

            {/* Customer Switch Confirmation Modal */}
            {showSwitchConfirm && pendingCustomer && (
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={handleCancelSwitch}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-200 text-center">
                            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                <UserCheck size={32} className="text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900">לקוח קיים נמצא</h2>
                            <p className="text-gray-500 font-medium mt-2">
                                הטלפון {pendingCustomer.phone} שייך ל-{pendingCustomer.name}
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-center text-gray-600 font-medium">
                                האם להעביר את ההזמנה ללקוח זה?
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={handleCancelSwitch}
                                className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold text-lg hover:bg-gray-300 transition"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleConfirmSwitch}
                                className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-bold text-lg hover:bg-blue-600 transition"
                            >
                                העבר ללקוח
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerInfoModal;
