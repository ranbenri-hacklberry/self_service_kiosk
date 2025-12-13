import React, { useState } from 'react';

const LoginForm = ({ onLogin, isLoading, error }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    onLogin(employeeId, pin);
  };

  const handlePinKeyPress = (e) => {
    // Allow only numbers
    if (!/^\d$/?.test(e?.key) && e?.key !== 'Backspace' && e?.key !== 'Delete' && e?.key !== 'Tab' && e?.key !== 'Enter') {
      e?.preventDefault();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 ml-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        </div>
      )}
      {/* Employee ID Field */}
      <div className="space-y-2">
        <label htmlFor="employeeId" className="block text-sm font-semibold text-gray-700 text-right">
          כרטיס עובד / ID סריקה
        </label>
        <div className="relative">
          <input
            id="employeeId"
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e?.target?.value)}
            placeholder="הזן כרטיס עובד או ID"
            className="w-full px-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-center bg-gray-50 hover:bg-white"
            disabled={isLoading}
            required
            dir="rtl"
          />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-2 4v6m0-6V4" />
            </svg>
          </div>
        </div>
      </div>
      {/* PIN Field */}
      <div className="space-y-2">
        <label htmlFor="pin" className="block text-sm font-semibold text-gray-700 text-right">
          קוד PIN
        </label>
        <div className="relative">
          <input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e?.target?.value)}
            onKeyPress={handlePinKeyPress}
            placeholder="הזן קוד PIN"
            maxLength="6"
            className="w-full px-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-center bg-gray-50 hover:bg-white tracking-widest"
            disabled={isLoading}
            required
          />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-right">הזן קוד PIN של 4-6 ספרות</p>
      </div>
      {/* Login Button */}
      <button
        type="submit"
        disabled={isLoading || !employeeId || !pin}
        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            מתחבר...
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            התחבר למערכת
          </div>
        )}
      </button>
    </form>
  );
};

export default LoginForm;