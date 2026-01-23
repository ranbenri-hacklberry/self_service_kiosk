import React, { useEffect, useState, lazy, Suspense } from "react";
import { ConnectionProvider } from "@/context/ConnectionContext";
import { ThemeProvider } from "@/context/ThemeContext";
import SplashScreen from "@/components/SplashScreen";

// Lazy Load Routes to ensure tree-shaking works for LITE mode
const FullRoutes = lazy(() => import("./Routes"));
const LiteRoutes = lazy(() => import("./LiteRoutes"));

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const isLite = import.meta.env.VITE_APP_MODE === 'lite';

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
          const domainParts = window.location.hostname.split('.');
          if (domainParts.length >= 2) {
            const rootDomain = '.' + domainParts.slice(-2).join('.');
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;domain=" + rootDomain;
          }
        }
      }
      if (!isLite) console.log('🧹 Cleanup: Authentication cookies cleared to prevent Header Too Large errors');
    } catch (e) {
      console.warn('Cookie cleanup failed:', e);
    }
  }, [isLite]);

  // 🧹 DATA PRUNING: Automatically clean old local orders on startup to improve performance on tablets
  useEffect(() => {
    const pruneData = async () => {
      try {
        const { db } = await import('@/db/database');

        // SAFETY CHECK: incomplete offline actions?
        // We assume >7 days old orders are safe unless specifically in a queue.
        // If there were a specific 'offlineQueue' table we would check it here.
        // For now, this is a placeholder for that safety check logic.
        // const pendingCount = await db.offlineQueue?.count() || 0;
        // if (pendingCount > 0) { console.log('⏳ Pending offline actions found, skipping prune.'); return; }



        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isoLimit = sevenDaysAgo.toISOString();

        // Delete old orders
        const oldOrdersCount = await db.orders.where('created_at').below(isoLimit).count();
        if (oldOrdersCount > 0) {
          console.log(`🧹 Pruning ${oldOrdersCount} old local orders (older than 7 days)...`);
          await db.orders.where('created_at').below(isoLimit).delete();
          // Also cleanup orphaned items if possible, but cascading delete handles most
          console.log('✅ Pruning complete.');
        } else {
          console.log('✅ Local DB is clean (no orders older than 7 days).');
        }
      } catch (err) {
        console.error('Failed to prune local data:', err);
      }
    };

    // Run only once on mount
    pruneData();
  }, []);

  if (isLoading) {
    return <SplashScreen onFinish={() => setIsLoading(false)} />;
  }

  // 🚀 LITE MODE: Minimal Providers
  if (isLite) {
    return (
      <ThemeProvider>
        <ConnectionProvider>
          <Suspense fallback={<div className="h-screen bg-slate-900 flex items-center justify-center text-white">Loading Lite...</div>}>
            <LiteRoutes />
          </Suspense>
        </ConnectionProvider>
      </ThemeProvider>
    );
  }

  // 🌟 FULL MODE: All Providers
  return (
    <ThemeProvider>
      <ConnectionProvider>
        <Suspense fallback={<div>Loading app...</div>}>
          <FullRoutes />
        </Suspense>
      </ConnectionProvider>
    </ThemeProvider>
  );
}

export default App;
