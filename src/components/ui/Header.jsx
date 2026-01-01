import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import { recordTimeClockEvent, getEmployeeClockStatus } from '../../services/timeClockService';
import { safeJsonParse } from '../../utils';

const Header = ({
  primaryAction = null,
  hideLanguage = false,
  customActions = null,
  customerName = null,
  isEditMode = false
}) => {
  const [employeeSession, setEmployeeSession] = useState(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Load employee session on component mount
  useEffect(() => {
    const loadEmployeeSession = () => {
      const sessionData = sessionStorage.getItem('employee_session');
      if (sessionData) {
        const employee = safeJsonParse(sessionData);
        setEmployeeSession(employee);

        // Check clock status if employee is logged in
        if (employee?.id) {
          checkClockStatus(employee?.id);
        }
      }
    };

    loadEmployeeSession();
  }, []);

  // Check if employee is currently clocked in
  const checkClockStatus = async (employeeId) => {
    try {
      const result = await getEmployeeClockStatus(employeeId);
      if (result?.success) {
        setIsClockedIn(result?.isClockedIn);
      }
    } catch (error) {
      console.error('Error checking clock status:', error);
    }
  };

  // Handle employee clock out
  const handleClockOut = async () => {
    if (!employeeSession?.id || isClockingOut) return;

    setIsClockingOut(true);

    try {
      const result = await recordTimeClockEvent(employeeSession?.id, 'clock_out');

      if (result?.success) {
        setIsClockedIn(false);

        // Clear employee session
        sessionStorage.removeItem('employee_session');
        setEmployeeSession(null);

        // Navigate back to login screen
        navigate('/employee-login-screen');
      } else {
        console.error('Clock out failed:', result?.error);
        alert('שגיאה ביציאה מהעבודה. אנא נסה שוב.');
      }
    } catch (error) {
      console.error('Clock out error:', error);
      alert('שגיאה ביציאה מהעבודה. אנא נסה שוב.');
    } finally {
      setIsClockingOut(false);
    }
  };

  // Handle end session without clock out (for customer mode or manager override)
  const handleEndSession = () => {
    sessionStorage.removeItem('employee_session');
    setEmployeeSession(null);
    setIsClockedIn(false);
    navigate('/employee-login-screen');
  };

  return (
    <header className="bg-primary text-primary-foreground shadow-kiosk relative z-20">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Logo Section */}
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-kiosk-sm">
              <Icon name="Utensils" size={24} color="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Self Service Kiosk
              </h1>
              <p className="text-xs text-primary-foreground/80">
                Quick & Easy Ordering
              </p>
            </div>
          </div>
        </div>

        {/* Customer Greeting (when customer name is available) */}
        {customerName && (
          <div className="flex-1 text-center">
            <div className="text-lg font-semibold text-primary-foreground/90">
              {isEditMode ? `עדכון הזמנה - ${customerName}` : `הזמנה חדשה - ${customerName}`}
            </div>
          </div>
        )}

        {/* Employee Session Info (when logged in) */}
        {employeeSession && (
          <div className="flex items-center space-x-4 bg-white/10 rounded-kiosk-md px-4 py-2">
            <div className="flex items-center space-x-2">
              <Icon name="User" size={16} color="currentColor" />
              <div className="text-sm">
                <div className="font-medium">{employeeSession?.name}</div>
                <div className="text-xs text-primary-foreground/80">
                  {employeeSession?.accessLevel} • {isClockedIn ? 'פעיל' : 'לא פעיל'}
                </div>
              </div>
            </div>

            {/* Clock Status Indicator */}
            <div className={`w-2 h-2 rounded-full ${isClockedIn ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center space-x-4">
          {/* Time Display */}
          <div className="hidden sm:flex items-center space-x-2 text-sm">
            <Icon name="Clock" size={16} color="currentColor" />
            <span className="font-mono">
              {currentTime?.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Employee Actions */}
          {employeeSession && (
            <div className="flex items-center space-x-2">
              {/* Clock Out Button (only show if clocked in) */}
              {isClockedIn && (
                <button
                  onClick={handleClockOut}
                  disabled={isClockingOut}
                  className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-red-500/80 hover:bg-red-500 transition-colors duration-150 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="LogOut" size={18} color="currentColor" />
                  <span className="hidden sm:inline text-sm font-medium">
                    {isClockingOut ? 'יוצא...' : 'יציאה'}
                  </span>
                </button>
              )}

              {/* End Session Button (for manager override or customer mode) */}
              {(!isClockedIn || employeeSession?.isOverride) && (
                <button
                  onClick={handleEndSession}
                  className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-orange-500/80 hover:bg-orange-500 transition-colors duration-150 touch-target"
                >
                  <Icon name="X" size={18} color="currentColor" />
                  <span className="hidden sm:inline text-sm font-medium">סיום</span>
                </button>
              )}
            </div>
          )}

          {/* Primary Action */}
          {primaryAction && (
            <button
              onClick={primaryAction?.onClick}
              className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-white/20 hover:bg-white/30 transition-colors duration-150 touch-target"
            >
              {primaryAction?.iconName && (
                <Icon name={primaryAction?.iconName} size={18} color="currentColor" />
              )}
              <span className="hidden sm:inline text-sm font-medium">
                {primaryAction?.label}
              </span>
            </button>
          )}

          {/* Custom Actions (e.g., view toggles) */}
          {customActions && (
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              {customActions}
            </div>
          )}


          {/* Maya AI Assistant (Only for logged-in employees) */}
          {employeeSession && (
            <button
              className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-gradient-to-r from-purple-500/80 to-pink-500/80 hover:from-purple-500 hover:to-pink-500 transition-all duration-150 touch-target shadow-lg"
              onClick={() => {
                navigate('/maya');
              }}
              title="מאיה - העוזרת האישית"
            >
              <span className="text-lg">🌸</span>
              <span className="hidden sm:inline text-sm font-medium">מאיה</span>
            </button>
          )}

          {/* Language Toggle */}
          {!hideLanguage && (
            <button
              className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-white/10 hover:bg-white/20 transition-colors duration-150 touch-target"
              onClick={() => {
                // Language toggle functionality
                console.log('Language toggle');
              }}
            >
              <Icon name="Globe" size={18} color="currentColor" />
              <span className="text-sm font-medium">EN</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;