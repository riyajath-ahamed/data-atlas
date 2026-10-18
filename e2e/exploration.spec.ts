import { expect, test } from "@playwright/test";

test("browser back restores the scatter metric", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Multidimensional scatter" })).toBeVisible();
  await page.getByTestId("metric-x").selectOption("population");
  await expect(page).toHaveURL(/x=population/);
  await page.goBack();
  await expect(page.getByTestId("metric-x")).toHaveValue("gdpPerCapita");
});

test("selecting a table row highlights the same country on the map", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search-input").fill("Japan");
  await page.getByTestId("nav-table").click();
  await page.getByTestId("country-row-JPN").click();
  await expect(page.getByTestId("selected-count")).toContainText("Japan");
  await page.getByTestId("nav-geographic").click();
  await expect(page.getByTestId("map-svg").locator("path.country.is-selected")).toHaveCount(1);
});

test("timeline brush updates the shared year range", async ({ page }) => {
  await page.goto("/");
  const overlay = page.locator(".timeline-brush .overlay");
  await overlay.scrollIntoViewIfNeeded();
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  if (!box) throw new Error("Timeline brush has no box");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2);
  await page.mouse.up();
  await expect(page).toHaveURL(/from=\d+/);
  const from = Number(new URL(page.url()).searchParams.get("from"));
  const to = Number(new URL(page.url()).searchParams.get("to"));
  expect(to).toBeGreaterThan(from);
});

test("narrow layout keeps navigation reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("nav-scatter").click();
  await expect(page.getByTestId("scatter-svg")).toBeVisible();
});
