import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import LoginForm from './components/LoginForm';
import ForgotPinModal from './components/ForgotPinModal';
import ManagerOverrideModal from './components/ManagerOverrideModal';

const EmployeeLoginScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [showManagerOverride, setShowManagerOverride] = useState(false);
  const navigate = useNavigate();

  // Handle employee login with PIN authentication
  const handleEmployeeLogin = async (employeeId, pin) => {
    if (!employeeId || !pin) {
      setError('נא להזין תעודת זהות וקוד PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Query employee by ID OR Phone (and check PIN)
      // Note: Supabase doesn't support "OR" easily across different columns with .eq() chain for standard strict filtering in one go without .or() syntax which is string based.
      // Easiest is to try both or use .or()

      const { data: employees, error: queryError } = await supabase
        .from('employees')
        .select('*')
        .or(`id.eq.${employeeId},whatsapp_phone.eq.${employeeId}`)
        .eq('pin_code', pin)
        .limit(1);

      if (queryError) {
        console.error('Database query error:', queryError);
        setError('שגיאה בחיבור למסד הנתונים');
        return;
      }

      if (!employees || employees?.length === 0) {
        setError('תעודת זהות או קוד PIN שגויים');
        return;
      }

      const employee = employees?.[0];

      // Record clock-in event
      const { error: clockError } = await supabase?.from('time_clock_events')?.insert({
        employee_id: employee?.id,
        event_type: 'clock_in',
        event_time: new Date()?.toISOString()
      });

      if (clockError) {
        console.error('Clock-in error:', clockError);
        setError('שגיאה ברישום כניסה לעבודה');
        return;
      }

      // Store employee session data
      sessionStorage.setItem('employee_session', JSON.stringify({
        id: employee?.id,
        name: employee?.name,
        accessLevel: employee?.access_level,
        whatsapp_phone: employee?.whatsapp_phone, // Added for demo user detection
        loginTime: new Date()?.toISOString()
      }));

      // Navigate to menu interface with employee context
      navigate('/menu-ordering-interface', {
        state: {
          employeeId: employee?.id,
          employeeName: employee?.name,
          accessLevel: employee?.access_level,
          whatsapp_phone: employee?.whatsapp_phone
        }
      });

    } catch (err) {
      console.error('Unexpected error during login:', err);
      setError('שגיאה לא צפויה. אנא נסה שוב');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manager override authentication
  const handleManagerOverride = async (managerPin) => {
    setIsLoading(true);
    setError('');

    try {
      // Query for manager/admin level employee
      const { data: managers, error: queryError } = await supabase?.from('employees')?.select('*')?.eq('pin_code', managerPin)?.in('access_level', ['Manager', 'Admin'])?.limit(1);

      if (queryError) {
        console.error('Manager query error:', queryError);
        setError('שגיאה בחיבור למסד הנתונים');
        return;
      }

      if (!managers || managers?.length === 0) {
        setError('קוד מנהל שגוי');
        return;
      }

      const manager = managers?.[0];

      // Store manager session
      sessionStorage.setItem('employee_session', JSON.stringify({
        id: manager?.id,
        name: manager?.name,
        accessLevel: manager?.access_level,
        loginTime: new Date()?.toISOString(),
        isOverride: true
      }));

      // Navigate to menu interface
      navigate('/menu-ordering-interface', {
        state: {
          employeeId: manager?.id,
          employeeName: manager?.name,
          accessLevel: manager?.access_level,
          isManagerOverride: true
        }
      });

    } catch (err) {
      console.error('Manager override error:', err);
      setError('שגיאה לא צפויה. אנא נסה שוב');
    } finally {
      setIsLoading(false);
      setShowManagerOverride(false);
    }
  };

  // Handle customer mode bypass
  const handleCustomerMode = () => {
    // Clear any existing employee session
    sessionStorage.removeItem('employee_session');

    // Navigate directly to menu interface without employee context
    navigate('/menu-ordering-interface');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4 relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2303A9F4%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>

      {/* Customer Mode Button */}
      <button
        onClick={handleCustomerMode}
        className="absolute top-6 left-6 px-4 py-2 bg-white/80 hover:bg-white text-gray-700 rounded-lg shadow-sm border border-gray-200 transition-all duration-200 text-sm font-medium z-10"
      >
        מצב לקוח
      </button>

      {/* Main Login Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">התחברות עובדים</h1>
            <p className="text-blue-100 text-sm mt-1">נא להזין את פרטי הגישה שלך</p>
          </div>

          {/* Login Form */}
          <div className="p-8">
            <LoginForm
              onLogin={handleEmployeeLogin}
              isLoading={isLoading}
              error={error}
            />

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowForgotPin(true)}
                className="w-full text-center text-blue-600 hover:text-blue-700 text-sm font-medium py-2 transition-colors"
              >
                שכחתי את הקוד שלי
              </button>

              <button
                onClick={() => setShowManagerOverride(true)}
                className="w-full text-center text-gray-600 hover:text-gray-700 text-sm py-2 transition-colors border-t border-gray-100"
              >
                כניסת מנהל חירום
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            מערכת נוכחות ומכירות • גרסה 2.0
          </p>
        </div>
      </div>

      {/* Modals */}
      {showForgotPin && (
        <ForgotPinModal
          onClose={() => setShowForgotPin(false)}
        />
      )}

      {showManagerOverride && (
        <ManagerOverrideModal
          onClose={() => setShowManagerOverride(false)}
          onConfirm={handleManagerOverride}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

export default EmployeeLoginScreen;