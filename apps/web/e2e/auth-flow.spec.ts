import { expect, test } from "@playwright/test";

const runAuthScenario = process.env.E2E_RUN_AUTH === "1";

test("login page smoke", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: /doktor girişi|doktor girisi/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /giris yap|giriş yap/i }),
  ).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("register is closed for public users", async ({ page }) => {
  await page.goto("/register");

  await expect(
    page.getByText(
      /manager hesabi ile giris yapin|public kayit icin kapatildi/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /yalnizca yonetici islem yapabilir|yalnızca yönetici kayıt açabilir/i,
    }),
  ).toBeDisabled();
});

test("invalid credentials show auth error", async ({ page }) => {
  test.skip(
    !runAuthScenario,
    "Set E2E_RUN_AUTH=1 to run auth failure scenario.",
  );

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("invalid-user@example.com");
  await page.locator('input[type="password"]').fill("wrong-password");
  await page.getByRole("button", { name: /giris yap|giriş yap/i }).click();

  await expect(
    page.getByText(/e-posta veya sifre hatali|e-posta veya şifre hatalı/i),
  ).toBeVisible();
});
