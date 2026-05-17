// Redirect helpers — BFF spravuje SSO callback. SPA len iniciuje login a logout.

const LOGIN_PATH = "/auth/login";
const LOGOUT_PATH = "/auth/logout";

export interface LoginOptions {
  readonly returnTo?: string;
}

export const redirectToLogin = (opts: LoginOptions = {}): void => {
  const url = new URL(LOGIN_PATH, window.location.origin);
  if (opts.returnTo) url.searchParams.set("returnTo", opts.returnTo);
  window.location.assign(url.toString());
};

export const redirectToLogout = (): void => {
  window.location.assign(new URL(LOGOUT_PATH, window.location.origin).toString());
};

export const currentReturnTo = (): string =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;
