// Portal vitest setup — testing-library DOM cleanup between specs so each
// test starts with an empty `document.body` and no leftover subscribed
// components from prior renders.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
