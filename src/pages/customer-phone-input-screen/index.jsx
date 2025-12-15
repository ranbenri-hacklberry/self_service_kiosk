import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House } from 'lucide-react';
import { supabase } from '../../lib/supabase'; // IMPORTED
import { useAuth } from '../../context/AuthContext'; // IMPORTED

import { APP_VERSION } from '../../config/version';
import NumericKeypad from './components/NumericKeypad';

const ORDER_ORIGIN_STORAGE_KEY = 'order_origin';

const CustomerPhoneInputScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth(); // GET AUTH CONTEXT

  const formattedPhoneNumber = useMemo(() => {
    const digits = phoneNumber?.replace(/[^0-9]/g, '')?.split('') || [];
    if (digits.length > 3) {
      digits.splice(3, 0, '-');
    }
    if (digits.length > 7) {
      digits.splice(7, 0, '-');
    }
    return digits.join('');
  }, [phoneNumber]);

  const handleIdentifyAndGreet = async (cleanedPhone) => {
    // Check for KDS access code (2102)
    if (cleanedPhone === '2102') {
      sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
      navigate('/kds');
      return null;
    }

    try {
      console.log('🔍 Checking customer:', cleanedPhone);
      const { data, error } = await supabase.rpc('lookup_customer', {
        p_phone: cleanedPhone,
        p_business_id: currentUser?.business_id || null
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Lookup error:', err);
      throw new Error('שגיאה בחיפוש לקוח: ' + err.message);
    }
  };

  const handlePhysicalInputChange = (inputValue) => {
    inputRef?.current?.focus?.();
    const cleaned = inputValue?.replace(/\D/g, '');
    if (cleaned?.length <= 10) {
      setPhoneNumber(cleaned);
    } else {
      setPhoneNumber(cleaned?.slice(0, 10));
    }
  };

  const handleHiddenInputChange = (event) => {
    const cleaned = event?.target?.value?.replace(/\D/g, '') ?? '';
    const sanitized = cleaned?.slice(0, 10);
    setPhoneNumber(sanitized);
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location?.search || '');
    const origin = searchParams.get('from');

    if (origin) {
      sessionStorage.setItem(ORDER_ORIGIN_STORAGE_KEY, origin);
    } else if (!searchParams.has('from')) {
      sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
    }
  }, [location?.search]);

  useEffect(() => {
    inputRef?.current?.focus?.();
  }, []);

  const handleKeypadPress = (value) => {
    inputRef?.current?.focus?.();
    setError(''); // Clear error on typing

    if (value === 'delete') {
      setPhoneNumber((prev) => prev?.slice(0, -1));
    } else if (value === '*') {
      return;
    } else if (phoneNumber?.length < 10) {
      const newPhone = `${phoneNumber || ''}${value}`;

      // Validation: Check if starts with 05 (only if length >= 2)
      if (newPhone.length >= 2 && !newPhone.startsWith('05') && newPhone !== '21') { // Allow 21 for KDS code
        setError('מספר נייד חייב להתחיל ב-05');
        // Don't block typing, just show error
      }

      setPhoneNumber(newPhone);
    }
  };

  const handleContinue = async () => {
    const cleanPhone = phoneNumber?.replace(/\D/g, '');

    // KDS Code check
    if (cleanPhone === '2102') {
      handleIdentifyAndGreet(cleanPhone);
      return;
    }

    if (cleanPhone?.length !== 10) {
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
      const data = await handleIdentifyAndGreet(cleanPhone);

      console.log('מה API:', data?.customer);

      if (!data) {
        return;
      }

      if (!data?.success) {
        const errorMessage = data?.errorHe || data?.error || 'שגיאה לא ידועה';
        throw new Error(errorMessage);
      }

      const customer = {
        ...(data?.customer || {}),
        loyalty_coffee_count: data?.customer?.loyalty_coffee_count ?? 0,
        phone: data?.customer?.phone || cleanPhone,
      };

      setCurrentCustomer(customer);

      localStorage.setItem('currentCustomer', JSON.stringify(customer));

      if (data?.isNewCustomer) {
        navigate('/new-customer-name-collection-screen', {
          state: {
            phoneNumber: cleanPhone,
            customerId: data?.customer?.id
          }
        });
      } else {
        navigate('/returning-customer-welcome-screen', {
          state: {
            customer: customer,
            isReturningCustomer: true,
            cupsCollected: customer?.loyalty_coffee_count || 0
          }
        });
      }
    } catch (err) {
      console.error('Error identifying customer:', err);
      setError(err?.message || 'אירעה שגיאה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousEntry = () => {
    localStorage.removeItem('currentCustomer');
    navigate('/new-customer-name-collection-screen', {
      state: {
        phoneNumber: null,
        customerId: 'anonymous'
      }
    });
  };

  const formattedDisplay = formattedPhoneNumber || '';
  const isValidPhone = phoneNumber?.length === 10 && phoneNumber.startsWith('05');
  const isKdsCode = phoneNumber === '2102';
  const canContinue = isValidPhone || isKdsCode;
  const showAnonymous = !phoneNumber || phoneNumber.length === 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-50 font-heebo overflow-hidden" dir="rtl">

      {/* Admin Button */}
      {/* Home Button */}
      <button
        onClick={() => navigate('/mode-selection')}
        className="absolute top-4 right-4 p-3 bg-white hover:bg-gray-50 text-slate-600 border border-gray-200 rounded-xl shadow-sm transition-all hover:scale-105 z-10"
      >
        <House size={20} className="text-slate-700" />
      </button>

      <main className="bg-white rounded-3xl shadow-sm border border-gray-200 p-4 w-full max-w-[400px] flex flex-col items-center space-y-2">

        {/* Hidden Input for Keyboard Handling */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="none"
          pattern="[0-9]*"
          value={phoneNumber}
          readOnly
          onKeyDown={(event) => {
            if (event?.key === 'Enter') {
              event.preventDefault();
              handleContinue();
            }
          }}
          className="absolute opacity-0 pointer-events-none h-0 w-0"
          aria-hidden="true"
        />

        {/* Header Section - Ultra Compact */}
        <div className="text-center space-y-0.5 mb-2">
          <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center justify-center gap-2">
            <span>👋</span>
            <span>היי, מה הנייד?</span>
          </h1>
        </div>

        {/* Phone Number Display */}
        <div
          className={`w-full h-12 bg-gray-50 rounded-xl border-2 flex items-center justify-center relative overflow-hidden transition-colors group ${error ? 'border-red-200 bg-red-50' : 'border-gray-100 focus-within:border-orange-400'}`}
          onClick={() => inputRef.current?.focus()}
        >
          <input
            type="text"
            value={formattedPhoneNumber}
            placeholder=""
            className="w-full text-center bg-transparent outline-none text-2xl font-mono font-bold text-gray-800 tracking-wider z-10"
            dir="ltr"
            readOnly
            inputMode="none"
          />
          {/* Blinking Cursor Simulation */}
          {!phoneNumber && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[2px] h-5 bg-orange-500 animate-pulse opacity-50" />
            </div>
          )}
        </div>

        {/* Error Message - Compact */}
        <div className={`w-full overflow-hidden transition-all duration-200 ${error ? 'max-h-7 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="text-red-600 text-xs font-bold text-center flex items-center justify-center gap-1">
            <span>⚠️</span>
            {error}
          </div>
        </div>

        {/* Keypad */}
        <div className="w-full py-0">
          <NumericKeypad onKeyPress={handleKeypadPress} />
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col items-center space-y-3 pt-0 min-h-[140px] justify-end">
          <button
            onClick={handleContinue}
            className={`w-full font-extrabold py-3 px-6 rounded-xl text-lg transition-all duration-200 ${canContinue && !isLoading
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200 transform active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            disabled={!canContinue || isLoading}
          >
            <span className="flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>בודק...</span>
                </>
              ) : (
                'המשך'
              )}
            </span>
          </button>

          {/* Quick Actions Footer - Only show when no phone number is entered */}
          <div className={`w-full grid grid-cols-2 gap-3 transition-all duration-300 overflow-hidden ${showAnonymous ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* Skip (Right in RTL) */}
            <button
              onClick={handleAnonymousEntry}
              className="flex flex-col items-center justify-center py-3 px-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 transition-all active:scale-95"
            >
              <span className="text-lg">👤</span>
              <span className="text-xs font-bold mt-1">דלג (רק שם)</span>
            </button>

            {/* Quick Order (Left in RTL) */}
            <button
              onClick={() => {
                // Quick Order: Skip everything, auto-generate name later
                const quickCustomer = {
                  id: 'quick-' + Date.now(),
                  name: 'הזמנה מהירה', // Will be replaced by Order # later
                  phone: null,
                  isAnonymous: true,
                  isQuickOrder: true, // Flag for backend
                  loyalty_coffee_count: 0
                };
                localStorage.setItem('currentCustomer', JSON.stringify(quickCustomer));
                navigate('/menu-ordering-interface', {
                  state: {
                    customer: quickCustomer,
                    isQuickOrder: true
                  }
                });
              }}
              className="flex flex-col items-center justify-center py-3 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-100 transition-all active:scale-95"
            >
              <span className="text-lg">⚡</span>
              <span className="text-xs font-bold mt-1">הזמנה מהירה</span>
            </button>
          </div>
        </div>

        {/* Version number */}
        <div className="text-[9px] font-mono text-gray-300 text-center select-none">
          {APP_VERSION}
        </div>
      </main>
    </div>
  );
};

export default CustomerPhoneInputScreen;