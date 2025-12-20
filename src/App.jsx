import React from "react";
import Routes from "./Routes";
import { ConnectionProvider } from "@/context/ConnectionContext";
import ConnectionStatusBar from "@/components/ConnectionStatusBar";

function App() {
  return (
    <ConnectionProvider>
      <ConnectionStatusBar />
      <Routes />
    </ConnectionProvider>
  );
}

export default App;
