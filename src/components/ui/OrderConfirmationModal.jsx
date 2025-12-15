import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

const OrderConfirmationModal = ({ isOpen, orderDetails, onStartNewOrder }) => {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onStartNewOrder?.();
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, onStartNewOrder]);

  if (!isOpen || !orderDetails) return null;

  const {
    customerName = 'אורח',
    orderNumber,
    total = 0,
    loyaltyCoffeeCount,
    loyaltyRewardEarned,
    paymentStatus,
    isRefund,
    refundAmount
  } = orderDetails;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formattedTotal = formatPrice(total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">

        {/* Header Section */}
        <div className="p-8 pb-0 flex flex-col items-center text-center space-y-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isRefund ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
            } border-4`}>
            <CheckCircle2 className="w-10 h-10" strokeWidth={3} />
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800">
              {isRefund ? 'זיכוי בוצע!' : 'תודה רבה!'}
            </h2>
            <p className="text-lg text-slate-500 font-medium">
              {isRefund ? 'הלקוח זוכה' : 'ההזמנה שלך התקבלה בהצלחה'}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-6">

          {/* Order Number & Total Card */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
            {orderNumber && (
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <span className="text-slate-500 font-bold">מספר הזמנה</span>
                <span className="text-2xl font-black text-slate-800">#{orderNumber}</span>
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
            <div className={`rounded-3xl p-6 border-2 text-center transform transition-all ${loyaltyRewardEarned
              ? 'bg-green-50 border-green-200 shadow-sm'
              : 'bg-amber-50 border-amber-200'
              }`}>
              <p className={`text-lg font-bold mb-2 ${loyaltyRewardEarned ? 'text-green-700' : 'text-amber-700'
                }`}>
                {loyaltyRewardEarned
                  ? '🎉 איזה כיף! הקפה הבא עלינו!'
                  : 'הכרטיסייה שלך מתקדמת!'}
              </p>

              <div className="flex justify-center items-end gap-2">
                <span className={`text-5xl font-black ${loyaltyRewardEarned ? 'text-green-600' : 'text-amber-600'
                  }`}>
                  {Math.min(loyaltyCoffeeCount, 10)}
                </span>
                <span className={`text-xl font-bold mb-2 ${loyaltyRewardEarned ? 'text-green-400' : 'text-amber-400'
                  }`}>/10</span>
              </div>

              {!loyaltyRewardEarned && (
                <p className="text-sm font-medium text-amber-600/80 mt-2">
                  עוד {Math.max(0, 10 - Math.min(loyaltyCoffeeCount, 10))} כוסות לקפה מתנה
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-sm font-bold text-slate-400 animate-pulse">
            חוזרים לתפריט הראשי...
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationModal;

