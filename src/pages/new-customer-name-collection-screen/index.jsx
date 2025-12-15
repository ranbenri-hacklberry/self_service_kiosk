import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House } from 'lucide-react';

import HebrewKeyboard from './components/HebrewKeyboard';

const IDENTIFY_AND_GREET_URL =
  import.meta.env?.VITE_CUSTOMER_IDENTIFY_FUNCTION_URL ||
  'https://identifyandgreet-4hiqfyxbaa-ey.a.run.app';

const isIPadDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return (
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

const NewCustomerNameCollectionScreen = () => {
  const [customerName, setCustomerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);

  const { phoneNumber: phoneNumberFromState, customerId } = location?.state || {};
  const [resolvedPhoneNumber, setResolvedPhoneNumber] = useState(phoneNumberFromState || '');

  useEffect(() => {
    if (phoneNumberFromState) {
      setResolvedPhoneNumber(phoneNumberFromState);
      return;
    }

    try {
      const storedCustomerRaw = localStorage.getItem('currentCustomer');
      if (!storedCustomerRaw) {
        return;
      }
      const storedCustomer = JSON.parse(storedCustomerRaw);
      if (storedCustomer?.phone) {
        setResolvedPhoneNumber(storedCustomer.phone);
      }
    } catch (storageErr) {
      console.warn('Failed to read stored customer phone number', storageErr);
    }
  }, [phoneNumberFromState]);

  useEffect(() => {
    inputRef?.current?.focus?.();
  }, []);

  const handleKeyboardInput = (value) => {
    inputRef?.current?.focus?.();
    if (value === 'delete') {
      setCustomerName((prev) => prev?.slice(0, -1));
    } else if (value === 'space') {
      setCustomerName((prev) => `${prev} `);
    } else if ((customerName || '').length < 50) {
      setCustomerName((prev) => `${prev || ''}${value}`);
    }
  };

  const trimmedName = useMemo(() => customerName?.trim() ?? '', [customerName]);
  const isValidName = trimmedName.length >= 2;

  const handleContinue = async () => {
    if (!isValidName) {
      setError('אנא הכנס שם תקין (לפחות 2 תווים)');
      return;
    }

    // בדיקה אם למשתמש יש מספר טלפון
    const hasPhoneNumber = !!resolvedPhoneNumber;

    // אם אין URL לשרת וזה לא לקוח ללא טלפון, זו בעיה
    if (hasPhoneNumber && !IDENTIFY_AND_GREET_URL) {
      setError('הגדרת השרת חסרה. פנה למנהל המערכת.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let customerData;

      if (!hasPhoneNumber) {
        // לקוח ללא טלפון - שומרים אותו כלקוח מקומי עם שם
        // חשוב: לא מסמנים כ-isAnonymous כדי שהשם יוצג בהזמנה
        customerData = {
          id: 'local-' + Date.now(), // מזהה זמני
          name: trimmedName,
          phone: null,
          isAnonymous: false, // שינוי: לא אנונימי כי יש לו שם!
          isPhoneLess: true,  // דגל חדש לזיהוי
          loyalty_coffee_count: 0,
          createdAt: new Date().toISOString()
        };

        localStorage.setItem('currentCustomer', JSON.stringify(customerData));
      } else {
        // לקוח רגיל עם מספר טלפון - מעדכנים בשרת
        const response = await fetch(IDENTIFY_AND_GREET_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber: resolvedPhoneNumber,
            customerName: trimmedName
          })
        });

        const data = await response?.json();

        if (!response?.ok) {
          throw new Error(data?.error || 'Failed to update customer name');
        }

        if (!data?.success) {
          throw new Error('API response indicates failure');
        }

        // Merge server data with known phone number to prevent data loss
        customerData = {
          ...(data?.customer ?? {}),
          phone: data?.customer?.phone || resolvedPhoneNumber
        };

        localStorage.setItem('currentCustomer', JSON.stringify(customerData));
      }

      navigate('/menu-ordering-interface', {
        state: {
          customer: customerData,
          isNewCustomer: true
        }
      });
    } catch (err) {
      console.error('Error updating customer name:', err);
      setError('אירעה שגיאה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-50 font-heebo" dir="rtl">
      {/* Home Button */}
      <button
        onClick={() => navigate('/mode-selection')}
        className="absolute top-4 right-4 p-3 bg-white hover:bg-gray-50 text-slate-600 border border-gray-200 rounded-xl shadow-sm transition-all hover:scale-105 z-10"
      >
        <House size={20} className="text-slate-700" />
      </button>

      <main className="bg-white rounded-3xl shadow-sm border border-gray-200 p-4 w-full max-w-[600px] flex flex-col items-center space-y-3">
        <input
          ref={inputRef}
          type="text"
          value={customerName}
          readOnly
          onKeyDown={(event) => {
            if (event?.key === 'Enter') {
              event.preventDefault();
              handleContinue();
            }
          }}
          className="absolute opacity-0 pointer-events-none h-0 w-0"
          aria-hidden="true"
          autoComplete="off"
          inputMode="none"
          onFocus={(e) => {
            e.target.blur(); // Always blur to prevent keyboard
          }}
        />

        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-orange-100 text-orange-600 rounded-xl mb-1 text-xl">
            😊
          </div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight">
            נעים להכיר!
          </h1>
          <p className="text-sm text-gray-500 font-bold">
            איך לקרוא לך בהזמנה?
          </p>
        </div>

        <div className={`w-full h-12 bg-gray-50 rounded-xl border-2 flex items-center justify-center relative overflow-hidden transition-colors ${error ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
          <span className={`text-2xl font-bold ${customerName ? 'text-gray-800' : 'text-gray-300'}`}>
            {customerName || 'הקלד את שמך...'}
          </span>
          {/* Blinking Cursor */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-[2px] h-6 bg-orange-500 animate-pulse opacity-50 ${customerName ? 'translate-x-[calc(100%+2px)]' : ''}`} style={{ transform: `translateX(${customerName ? (customerName.length * 0.6) + 'ch' : '0'})` }} />
          </div>
        </div>

        {error && (
          <div className="w-full overflow-hidden">
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-lg p-2 text-center flex items-center justify-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          </div>
        )}

        <div className="w-full py-1">
          <HebrewKeyboard onKeyPress={handleKeyboardInput} />
        </div>

        <div className="w-full pt-1">
          <button
            onClick={handleContinue}
            className={`w-full font-extrabold py-3 px-6 rounded-xl text-lg transition-all duration-200 ${isValidName && !isLoading
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm transform active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            disabled={!isValidName || isLoading}
          >
            <span className="flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>שומר...</span>
                </>
              ) : (
                'המשך לתפריט'
              )}
            </span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default NewCustomerNameCollectionScreen;