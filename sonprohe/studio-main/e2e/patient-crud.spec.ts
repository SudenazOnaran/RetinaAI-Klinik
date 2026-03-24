import { expect, test, type Page } from "@playwright/test";

const runPatientCrudScenario = process.env.E2E_RUN_PATIENT_CRUD === "1";
const e2eDoctorEmail = process.env.E2E_DOCTOR_EMAIL || "";
const e2eDoctorPassword = process.env.E2E_DOCTOR_PASSWORD || "";

function generateValidTcNo() {
  const digits: number[] = [];

  // First digit cannot be zero for TCKN.
  digits.push(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < 9; i += 1) {
    digits.push(Math.floor(Math.random() * 10));
  }

  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  digits.push(tenth);

  const firstTenSum = digits.reduce((acc, value) => acc + value, 0);
  const eleventh = firstTenSum % 10;
  digits.push(eleventh);

  return digits.join("");
}

async function loginAsDoctor(page: Page) {
  const loginResponse = await page.request.post("/api/doctor/login", {
    data: {
      email: e2eDoctorEmail,
      password: e2eDoctorPassword,
    },
  });

  expect(loginResponse.ok()).toBeTruthy();
}

test("patient pages redirect unauthenticated users", async ({ page }) => {
  await page.goto("/dashboard/hastalar");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard/hastalar/yeni");
  await expect(page).toHaveURL(/\/login/);
});

test("patient create-update-delete flow", async ({ page }) => {
  test.skip(
    !runPatientCrudScenario,
    "Set E2E_RUN_PATIENT_CRUD=1, E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD to run CRUD scenario.",
  );

  test.skip(
    !e2eDoctorEmail || !e2eDoctorPassword,
    "E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD are required.",
  );

  const tcNo = generateValidTcNo();
  const fullName = `E2E Hasta ${Date.now()}`;

  await loginAsDoctor(page);

  await page.goto("/dashboard/hastalar/yeni");
  await expect(
    page.getByRole("heading", { name: /yeni hasta kaydi|yeni hasta kaydı/i }),
  ).toBeVisible();

  await page.locator('input[name="fullName"]').fill(fullName);
  await page.locator('input[name="tcNo"]').fill(tcNo);
  await page.locator('input[name="age"]').fill("56");

  await page.locator('button[role="combobox"]').first().click();
  await page
    .getByRole("option", { name: /erkek|kadın|kadin/i })
    .first()
    .click();

  await page.locator('input[name="diabetesYears"]').fill("10");
  await page.locator('input[name="hba1c"]').fill("7.1");

  await page.getByRole("button", { name: /^kaydet$/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/hastalar/);

  await page.locator('input[placeholder="Ad veya TC ile ara"]').fill(tcNo);
  await expect(page.getByText(fullName)).toBeVisible();

  await page
    .locator("tr", { hasText: fullName })
    .getByRole("link", { name: /rapor olustur|rapor oluştur/i })
    .click();

  await expect(page).toHaveURL(/\/dashboard\/hastalar\//);
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();

  await page
    .getByRole("button", { name: /bilgileri güncelle|bilgileri guncelle/i })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /hasta bilgilerini güncelle|hasta bilgilerini guncelle/i,
    }),
  ).toBeVisible();

  await page.locator('input[name="age"]').fill("57");
  await page.getByRole("button", { name: /güncelle|guncelle/i }).click();

  await page.goto("/dashboard/hastalar");
  await page.locator('input[placeholder="Ad veya TC ile ara"]').fill(tcNo);
  await expect(page.getByText(fullName)).toBeVisible();

  await page
    .getByRole("checkbox", { name: new RegExp(fullName, "i") })
    .first()
    .click();

  page.once("dialog", (dialog) => {
    dialog.accept().catch(() => undefined);
  });
  await page
    .getByRole("button", { name: /seçilileri sil|secilileri sil/i })
    .click();

  await expect(page.getByText(fullName)).toHaveCount(0);
});
