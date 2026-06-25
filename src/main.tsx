import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyInitialSettings } from "./lib/settingsStorage";
import "./styles/global.css";

applyInitialSettings();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);