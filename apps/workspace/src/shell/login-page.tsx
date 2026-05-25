import { useState } from "react";
import { Button, Card } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";

export function LoginPage({
  appName,
  onSubmit,
}: {
  appName: string;
  onSubmit: (username: string, password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError(t("errors.loginCredentialsRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loginFailed"));
      setBusy(false);
    }
  }

  return (
    <section className="sdm-login-page" data-testid="login-page">
      <Card variant="surface" className="sdm-login-card">
        <form className="sdm-login-form" onSubmit={handleSubmit} aria-labelledby="login-title">
          <h1 id="login-title">{appName}</h1>
          <p className="sdm-login-hint">{t("workspace:shell.loginHint")}</p>
          <label className="sdm-login-field">
            <span>{t("workspace:shell.username")}</span>
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
            <span>{t("workspace:shell.password")}</span>
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
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={busy}
            fullWidth
            data-testid="login-submit"
          >
            {busy ? t("actions.signingIn") : t("actions.signIn")}
          </Button>
        </form>
      </Card>
    </section>
  );
}
