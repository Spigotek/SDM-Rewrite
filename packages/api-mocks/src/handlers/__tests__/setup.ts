import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../../node";
import { resetStore } from "../../db";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetStore();
});
afterAll(() => server.close());
