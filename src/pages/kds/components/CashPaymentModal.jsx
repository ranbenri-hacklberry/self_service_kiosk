import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard } from 'lucide-react';

const CashPaymentModal = ({ isOpen, onClose, orderId, orderAmount, customerName, onConfirmCash, onSwitchToCredit }) => {
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsProcessing(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsProcessing(true);

        // Simulate a small delay for UX
        setTimeout(() => {
            // For now, we'll just mark as cash payment
            // The POS device will handle whether it's cash or credit
            onConfirmCash(orderId);
            setIsProcessing(false);
            onClose();
        }, 300);
    };

    // Direct to POS Instruction Screen (no payment method selection)
    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
            dir="rtl"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col min-h-[500px] max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-white p-6 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">{customerName}</h2>
                                <p className="text-sm text-slate-400 font-medium">קבלת תשלום</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600">
                            <X size={28} />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-8">
                    {/* Amount Display - Large and Prominent */}
                    <div className="w-full bg-blue-50 border-2 border-blue-200 rounded-3xl p-8 text-center">
                        <p className="text-sm font-bold mb-3 text-slate-600">הזן במכשיר סליקה:</p>
                        <p className="text-7xl font-black text-blue-600">
                            ₪{orderAmount.toFixed(2)}
                        </p>
                    </div>

                    {/* Instruction */}
                    <div className="text-center space-y-2">
                        <p className="text-xl font-bold text-slate-700">
                            הזן את הסכום במכשיר הסליקה
                        </p>
                        <p className="text-sm text-slate-500">
                            המכשיר יאפשר בחירה בין מזומן לאשראי
                        </p>
                        <p className="text-sm text-slate-500">
                            לאחר אישור התשלום במכשיר, לחץ על "אישור"
                        </p>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-slate-100 bg-white">
                    <div className="flex gap-3">
                        {/* Cancel Button - Right */}
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xl transition disabled:opacity-50"
                        >
                            ביטול
                        </button>

                        {/* Confirm Button - Left (Green) */}
                        <button
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-xl transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <span>מעבד...</span>
                            ) : (
                                <>
                                    <Check size={24} strokeWidth={3} />
                                    <span>אישור תשלום</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashPaymentModal;
