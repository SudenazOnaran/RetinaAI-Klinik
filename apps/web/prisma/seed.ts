import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const adminPasswordHash = await bcrypt.hash("Admin123!", 10);

  // Admin kullanıcısı
  await prisma.doctor.upsert({
    where: { email: "admin@retina.local" },
    update: {},
    create: {
      name: "Admin",
      surname: "Retina",
      email: "admin@retina.local",
      password: adminPasswordHash,
      specialty: "Sistem Yönetimi",
      hospital: "Retina Klinik",
      role: "ADMIN",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    select: { id: true },
  });

  console.log("✅ Admin kullanıcısı oluşturuldu → admin@retina.local / Admin123!");

  const doctor = await prisma.doctor.upsert({
    where: { email: "seed.manager@retina.local" },
    update: {},
    create: {
      name: "Seed Manager",
      surname: "Test",
      email: "seed.manager@retina.local",
      password: passwordHash,
      specialty: "Göz Hastalıkları",
      hospital: "Retina Klinik",
      role: "MANAGER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    select: { id: true },
  });

  await prisma.patient.createMany({
    data: [
      {
        doctorId: doctor.id,
        fullName: "Ali Vural",
        tcNo: "98765432109",
        age: 71,
        risk: "Yüksek",
        createdAt: new Date("2024-01-15"),
      },
      {
        doctorId: doctor.id,
        fullName: "Zeynep Aksoy",
        tcNo: "45678912345",
        age: 34,
        risk: "Yok",
        createdAt: new Date("2024-03-08"),
      },
      {
        doctorId: doctor.id,
        fullName: "Mehmet Karaca",
        tcNo: "32165498701",
        age: 58,
        risk: "Orta",
        createdAt: new Date("2024-02-01"),
      },
      {
        doctorId: doctor.id,
        fullName: "Ayşe Demir",
        tcNo: "78912345670",
        age: 46,
        risk: "Düşük",
        createdAt: new Date("2024-04-12"),
      },
      {
        doctorId: doctor.id,
        fullName: "Hasan Yıldız",
        tcNo: "65498732144",
        age: 63,
        risk: "Yok",
        createdAt: new Date("2024-05-02"),
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Örnek hastalar başarıyla eklendi");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
