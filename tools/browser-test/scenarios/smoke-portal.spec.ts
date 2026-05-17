import { test, expect } from "../fixtures/isolated-context";

test("portal renders + MSW intercepts /me/tenants", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");

  await expect(isolatedPage.getByRole("heading", { name: "SDM Portal" })).toBeVisible();

  const mocksFlag = isolatedPage.getByTestId("mocks-flag");
  await expect(mocksFlag).toHaveText(/Mocks: on/);

  const list = isolatedPage.getByTestId("tenants-list");
  await expect(list).toBeVisible({ timeout: 15_000 });
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list).toContainText("Acme Corporation");
  await expect(list).toContainText("Globex Industries");
});
