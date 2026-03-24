import {
  expect,
  test,
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";

type Creds = {
  email: string;
  password: string;
};

const runApiValidationScenario = process.env.E2E_RUN_API_VALIDATION === "1";
const runApiDbFailureScenario = process.env.E2E_RUN_API_DB_FAILURE === "1";

const doctorCreds: Creds = {
  email: process.env.E2E_DOCTOR_EMAIL || "",
  password: process.env.E2E_DOCTOR_PASSWORD || "",
};

const managerCreds: Creds = {
  email: process.env.E2E_MANAGER_EMAIL || "",
  password: process.env.E2E_MANAGER_PASSWORD || "",
};

const unauthMatrix = [
  { method: "GET", path: "/api/doctor/session", expectedStatus: 401 },
  { method: "GET", path: "/api/doctor/profile", expectedStatus: 401 },
  { method: "GET", path: "/api/doctor/settings", expectedStatus: 401 },
  { method: "GET", path: "/api/doctor/kvkk/consent", expectedStatus: 401 },
  {
    method: "GET",
    path: "/api/doctor/kvkk/processing-logs",
    expectedStatus: 401,
  },
  { method: "POST", path: "/api/storage/backup", expectedStatus: 401 },
] as const;

async function createAuthedContext(creds: Creds): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext({
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:9002",
  });

  const loginResponse = await ctx.post("/api/doctor/login", {
    data: {
      email: creds.email,
      password: creds.password,
    },
  });

  expect(loginResponse.ok()).toBeTruthy();
  return ctx;
}

test("auth-required endpoint matrix", async ({ request }) => {
  for (const row of unauthMatrix) {
    const response =
      row.method === "GET"
        ? await request.get(row.path)
        : await request.post(row.path);

    expect(response.status(), `${row.method} ${row.path}`).toBe(
      row.expectedStatus,
    );
  }
});

test("validation failure matrix for authenticated APIs", async () => {
  test.skip(
    !runApiValidationScenario,
    "Set E2E_RUN_API_VALIDATION=1 with doctor/manager credentials.",
  );

  test.skip(
    !doctorCreds.email ||
      !doctorCreds.password ||
      !managerCreds.email ||
      !managerCreds.password,
    "E2E_DOCTOR_* and E2E_MANAGER_* credentials are required.",
  );

  const doctorCtx = await createAuthedContext(doctorCreds);
  const managerCtx = await createAuthedContext(managerCreds);

  try {
    const aiPredictValidation = await doctorCtx.post("/api/ai/predict", {
      multipart: {},
    });
    expect(aiPredictValidation.status()).toBe(400);

    const kvkkConsentValidation = await doctorCtx.put(
      "/api/doctor/kvkk/consent",
      {
        data: { consentGiven: true },
      },
    );
    expect(kvkkConsentValidation.status()).toBe(400);

    const registerValidation = await managerCtx.post("/api/doctor/register", {
      data: { email: "" },
    });
    expect(registerValidation.status()).toBe(400);
  } finally {
    await Promise.all([doctorCtx.dispose(), managerCtx.dispose()]);
  }
});

test("database failure handling returns controlled error envelope", async ({
  request,
}) => {
  test.skip(
    !runApiDbFailureScenario,
    "Set E2E_RUN_API_DB_FAILURE=1 in a fault-injected environment.",
  );

  const response = await request.post("/api/doctor/login", {
    data: {
      email: "db-failure-check@example.com",
      password: "InvalidPassword123",
    },
  });

  expect([500, 503]).toContain(response.status());

  const payload = (await response.json()) as {
    error?: string;
    errorCode?: string;
  };

  expect(typeof payload.error).toBe("string");
  expect(typeof payload.errorCode).toBe("string");
});
