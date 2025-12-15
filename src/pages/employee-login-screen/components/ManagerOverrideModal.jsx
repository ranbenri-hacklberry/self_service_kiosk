import React, { useState } from 'react';

const ManagerOverrideModal = ({ onClose, onConfirm, isLoading }) => {
  const [managerPin, setManagerPin] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (managerPin) {
      onConfirm(managerPin);
    }
  };

  const handlePinKeyPress = (e) => {
    // Allow only numbers
    if (!/^\d$/?.test(e?.key) && e?.key !== 'Backspace' && e?.key !== 'Delete' && e?.key !== 'Tab' && e?.key !== 'Enter') {
      e?.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">כניסת מנהל חירום</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Warning Icon */}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          {/* Description */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              גישת מנהל בלבד
            </h3>
            <p className="text-gray-600 text-sm">
              פונקציה זו מיועדת למנהלים בלבד.<br />
              הזן קוד PIN של מנהל לגישה למערכת.
            </p>
          </div>

          {/* Manager PIN Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="managerPin" className="block text-sm font-semibold text-gray-700 text-right">
                קוד PIN מנהל
              </label>
              <div className="relative">
                <input
                  id="managerPin"
                  type="password"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e?.target?.value)}
                  onKeyPress={handlePinKeyPress}
                  placeholder="הזן קוד PIN מנהל"
                  maxLength="6"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 text-center bg-gray-50 hover:bg-white tracking-widest"
                  disabled={isLoading}
                  required
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={isLoading || !managerPin}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    מתחבר...
                  </div>
                ) : (
                  'אישור כניסה'
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-amber-800 text-xs font-medium">
                פעולה זו נרשמת במערכת לצרכי ביטחון
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerOverrideModal;