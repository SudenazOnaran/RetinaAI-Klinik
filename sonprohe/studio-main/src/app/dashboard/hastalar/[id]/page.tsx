import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import PatientDetailClient from "./patient-detail-client"; // Dosya yolunu kontrol et

export default async function HastaDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doctor = await getCurrentDoctorSession();

  if (!doctor) notFound();

  if (!id) notFound();

  const patient = await prisma.patient.findFirst({
    where: { id: id, doctorId: doctor.id },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!patient) notFound();

  return <PatientDetailClient patient={patient} />;
}
