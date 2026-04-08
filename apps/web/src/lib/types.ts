export type Patient = {
  id: string;
  tcKimlikNo: string;
  name: string;
  age: number;
  gender: 'Erkek' | 'Kadın';
  diabetesDuration: number;
  hba1c: number;
  riskLevel: 'Yüksek' | 'Orta' | 'Düşük' | 'Yok';
  lastCheckup: string;
  avatarUrl: string;
  fundusImage: string;
};
