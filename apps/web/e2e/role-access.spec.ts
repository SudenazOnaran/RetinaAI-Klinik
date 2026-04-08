import {
  expect,
  test,
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";

type RoleName = "DOCTOR" | "ASSISTANT" | "MANAGER" | "AUDITOR";

type Creds = {
  email: string;
  password: string;
};

const runRoleScenario = process.env.E2E_RUN_ROLE_ACCESS === "1";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:9002";

const roleCreds: Record<RoleName, Creds> = {
  DOCTOR: {
    email: process.env.E2E_DOCTOR_EMAIL || "",
    password: process.env.E2E_DOCTOR_PASSWORD || "",
  },
  ASSISTANT: {
    email: process.env.E2E_ASSISTANT_EMAIL || "",
    password: process.env.E2E_ASSISTANT_PASSWORD || "",
  },
  MANAGER: {
    email: process.env.E2E_MANAGER_EMAIL || "",
    password: process.env.E2E_MANAGER_PASSWORD || "",
  },
  AUDITOR: {
    email: process.env.E2E_AUDITOR_EMAIL || "",
    password: process.env.E2E_AUDITOR_PASSWORD || "",
  },
};

function hasAllCreds() {
  return (Object.values(roleCreds) as Creds[]).every(
    (creds) => creds.email && creds.password,
  );
}

async function createAuthedContext(creds: Creds): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext({ baseURL });
  const loginResponse = await ctx.post("/api/doctor/login", {
    data: {
      email: creds.email,
      password: creds.password,
    },
  });

  expect(loginResponse.ok()).toBeTruthy();
  return ctx;
}

test("role-based access matrix for protected APIs", async () => {
  test.skip(
    !runRoleScenario,
    "Set E2E_RUN_ROLE_ACCESS=1 and role credentials to run role access matrix.",
  );

  test.skip(
    !hasAllCreds(),
    "E2E_DOCTOR/ASSISTANT/MANAGER/AUDITOR credential env vars are required.",
  );

  const contexts: Partial<Record<RoleName, APIRequestContext>> = {};

  try {
    contexts.DOCTOR = await createAuthedContext(roleCreds.DOCTOR);
    contexts.ASSISTANT = await createAuthedContext(roleCreds.ASSISTANT);
    contexts.MANAGER = await createAuthedContext(roleCreds.MANAGER);
    contexts.AUDITOR = await createAuthedContext(roleCreds.AUDITOR);

    for (const role of Object.keys(contexts) as RoleName[]) {
      const ctx = contexts[role]!;

      const profileResponse = await ctx.get("/api/doctor/profile");
      expect(profileResponse.status()).toBe(200);

      const registerListResponse = await ctx.get("/api/doctor/register");
      if (role === "MANAGER") {
        expect(registerListResponse.status()).toBe(200);
      } else {
        expect(registerListResponse.status()).toBe(403);
      }

      const kvkkGetResponse = await ctx.get("/api/doctor/kvkk/consent");
      if (role === "ASSISTANT") {
        expect(kvkkGetResponse.status()).toBe(403);
      } else {
        expect(kvkkGetResponse.status()).toBe(200);
      }

      const kvkkPutResponse = await ctx.put("/api/doctor/kvkk/consent", {
        data: { consentGiven: true },
      });
      if (role === "DOCTOR" || role === "MANAGER") {
        expect(kvkkPutResponse.status()).toBe(400);
      } else {
        expect(kvkkPutResponse.status()).toBe(403);
      }

      const anonymizeResponse = await ctx.post("/api/doctor/kvkk/anonymize", {
        data: {},
      });
      if (role === "DOCTOR" || role === "MANAGER") {
        expect(anonymizeResponse.status()).toBe(400);
      } else {
        expect(anonymizeResponse.status()).toBe(403);
      }

      const backupResponse = await ctx.post("/api/storage/backup");
      if (role === "DOCTOR" || role === "MANAGER") {
        expect(backupResponse.status()).toBe(200);
      } else {
        expect(backupResponse.status()).toBe(403);
      }
    }
  } finally {
    await Promise.all(
      (Object.values(contexts) as Array<APIRequestContext | undefined>).map(
        async (ctx) => {
          if (ctx) await ctx.dispose();
        },
      ),
    );
  }
});
