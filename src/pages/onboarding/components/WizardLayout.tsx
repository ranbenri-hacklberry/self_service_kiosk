import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '../store/useOnboardingStore';
import Step1_Atmosphere from './Step1_Atmosphere';
import Step2_MenuUpload from './Step2_MenuUpload';
import Step3_ReviewAI from './Step3_ReviewAI';
import Step4_Generation from './Step4_Generation';
import Step5_Finish from './Step5_Finish';
import { useTheme } from '../../../context/ThemeContext';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const WizardLayout = () => {
    const { step, setStep, initSession } = useOnboardingStore();
    const { isDarkMode } = useTheme();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Init session for resuming data
    useEffect(() => {
        if (!currentUser?.business_id) return;
        initSession(currentUser.business_id);
    }, [currentUser?.business_id, initSession]);

    const variants = {
        enter: { opacity: 0, x: 20 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    const renderStep = () => {
        switch (step) {
            case 1: return <Step1_Atmosphere />;
            case 2: return <Step2_MenuUpload />;
            case 3: return <Step3_ReviewAI />;
            case 4: return <Step4_Generation />;
            case 5: return <Step5_Finish />;
            default: return <Step1_Atmosphere />;
        }
    };

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/owner-settings')} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                        <ChevronLeft />
                    </button>
                    <h1 className="text-xl font-bold">Menu Setup Wizard 🪄</h1>
                </div>

                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <button
                                onClick={() => setStep(s)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                ${step === s ? 'bg-indigo-500 text-white scale-110 shadow-lg shadow-indigo-500/30' :
                                        step > s ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' :
                                            'bg-slate-700/30 text-slate-500 hover:bg-slate-700/50'}`}
                            >
                                {s}
                            </button>
                            {s < 5 && <div className={`w-6 h-[2px] rounded-full ${step > s ? 'bg-indigo-500/50' : 'bg-slate-700/30'}`} />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={step}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}
                    >
                        <div className="max-w-5xl mx-auto p-6 min-h-full">
                            {renderStep()}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WizardLayout;
