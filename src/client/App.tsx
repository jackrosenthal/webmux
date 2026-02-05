import { useEffect, useState } from "react";
import { Login } from "./components/Login";
import { TerminalView } from "./components/TerminalView";
import { ToastProvider } from "./components/Toast";
import { verifyAuth } from "./services/api";
import "./styles/main.css";

type AuthState = "loading" | "authenticated" | "unauthenticated";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    verifyAuth()
      .then((authenticated) => {
        setAuthState(authenticated ? "authenticated" : "unauthenticated");
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        setAuthState("unauthenticated");
      });
  }, []);

  if (authState === "loading") {
    return null;
  }

  if (authState === "unauthenticated") {
    return (
      <ToastProvider>
        <Login onSuccess={() => setAuthState("authenticated")} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <TerminalView />
    </ToastProvider>
  );
}
