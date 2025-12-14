import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginEmployee, clockEvent } from '../../lib/employees/employeeService';
import { Loader2, User, KeyRound, ArrowRight, CheckCircle } from 'lucide-react';

const LoginScreen = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [step, setStep] = useState('phone'); // 'phone' | 'pin'
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [shouldClockIn, setShouldClockIn] = useState(true);

    const handleNumberClick = (num) => {
        setError('');
        if (step === 'phone') {
            if (phone.length < 10) setPhone(prev => prev + num);
        } else {
            if (pin.length < 4) setPin(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        setError('');
        if (step === 'phone') {
            setPhone(prev => prev.slice(0, -1));
        } else {
            setPin(prev => prev.slice(0, -1));
        }
    };

    const handleNext = async () => {
        if (step === 'phone') {
            if (phone.length < 10) {
                setError('נא להזין מספר טלפון תקין (10 ספרות)');
                return;
            }
            setStep('pin');
        } else {
            // Submit Login
            if (pin.length < 4) {
                setError('נא להזין קוד אישי בן 4 ספרות');
                return;
            }

            setIsLoading(true);
            try {
                const result = await loginEmployee(phone, pin);

                if (result.success) {
                    // Login successful
                    login(result.employee);

                    // Optional: Auto Clock In
                    if (shouldClockIn) {
                        try {
                            await clockEvent(result.employee.id, 'clock_in');
                        } catch (e) {
                            console.error('Auto clock-in failed', e);
                        }
                    }

                    navigate('/mode-selection');
                } else {
                    setError(result.message || 'שגיאה בהתחברות');
                    setPin(''); // Clear PIN on error
                }
            } catch (err) {
                setError('שגיאה בתקשורת עם השרת');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-heebo" dir="rtl">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="bg-slate-800 p-8 text-center text-white">
                    <h1 className="text-3xl font-black mb-2">כניסת עובדים</h1>
                    <p className="text-slate-300">
                        {step === 'phone' ? 'הזן מספר טלפון' : 'הזן קוד אישי'}
                    </p>
                </div>

                <div className="p-8">
                    {/* Input Display */}
                    <div className="mb-8 text-center">
                        <div className="text-4xl font-mono font-bold tracking-widest text-slate-800 h-12 flex items-center justify-center gap-2">
                            {step === 'phone' ? (
                                phone || <span className="text-gray-300">050...</span>
                            ) : (
                                <div className="flex gap-4">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-slate-800' : 'bg-gray-200'}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                        {error && <p className="text-red-500 text-sm mt-2 font-bold animate-pulse">{error}</p>}
                    </div>

                    {/* Keypad */}
                    <div className="grid grid-cols-3 gap-4 mb-8" dir="ltr">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumberClick(num)}
                                className="h-16 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-sm border border-slate-100"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            onClick={handleBackspace}
                            className="h-16 rounded-2xl bg-red-50 text-red-600 font-bold hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center"
                        >
                            ⌫
                        </button>
                        <button
                            onClick={() => handleNumberClick(0)}
                            className="h-16 rounded-2xl bg-slate-50 text-2xl font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-sm border border-slate-100"
                        >
                            0
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={isLoading}
                            className="h-16 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : (step === 'phone' ? <ArrowRight /> : <CheckCircle />)}
                        </button>
                    </div>

                    {/* Clock In Checkbox (Only on PIN step) */}
                    {step === 'pin' && (
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                id="clockIn"
                                checked={shouldClockIn}
                                onChange={(e) => setShouldClockIn(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-slate-900 focus:ring-slate-900"
                            />
                            <label htmlFor="clockIn" className="text-slate-700 font-medium select-none cursor-pointer">
                                רשום כניסה למשמרת
                            </label>
                        </div>
                    )}

                    {/* Back Button */}
                    {step === 'pin' && (
                        <button
                            onClick={() => {
                                setStep('phone');
                                setPin('');
                                setError('');
                            }}
                            className="w-full py-3 text-slate-500 font-medium hover:text-slate-700 transition-colors"
                        >
                            חזרה להזנת טלפון
                        </button>
                    )}
                </div>
                {/* Manager Login Link */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <button
                        onClick={() => navigate('/manager')}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                        <User size={12} />
                        <span>כניסת מנהל</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
