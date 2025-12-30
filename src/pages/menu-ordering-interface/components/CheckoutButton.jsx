import React, { useMemo } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const CheckoutButton = ({
  cartTotal = 0,
  originalTotal, // Subtotal before discount
  loyaltyDiscount = 0,
  cartItems = [],
  onInitiatePayment,
  disabled = false,
  className = "",
  isEditMode = false,
  editingOrderData = null
}) => {
  // Format price to Israeli Shekel (ILS) - show agorot if present
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

  // Handler for payment/update action
  const handlePaymentClick = () => {
    // A refund scenario is allowed even if cartTotal is 0 (total difference is negative)
    if (onInitiatePayment && cartItems.length > 0 && (cartTotal > 0 || isRefund || loyaltyDiscount > 0)) {
      const orderData = {
        items: cartItems,
        total: cartTotal,
        // Using correct data fields for editingOrderData structure, if available
        originalTotal: editingOrderData?.totalAmount,
        timestamp: new Date().toISOString(),
        orderNumber: editingOrderData?.orderNumber || `ORD-${Date.now()}`,
        itemCount: cartItems.reduce((count, item) => count + item.quantity, 0),
        isEdit: isEditMode,
      };
      onInitiatePayment(orderData);
    }
  };

  // --- Updated Logic for Edit Mode ---
  const originalTotalAmount = editingOrderData?.totalAmount || 0;
  const originalIsPaid = editingOrderData?.isPaid || false;

  // The difference: Positive means additional charge, Negative means refund
  const priceDifference = cartTotal - originalTotalAmount;

  // 1. Is it a Refund? (Paid order, and new total is lower)
  const isRefund = isEditMode && originalIsPaid && priceDifference < 0;

  const isDisabled = disabled || (cartItems.length === 0 && !isRefund);

  // 2. Is it an Additional Charge? (Paid order, and new total is higher)
  const isAdditionalCharge = isEditMode && originalIsPaid && priceDifference > 0;

  // 3. Is it a Finalization? (Unpaid order, just finishing payment)
  const isFinalizingOrder = isEditMode && !originalIsPaid;

  // 4. Is it an Update with No Payment Change? (Paid order, and total is the same)
  const isNoChangeUpdate = isEditMode && originalIsPaid && priceDifference === 0;

  // Text displayed on the button
  const buttonText = useMemo(() => {
    if (isDisabled) return 'הוסף פריטים להזמנה';

    if (!isEditMode) return 'המשך לתשלום';

    // --- Edit Mode States ---
    if (isRefund) return 'החזר כספי';
    if (isAdditionalCharge) return 'חיוב נוסף';
    if (isFinalizingOrder) return 'השלם תשלום';
    if (isNoChangeUpdate) return 'עדכן הזמנה';

    return 'עדכן הזמנה'; // Default for edit mode if cartTotal > 0
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, isFinalizingOrder, isNoChangeUpdate]);

  // Amount displayed on the button
  const buttonAmount = useMemo(() => {
    // Only display an amount if we are not disabled and not in regular checkout with 0 total
    if (isDisabled && !isEditMode && cartTotal <= 0 && loyaltyDiscount === 0) return '';

    if (isRefund) return formatPrice(Math.abs(priceDifference)); // Refund: Display the positive difference
    if (isAdditionalCharge) return formatPrice(priceDifference); // Additional Charge: Display the positive difference

    // In other cases (Finalizing, No Change Update, Regular Checkout) - Display the total cart amount
    return formatPrice(cartTotal);
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, cartTotal, priceDifference, loyaltyDiscount]);

  // Dynamic Tailwind Classes for button color/style
  const buttonVariantClass = useMemo(() => {
    if (isDisabled) return 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300';
    // Refund: Red background
    if (isEditMode && isRefund) return 'bg-red-500 hover:bg-red-600 text-white animate-scale-touch shadow-kiosk hover:shadow-kiosk-lg';
    // Charge/Finalize/Regular: Orange (Primary Action)
    if (isAdditionalCharge || isFinalizingOrder || !isEditMode) return 'bg-orange-500 hover:bg-orange-600 text-white animate-scale-touch shadow-kiosk hover:shadow-kiosk-lg';
    // No change update: Gray/default
    return 'bg-gray-500 hover:bg-gray-600 text-white animate-scale-touch shadow-kiosk hover:shadow-kiosk-lg';
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, isFinalizingOrder]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 lg:static lg:z-auto ${className}`} dir="rtl">

      {/* Refund Note */}
      {isRefund && (
        <div className="flex justify-between items-center mb-3 px-3 py-2 text-sm font-bold text-red-700 bg-red-50 rounded-xl border border-red-100 shadow-sm">
          <span className="flex items-center gap-2">↩️ החזר ללקוח</span>
          <span className="bg-white px-2 py-0.5 rounded text-red-800 dir-ltr">{formatPrice(Math.abs(priceDifference))}</span>
        </div>
      )}

      {/* Loyalty Discount Badge */}
      {loyaltyDiscount > 0 && (
        <div className="flex justify-between items-center mb-3 px-3 py-2 text-sm font-bold text-green-700 bg-green-50 rounded-xl border border-green-100 shadow-sm">
          <span className="flex items-center gap-2">🎁 הנחת נאמנות</span>
          <span className="bg-white px-2 py-0.5 rounded text-green-800 dir-ltr">-{formatPrice(loyaltyDiscount)}</span>
        </div>
      )}

      {/* Payment Button */}
      <Button
        variant="default"
        size="xl"
        fullWidth
        disabled={isDisabled && !isRefund}
        className={`
          ${buttonVariantClass}
          touch-target transition-all duration-200 font-extrabold text-xl min-h-[64px] rounded-xl
        `}
        iconName={isDisabled && !isRefund ? "ShoppingCart" : "CreditCard"}
        iconPosition="right"
        iconSize={24}
        onClick={handlePaymentClick}
      >
        <div className="flex items-center justify-between w-full">
          <span>{buttonText}</span>
          {/* The amount only shows if we are in edit mode OR if it's a regular, non-empty checkout */}
          <span className={`font-mono text-2xl ${isDisabled && !isEditMode ? 'hidden' : ''}`}>
            {buttonAmount}
          </span>
        </div>
      </Button>

      {/* Payment Methods Info */}
      {/* Show payment methods only in regular checkout mode */}
      {!isDisabled && !isEditMode && (
        <div className="flex items-center justify-center space-x-6 text-xs text-gray-400 bg-gray-50 rounded-lg p-3 mt-3">
          <div className="flex items-center space-x-1">
            <Icon name="CreditCard" size={14} />
            <span>כרטיס אשראי</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Smartphone" size={14} />
            <span>Apple Pay</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Banknote" size={14} />
            <span>מזומן</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutButton;