import { expect, test } from "@playwright/test";

test.describe("shared Vite client bootstrap @smoke", () => {
  test("loads the integrated client without page errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");

    await expect(page).toHaveTitle("Ritmo");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Vuelve a tu ritmo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesion" }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("guards a private hash route across reload", async ({ page }) => {
    await page.goto("/#/rutinas/fixture-routine");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("main")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/#\/login$/);
    await expect(
      page.getByRole("heading", { name: "Vuelve a tu ritmo" }),
    ).toBeVisible();
  });

  test("validates auth input before network access", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByRole("button", { name: "Iniciar sesion" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Escribe un email valido.",
    );
  });

  for (const viewport of [
    { name: "mobile", width: 360, height: 800 },
    { name: "tablet", width: 768, height: 900 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`fits ${viewport.name} without horizontal overflow @smoke`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/");

      await expect(page.getByRole("main")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Vuelve a tu ritmo" }),
      ).toBeVisible();
      await expect(page.locator("form.auth-form")).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);

      const serviceWorkerCount = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return 0;
        return (await navigator.serviceWorker.getRegistrations()).length;
      });
      expect(serviceWorkerCount).toBe(0);
    });
  }
});
