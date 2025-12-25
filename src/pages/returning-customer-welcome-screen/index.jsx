import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const REWARD_THRESHOLD = 9;
const DISPLAY_TOTAL = 10;

const ORDER_ORIGIN_STORAGE_KEY = 'order_origin';

const ReturningCustomerWelcomeScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentCustomer, setCurrentCustomer] = useState(() => {
    try {
      const raw = localStorage.getItem('currentCustomer');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Failed to parse currentCustomer from localStorage:', error);
      return null;
    }
  });
  const [customerName, setCustomerName] = useState('אורח');
  const [loyaltyCoffeeCount, setLoyaltyCoffeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { customer: customerData, cupsCollected: cupsFromState } = location?.state || {};

    let resolvedCustomer = customerData;

    if (!resolvedCustomer || typeof resolvedCustomer !== 'object') {
      const stored = (() => {
        try {
          const raw = localStorage.getItem('currentCustomer');
          return raw ? JSON.parse(raw) : null;
        } catch (error) {
          console.error('Failed to parse stored currentCustomer:', error);
          return null;
        }
      })();
      resolvedCustomer = stored;
    }

    if (resolvedCustomer && typeof resolvedCustomer === 'object') {
      const normalizedCustomer = {
        ...resolvedCustomer,
        loyalty_coffee_count: resolvedCustomer?.loyalty_coffee_count ?? 0,
      };

      setCurrentCustomer(normalizedCustomer);

      if (normalizedCustomer?.name) {
        setCustomerName(normalizedCustomer.name);
      }

      if (typeof normalizedCustomer?.loyalty_coffee_count === 'number') {
        setLoyaltyCoffeeCount(normalizedCustomer.loyalty_coffee_count);
      }
    }

    if (typeof cupsFromState === 'number') {
      setLoyaltyCoffeeCount(cupsFromState);
    }

    setLoading(false);

    // Auto-redirect to menu (this screen is deprecated)
    const timer = setTimeout(() => {
      const payloadCustomer = resolvedCustomer ? { ...resolvedCustomer, loyalty_coffee_count: cupsFromState || resolvedCustomer?.loyalty_coffee_count || 0 } : null;
      navigate('/menu-ordering-interface', {
        state: {
          customer: payloadCustomer,
          loyaltyCoffeeCount: cupsFromState || resolvedCustomer?.loyalty_coffee_count || 0
        },
        replace: true
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [location?.state, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center text-lg text-gray-600" dir="rtl">
        טוען...
      </div>
    );
  }

  const normalizedCount = Math.max(0, Math.min(loyaltyCoffeeCount, REWARD_THRESHOLD));
  const nextIsFree = normalizedCount >= REWARD_THRESHOLD;
  const displayedCount = nextIsFree ? REWARD_THRESHOLD : normalizedCount;
  const remainingCoffees = nextIsFree ? 0 : Math.max(0, REWARD_THRESHOLD - normalizedCount);
  const progressPercentage = REWARD_THRESHOLD === 0 ? 0 : (displayedCount / REWARD_THRESHOLD) * 100;

  const handleNavigateToMenu = () => {
    const payloadCustomer = currentCustomer ? { ...currentCustomer, loyalty_coffee_count: loyaltyCoffeeCount } : null;

    navigate('/menu-ordering-interface', {
      state: {
        customer: payloadCustomer,
        loyaltyCoffeeCount
      }
    });
  };

  const handleReturnToPhoneScreen = () => {
    const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
    if (origin === 'kds') {
      sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
      navigate('/kds');
      return;
    }
    navigate('/menu-ordering-interface');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-50 font-heebo" dir="rtl">
      <main className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-200 p-8 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl mb-4 text-3xl">
            👋
          </div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">
            שלום {customerName}
          </h1>
          <p className="text-gray-500 font-bold text-lg">
            כיף לראות אותך שוב!
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-black text-center text-gray-800 mb-6">
              {nextIsFree ? '🎉 הקפה הבא שלך חינם!' : `עוד ${remainingCoffees} כוסות לקפה חינם!`}
            </h2>

            <div className="relative w-40 h-40 mx-auto">
              {/* Circular Progress */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                {/* Background Circle */}
                <path
                  className="text-orange-200"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                {/* Progress Circle */}
                <path
                  className="text-orange-500 transition-all duration-1000 ease-out"
                  strokeDasharray={`${progressPercentage}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-gray-800">
                  {Math.min(loyaltyCoffeeCount, DISPLAY_TOTAL - 1)}
                  <span className="text-xl text-gray-400 font-medium">/{DISPLAY_TOTAL}</span>
                </span>
                <span className="text-sm font-bold text-gray-500 mt-1">כוסות</span>
              </div>
            </div>
          </div>

          {/* Decorative Background Icon */}
          <div className="absolute -bottom-6 -right-6 text-orange-100 opacity-50 transform rotate-12">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2,21H20V19H2M20,8H18V5H20M20,3H4V13A4,4 0 0,0 8,17H14A4,4 0 0,0 18,13V10H20A2,2 0 0,0 22,8V5C22,3.89 21.1,3 20,3Z" />
            </svg>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center space-y-3 pt-2">
          <button
            onClick={handleNavigateToMenu}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-4 px-6 rounded-xl text-xl shadow-sm transition-all active:scale-[0.98]"
          >
            המשך לתפריט
          </button>

          <button
            onClick={handleReturnToPhoneScreen}
            className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors py-2"
          >
            חזרה למסך הראשי
          </button>
        </div>
      </main>
    </div>
  );
};

export default ReturningCustomerWelcomeScreen;