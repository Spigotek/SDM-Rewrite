import { test, expect } from "../fixtures/isolated-context";

test("workspace renders + MSW intercepts /api/incidents", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");

  await expect(isolatedPage.getByRole("heading", { name: "SDM Workspace" })).toBeVisible();

  const mocksFlag = isolatedPage.getByTestId("mocks-flag");
  await expect(mocksFlag).toHaveText(/Mocks: on/);

  const summary = isolatedPage.getByTestId("incidents-summary");
  await expect(summary).toBeVisible({ timeout: 15_000 });
  await expect(summary).toContainText(/Showing \d+ of \d+ incidents/);

  const list = isolatedPage.getByTestId("incidents-list");
  await expect(list.locator("li").first()).toBeVisible();
});
