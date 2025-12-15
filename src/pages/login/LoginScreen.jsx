import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { loginEmployee, clockEvent } from '../../lib/employees/employeeService';
import { Loader2, User, KeyRound, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

const LoginScreen = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Find employee by Email
            const { data: employees, error: fetchError } = await supabase
                .from('employees')
                .select('*')
                .eq('email', email.trim().toLowerCase())
                .limit(1);

            if (fetchError) throw fetchError;

            if (!employees || employees.length === 0) {
                setError('אימייל לא נמצא במערכת');
                setIsLoading(false);
                return;
            }

            const employee = employees[0];
            let isValid = false;

            // Check Password (or PIN as fallback)
            if (employee.password_hash) {
                // In a real app, compare hash. For this demo/legacy, we might check direct equality if stored plain, or PIN
                // Assuming 'password_hash' stores the password for now as per previous 'ManagerAuthenticationScreen' logic
                isValid = (employee.password_hash === password) || (employee.pin_code === password);
            } else {
                isValid = employee.pin_code === password;
            }

            if (!isValid) {
                setError('סיסמה שגויה');
                setIsLoading(false);
                return;
            }

            // Success
            login(employee);

            // Clock In Check currently removed from UI to simplify, or could be auto-triggered
            try {
                await clockEvent(employee.id, 'clock_in');
            } catch (e) { console.log('Auto clock-in optional', e) }

            navigate('/mode-selection');

        } catch (err) {
            console.error('Login error:', err);
            setError('שגיאה בהתחברות לשירות');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-heebo" dir="rtl">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-slate-800 p-8 text-center text-white">
                    <h1 className="text-3xl font-black mb-2">כניסה למערכת</h1>
                    <p className="text-slate-300">הזן פרטי התחברות</p>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                            AlertTriangle size={16}
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-slate-700 font-bold mb-2 text-sm">אימייל</label>
                            <div className="relative">
                                <User className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-400 w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pr-12 pl-4 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                                    placeholder="your@email.com"
                                    required
                                    autoFocus
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-700 font-bold mb-2 text-sm">סיסמה</label>
                            <div className="relative">
                                <KeyRound className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-400 w-5 h-5" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pr-12 pl-4 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 font-sans"
                                    placeholder="••••••••"
                                    required
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                >
                                    {showPassword ? 'הסתר' : 'הצג'}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl text-lg shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin w-6 h-6" />
                            ) : (
                                <>
                                    <span>התחבר</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
