import React, { useEffect, useState, lazy, Suspense } from "react";
import { ConnectionProvider } from "@/context/ConnectionContext";
import { ThemeProvider } from "@/context/ThemeContext";
import SplashScreen from "@/components/SplashScreen";

import LoadingFallback from "@/components/LoadingFallback";

// Lazy Load Routes to ensure tree-shaking works for LITE mode
const FullRoutes = lazy(() => import("./Routes"));
const LiteRoutes = lazy(() => import("./LiteRoutes"));

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const isLite = import.meta.env.VITE_APP_MODE === 'lite';

  // ... (Effect hooks kept same) ...

  if (isLoading) {
    return <SplashScreen onFinish={() => setIsLoading(false)} />;
  }

  // 🚀 LITE MODE: Minimal Providers
  if (isLite) {
    return (
      <ThemeProvider>
        <ConnectionProvider>
          <Suspense fallback={<LoadingFallback message="טוען גרסה קלה..." />}>
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
        <Suspense fallback={<LoadingFallback message="טוען מודולים..." />}>
          <FullRoutes />
        </Suspense>
      </ConnectionProvider>
    </ThemeProvider>
  );
}

export default App;
