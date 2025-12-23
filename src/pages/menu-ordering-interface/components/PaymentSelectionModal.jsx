import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Clock, Gift, Banknote, Star } from 'lucide-react';
import Button from '../../../components/ui/Button'; // Assuming Button component exists in this path, based on previous file
import { cn } from '../../../utils/cn'; // Assuming cn exists
import { useDiscounts } from '../hooks/useDiscounts';

const PaymentSelectionModal = ({
  isOpen,
  onClose,
  onPaymentSelect,
  cartTotal = 0,
  subtotal = 0,
  loyaltyDiscount = 0,
  cartItems = [],
  isRefund = false,
  refundAmount = 0,
  businessId = null
}) => {
  const [step, setStep] = useState('selection'); // 'selection' or 'pos_instruction'
  const [isProcessing, setIsProcessing] = useState(false);

  // Custom Hooks
  // We pass businessId to the hook
  // const { discounts, calculateDiscount } = useDiscounts(businessId);
  const discounts = [];
  const calculateDiscount = () => ({ amount: 0, details: '' });

  // State
  const [selectedDiscount, setSelectedDiscount] = useState(null); // The full discount object
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountDetails, setDiscountDetails] = useState('');

  // Payment Method State
  // We'll use a temporary state for the "intended" payment method if it requires a second step (like POS)
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(null);

  // Computed
  const finalPrice = Math.max(0, cartTotal - discountAmount);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('selection');
      setIsProcessing(false);
      setSelectedDiscount(null);
      setDiscountAmount(0);
      setDiscountDetails('');
      setPendingPaymentMethod(null);
    }
  }, [isOpen]);

  // Recalculate discount when selection or cart changes
  useEffect(() => {
    if (selectedDiscount) {
      const { amount, details } = calculateDiscount(selectedDiscount, cartItems, cartTotal);
      setDiscountAmount(amount);
      setDiscountDetails(details);
    } else {
      setDiscountAmount(0);
      setDiscountDetails('');
    }
  }, [selectedDiscount, cartItems, cartTotal, calculateDiscount]);

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

    return {
      customer_phone: customerData?.phone || '',
      customer_name: customerData?.name || '',
      payment_method: paymentMethod,
      is_paid: isPaid,
      total_amount: finalPrice, // Use final price with discount
      discount_id: selectedDiscount?.id || null,
      discount_amount: discountAmount,
      items: cartItems?.map((item) => ({
        menu_item_id: item?.id,
        quantity: item?.quantity ?? 1,
        mods: buildModsString(item),
      }))
    };
  };

  const handleDiscountToggle = (discount) => {
    if (selectedDiscount?.id === discount.id) {
      setSelectedDiscount(null);
    } else {
      setSelectedDiscount(discount);
    }
  };

  const handlePaymentMethodSelect = (method) => {
    // If credit card, show instruction
    if (method === 'credit_card') {
      setPendingPaymentMethod(method);
      setStep('pos_instruction');
      return;
    }

    // Immediate Payment (Cash, Gift Card, OTH)
    setIsProcessing(true);
    const orderData = buildOrderPayload(method, true);

    // For OTH, maybe we implicitly assume 100% discount if not already set?
    // For now, let's just record method. Using OTH discount renders total 0. 
    // If User pays full price with "OTH" (Manager Meal?), it's recorded.

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handlePayLater = () => {
    setIsProcessing(true);
    // Mark as cash (or none?) and not paid
    const orderData = buildOrderPayload('cash', false);

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handleConfirmPOS = () => {
    setIsProcessing(true);
    // Confirm pending method (credit card)
    const orderData = buildOrderPayload(pendingPaymentMethod || 'credit_card', true);

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handleCancelPOS = () => {
    setStep('selection');
    setPendingPaymentMethod(null);
  };

  // Payment Methods Config
  const PAYMENT_METHODS = [
    { id: 'cash', label: 'מזומן', icon: Banknote, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
    { id: 'credit_card', label: 'אשראי', icon: CreditCard, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { id: 'gift_card', label: 'גיפט קארד', icon: Gift, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
    { id: 'oth', label: 'ע״ח הבית', icon: Star, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  ];

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

          <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-8">
            <div className={`w-full ${isRefund ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border-2 rounded-3xl p-8 text-center`}>
              <p className="text-sm font-bold mb-3 text-slate-600">{isRefund ? 'סכום לזיכוי במכשיר סליקה:' : 'הזן במכשיר סליקה:'}</p>
              <p className={`text-7xl font-black ${isRefund ? 'text-red-600' : 'text-blue-600'}`}>
                {formatPrice(isRefund ? refundAmount : finalPrice)}{isRefund ? '-' : ''}
              </p>
            </div>

            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-slate-700">
                {isRefund ? 'בצע זיכוי במכשיר הסליקה' : 'הזן את הסכום במכשיר הסליקה'}
              </p>
              <p className="text-sm text-slate-500">
                {isRefund ? 'לאחר ביצוע הזיכוי, לחץ על "אישור"' : 'לאחר אישור התשלום במכשיר, לחץ על "אישור"'}
              </p>
            </div>
          </div>

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
                onClick={handleConfirmPOS} // CHANGED to specific handler
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100">
                <CreditCard size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  {isRefund ? 'אישור זיכוי' : 'תשלום'}
                </h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{cartItems?.reduce((count, item) => count + item?.quantity, 0)} פריטים</span>
                  <span>•</span>
                  <span>סה״כ: {formatPrice(cartTotal)}</span>
                </div>
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

        {/* Main Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Totals Summary */}
          <div className={`${isRefund ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'} border-2 rounded-3xl p-6`}>
            {/* Base */}
            <div className="flex justify-between items-center mb-2 text-slate-500 font-medium">
              <span>סכום לתשלום</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>

            {/* Loyalty Discount */}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between items-center mb-2 text-green-600 font-medium">
                <span>הנחת מועדון</span>
                <span>-{formatPrice(loyaltyDiscount)}</span>
              </div>
            )}

            {/* Selected Discount */}
            {discountAmount > 0 && (
              <div className="flex justify-between items-center mb-4 text-blue-600 font-medium bg-blue-50 p-2 rounded-lg border border-blue-100">
                <div className="flex flex-col">
                  <span>{selectedDiscount?.name}</span>
                  <span className="text-xs opacity-70">{discountDetails}</span>
                </div>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-slate-200 my-4" />

            {/* Final Total */}
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-slate-800">סה״כ לתשלום</span>
              <span className={`text-4xl font-black ${isRefund ? 'text-red-600' : 'text-slate-800'}`}>
                {formatPrice(finalPrice)}
              </span>
            </div>
          </div>

          {/* Discounts Grid */}
          {/* Discounts Grid - TEMPORARILY DISABLED
          {!isRefund && (
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Star size={18} className="text-yellow-500" />
                הנחות
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {discounts.map(discount => {
                  const isActive = selectedDiscount?.id === discount.id;
                  return (
                    <button
                      key={discount.id}
                      onClick={() => handleDiscountToggle(discount)}
                      className={cn(
                        "p-4 rounded-xl border-2 text-right transition-all",
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-slate-100 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="font-bold">{discount.name}</div>
                      <div className="text-xs opacity-70">
                        {discount.type === 'PERCENTAGE' && `${discount.value}%`}
                        {discount.type === 'FIXED' && `₪${discount.value}`}
                        {discount.type === 'FREE_ITEM' && 'פריט מתנה'}
                      </div>
                    </button>
                  );
                })}
                {discounts.length === 0 && (
                  <div className="col-span-2 text-center text-sm text-slate-400 py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    אין הנחות זמינות
                  </div>
                )}
              </div>
            </div>
          )}
          */}

          {/* Payment Methods Grid */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-3">אמצעי תשלום</h3>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method.id}
                  onClick={() => handlePaymentMethodSelect(method.id)}
                  disabled={isProcessing}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-2xl transition-all border-2 border-transparent",
                    method.color,
                    "hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
                  )}
                >
                  <method.icon size={28} />
                  <span className="font-bold text-lg">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <button
            onClick={handlePayLater} // Keep Pay Later Logic
            disabled={isProcessing}
            className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-lg hover:bg-slate-100 transition flex items-center justify-center gap-2"
          >
            <Clock size={20} />
            <span>שמור ללא תשלום (תשלום אחר כך)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSelectionModal;