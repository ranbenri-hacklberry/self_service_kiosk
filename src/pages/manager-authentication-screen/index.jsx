import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const ManagerAuthenticationScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. בדיקה שהאימייל קיים בטבלת employees
      // קודם נבדוק אם המשתמש קיים בכלל, כדי לתת שגיאה מדוייקת
      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .limit(1);

      if (employeeError) {
        console.error('Employee query error:', employeeError);
        setError('שגיאה בחיבור למסד הנתונים: ' + employeeError.message);
        return;
      }

      if (!employees || employees.length === 0) {
        console.log('Email not found:', email.trim().toLowerCase());
        setError('האימייל לא נמצא במערכת. וודא שהרצת את הסקריפט ב-Supabase.');
        return;
      }

      const employee = employees[0];

      // בדיקת הרשאות
      if (employee.access_level !== 'Manager' && employee.access_level !== 'Admin') {
        setError(`למשתמש זה אין הרשאות מנהל (הרשאה נוכחית: ${employee.access_level})`);
        return;
      }

      // 2. בדיקת סיסמה - אם יש password_hash, נבדוק אותו
      // אם לא, נשתמש ב-pin_code כסיסמה זמנית (למקרה של מעבר הדרגתי)
      let isPasswordValid = false;

      if (employee.password_hash) {
        // TODO: אם יש password_hash, נבדוק אותו עם bcrypt
        // כרגע נשתמש ב-pin_code כסיסמה זמנית
        isPasswordValid = employee.pin_code === password;
      } else {
        // אם אין password_hash, נשתמש ב-pin_code כסיסמה זמנית
        // זה מאפשר מעבר הדרגתי - מנהלים יכולים להשתמש ב-PIN שלהם
        isPasswordValid = employee.pin_code === password;
      }

      if (!isPasswordValid) {
        console.log('Password mismatch. Expected PIN:', employee.pin_code, 'Received:', password);
        setError('הסיסמה שגויה');
        return;
      }

      // 3. שמירת session
      const sessionData = {
        employeeId: employee.id,
        employeeName: employee.name,
        accessLevel: employee.access_level,
        email: employee.email,
        loginTime: Date.now()
      };

      // קידוד בטוח גם לעברית
      const encodeData = (data) => {
        return btoa(encodeURIComponent(JSON.stringify(data)));
      };

      localStorage.setItem('manager_auth_key', encodeData(sessionData));
      localStorage.setItem('manager_auth_time', Date.now().toString());
      localStorage.setItem('manager_employee_id', employee.id);

      // 4. מעבר לממשק הניהול
      navigate('/data-manager-interface');
    } catch (err) {
      console.error('Authentication error:', err);
      setError('שגיאה בחיבור לשרת: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">אימות מנהל</h1>
          <p className="text-purple-100 text-sm mt-1">התחבר עם אימייל וסיסמה</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-4 bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 text-right">
                אימייל
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-right"
                placeholder="your@email.com"
                required
                disabled={isLoading}
                dir="ltr"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2 text-right">
                סיסמה
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-right"
                  placeholder="הכנס סיסמה"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                ניתן להשתמש ב-PIN שלך כסיסמה זמנית
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>מאמת...</span>
                </>
              ) : (
                <span>התחבר</span>
              )}
            </button>
          </form>

          {/* Back Button */}
          <button
            onClick={() => navigate('/')}
            className="w-full mt-4 text-center text-gray-600 hover:text-gray-800 text-sm py-2 transition-colors"
            disabled={isLoading}
          >
            חזרה למסך הראשי
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerAuthenticationScreen;
