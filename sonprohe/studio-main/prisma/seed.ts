import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.patient.createMany({
    data: [
      {
        fullName: 'Ali Vural',
        tcNo: '98765432109',
        age: 71,
        risk: 'Yüksek',
        createdAt: new Date('2024-01-15'),
        lastCheckup: new Date('2024-06-20'),
      },
      {
        fullName: 'Zeynep Aksoy',
        tcNo: '45678912345',
        age: 34,
        risk: null, // Analiz yapılmadı
        createdAt: new Date('2024-03-08'),
        lastCheckup: null,
      },
      {
        fullName: 'Mehmet Karaca',
        tcNo: '32165498701',
        age: 58,
        risk: 'Orta',
        createdAt: new Date('2024-02-01'),
        lastCheckup: new Date('2024-05-30'),
      },
      {
        fullName: 'Ayşe Demir',
        tcNo: '78912345670',
        age: 46,
        risk: 'Düşük',
        createdAt: new Date('2024-04-12'),
        lastCheckup: new Date('2024-06-05'),
      },
      {
        fullName: 'Hasan Yıldız',
        tcNo: '65498732144',
        age: 63,
        risk: null, // Analiz yapılmadı
        createdAt: new Date('2024-05-02'),
        lastCheckup: null,
      },
    ],
  });

  console.log('✅ Örnek hastalar başarıyla eklendi');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
