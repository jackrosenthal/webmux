import { useEffect, useState } from "react";
import { Login } from "./components/Login";
import { verifyAuth } from "./services/api";
import "./styles/main.css";

type AuthState = "loading" | "authenticated" | "unauthenticated";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    verifyAuth().then((authenticated) => {
      setAuthState(authenticated ? "authenticated" : "unauthenticated");
    });
  }, []);

  if (authState === "loading") {
    return null;
  }

  if (authState === "unauthenticated") {
    return <Login onSuccess={() => setAuthState("authenticated")} />;
  }

  return <div>Hello Webmux</div>;
}
