import React, { useState } from 'react';
import { X, Check, CreditCard, Clock } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';

const PaymentSelectionModal = ({
  isOpen,
  onClose,
  onPaymentSelect,
  cartTotal = 0,
  subtotal = 0,
  loyaltyDiscount = 0,
  cartItems = [],
  isRefund = false,
  refundAmount = 0
}) => {
  const [step, setStep] = useState('selection'); // 'selection' or 'pos_instruction'
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('selection');
      setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0
    })?.format(price);
  };

  const buildModsString = (item) => {
    if (!item?.selectedOptions) return null;
    try {
      if (Array.isArray(item.selectedOptions)) {
        const modsObject = {};
        item.selectedOptions.forEach((opt) => {
          if (opt?.groupId && opt?.valueName) {
            modsObject[opt.groupId] = opt.valueName;
          }
        });
        return Object.keys(modsObject).length > 0 ? JSON.stringify(modsObject) : null;
      }

      const normalizedOptions = {};
      Object.keys(item.selectedOptions).forEach((key) => {
        const value = item.selectedOptions[key];
        if (value && typeof value === 'object' && value.valueName) {
          normalizedOptions[key] = value.valueName;
        } else {
          normalizedOptions[key] = value;
        }
      });

      return Object.keys(normalizedOptions).length > 0 ? JSON.stringify(normalizedOptions) : null;
    } catch (e) {
      console.error('Error building mods string:', e);
      return null;
    }
  };

  const buildOrderPayload = (paymentMethod, isPaid) => {
    const customerDataString = localStorage.getItem('currentCustomer');
    const customerData = customerDataString ? JSON.parse(customerDataString) : {};

    console.log('📦 items sent:', cartItems?.map((item) => ({ id: item?.id, qty: item?.quantity })));

    return {
      customer_phone: customerData?.phone || '',
      customer_name: customerData?.name || '',
      payment_method: paymentMethod,
      is_paid: isPaid,
      total_amount: cartTotal,
      items: cartItems?.map((item) => ({
        menu_item_id: item?.id,
        quantity: item?.quantity ?? 1,
        mods: buildModsString(item),
      }))
    };
  };

  const handlePayNow = () => {
    // Move to POS instruction screen
    setStep('pos_instruction');
  };

  const handlePayLater = () => {
    setIsProcessing(true);

    // Mark as cash and not paid (will be paid when order is ready)
    const orderData = buildOrderPayload('cash', false);

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handleConfirmPayment = () => {
    setIsProcessing(true);

    // Mark as cash and paid
    const orderData = buildOrderPayload('cash', true);

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handleCancelPOS = () => {
    setStep('selection');
  };

  // POS Instruction Screen
  if (step === 'pos_instruction') {
    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        dir="rtl"
      >
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden flex flex-col min-h-[500px]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100">
                <CreditCard size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">אישור תשלום</h2>
                <p className="text-sm text-slate-400">הזן במכשיר סליקה</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-8">
            {/* Amount Display */}
            <div className={`w-full ${isRefund ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border-2 rounded-3xl p-8 text-center`}>
              <p className="text-sm font-bold mb-3 text-slate-600">{isRefund ? 'סכום לזיכוי במכשיר סליקה:' : 'הזן במכשיר סליקה:'}</p>
              <p className={`text-7xl font-black ${isRefund ? 'text-red-600' : 'text-blue-600'}`}>
                {formatPrice(isRefund ? refundAmount : cartTotal)}{isRefund ? '-' : ''}
              </p>
            </div>

            {/* Instruction */}
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-slate-700">
                {isRefund ? 'בצע זיכוי במכשיר הסליקה' : 'הזן את הסכום במכשיר הסליקה'}
              </p>
              <p className="text-sm text-slate-500">
                {isRefund ? 'לאחר ביצוע הזיכוי, לחץ על "אישור"' : 'לאחר אישור התשלום במכשיר, לחץ על "אישור"'}
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="p-6 border-t border-slate-100">
            <div className="flex gap-3">
              <button
                onClick={handleCancelPOS}
                disabled={isProcessing}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xl transition disabled:opacity-50"
              >
                ביטול
              </button>

              <button
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className={`flex-[2] py-4 ${isRefund ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-2xl font-bold text-xl transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {isProcessing ? (
                  <span>מעבד...</span>
                ) : (
                  <>
                    <Check size={24} strokeWidth={3} />
                    <span>{isRefund ? 'זיכוי ועדכון הזמנה' : 'אישור ושליחת הזמנה'}</span>
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100">
                <CreditCard size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  {isRefund ? 'אישור זיכוי' : 'אישור תשלום'}
                </h2>
                <p className="text-sm text-slate-400">
                  {cartItems?.reduce((count, item) => count + item?.quantity, 0)} פריטים
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              disabled={isProcessing}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-6">
          {/* Amount Display */}
          <div className={`${isRefund ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border-2 rounded-3xl p-8 text-center`}>
            <p className="text-sm font-bold mb-2 text-slate-600">
              {isRefund ? 'סכום לזיכוי' : 'סכום לתשלום'}
            </p>
            <p className={`text-6xl font-black ${isRefund ? 'text-red-600' : 'text-blue-600'}`}>
              {isRefund ? formatPrice(refundAmount) : formatPrice(cartTotal)}{isRefund ? '-' : ''}
            </p>
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between items-center bg-green-50 p-2 rounded-lg border border-green-100 mt-2">
                <span className="text-green-700 font-bold">הנחת נאמנות</span>
                <span className="text-green-800 font-bold dir-ltr">-{formatPrice(loyaltyDiscount)}</span>
              </div>
            )}
          </div>

          {/* Instruction */}
          <div className="text-center">
            <p className="text-lg font-bold text-slate-700">
              בחר אופן תשלום
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-6 border-t border-slate-100 space-y-3">
          {/* Pay Later Button */}
          <button
            onClick={handlePayLater}
            disabled={isProcessing}
            className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Clock size={20} />
            <span>תשלום אחר כך (עד קבלת ההזמנה)</span>
          </button>

          {/* Pay Now Buttons Row */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="flex-1 h-14 text-lg bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl transition-all"
              disabled={isProcessing}
            >
              ביטול
            </Button>

            <button
              onClick={handlePayNow}
              disabled={isProcessing}
              className={`flex-[2] h-14 ${isRefund ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-2xl font-bold text-xl transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              <Check size={24} strokeWidth={3} />
              <span>{isRefund ? 'המשך לזיכוי' : 'תשלום עכשיו'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSelectionModal;