/**
 * Login Gateway - Smart Login Router
 * מנתב בין MayaGateway (רשת מקומית) ל-LoginScreen (גישה מרחוק)
 */

import React from 'react';
import { isLocalNetworkAccess } from '@/utils/networkDetection';
import MayaGateway from '@/components/maya/MayaGatewayComplete';
import LoginScreen from '@/pages/login/LoginScreen';

export const LoginGateway: React.FC = () => {
  const isLocalNetwork = isLocalNetworkAccess();

  console.log('🔐 LoginGateway:', isLocalNetwork ? 'Local Network → MayaGateway' : 'Remote → LoginScreen');

  if (isLocalNetwork) {
    // רשת מקומית → זיהוי פנים + PIN (ללא אפשרות לסגור)
    return (
      <div className="min-h-screen bg-[#050505]" dir="rtl">
        <MayaGateway forceOpen={true} hideClose={true} />
      </div>
    );
  } else {
    // גישה מרחוק → לוגין רגיל עם אימייל/סיסמה
    return <LoginScreen />;
  }
};

export default LoginGateway;
