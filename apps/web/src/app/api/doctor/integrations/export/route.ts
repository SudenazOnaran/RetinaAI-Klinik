import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import {
  buildFhirBundle,
  buildHbysPayload,
  getPatientForIntegration,
  IntegrationTarget,
  sendToIntegration,
  writeIntegrationEvent,
} from "@/lib/clinical-integrations";
import { logAuditEvent } from "@/lib/audit-log";
import { createMonitoringAlert } from "@/lib/monitoring-alerts";

type ExportBody = {
  patientId?: string;
  target?: IntegrationTarget;
};

export async function POST(request: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await request.json()) as ExportBody;
  const patientId = String(body.patientId || "").trim();
  const target = body.target === "HBYS" ? "HBYS" : "FHIR";

  if (!patientId) {
    return NextResponse.json(
      { error: "patientId zorunludur" },
      { status: 400 },
    );
  }

  const patient = await getPatientForIntegration(session.id, patientId);
  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadi" }, { status: 404 });
  }

  const payload =
    target === "FHIR"
      ? buildFhirBundle(patient, session.name)
      : buildHbysPayload(patient, session.name);

  const result = await sendToIntegration(target, payload);

  await writeIntegrationEvent({
    doctorId: session.id,
    patientId: patient.id,
    target,
    status: result.ok ? "SUCCESS" : "FAILED",
    httpStatus: result.status,
    errorMessage:
      result.ok || typeof result.response !== "object"
        ? null
        : (result.response as { error?: string })?.error || null,
    requestPayload: payload,
    responsePayload: result.response,
  });

  if (!result.ok) {
    await createMonitoringAlert({
      doctorId: session.id,
      source: "INTEGRATION_EXPORT",
      severity: "WARNING",
      title: `${target} aktarim hatasi`,
      detail: `Hasta ${patient.fullName} icin ${target} aktarimi basarisiz oldu`,
      metadata: {
        target,
        patientId: patient.id,
        httpStatus: result.status,
        response: result.response,
      },
    });
  }

  await logAuditEvent({
    doctorId: session.id,
    role: session.role,
    action: "CREATE",
    entityType: "SYSTEM",
    entityId: patient.id,
    description: `${target} entegrasyon export islemi`,
    metadata: {
      patientId: patient.id,
      target,
      success: result.ok,
      httpStatus: result.status,
    },
  });

  return NextResponse.json(
    {
      success: result.ok,
      target,
      patientId: patient.id,
      status: result.status,
      response: result.response,
      message: result.ok
        ? `${target} sistemine aktarim basarili`
        : `${target} sistemine aktarim basarisiz`,
    },
    { status: result.ok ? 200 : 502 },
  );
}
