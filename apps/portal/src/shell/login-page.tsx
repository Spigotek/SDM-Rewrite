import { useState } from "react";

export function LoginPage({
  appName,
  onSubmit,
}: {
  appName: string;
  onSubmit: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("Vyplňte meno aj heslo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prihlásenie zlyhalo.");
      setBusy(false);
    }
  }

  return (
    <section className="sdm-login-page" data-testid="login-page">
      <form className="sdm-login-form" onSubmit={handleSubmit} aria-labelledby="login-title">
        <h1 id="login-title">{appName}</h1>
        <p className="sdm-login-hint">Prihláste sa do Service Desk-u.</p>
        <label className="sdm-login-field">
          <span>Používateľské meno</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            disabled={busy}
            data-testid="login-username"
          />
        </label>
        <label className="sdm-login-field">
          <span>Heslo</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={busy}
            data-testid="login-password"
          />
        </label>
        {error && (
          <p role="alert" className="sdm-login-error" data-testid="login-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="sdm-login-submit"
          disabled={busy}
          data-testid="login-submit"
        >
          {busy ? "Prihlasujem…" : "Prihlásiť"}
        </button>
      </form>
    </section>
  );
}
