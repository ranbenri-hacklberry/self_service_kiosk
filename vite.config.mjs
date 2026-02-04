
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tagger from "@dhiwise/component-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isLite = env.VITE_APP_MODE === 'lite';
  const rootDir = process.cwd();

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
    plugins: [tsconfigPaths(), react(), tagger()],
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
          target: "http://localhost:8081",
          changeOrigin: true,
          secure: false,
        },
        "/api": {
          target: "http://localhost:8081",
          changeOrigin: true,
          secure: false,
        },
        "/music": {
          target: "http://localhost:8081",
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
