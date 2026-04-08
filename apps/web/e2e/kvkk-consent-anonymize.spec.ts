import { expect, test, type Page } from "@playwright/test";

const runKvkkScenario = process.env.E2E_RUN_KVKK === "1";
const e2eDoctorEmail = process.env.E2E_DOCTOR_EMAIL || "";
const e2eDoctorPassword = process.env.E2E_DOCTOR_PASSWORD || "";

function generateValidTcNo() {
  const digits: number[] = [];

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

test("kvkk consent approval and anonymize flow", async ({ page }) => {
  test.skip(
    !runKvkkScenario,
    "Set E2E_RUN_KVKK=1, E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD to run KVKK scenario.",
  );

  test.skip(
    !e2eDoctorEmail || !e2eDoctorPassword,
    "E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD are required.",
  );

  const tcNo = generateValidTcNo();
  const fullName = `E2E KVKK ${Date.now()}`;

  await loginAsDoctor(page);

  await page.goto("/dashboard/hastalar/yeni");
  await page.locator('input[name="fullName"]').fill(fullName);
  await page.locator('input[name="tcNo"]').fill(tcNo);
  await page.locator('input[name="age"]').fill("49");

  await page.locator('button[role="combobox"]').first().click();
  await page
    .getByRole("option", { name: /erkek|kadın|kadin/i })
    .first()
    .click();

  await page.getByRole("button", { name: /^kaydet$/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/hastalar/);

  await page.goto("/dashboard/kvkk");
  await expect(
    page.getByRole("heading", { name: /kvkk uyum merkezi/i }),
  ).toBeVisible();

  await page
    .getByPlaceholder(/hasta adı veya tc ile ara|hasta adı veya tc ile ara/i)
    .fill(tcNo);

  const patientRow = page.locator("tr", { hasText: fullName }).first();
  await expect(patientRow).toBeVisible();

  await patientRow
    .getByRole("button", { name: /rızayı onayla|rizayi onayla/i })
    .click();

  await expect(patientRow.getByText(/onaylı|onayli/i)).toBeVisible();

  page.once("dialog", (dialog) => {
    dialog.accept().catch(() => undefined);
  });

  await patientRow
    .getByRole("button", { name: /anonimleştir|anonimlestir/i })
    .click();

  await expect(page.getByText(/anonim hasta/i).first()).toBeVisible();
  await expect(page.getByText(/ANON-/).first()).toBeVisible();

  await expect(page.getByText(/CONSENT_UPDATE/i).first()).toBeVisible();
  await expect(page.getByText(/ANONYMIZE/i).first()).toBeVisible();
});
