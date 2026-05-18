import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export interface CookieConfig {
  readonly name: string;
  readonly secure: boolean;
  readonly sameSite: "Lax" | "Strict" | "None";
  readonly maxAgeSec: number;
  readonly path: "/";
  readonly domain?: string;
}

function assertHostPrefixCompliant(cfg: CookieConfig): void {
  if (!cfg.name.startsWith("__Host-")) return;
  if (cfg.path !== "/") throw new Error("__Host- cookies require Path=/");
  if (!cfg.secure) throw new Error("__Host- cookies require Secure");
  if (cfg.domain !== undefined) throw new Error("__Host- cookies must NOT set Domain");
}

export function setSessionCookie(c: Context, sid: string, cfg: CookieConfig): void {
  assertHostPrefixCompliant(cfg);
  setCookie(c, cfg.name, sid, {
    httpOnly: true,
    secure: cfg.secure,
    sameSite: cfg.sameSite,
    path: cfg.path,
    maxAge: cfg.maxAgeSec,
    ...(cfg.domain !== undefined ? { domain: cfg.domain } : {}),
  });
}

export function getSessionCookie(c: Context, cookieName: string): string | null {
  return getCookie(c, cookieName) ?? null;
}

export function clearSessionCookie(c: Context, cfg: CookieConfig): void {
  assertHostPrefixCompliant(cfg);
  deleteCookie(c, cfg.name, {
    path: cfg.path,
    secure: cfg.secure,
    sameSite: cfg.sameSite,
    ...(cfg.domain !== undefined ? { domain: cfg.domain } : {}),
  });
}
