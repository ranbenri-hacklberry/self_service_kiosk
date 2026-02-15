
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tagger from "@dhiwise/component-tagger";
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isLite = env.VITE_APP_MODE === 'lite';
  const rootDir = process.cwd();

  // Docker networking: use service name 'backend' when running in container
  // Falls back to localhost:8081 for local development
  const backendTarget = process.env.DOCKER_ENV === 'true'
    ? 'http://localhost:8081'
    : 'http://localhost:8081';

  // Check if running in a container or Linux environment without display (headless)
  // 🚨 TEMP FIX: Disable Electron for development to avoid crashes
  const isDocker = process.env.DOCKER_ENV === 'true' || process.platform === 'linux' || true;

  const aliases = {
    "@": path.resolve(rootDir, "./src"),
  };

  if (isLite) {
    console.log("🚀 Building in LITE mode: Swapping heavy modules...");
    const emptyModule = path.resolve(rootDir, "./src/emptyModule.jsx");
    aliases['framer-motion'] = emptyModule;
    aliases['recharts'] = emptyModule;
  }

  return {
    base: './', // 🚀 CRITICAL: Fixes relative paths for Electron file:// protocol
    build: {
      outDir: "build",
      chunkSizeWarningLimit: isLite ? 500 : 2000,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
    plugins: [
      tsconfigPaths(),
      react(),
      tagger(),
      // Only run Electron if NOT in Docker/Linux environment
      !isDocker && electron([
        {
          // Main-Process entry point
          entry: 'electron/main/index.ts',
          vite: {
            build: {
              outDir: 'dist-electron/main',
            },
          },
        },
        {
          // Preload-Process entry point
          entry: 'electron/preload/index.ts',
          onstart(args) {
            // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
            // instead of restarting the entire Electron App.
            args.reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron/preload',
            },
          },
        },
      ]),
      !isDocker && renderer(),
    ].filter(Boolean),
    resolve: {
      alias: aliases,
    },
    server: {
      port: 4028,
      host: "0.0.0.0",
      strictPort: true,
      allowedHosts: [".amazonaws.com", ".builtwithrocket.new", "icaffe.hacklberryfinn.com", "localhost"],
      proxy: {
        "/item": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // Marketing routes
        "/api/marketing": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // Maya AI routes
        "/api/maya": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/health": {
          target: backendTarget, // backendTarget is http://127.0.0.1:8081
          changeOrigin: true,
          secure: false,
        },
        // Proxy only music-related API calls to avoid intercepting the frontend /music route
        "^/music/(scan|volumes|library|stream|folders|process|cover|sync|youtube)": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/ollama": {
          target: "http://localhost:11434/api",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/ollama/, ""),
        },
      },
    }
  };
});
