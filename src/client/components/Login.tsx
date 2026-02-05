import { useState, type FormEvent } from "react";
import { login } from "../services/api";

interface LoginProps {
  onSuccess: () => void;
}

export function Login({ onSuccess }: LoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(password);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error ?? "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Webmux</h1>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Log in"}
        </button>
        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}
