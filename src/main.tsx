import React from "react";
import { createRoot } from "react-dom/client";
import App from "./atlas/AtlasApp";
import { isTauri } from "@tauri-apps/api/core";
import "./base.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isTauri() ? <App /> : <p>Bitte starte SaltMarcher in der Desktop-App.</p>}
  </React.StrictMode>,
);
