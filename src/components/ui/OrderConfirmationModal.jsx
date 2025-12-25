import React, { useEffect, useState } from 'react';
import { CheckCircle2, Coffee, Send } from 'lucide-react';

// Fun messages for the cashier
const funMessages = [
  "☕ עוד קפה יצא למסע!",
  "🚀 ההזמנה מטסת למטבח!",
  "👨‍🍳 השף כבר שם עין...",
  "✨ קסם קורה במטבח!",
  "🎯 מטרה חדשה ל-KDS!",
  "🔥 המטבח מתחמם!",
  "⚡ הזמנה בזק!",
];

const OrderConfirmationModal = ({ isOpen, orderDetails, onStartNewOrder }) => {
  const [funMessage] = useState(() =>
    funMessages[Math.floor(Math.random() * funMessages.length)]
  );

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
    orderNumber,
    total = 0,
    paymentStatus,
    paymentMethod,
    isRefund,
    refundAmount,
    isPaid = true
  } = orderDetails;

  // Check if order was sent without payment
  const isSentToKitchen = !isPaid || paymentStatus === 'לא שולם' || paymentStatus === 'שליחה למטבח';

  const formatPrice = (price) => {
    const num = Number(price);
    const hasDecimals = num % 1 !== 0;
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0
    }).format(num);
  };

  const formattedTotal = formatPrice(total);

  // Determine header style based on order type
  const getHeaderStyle = () => {
    if (isRefund) return 'bg-gradient-to-b from-red-50 to-white';
    if (isSentToKitchen) return 'bg-gradient-to-b from-blue-50 to-white';
    return 'bg-gradient-to-b from-green-50 to-white';
  };

  const getIconStyle = () => {
    if (isRefund) return 'bg-red-100 text-red-600 border-red-200';
    if (isSentToKitchen) return 'bg-blue-100 text-blue-600 border-blue-200';
    return 'bg-green-100 text-green-600 border-green-200';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={() => onStartNewOrder?.()}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className={`p-6 pb-4 flex flex-col items-center text-center ${getHeaderStyle()}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 border-4 shadow-lg ${getIconStyle()}`}>
            {isSentToKitchen ? (
              <Send className="w-10 h-10" strokeWidth={2.5} />
            ) : (
              <CheckCircle2 className="w-10 h-10" strokeWidth={2.5} />
            )}
          </div>

          <h2 className="text-2xl font-black text-slate-800 mb-1">
            {isRefund ? 'זיכוי בוצע!' : isSentToKitchen ? 'נשלח למטבח!' : 'נרשם בהצלחה!'}
          </h2>

          <p className="text-base text-slate-500 font-medium">
            {isRefund
              ? 'הלקוח זוכה'
              : isSentToKitchen
                ? 'ההזמנה ממתינה לתשלום'
                : 'ההזמנה בדרך למסך הסרוויס'}
          </p>
        </div>

        {/* Fun Animation Section */}
        <div className="px-6 py-3 text-center">
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-xl p-3 border border-amber-100">
            <div className="flex justify-center gap-2 mb-2">
              <Coffee className="w-6 h-6 text-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <Coffee className="w-6 h-6 text-orange-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <Coffee className="w-6 h-6 text-amber-600 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-base font-bold text-amber-700">
              {funMessage}
            </p>
          </div>
        </div>

        {/* Order Details Card */}
        <div className="px-6 pb-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
            {orderNumber && (
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-bold text-sm">מספר הזמנה</span>
                <span className="text-xl font-black text-slate-800">#{orderNumber}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-bold text-sm">
                {isRefund ? 'סכום לזיכוי' : isSentToKitchen ? 'סה"כ לתשלום' : 'סה"כ שולם'}
              </span>
              <span className={`text-xl font-black ${isRefund ? 'text-red-600' : isSentToKitchen ? 'text-blue-600' : 'text-green-600'
                }`}>
                {isRefund ? `${formatPrice(refundAmount)}-` : formattedTotal}
              </span>
            </div>

            {/* Payment status badge */}
            {isSentToKitchen && (
              <div className="pt-2 border-t border-slate-200">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                  ⏳ ממתין לתשלום
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs font-bold text-slate-400 animate-pulse">
            לחץ בכל מקום להמשיך...
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationModal;
