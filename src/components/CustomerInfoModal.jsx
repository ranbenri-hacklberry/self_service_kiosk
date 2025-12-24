import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, User, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NumericKeypad from '@/pages/customer-phone-input-screen/components/NumericKeypad';

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

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            // Reset state
            setPhoneNumber(currentCustomer?.phone || '');
            setCustomerName(currentCustomer?.name || '');
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
                const customer = {
                    id: data.customer.id,
                    phone: cleanPhone,
                    name: data.customer.name,
                    loyalty_coffee_count: data.customer.loyalty_coffee_count || 0
                };

                // If editing an order (KDS flow), update it
                if (orderId) {
                    await updateOrderCustomer(orderId, customer);
                }

                // Return customer data
                onCustomerUpdate?.(customer);
                onClose();
            } else {
                // New customer - advance to name entry
                if (mode === 'phone-then-name') {
                    setStep('name');
                    setTimeout(() => nameInputRef.current?.focus(), 100);
                } else {
                    // Just phone mode - create anonymous customer
                    const customer = {
                        id: null,
                        phone: cleanPhone,
                        name: 'אורח',
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
            let customerId = currentCustomer?.id;

            // If we have a phone, create/update customer via RPC
            if (cleanPhone && cleanPhone.length === 10) {
                // Use RPC to create/update customer (bypasses RLS)
                const { data: customerData, error: rpcError } = await supabase.rpc('create_or_update_customer', {
                    p_business_id: currentUser?.business_id,
                    p_phone: cleanPhone,
                    p_name: customerName.trim()
                });

                if (rpcError) throw rpcError;
                customerId = customerData;
            } else if (!cleanPhone) {
                // Name only - use RPC to create customer without phone
                const { data: customerData, error: rpcError } = await supabase.rpc('create_or_update_customer', {
                    p_business_id: currentUser?.business_id,
                    p_phone: null,
                    p_name: customerName.trim()
                });

                if (rpcError) throw rpcError;
                customerId = customerData;
            }

            const customer = {
                id: customerId,
                phone: cleanPhone || null,
                name: customerName.trim(),
                loyalty_coffee_count: 0
            };

            // If editing an order (KDS flow), update it
            if (orderId) {
                await updateOrderCustomer(orderId, customer);
            }

            // Return customer data
            onCustomerUpdate?.(customer);
            onClose();
        } catch (err) {
            console.error('Name submission error:', err);
            setError('שגיאה בשמירת הנתונים. אנא נסה שוב.');
        } finally {
            setIsLoading(false);
        }
    };

    // Update order with customer info (KDS flow)
    const updateOrderCustomer = async (orderId, customer) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    customer_id: customer.id,
                    customer_phone: customer.phone,
                    customer_name: customer.name
                })
                .eq('id', orderId);

            if (error) throw error;
        } catch (err) {
            console.error('Failed to update order customer:', err);
            throw err;
        }
    };

    // Render phone entry step
    const renderPhoneStep = () => (
        <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-3">
                    <Phone className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-gray-900">הזן מספר טלפון</h2>
                <p className="text-gray-500 font-medium mt-1">לזיהוי ומעקב אחר ההזמנה</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
                {/* Phone Display */}
                <div
                    className={`w-full h-14 bg-gray-50 rounded-xl border-2 flex items-center justify-center transition-colors ${error ? 'border-red-200 bg-red-50' : 'border-gray-100'
                        }`}
                >
                    <div className="text-2xl font-mono font-bold text-gray-800 tracking-wider" dir="ltr">
                        {formatPhoneDisplay(phoneNumber) || '___-___-____'}
                    </div>
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
            <div className="p-6 border-t border-gray-200 flex gap-3">
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
        </>
    );

    // Render name entry step
    const renderNameStep = () => (
        <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mb-3">
                    <User className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-gray-900">מה השם?</h2>
                <p className="text-gray-500 font-medium mt-1">לזיהוי ההזמנה</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
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
        </div>
    );
};

export default CustomerInfoModal;
