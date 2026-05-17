/**
 * Reference template for ad-hoc scenarios. The runner copies this file to
 * `.playwright/runs/<runId>/ad-hoc.spec.ts` and replaces the body with the
 * caller-provided snippet. DO NOT execute this file directly; the runner
 * filters it out.
 */
import { test, expect } from "../fixtures/isolated-context";

test.skip("ad-hoc template (skipped by default)", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");
  expect(true).toBe(true);
});
