import { test, expect } from "../fixtures/isolated-context";

test("workspace app shell renders with mocked session + tenant switcher", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/");

  await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByRole("heading", { name: "SDM Workspace" })).toBeVisible();

  const activeTenant = isolatedPage.getByTestId("active-tenant");
  await expect(activeTenant).toHaveText("acme-corp");

  const userPill = isolatedPage.getByTestId("user-pill");
  await expect(userPill).toContainText("Anna Analyst");

  const tenantDisplay = isolatedPage.getByTestId("tenant-display");
  await expect(tenantDisplay).toContainText("Acme Corporation");

  await tenantDisplay.click();
  const list = isolatedPage.getByTestId("tenant-list");
  await expect(list).toBeVisible();
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list).toContainText("Acme Corporation");
  await expect(list).toContainText("Globex Industries");

  await isolatedPage.getByTestId("tenant-row-globex").click();

  await expect(activeTenant).toHaveText("globex", { timeout: 5_000 });
  await expect(tenantDisplay).toContainText("Globex Industries");
});
