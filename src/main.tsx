import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Dark mode is the default and enforced for all users
const savedTheme = localStorage.getItem("theme");
const theme = savedTheme ?? "dark";
document.documentElement.classList.toggle("dark", theme === "dark");
if (!savedTheme) localStorage.setItem("theme", "dark");

const rootEl = document.getElementById("root")!;
// Remove o splash inicial assim que o React assume o controle
const splash = document.getElementById("initial-splash");
if (splash) splash.remove();
createRoot(rootEl).render(<App />);
