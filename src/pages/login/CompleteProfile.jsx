import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
    Loader2,
    CheckCircle,
    AlertTriangle,
    User,
    Lock,
    Key,
    Mail,
    ArrowLeft,
    Check,
    Eye,
    EyeOff,
    Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CompleteProfile = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const employeeId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [employee, setEmployee] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        pinCode: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const verifyEmployee = async () => {
            if (!employeeId) {
                setError('קישור לא תקין. אנא פנה למנהל שלך.');
                setLoading(false);
                return;
            }

            try {
                // Fetch basic employee info to verify
                const { data, error: fetchError } = await supabase
                    .from('employees')
                    .select('id, name, business_id, auth_user_id, password_hash')
                    .eq('id', employeeId)
                    .single();

                if (fetchError || !data) {
                    setError('העובד לא נמצא או שהקישור פג תוקף.');
                } else if (data.password_hash) {
                    setError('החשבון שלך כבר הוגדר. אנא התחבר רגיל.');
                } else {
                    setEmployee(data);
                }
            } catch (err) {
                console.error('Verification error:', err);
                setError('שגיאה באימות הפרטים.');
            } finally {
                setLoading(false);
            }
        };

        verifyEmployee();
    }, [employeeId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            alert('הסיסמאות לא תואמות');
            return;
        }
        if (form.pinCode.length < 4) {
            alert('קוד פין חייב להכיל לפחות 4 ספרות');
            return;
        }

        setIsSubmitting(true);
        try {
            // Call the secure RPC to update password and other details
            const { data, error: rpcError } = await supabase.rpc('complete_employee_setup', {
                p_employee_id: employeeId,
                p_email: form.email.toLowerCase().trim(),
                p_password: form.password,
                p_pin_code: form.pinCode
            });

            if (rpcError) throw rpcError;

            if (data) {
                setSuccess(true);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                throw new Error('Update failed');
            }
        } catch (err) {
            console.error('Submission error:', err);
            alert('שגיאה בשמירת הפרטים. ייתכן והמייל כבר בשימוש.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <Loader2 className="text-white animate-spin" size={48} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-heebo" dir="rtl">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center">
                    <AlertTriangle className="text-amber-500 mx-auto mb-4" size={56} />
                    <h2 className="text-2xl font-black text-slate-800 mb-2">אופס! משהו לא תקין</h2>
                    <p className="text-slate-600 mb-6 font-medium">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200"
                    >
                        חזור להתחברות
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-heebo" dir="rtl">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-3xl p-8 max-w-md w-full text-center"
                >
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check size={48} strokeWidth={3} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">הוגדר בהצלחה!</h2>
                    <p className="text-slate-600 mb-8 font-medium">החשבון שלך מוכן לפעולה. מעביר אותך למסך ההתחברות...</p>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 3 }}
                            className="bg-green-500 h-full"
                        />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 py-12 px-4 font-heebo flex items-center justify-center" dir="rtl">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col pt-12 pb-8 px-8 sm:px-12">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <User size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 leading-none">היי {employee?.name}!</h1>
                    <p className="text-slate-500 font-bold mt-3 text-lg">בוא נשלים את הקמת החשבון שלך</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 mr-1 flex items-center gap-1.5">
                            <Mail size={14} className="text-indigo-500" />
                            אימייל להתחברות
                        </label>
                        <input
                            required
                            type="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-lg"
                            placeholder="your@email.com"
                            dir="ltr"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 mr-1 flex items-center gap-1.5">
                                <Lock size={14} className="text-indigo-500" />
                                סיסמה
                            </label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full pr-6 pl-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-lg tracking-widest"
                                    placeholder="••••••••"
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 mr-1 flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-indigo-500" />
                                אימות סיסמה
                            </label>
                            <input
                                required
                                type={showPassword ? "text" : "password"}
                                value={form.confirmPassword}
                                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-lg tracking-widest"
                                placeholder="••••••••"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 mr-1 flex items-center gap-1.5">
                            <Key size={14} className="text-indigo-500" />
                            קוד פין (לכניסה מהירה בקופה)
                        </label>
                        <input
                            required
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={form.pinCode}
                            onChange={e => setForm({ ...form, pinCode: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-2xl tracking-[0.5em] text-center"
                            placeholder="0000"
                        />
                        <p className="text-[11px] text-slate-400 font-bold px-2 text-center">קוד זה ישמש אותך לכניסה מהירה למסך המכירה ולביצוע פעולות בקופה.</p>
                    </div>

                    <button
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-2xl font-black text-xl transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 mt-4 active:scale-[0.98]"
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                <span>סיים והתחבר למערכת</span>
                                <ArrowLeft size={24} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
