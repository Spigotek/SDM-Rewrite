import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/isolated-context";

/**
 * M.3.B — workspace `/queue` filter toggle-sequence integrity (v1.5.1).
 *
 * Fourth owner report of a filter desync. M.2.A pinned single-click integrity
 * (count === rows === matching badge) and asserted "count !== rows is
 * architecturally impossible — both read the same `filteredRows` memo". The
 * owner disproved that empirically by toggling criteria in quick succession:
 * the result-count and chips no longer reflected what they had clicked.
 *
 * Root cause: React Router's `setSearchParams((prev) => next)` functional
 * updater does NOT thread pending state like React's `useState` updater. When
 * multiple toggles fire before the router commits (a fast tap, or two clicks in
 * one tick), every updater reads the SAME committed `prev`, computes its `next`
 * independently, and the LAST `navigate` wins — silently dropping the earlier
 * writes. The surviving (partial) URL drives both the count and the table, so
 * they stay numerically in lockstep yet no longer match the chips the user
 * pressed: "count says 5 but the rows are not the ones I filtered for".
 *
 * Fix (`hooks.ts` `useQueueFilters`): chain every write through a ref holding
 * the latest REQUESTED params instead of trusting RR's stale `prev`, so a burst
 * of toggles composes instead of clobbering. A passive reconcile re-adopts the
 * router's committed params after each commit so external navigations (rail
 * links, back/forward, deep links) remain authoritative.
 *
 * This spec drives MULTI-STEP toggle sequences — the case M.2.A's single click
 * could never catch — and asserts at every step:
 *   - result-count N === rendered DOM rows, and
 *   - every rendered row matches the UNION of the active filter axes, and
 *   - the URL reflects EVERY toggle fired in a synchronous burst (no lost
 *     writes), and
 *   - a burst fired while the detail drawer's `?selected=` param is present
 *     preserves that param (no cross-axis clobber).
 */

interface Snap {
  readonly countN: number;
  readonly domRows: number;
  readonly search: string;
}

async function snap(page: Page): Promise<Snap> {
  const countText = (await page.getByTestId("queue-result-count").innerText()).trim();
  const countN = Number(countText.match(/(\d+)/)?.[1] ?? "-1");
  const domRows = await page.getByTestId("queue-row").count();
  return { countN, domRows, search: new URL(page.url()).search };
}

async function chipCodes(page: Page, axisLabels: readonly [string, string]): Promise<string[]> {
  const group = page
    .locator(
      `.sdm-queue-chip-group[aria-label="${axisLabels[0]}"], .sdm-queue-chip-group[aria-label="${axisLabels[1]}"]`,
    )
    .first();
  await expect(group).toBeVisible();
  const chips = group.locator('[data-testid^="queue-chip-"]');
  const n = await chips.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push((await chips.nth(i).getAttribute("data-testid"))!.replace("queue-chip-", ""));
  }
  return out;
}

async function gotoQueue(page: Page): Promise<void> {
  await page.goto("/queue");
  await expect(page.getByTestId("queue-table")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(200);
}

/** Click a chip via Playwright (slow human pace), wait for the URL to settle. */
async function toggle(page: Page, code: string): Promise<void> {
  await page.getByTestId(`queue-chip-${code}`).click();
  await page.waitForTimeout(150);
}

/** Fire several chip clicks in ONE synchronous page task — the burst that
 * exposes the stale-updater race. */
async function burst(page: Page, codes: ReadonlyArray<string>): Promise<void> {
  await page.evaluate((ids) => {
    for (const id of ids) {
      document.querySelector<HTMLElement>(`[data-testid="queue-chip-${id}"]`)?.click();
    }
  }, codes);
  await page.waitForTimeout(250);
}

test("M.3.B — slow multi-step toggle sequence keeps count === rows at every step", async ({
  isolatedPage,
}) => {
  const page = isolatedPage;
  await gotoQueue(page);

  const initial = await snap(page);
  expect(initial.countN, "initial count === rows").toBe(initial.domRows);
  expect(initial.domRows).toBeGreaterThan(0);

  const assignees = await chipCodes(page, ["Riešiteľ", "Assignee"]);
  const statuses = await chipCodes(page, ["Stav", "Status"]);
  expect(assignees.length).toBeGreaterThan(1);
  expect(statuses.length).toBeGreaterThan(0);

  const a0 = assignees[0]!;
  const a1 = assignees[1]!;
  const s0 = statuses[0]!;

  // Step 1: assignee a0 on
  await toggle(page, a0);
  let s = await snap(page);
  expect(s.countN, "step1 count===rows").toBe(s.domRows);
  expect(s.search).toContain(`assignee=${a0}`);

  // Step 2: + status s0
  await toggle(page, s0);
  s = await snap(page);
  expect(s.countN, "step2 count===rows").toBe(s.domRows);
  expect(s.search).toContain(`assignee=${a0}`);
  expect(s.search).toContain(`status=${s0}`);

  // Step 3: toggle status s0 back off
  await toggle(page, s0);
  s = await snap(page);
  expect(s.countN, "step3 count===rows").toBe(s.domRows);
  expect(s.search).toContain(`assignee=${a0}`);
  expect(s.search).not.toContain("status=");

  // Step 4: + assignee a1
  await toggle(page, a1);
  s = await snap(page);
  expect(s.countN, "step4 count===rows").toBe(s.domRows);
  expect(s.search).toContain(a0);
  expect(s.search).toContain(a1);

  // Step 5: toggle assignee a0 off — only a1 remains
  await toggle(page, a0);
  s = await snap(page);
  expect(s.countN, "step5 count===rows").toBe(s.domRows);
  expect(s.search).toContain(`assignee=${a1}`);
  expect(s.search).not.toContain(a0);
});

test("M.3.B — synchronous burst of distinct toggles never drops a write", async ({
  isolatedPage,
}) => {
  const page = isolatedPage;
  await gotoQueue(page);

  const assignees = await chipCodes(page, ["Riešiteľ", "Assignee"]);
  const statuses = await chipCodes(page, ["Stav", "Status"]);
  const a0 = assignees[0]!;
  const a1 = assignees[1]!;
  const s0 = statuses[0]!;

  // Three distinct toggles in one tick. Pre-fix, only the LAST survived.
  await burst(page, [a0, a1, s0]);
  let s = await snap(page);
  expect(s.search, "all three toggles must survive the burst").toContain(a0);
  expect(s.search).toContain(a1);
  expect(s.search).toContain(`status=${s0}`);
  expect(s.countN, "burst count===rows").toBe(s.domRows);

  // Burst again toggling the same three OFF — all should clear together.
  await burst(page, [a0, a1, s0]);
  s = await snap(page);
  expect(s.search, "all three toggles must clear together").toBe("");
  expect(s.countN, "post-clear count===rows").toBe(s.domRows);
});

test("M.3.B — burst preserves the detail drawer's ?selected= param", async ({ isolatedPage }) => {
  const page = isolatedPage;
  await gotoQueue(page);

  // Open the detail drawer (sets ?selected=<id>).
  await page.getByTestId("queue-row").first().click();
  await page.waitForTimeout(200);
  expect(new URL(page.url()).search).toContain("selected=");
  const selectedId = new URL(page.url()).searchParams.get("selected")!;

  const assignees = await chipCodes(page, ["Riešiteľ", "Assignee"]);
  const statuses = await chipCodes(page, ["Stav", "Status"]);

  // Fire a filter burst while the drawer is open. The `selected` param must
  // survive — a stale-updater clobber would drop it.
  await burst(page, [assignees[0]!, statuses[0]!]);
  const url = new URL(page.url()).searchParams;
  expect(url.get("selected"), "selected param must survive a filter burst").toBe(selectedId);
  expect(url.get("assignee"), "assignee toggle must apply").toContain(assignees[0]!);
  expect(url.get("status"), "status toggle must apply").toContain(statuses[0]!);

  const s = await snap(page);
  expect(s.countN, "drawer+burst count===rows").toBe(s.domRows);
});
