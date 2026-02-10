// @ts-nocheck
/**
 * Maya Gateway - Complete State Machine Orchestrator (Phase 4)
 *
 * Manages the full authentication flow with all fallback options
 * Flow: SCANNING → [PIN_FALLBACK] → IDENTIFIED → CLOCK_IN → AUTHORIZED → Chat
 *
 * Anti-Gravity Aesthetic with framer-motion transitions
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMayaAuth, isFullyAuthorized, canViewFinancialData } from '../../context/MayaAuthContext';
import FaceScanner from './FaceScanner';
import PINPad from './PINPad';
import ClockInModal from './ClockInModal';
import MayaOverlay from './MayaOverlay';
import { Loader2, CheckCircle, ShieldAlert, Clock, UserCheck, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getBackendApiUrl } from '../../utils/apiUtils';

interface MayaGatewayProps {
  /** Force the gateway to always be open (for login screen) */
  forceOpen?: boolean;
  /** Hide the close button (for login screen) */
  hideClose?: boolean;
}

export const MayaGateway: React.FC<MayaGatewayProps> = ({
  forceOpen = false,
  hideClose = false
}) => {
  const mayaAuth = useMayaAuth();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(forceOpen);

  // Auto-open if forceOpen is true
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Initialize - start scanning when opened
  useEffect(() => {
    if (isOpen && mayaAuth.authState === 'LOADING') {
      mayaAuth.setAuthState('SCANNING');
    }
  }, [isOpen, mayaAuth]);

  // Navigate based on user role when authorized
  useEffect(() => {
    if (mayaAuth.authState === 'AUTHORIZED') {
      const isSuperAdmin = mayaAuth.employee?.isSuperAdmin;
      const destination = isSuperAdmin ? '/super-admin' : '/mode-selection';

      console.log(`✅ Authorization complete, navigating to ${destination}...`, { isSuperAdmin });

      // Small delay to show success state
      setTimeout(() => {
        navigate(destination, { replace: true });
      }, 1000);
    }
  }, [mayaAuth.authState, mayaAuth.employee, navigate]);

  // Cleanup: Stop all active media tracks when component unmounts
  useEffect(() => {
    return () => {
      // Stop all active video/audio tracks
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
          if (video.srcObject) {
            const stream = video.srcObject;
            stream.getTracks().forEach(track => {
              track.stop();
              console.log('🧹 Stopped track on cleanup:', track.kind);
            });
            video.srcObject = null;
          }
        });
      }
      console.log('✅ MayaGateway cleanup complete');
    };
  }, []);

  // Handle face scan completion
  const handleFaceScanComplete = async (embedding: Float32Array, confidence: number) => {
    try {
      console.log('🎯 Face captured, verifying with Supabase RPC...', { confidence });
      mayaAuth.setAuthState('MATCHING');

      const embeddingArray = Array.from(embedding);

      // 🛡️ SECURITY UPGRADE: Call Backend API instead of direct Supabase RPC
      // This allows server-side Biometric Peppering (Salting) to protect against data leaks.
      const API_URL = getBackendApiUrl();
      const response = await fetch(`${API_URL}/api/maya/verify-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embedding: embeddingArray,
          threshold: 0.55,
          businessId: '22222222-2222-2222-2222-222222222222' // Adjust if dynamic
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend verification error:', errorData);
        throw new Error(errorData.error || 'Face verification failed');
      }

      const verifiedData = await response.json();

      if (!verifiedData.matched) {
        throw new Error('No matching employee found. Please enroll your face first.');
      }

      const match = verifiedData.employee;
      console.log('✅ Face matched via Backend:', match);

      const employee = {
        id: match.id,
        name: match.name,
        access_level: match.accessLevel,
        accessLevel: match.accessLevel,
        is_super_admin: match.isSuperAdmin,
        isSuperAdmin: match.isSuperAdmin,
        business_id: match.businessId,
        businessId: match.businessId
      };

      // Set employee in Maya Auth context
      mayaAuth.setEmployee(employee, match.similarity);
      mayaAuth.setAuthState('IDENTIFIED');

      // CRITICAL: Also set in regular Auth context so all other screens work!
      await login(employee);
      console.log('✅ Employee logged in to Auth context');

      // Auto-transition after showing identification
      setTimeout(() => {
        checkAccessRequirements(employee);
      }, 1500);

    } catch (err) {
      console.warn('Face verification failed, switching to PIN:', err);
      // Auto-fallback to PIN on verification failure for smoother UX
      mayaAuth.setAuthState('PIN_FALLBACK');
    }
  };

  // Handle PIN verification success
  const handlePINSuccess = async (employee: any, similarity: number) => {
    console.log('✅ PIN verified:', employee);

    const employeeData = {
      id: employee.id,
      name: employee.name,
      access_level: employee.accessLevel,
      accessLevel: employee.accessLevel,
      is_super_admin: employee.isSuperAdmin,
      isSuperAdmin: employee.isSuperAdmin,
      business_id: employee.businessId,
      businessId: employee.businessId
    };

    // Set employee in Maya Auth context
    mayaAuth.setEmployee(employeeData, similarity);
    mayaAuth.setAuthState('IDENTIFIED');

    // CRITICAL: Also set in regular Auth context so all other screens work!
    await login(employeeData);
    console.log('✅ Employee logged in to Auth context (via PIN)');

    // Auto-transition after showing identification
    setTimeout(() => {
      checkAccessRequirements(employeeData);
    }, 1500);
  };

  // Check what access requirements are needed
  const checkAccessRequirements = async (employee: any) => {
    // Everyone goes through clock-in check
    // Super admins and managers get a prominent skip option in the UI
    await checkClockInStatus(employee.id);
  };

  // Check if employee is clocked in
  const checkClockInStatus = async (employeeId: string) => {
    try {
      // Call Supabase RPC function directly
      const { data, error } = await supabase.rpc('check_clocked_in', {
        p_employee_id: employeeId
      });

      if (error) {
        console.error('❌ Clock-in check error:', error);
        throw error;
      }

      console.log('🕐 Clock-in status:', data);

      if (data?.is_clocked_in) {
        mayaAuth.setClockInStatus(true, data.assigned_role);
        mayaAuth.setAuthState('AUTHORIZED');
      } else {
        mayaAuth.setClockInStatus(false);
        mayaAuth.setAuthState('CLOCK_IN_REQUIRED');
      }

    } catch (err) {
      console.error('Clock-in check failed:', err);
      // Don't block - allow access but warn
      mayaAuth.setClockInStatus(false);
      mayaAuth.setAuthState('AUTHORIZED');
    }
  };

  // Handle clock-in success
  const handleClockInSuccess = (role: string, eventId: string) => {
    console.log('✅ Clocked in:', { role, eventId });
    mayaAuth.setClockInStatus(true, role);
    mayaAuth.setAuthState('AUTHORIZED');
  };

  // Handle errors
  const handleError = (error: string) => {
    mayaAuth.setError(error, true);
  };

  // Handle fallback to PIN
  const handleFallbackToPIN = () => {
    console.log('🔑 Switching to PIN fallback');
    mayaAuth.setAuthState('PIN_FALLBACK');
  };

  // Handle switch back to face
  const handleSwitchToFace = () => {
    console.log('📷 Switching back to face scanning');
    mayaAuth.reset();
    mayaAuth.setAuthState('SCANNING');
  };

  // Handle retry
  const handleRetry = () => {
    mayaAuth.reset();
    mayaAuth.setAuthState('SCANNING');
  };

  // Transition variants
  const transitionVariants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 300
      }
    },
    exit: {
      opacity: 0,
      scale: 1.05,
      y: -20,
      transition: { duration: 0.3 }
    }
  };

  // Show overlay ONLY when fully AUTHORIZED
  if (mayaAuth.authState === 'AUTHORIZED') {
    return (
      <MayaOverlay
        employee={mayaAuth.employee}
        canViewFinancialData={canViewFinancialData(mayaAuth)}
        sessionId={mayaAuth.currentSessionId}
        isClockedIn={mayaAuth.isClockedIn}
        onLogout={() => {
          mayaAuth.reset();
          setIsOpen(false);
        }}
      />
    );
  }

  // Render gateway states
  return (
    <>
      {/* Maya Button - Only show if NOT forceOpen */}
      <AnimatePresence>
        {!forceOpen && !isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 left-6 z-[9999] w-16 h-16 rounded-full
                       bg-gradient-to-br from-purple-600 to-pink-600 border-4 border-cyan-400
                       shadow-xl shadow-cyan-500/40 flex items-center justify-center
                       hover:shadow-cyan-500/60 hover:border-cyan-300
                       transition-all duration-200"
          >
            <span className="text-3xl">✨</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Gateway Modal */}
      <AnimatePresence>
        {isOpen && mayaAuth.authState !== 'AUTHORIZED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              variants={transitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`
                ${mayaAuth.authState === 'CLOCK_IN_REQUIRED' ? 'w-[800px]' : 'w-[500px]'}
                max-h-[90vh] rounded-3xl overflow-hidden
                backdrop-blur-xl bg-slate-900/90 border-2 border-cyan-400/30
                shadow-2xl shadow-cyan-500/20
                transition-all duration-300
              `}
            >
              {/* Header */}
              <div className="h-16 px-6 flex items-center justify-between
                           bg-gradient-to-r from-purple-600/50 to-pink-600/50
                           border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-400/20 flex items-center justify-center">
                    {mayaAuth.authState === 'PIN_FALLBACK' ? (
                      <Key className="w-5 h-5 text-cyan-400" />
                    ) : mayaAuth.authState === 'CLOCK_IN_REQUIRED' ? (
                      <Clock className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <span className="text-2xl">✨</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Maya Gateway</h3>
                    <p className="text-xs text-white/60">
                      {mayaAuth.authState === 'SCANNING' && 'מזהה פנים...'}
                      {mayaAuth.authState === 'PIN_FALLBACK' && 'הזנת PIN'}
                      {mayaAuth.authState === 'MATCHING' && 'בודק במערכת...'}
                      {mayaAuth.authState === 'IDENTIFIED' && 'זוהה!'}
                      {mayaAuth.authState === 'CLOCK_IN_REQUIRED' && 'בחר תפקיד'}
                      {mayaAuth.authState === 'ERROR' && 'שגיאה'}
                    </p>
                  </div>
                </div>

                {!hideClose && (
                  <button
                    onClick={() => {
                      if (!forceOpen) {
                        setIsOpen(false);
                        mayaAuth.reset();
                      }
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    <span className="text-white text-xl">×</span>
                  </button>
                )}
              </div>

              {/* Body - State-based content */}
              <div className="p-8 min-h-[500px] flex justify-center overflow-y-auto">
                <AnimatePresence mode="wait">
                  {/* SCANNING State */}
                  {mayaAuth.authState === 'SCANNING' && (
                    <motion.div
                      key="scanning"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full"
                    >
                      <FaceScanner
                        onScanComplete={handleFaceScanComplete}
                        onError={handleError}
                        onFallbackToPIN={handleFallbackToPIN}
                      />
                    </motion.div>
                  )}

                  {/* PIN_FALLBACK State */}
                  {mayaAuth.authState === 'PIN_FALLBACK' && (
                    <motion.div
                      key="pin-fallback"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full"
                    >
                      <PINPad
                        onSuccess={handlePINSuccess}
                        onError={handleError}
                        onSwitchToFace={handleSwitchToFace}
                      />
                    </motion.div>
                  )}

                  {/* MATCHING State */}
                  {mayaAuth.authState === 'MATCHING' && (
                    <motion.div
                      key="matching"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center"
                    >
                      <Loader2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-spin" />
                      <h3 className="text-xl font-bold text-white mb-2">בודק במערכת...</h3>
                      <p className="text-white/60 text-sm">Verifying identity</p>
                    </motion.div>
                  )}

                  {/* IDENTIFIED State */}
                  {mayaAuth.authState === 'IDENTIFIED' && (
                    <motion.div
                      key="identified"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center"
                    >
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 0.6 }}
                      >
                        <UserCheck className="w-20 h-20 text-green-400 mx-auto mb-4" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        היי {mayaAuth.employee?.name}! 👋
                      </h3>
                      <p className="text-white/60 text-sm mb-2">
                        {mayaAuth.employee?.isSuperAdmin ? 'Super Admin' : mayaAuth.employee?.accessLevel}
                      </p>
                      <p className="text-cyan-400 text-xs">
                        Similarity: {((mayaAuth.similarity || 0) * 100).toFixed(0)}%
                      </p>
                    </motion.div>
                  )}

                  {/* CLOCK_IN_REQUIRED State */}
                  {mayaAuth.authState === 'CLOCK_IN_REQUIRED' && mayaAuth.employee && (
                    <motion.div
                      key="clock-in"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full"
                    >
                      <ClockInModal
                        employee={mayaAuth.employee}
                        onClockInSuccess={handleClockInSuccess}
                        onError={handleError}
                        onSkip={(
                          mayaAuth.employee.isSuperAdmin ||
                          ['Manager', 'Admin', 'admin', 'owner'].includes(mayaAuth.employee.accessLevel)
                        ) ? () => {
                          mayaAuth.setClockInStatus(false);
                          mayaAuth.setAuthState('AUTHORIZED');
                        } : undefined}
                      />
                    </motion.div>
                  )}

                  {/* ERROR State */}
                  {mayaAuth.authState === 'ERROR' && (
                    <motion.div
                      key="error"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center"
                    >
                      <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white mb-2">שגיאה</h3>
                      <p className="text-red-400 text-sm mb-6">{mayaAuth.error}</p>

                      <div className="flex gap-3 justify-center">
                        {mayaAuth.errorRetryable && (
                          <button
                            onClick={handleRetry}
                            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-medium transition"
                          >
                            נסה שוב
                          </button>
                        )}

                        {mayaAuth.authState !== 'PIN_FALLBACK' && (
                          <button
                            onClick={handleFallbackToPIN}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition flex items-center gap-2"
                          >
                            <Key size={16} />
                            השתמש ב-PIN
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MayaGateway;
