import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply persisted theme (default: dark — futuristic Neon Synapse)
const savedTheme = localStorage.getItem("theme");
const theme = savedTheme === "light" ? "light" : "dark";
document.documentElement.classList.toggle("dark", theme === "dark");

createRoot(document.getElementById("root")!).render(<App />);
