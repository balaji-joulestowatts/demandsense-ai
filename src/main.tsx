import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Default to dark mode unless user has explicitly chosen light
if (localStorage.getItem("ds-theme") !== "light") {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
