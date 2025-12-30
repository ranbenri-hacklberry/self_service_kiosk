import React, { useEffect } from 'react';
import { PartyPopper, Sparkles, Coffee } from 'lucide-react';

const OrderConfirmationModal = ({ isOpen, orderDetails, onStartNewOrder }) => {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onStartNewOrder?.();
    }, 2500);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, onStartNewOrder]);

  if (!isOpen || !orderDetails) return null;

  const {
    customerName = 'אורח',
    orderNumber,
    total = 0,
    subtotal,
    soldierDiscountAmount = 0,
    loyaltyDiscount = 0,
    loyaltyCoffeeCount,
    loyaltyRewardEarned,
    paymentStatus,
    isRefund,
    refundAmount,
    isEdit
  } = orderDetails;

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

  const hasDiscounts = soldierDiscountAmount > 0 || loyaltyDiscount > 0;
  const formattedTotal = formatPrice(total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">

        {/* Header Section - Happy & Celebratory */}
        <div className={`p-8 pb-4 flex flex-col items-center text-center space-y-4 ${isRefund ? 'bg-gradient-to-b from-red-50 to-white' : 'bg-gradient-to-b from-green-50 to-white'
          }`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center relative ${isRefund ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
            }`}>
            {isRefund ? (
              <Coffee className="w-12 h-12" strokeWidth={2.5} />
            ) : (
              <>
                <PartyPopper className="w-12 h-12" strokeWidth={2.5} />
                <Sparkles className="w-6 h-6 absolute -top-1 -right-1 text-yellow-500 animate-pulse" />
                <Sparkles className="w-5 h-5 absolute -bottom-1 -left-1 text-yellow-400 animate-pulse" />
              </>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-800">
              {isRefund ? 'זיכוי בוצע! 💰' : isEdit ? 'עודכן בהצלחה! ✨' : 'מעולה! 🎉'}
            </h2>
            <p className="text-lg text-slate-500 font-medium">
              {isRefund
                ? 'הזיכוי בוצע בהצלחה'
                : isEdit
                  ? 'ההזמנה עודכנה והועברה למטבח'
                  : 'ההזמנה התקבלה ומועברת למסך השירות'}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-4">

          {/* Order Number & Total Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
            {orderNumber && (
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-slate-500 font-bold">מספר הזמנה</span>
                <span className="text-2xl font-black text-slate-800">#{orderNumber}</span>
              </div>
            )}

            {/* Show discounts breakdown if any */}
            {hasDiscounts && subtotal && (
              <div className="space-y-1 text-sm border-b border-slate-200 pb-3">
                <div className="flex justify-between items-center text-slate-500">
                  <span>סה"כ לפני הנחות</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {soldierDiscountAmount > 0 && (
                  <div className="flex justify-between items-center text-blue-600">
                    <span>🎖️ הנחת חייל (10%)</span>
                    <span>-{formatPrice(soldierDiscountAmount)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>🎁 הנחת נאמנות</span>
                    <span>-{formatPrice(loyaltyDiscount)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-bold">
                {isRefund ? 'סכום לזיכוי' : 'סה"כ שולם'}
              </span>
              <span className={`text-3xl font-black ${isRefund ? 'text-red-600' : 'text-green-600'}`}>
                {isRefund ? `${formatPrice(refundAmount)}-` : formattedTotal}
              </span>
            </div>
          </div>

          {/* Loyalty Status Card */}
          {typeof loyaltyCoffeeCount === 'number' && (
            <div className={`rounded-2xl p-5 border-2 text-center ${loyaltyRewardEarned
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
              }`}>
              <p className={`text-base font-bold mb-2 ${loyaltyRewardEarned ? 'text-green-700' : 'text-amber-700'
                }`}>
                {loyaltyRewardEarned
                  ? '🎉 איזה כיף! הקפה הבא עלינו!'
                  : 'הכרטיסייה מתקדמת!'}
              </p>

              <div className="flex justify-center items-end gap-2">
                <span className={`text-4xl font-black ${loyaltyRewardEarned ? 'text-green-600' : 'text-amber-600'
                  }`}>
                  {Math.min(loyaltyCoffeeCount, 10)}
                </span>
                <span className={`text-lg font-bold mb-1 ${loyaltyRewardEarned ? 'text-green-400' : 'text-amber-400'
                  }`}>/10</span>
              </div>

              {!loyaltyRewardEarned && (
                <p className="text-xs font-medium text-amber-600/80 mt-1">
                  עוד {Math.max(0, 10 - Math.min(loyaltyCoffeeCount, 10))} לקפה מתנה ☕
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-gradient-to-t from-slate-100 to-slate-50 border-t border-slate-100 text-center">
          <p className="text-sm font-bold text-slate-400 flex items-center justify-center gap-2">
            <span className="animate-spin inline-block">⏳</span>
            חוזרים למסך הראשי...
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationModal;
