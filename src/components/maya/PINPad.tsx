// @ts-nocheck
/**
 * PINPad Component - Fallback Authentication
 *
 * Glassmorphism 3x4 numeric grid for PIN entry
 * Anti-Gravity design with cyan glows and weightless animations
 *
 * Usage:
 * <PINPad
 *   onSuccess={(employee, similarity) => {...}}
 *   onError={(error) => {...}}
 *   onSwitchToFace={() => {...}}
 * />
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Delete,
  CheckCircle,
  AlertCircle,
  Camera,
  Loader2,
  Key
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PINPadProps {
  onSuccess: (employee: any, similarity: number) => void;
  onError?: (error: string) => void;
  onSwitchToFace?: () => void;
}

export const PINPad: React.FC<PINPadProps> = ({
  onSuccess,
  onError,
  onSwitchToFace
}) => {
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);

  const MAX_ATTEMPTS = 3;
  const PIN_LENGTH = 4;

  // Handle key press
  const handleNumberPress = (num: number) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  // Handle backspace
  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  // Handle submit
  const handleSubmit = async () => {
    if (pin.length !== PIN_LENGTH) {
      setError('יש להזין 4 ספרות');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      // Call Supabase RPC function directly (no backend needed!)
      const { data, error } = await supabase.rpc('verify_employee_pin', {
        p_pin: pin,
        p_business_id: '22222222-2222-2222-2222-222222222222'
      });

      if (error) {
        console.error('❌ Supabase RPC error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        // Success - found employee
        const employee = data[0];
        console.log('✅ PIN verified via Supabase RPC:', employee);

        onSuccess({
          id: employee.id,
          name: employee.name,
          accessLevel: employee.access_level,
          isSuperAdmin: employee.is_super_admin,
          businessId: employee.business_id
        }, 1.0); // 100% match for PIN
      } else {
        // Failed verification - no matching employee
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          setError('נסיונות רבים מדי. המערכת נעולה למשך 5 דקות.');
          onError?.('Too many failed attempts');
        } else {
          setError(`PIN שגוי. נותרו ${MAX_ATTEMPTS - newAttempts} ניסיונות`);
        }

        // Clear PIN
        setPin('');
      }
    } catch (err) {
      console.error('❌ PIN verification error:', err);
      setError('שגיאת תקשורת. נסה שוב.');
      onError?.('Network error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !isVerifying) {
      handleSubmit();
    }
  }, [pin]);

  // Number pad layout
  const numbers = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['backspace', 0, 'submit']
  ];

  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  const glowVariants = {
    rest: { boxShadow: '0 0 0px rgba(34, 211, 238, 0)' },
    tap: { boxShadow: '0 0 30px rgba(34, 211, 238, 0.6)' }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-xl border border-cyan-400/30 rounded-2xl mb-2">
          <Lock className="w-6 h-6 text-cyan-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1">הזן PIN</h3>
        <p className="text-white/60 text-xs">
          {isVerifying ? 'מאמת...' : 'הזן 4 ספרות'}
        </p>
      </motion.div>

      {/* PIN Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center gap-2 mb-6"
      >
        {[...Array(PIN_LENGTH)].map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`
                w-12 h-12 rounded-xl
                ${pin.length > index
                ? 'bg-gradient-to-br from-cyan-500 to-purple-500 shadow-lg shadow-cyan-500/50'
                : 'bg-white/5 backdrop-blur-xl border border-cyan-400/20'
              }
                flex items-center justify-center
                transition-all duration-300
              `}
          >
            {pin.length > index && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2.5 h-2.5 bg-white rounded-full"
              />
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Error Message - fixed height container */}
      <div className="h-8 mb-2 w-full flex justify-center">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error-msg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-1.5 bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-red-400 px-3 py-1 rounded-lg"
            >
              <AlertCircle size={14} />
              <span className="text-xs font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Number Pad */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        dir="ltr"
        className="grid grid-cols-3 gap-2 w-full mb-4"
      >
        {numbers.map((row, rowIndex) =>
          row.map((item, colIndex) => {
            const key = `${rowIndex}-${colIndex}`;

            // Backspace button
            if (item === 'backspace') {
              return (
                <motion.button
                  key={key}
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  onClick={handleBackspace}
                  disabled={pin.length === 0 || isVerifying}
                  className="
                      h-16 rounded-2xl
                      bg-slate-700/30 backdrop-blur-xl border border-slate-600/30
                      hover:bg-slate-600/40 hover:border-slate-500/50
                      disabled:opacity-30 disabled:cursor-not-allowed
                      flex items-center justify-center
                      transition-all duration-200
                    "
                >
                  <Delete className="w-6 h-6 text-slate-400" />
                </motion.button>
              );
            }

            // Submit button
            if (item === 'submit') {
              return (
                <motion.button
                  key={key}
                  variants={{ ...buttonVariants, ...glowVariants }}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  onClick={handleSubmit}
                  disabled={pin.length !== PIN_LENGTH || isVerifying}
                  className="
                      h-16 rounded-2xl
                      bg-gradient-to-br from-green-500/30 to-emerald-500/30 backdrop-blur-xl
                      border border-green-400/40
                      hover:from-green-500/40 hover:to-emerald-500/40
                      disabled:opacity-30 disabled:cursor-not-allowed
                      flex items-center justify-center
                      transition-all duration-200
                      shadow-lg shadow-green-500/20
                    "
                >
                  {isVerifying ? (
                    <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  )}
                </motion.button>
              );
            }

            // Number button
            return (
              <motion.button
                key={key}
                variants={{ ...buttonVariants, ...glowVariants }}
                initial="rest"
                whileHover="hover"
                whileTap="tap"
                onClick={() => handleNumberPress(item as number)}
                disabled={pin.length >= PIN_LENGTH || isVerifying}
                className="
                    h-16 rounded-2xl
                    bg-slate-900/40 backdrop-blur-xl border border-cyan-400/20
                    hover:bg-slate-800/60 hover:border-cyan-400/40
                    disabled:opacity-30 disabled:cursor-not-allowed
                    flex items-center justify-center
                    transition-all duration-200
                    group
                  "
              >
                <span className="text-2xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                  {item}
                </span>
              </motion.button>
            );
          })
        )}
      </motion.div>

      {/* Switch to Face Recognition */}
      {onSwitchToFace && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSwitchToFace}
          className="
              flex items-center gap-2
              text-white/60 hover:text-white/90
              text-sm font-medium
              transition-colors duration-200
            "
        >
          <Camera size={16} />
          חזור לזיהוי פנים
        </motion.button>
      )}

      {/* Locked State Overlay */}
      <AnimatePresence>
        {attempts >= MAX_ATTEMPTS && (
          <motion.div
            key="lock-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-3xl z-50"
          >
            <div className="text-center">
              <Key className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">מערכת נעולה</h3>
              <p className="text-white/60 text-sm">נסה שוב בעוד 5 דקות</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PINPad;
