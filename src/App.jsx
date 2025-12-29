import React, { useEffect } from "react";
import Routes from "./Routes";
import { ConnectionProvider } from "@/context/ConnectionContext";
import ConnectionStatusBar from "@/components/ConnectionStatusBar";
import SyncStatusModal from "@/components/SyncStatusModal";

function App() {
  // Fix for Cloudflare Error 1013: Clear large/overlapping cookies to reduce header size
  useEffect(() => {
    try {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

        // Clear common auth cookies that might have been set by accident or by other apps on same domain
        if (name.includes('supabase') || name.includes('sb-') || name.includes('spotify') || name.includes('token')) {
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
          // Also try clearing for second-level domain if applicable
          const domainParts = window.location.hostname.split('.');
          if (domainParts.length >= 2) {
            const rootDomain = '.' + domainParts.slice(-2).join('.');
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + rootDomain;
          }
        }
      }
      console.log('🧹 Cleanup: Authentication cookies cleared to prevent Header Too Large errors');
    } catch (e) {
      console.warn('Cookie cleanup failed:', e);
    }
  }, []);

  return (
    <ConnectionProvider>
      <Routes />
    </ConnectionProvider>
  );
}

export default App;
