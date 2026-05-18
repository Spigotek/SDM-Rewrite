import { randomBytes } from "node:crypto";
import { MemorySessionStore } from "./memory-store";
import type { SessionStore } from "./types";

export * from "./types";
export { MemorySessionStore };

export function createSessionStore(config: { driver: "memory" }): SessionStore {
  if (config.driver === "memory") return new MemorySessionStore();
  throw new Error(`unsupported session driver: ${config.driver as string}`);
}

export function generateSid(): string {
  return randomBytes(32).toString("base64url");
}
