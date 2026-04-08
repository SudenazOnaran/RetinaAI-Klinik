import { expect, test, type Page } from "@playwright/test";

const runAiScenario = process.env.E2E_RUN_AI_PREDICT === "1";
const expectQueue = process.env.E2E_EXPECT_AI_QUEUE === "1";
const e2eDoctorEmail = process.env.E2E_DOCTOR_EMAIL || "";
const e2eDoctorPassword = process.env.E2E_DOCTOR_PASSWORD || "";

const onePixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2M6MsAAAAASUVORK5CYII=";

async function loginAsDoctor(page: Page) {
  const loginResponse = await page.request.post("/api/doctor/login", {
    data: {
      email: e2eDoctorEmail,
      password: e2eDoctorPassword,
    },
  });

  expect(loginResponse.ok()).toBeTruthy();
}

test("ai predict endpoint accepts upload and supports queue fallback", async ({
  page,
}) => {
  test.skip(
    !runAiScenario,
    "Set E2E_RUN_AI_PREDICT=1, E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD to run AI scenario.",
  );

  test.skip(
    !e2eDoctorEmail || !e2eDoctorPassword,
    "E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD are required.",
  );

  await loginAsDoctor(page);

  const imageBuffer = Buffer.from(onePixelPngBase64, "base64");
  const predictResponse = await page.request.post("/api/ai/predict", {
    multipart: {
      image: {
        name: `e2e-fundus-${Date.now()}.png`,
        mimeType: "image/png",
        buffer: imageBuffer,
      },
    },
  });

  const status = predictResponse.status();
  expect([200, 202]).toContain(status);

  const data = await predictResponse.json();

  if (status === 200) {
    expect(data.success).toBeTruthy();
    expect(data.pytorch).toBeTruthy();
    expect(typeof data.pytorch.label).toBe("string");
    expect(Number(data.pytorch.confidence)).toBeGreaterThanOrEqual(0);
  }

  if (status === 202) {
    expect(data.success).toBeFalsy();
    expect(data.queued).toBeTruthy();
    expect(typeof data.queueId).toBe("string");

    const queueResponse = await page.request.get("/api/ai/queue?limit=10");
    expect(queueResponse.ok()).toBeTruthy();

    const queueData = await queueResponse.json();
    expect(queueData.success).toBeTruthy();

    const matchedRow = Array.isArray(queueData.rows)
      ? queueData.rows.find((row: any) => row.id === data.queueId)
      : null;

    expect(matchedRow).toBeTruthy();
    expect(matchedRow.endpoint).toBe("/predict");
  }

  if (expectQueue) {
    expect(status).toBe(202);
  }
});
