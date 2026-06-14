import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/isolated-context";

/**
 * M.2.A — workspace `/queue` status-filter integrity (v1.5.0).
 *
 * Regression guard for the owner-reported desync where a status filter showed
 * rows of "mixed statuses". Root cause: `QueueTable`/`QueueKanban` carried their
 * own divergent code→logical maps (`AWU → pending`, `RESOLVED → open` fallback,
 * etc.) instead of the filter's authoritative `hooks.CA_CODE_TO_LOGICAL`. A row
 * filtered as `resolved` could thus render its badge as `open`. The fix routes
 * both the filter and the badge through the single `caLogicalStatus` resolver.
 *
 * This spec pins three invariants:
 *   1. A status facet chip narrows the table: result-count N === rendered DOM
 *      rows === the facet's promised count.
 *   2. Every visible row's status badge label matches the clicked chip.
 *   3. For logical rail-style filters (`?status=resolved,closed`, etc.) every
 *      rendered badge's logical `data-status` lies within the active filter set
 *      — no badge may carry a status the user did not filter for.
 */

const STATUS_GROUP =
  '.sdm-queue-chip-group[aria-label="Stav"], .sdm-queue-chip-group[aria-label="Status"]';

interface Facet {
  readonly code: string;
  readonly label: string;
  readonly count: number;
}

async function readStatusFacets(page: Page): Promise<Facet[]> {
  const group = page.locator(STATUS_GROUP).first();
  await expect(group).toBeVisible();
  const chips = group.locator('[data-testid^="queue-chip-"]');
  const n = await chips.count();
  const out: Facet[] = [];
  for (let i = 0; i < n; i++) {
    const chip = chips.nth(i);
    const code = (await chip.getAttribute("data-testid"))!.replace("queue-chip-", "");
    const lines = (await chip.innerText()).trim().split("\n");
    out.push({
      code,
      label: lines[0] ?? code,
      count: Number(lines[lines.length - 1]),
    });
  }
  return out;
}

test("M.2.A — status facet chip narrows count AND rows in lockstep", async ({ isolatedPage }) => {
  await isolatedPage.goto("/queue");
  await expect(isolatedPage).toHaveURL(/\/queue/, { timeout: 15_000 });
  const table = isolatedPage.getByTestId("queue-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("queue-row");
  const totalRows = await rows.count();
  expect(totalRows).toBeGreaterThan(0);

  const facets = await readStatusFacets(isolatedPage);
  expect(facets.length).toBeGreaterThan(0);
  // Pick the narrowest facet so the filter is obviously narrowing.
  const target = [...facets].sort((a, b) => a.count - b.count)[0]!;

  await isolatedPage.getByTestId(`queue-chip-${target.code}`).click();
  await expect(isolatedPage.getByTestId(`queue-chip-${target.code}`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await isolatedPage.waitForTimeout(200);

  const countText = (await isolatedPage.getByTestId("queue-result-count").innerText()).trim();
  const n = Number(countText.match(/(\d+)/)?.[1] ?? "-1");
  const domRowsAfter = await rows.count();

  // 1. count text === rendered DOM rows === facet promise.
  expect(n, "result-count N must equal rendered DOM rows").toBe(domRowsAfter);
  expect(domRowsAfter, "DOM rows after filter must equal the facet's count").toBe(target.count);

  // 2. Every visible row carries the filtered status label.
  const badges = isolatedPage.getByTestId("queue-row-status-badge");
  const bc = await badges.count();
  expect(bc).toBe(domRowsAfter);
  for (let i = 0; i < bc; i++) {
    expect((await badges.nth(i).innerText()).trim(), "row badge must match the active chip").toBe(
      target.label,
    );
  }
});

test("M.2.A — logical status filters never render an out-of-filter badge", async ({
  isolatedPage,
}) => {
  // Rail-style logical + multi-value filters. Each badge's logical `data-status`
  // must lie within the active filter — the desync was a `resolved`-filtered row
  // badged as `open`.
  const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    [
      "/queue?status=waiting_customer,waiting_vendor,hold",
      ["waiting_customer", "waiting_vendor", "hold"],
    ],
    ["/queue?status=resolved,closed", ["resolved", "closed"]],
    ["/queue?status=new", ["new"]],
    ["/queue?status=in_progress", ["in_progress"]],
  ];

  for (const [url, want] of cases) {
    await isolatedPage.goto(url);
    await expect(isolatedPage.getByTestId("queue-table")).toBeVisible({ timeout: 15_000 });
    await isolatedPage.waitForTimeout(200);

    const badges = isolatedPage.locator('[data-testid="queue-row-status-badge"][data-status]');
    const bc = await badges.count();
    expect(bc, `expected at least one row for ${url}`).toBeGreaterThan(0);

    const wantSet = new Set(want);
    for (let i = 0; i < bc; i++) {
      const logical = (await badges.nth(i).getAttribute("data-status"))!;
      expect(
        wantSet.has(logical),
        `${url}: row badge logical "${logical}" not in active filter {${want.join(",")}}`,
      ).toBe(true);
    }

    // count text agrees with rendered rows for the logical filter too.
    const countText = (await isolatedPage.getByTestId("queue-result-count").innerText()).trim();
    const n = Number(countText.match(/(\d+)/)?.[1] ?? "-1");
    expect(n, `${url}: result-count must equal rendered rows`).toBe(bc);
  }
});
