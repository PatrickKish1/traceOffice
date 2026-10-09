import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Guide from "./Guide";
import "./style.css";
const Page = window.location.pathname === "/guides" ? Guide : App;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
