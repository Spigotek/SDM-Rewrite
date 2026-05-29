import { test, expect } from "../fixtures/isolated-context";

/**
 * H.10 change calendar — FullCalendar 6 lazy chunk + view switch + event
 * click navigation.
 *
 * Path:
 *   1. Navigate to `/changes/calendar`. Wait for the calendar view to mount
 *      (lazy chunk download + FullCalendar render).
 *   2. Verify the view switch tabs render and default view is Week.
 *   3. Switch through Day → Month → Week.
 *   4. Pick any rendered event block (the MSW fixture has changes with a
 *      scheduled window) and click it. Verify the URL changes to
 *      `/changes/:id`.
 *
 * Notes on stability:
 *  - Calendar event rendering depends on the fixture's `scheduledStartAt`
 *    field. The MSW seed (`packages/api-mocks/src/db/changes-seed.ts`) ships
 *    several changes with a schedule; if zero render, the test skips with a
 *    fixture-invariant message so it stays useful when the seed evolves.
 *  - We do not click the event with strict text matching — FullCalendar's
 *    title includes both ref and summary which are fixture-dependent.
 */
test("H.10 change calendar — view switch + event click navigation", async ({ isolatedPage }) => {
  // The viewport must be desktop-wide so the mobile fallback banner doesn't
  // short-circuit the route. Default Playwright viewport is desktop already.
  await isolatedPage.setViewportSize({ width: 1400, height: 900 });

  await isolatedPage.goto("/changes/calendar");

  const view = isolatedPage.getByTestId("calendar-view");
  await expect(view).toBeVisible({ timeout: 15_000 });

  // Filters chip group is rendered.
  await expect(isolatedPage.getByTestId("calendar-filters")).toBeVisible();

  // Default view = Week. The active button carries `data-active`.
  const weekBtn = isolatedPage.getByTestId("calendar-view-timeGridWeek");
  await expect(weekBtn).toHaveAttribute("data-active", "true");

  // Switch to Day.
  await isolatedPage.getByTestId("calendar-view-timeGridDay").click();
  await expect(isolatedPage.getByTestId("calendar-view-timeGridDay")).toHaveAttribute(
    "data-active",
    "true",
  );

  // Switch to Month.
  await isolatedPage.getByTestId("calendar-view-dayGridMonth").click();
  await expect(isolatedPage.getByTestId("calendar-view-dayGridMonth")).toHaveAttribute(
    "data-active",
    "true",
  );

  // Back to Week so the event-click assertion has a stable target shape.
  await weekBtn.click();
  await expect(weekBtn).toHaveAttribute("data-active", "true");

  // Find a rendered event. Calendar renders only events that intersect the
  // visible week — if none render, the seed lacks a near-term event and we
  // graciously skip.
  const events = isolatedPage.getByTestId("calendar-event");
  let eventCount = await events.count();
  if (eventCount === 0) {
    // Try Month view, which covers a wider window.
    await isolatedPage.getByTestId("calendar-view-dayGridMonth").click();
    eventCount = await events.count();
  }
  if (eventCount === 0) {
    test.skip(
      true,
      "no calendar events in the visible window — fixture seed lacks a near-term schedule",
    );
  }

  // Click the first event and verify the URL changes to /changes/:id.
  const firstEvent = events.first();
  const changeId = await firstEvent.getAttribute("data-change-id");
  if (!changeId) throw new Error("Calendar event missing data-change-id attribute");

  await firstEvent.click();
  await expect(isolatedPage).toHaveURL(/\/changes\//, { timeout: 10_000 });
  await expect(isolatedPage).toHaveURL(new RegExp(`/changes/${changeId}`), { timeout: 10_000 });
});
