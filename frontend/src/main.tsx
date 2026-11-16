import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { installNativeFeel } from "./lib/standalone";
import { applyTheme, getTheme } from "./lib/theme";
import "./styles.css";

installNativeFeel();
applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
