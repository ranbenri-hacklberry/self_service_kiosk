import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Banknote, Gift, Star, Clock, History } from 'lucide-react';

/**
 * KDS Payment Modal - Used to collect payment for orders from KDS
 * Shows payment method selection and instructions for each method
 */
const KDSPaymentModal = ({
    isOpen,
    onClose,
    order,
    onConfirmPayment,
    onMoveToHistory,
    isFromHistory = false // When true, hide "Move to History" button
}) => {
    const [step, setStep] = useState('selection'); // 'selection' | 'instruction'
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('selection');
            setSelectedMethod(null);
            setIsProcessing(false);
        }
    }, [isOpen]);

    if (!isOpen || !order) return null;

    const orderAmount = order.totalAmount || 0;
    const customerName = order.customerName || 'לקוח';

    const formatPrice = (price) => {
        const num = Number(price);
        const hasDecimals = num % 1 !== 0;
        return new Intl.NumberFormat('he-IL', {
            style: 'currency',
            currency: 'ILS',
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: 2
        }).format(num);
    };

    // Payment Methods Config
    const PAYMENT_METHODS = [
        { id: 'cash', label: 'מזומן', icon: Banknote, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
        { id: 'credit_card', label: 'אשראי', icon: CreditCard, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
        { id: 'bit', label: 'ביט', icon: CreditCard, color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
        { id: 'paybox', label: 'פייבוקס', icon: CreditCard, color: 'bg-pink-100 text-pink-700 hover:bg-pink-200' },
        { id: 'gift_card', label: 'שובר', icon: Gift, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
        { id: 'oth', label: 'OTH', icon: Star, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
    ];

    // Payment Instructions Config
    const PAYMENT_INSTRUCTIONS = {
        credit_card: {
            title: 'אישור תשלום באשראי',
            subtitle: 'הזן במכשיר סליקה',
            icon: CreditCard,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            amountBg: 'bg-blue-50 border-blue-200',
            amountColor: 'text-blue-600',
            instructions: [
                'הקש את הסכום במכשיר הסליקה',
                'העבר את כרטיס הלקוח',
                'קבל אישור מהמכשיר'
            ],
            confirmText: 'התשלום התקבל'
        },
        cash: {
            title: 'תשלום במזומן',
            subtitle: 'רישום בקופה',
            icon: Banknote,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            amountBg: 'bg-green-50 border-green-200',
            amountColor: 'text-green-600',
            instructions: [
                'פתח עסקה בקופה הרושמת',
                'בחר אמצעי תשלום: מזומן',
                'סגור את העסקה בקופה'
            ],
            confirmText: 'העסקה נרשמה'
        },
        gift_card: {
            title: 'תשלום בשובר/גיפט קארד',
            subtitle: 'רישום על השובר',
            icon: Gift,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            amountBg: 'bg-purple-50 border-purple-200',
            amountColor: 'text-purple-600',
            instructions: [
                'רשום על השובר את סכום הקנייה הנוכחית',
                'הפנה את הלקוח למשתלה',
                'במשתלה ישלימו את ההפרש ליתרת השובר'
            ],
            confirmText: 'השובר עודכן'
        },
        oth: {
            title: 'על חשבון הבית',
            subtitle: 'אישור הנהלה',
            icon: Star,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
            amountBg: 'bg-orange-50 border-orange-200',
            amountColor: 'text-orange-600',
            instructions: [
                'ההזמנה תירשם כ"על חשבון הבית"'
            ],
            confirmText: 'אישור'
        },
        bit: {
            title: 'Bit - להעברה ל 055-6822072',
            subtitle: 'העברה באפליקציה',
            icon: CreditCard,
            iconBg: 'bg-cyan-50',
            iconColor: 'text-cyan-600',
            amountBg: 'bg-cyan-50 border-cyan-200',
            amountColor: 'text-cyan-600',
            instructions: [
                '⚠️ חשוב! בקש מהלקוח להשאיר את שדה הסיבה ריק',
                'ודא שהלקוח שולח למספר: 055-6822072',
                'המתן לקבלת אישור העברה על המסך',
                'אשר רק לאחר שראית את האישור'
            ],
            confirmText: 'קיבלתי אישור'
        },
        paybox: {
            title: 'Paybox - להעברה ל 055-6822072',
            subtitle: 'העברה באפליקציה',
            icon: CreditCard,
            iconBg: 'bg-pink-50',
            iconColor: 'text-pink-600',
            amountBg: 'bg-pink-50 border-pink-200',
            amountColor: 'text-pink-600',
            instructions: [
                'ודא שהלקוח שולח למספר: 055-6822072',
                'המתן לקבלת אישור העברה',
                'אשר רק לאחר שראית את האישור'
            ],
            confirmText: 'קיבלתי אישור'
        }
    };

    const handleMethodSelect = (methodId) => {
        setSelectedMethod(methodId);
        setStep('instruction');
    };

    const handleConfirm = async () => {
        if (!onConfirmPayment || !selectedMethod) return;

        setIsProcessing(true);
        try {
            await onConfirmPayment(order.originalOrderId || order.id, selectedMethod);
            onClose();
        } catch (err) {
            alert('שגיאה באישור התשלום: ' + (err?.message || err));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMoveToHistory = async () => {
        if (!onMoveToHistory) {
            onClose();
            return;
        }

        setIsProcessing(true);
        try {
            await onMoveToHistory(order.originalOrderId || order.id);
            // Close modal and signal to show history info popup for unpaid orders
            onClose({ showHistoryInfo: !order.isPaid, orderNumber: order.orderNumber });
        } catch (err) {
            alert('שגיאה בהעברה להיסטוריה: ' + (err?.message || err));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBack = () => {
        setStep('selection');
        setSelectedMethod(null);
    };

    // Instruction Screen
    if (step === 'instruction' && selectedMethod) {
        const config = PAYMENT_INSTRUCTIONS[selectedMethod];
        const IconComponent = config?.icon || CreditCard;

        return (
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
                dir="rtl"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
                    style={{ maxHeight: '72vh' }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${config?.iconBg} rounded-full flex items-center justify-center ${config?.iconColor} border border-slate-100`}>
                                <IconComponent size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">{config?.title}</h2>
                                <p className="text-xs text-slate-400">{config?.subtitle}</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-4">
                        <div className={`w-full ${config?.amountBg} border-2 rounded-2xl p-6 text-center`}>
                            <p className="text-sm font-bold mb-2 text-slate-600">סכום לתשלום:</p>
                            <p className={`text-5xl font-black ${config?.amountColor}`}>
                                {selectedMethod === 'oth' ? formatPrice(0) : formatPrice(orderAmount)}
                            </p>
                        </div>

                        <div className="w-full bg-slate-50 rounded-2xl p-4 space-y-2">
                            {config?.instructions.map((instruction, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                                        {idx + 1}
                                    </div>
                                    <p className="text-sm text-slate-700 font-medium">{instruction}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100">
                        <div className="flex gap-3">
                            <button
                                onClick={handleBack}
                                disabled={isProcessing}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-lg transition disabled:opacity-50"
                            >
                                חזור
                            </button>

                            <button
                                onClick={handleConfirm}
                                disabled={isProcessing}
                                className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <span>מעבד...</span>
                                ) : (
                                    <>
                                        <Check size={20} strokeWidth={3} />
                                        <span>{config?.confirmText}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Selection Screen
    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
            dir="rtl"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
                style={{ maxHeight: '80vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100">
                                <CreditCard size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">{customerName}</h2>
                                <p className="text-xs text-slate-400 font-medium">קבלת תשלום</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {/* Amount Display */}
                    <div className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-center">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-800">סה״כ לתשלום</span>
                            <span className="text-3xl font-black text-slate-800">
                                {formatPrice(orderAmount)}
                            </span>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <h3 className="text-base font-bold text-slate-800 mb-2 shrink-0">אמצעי תשלום</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {PAYMENT_METHODS.map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => handleMethodSelect(method.id)}
                                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all border-2 border-transparent ${method.color} hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md 
                                    ${['cash', 'credit_card'].includes(method.id) ? 'col-span-2 h-32 p-4' : 'col-span-1 h-20 p-2'}`}
                                >
                                    <method.icon size={['cash', 'credit_card'].includes(method.id) ? 24 : 20} />
                                    <span className={`font-bold ${['cash', 'credit_card'].includes(method.id) ? 'text-base' : 'text-sm'}`}>{method.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    {isFromHistory ? (
                        // From History: Only Cancel button
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="w-full py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-lg hover:bg-slate-100 transition disabled:opacity-50"
                        >
                            ביטול
                        </button>
                    ) : (
                        // From Active: Cancel (1/3) + Move to History (2/3)
                        <div className="flex gap-3">
                            {/* Cancel Button - Right side (RTL), 1/3 width */}
                            <button
                                onClick={onClose}
                                disabled={isProcessing}
                                className="flex-1 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-lg hover:bg-slate-100 transition disabled:opacity-50"
                            >
                                ביטול
                            </button>

                            {/* Move to History Button - Left side (RTL), 2/3 width */}
                            <button
                                onClick={handleMoveToHistory}
                                disabled={isProcessing}
                                className="flex-[2] py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-base transition shadow-md disabled:opacity-50 flex flex-col items-center justify-center"
                            >
                                <div className="flex items-center gap-2">
                                    <History size={18} />
                                    <span>{isProcessing ? 'מעביר...' : 'העבר להיסטוריה'}</span>
                                </div>
                                <span className="text-[10px] font-medium opacity-70 mt-0.5">ניתן יהיה לגשת להזמנה דרך טאב היסטוריה</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KDSPaymentModal;
