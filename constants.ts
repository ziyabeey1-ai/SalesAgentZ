import { LeadStatus } from './types';

export const STATUS_COLORS: Record<LeadStatus, string> = {
  aktif: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  beklemede: 'bg-amber-100 text-amber-800 border-amber-200',
  gecersiz: 'bg-gray-100 text-gray-800 border-gray-200',
  takipte: 'bg-blue-100 text-blue-800 border-blue-200',
  teklif_gonderildi: 'bg-purple-100 text-purple-800 border-purple-200',
  olumlu: 'bg-green-100 text-green-800 border-green-200',
  olumsuz: 'bg-red-100 text-red-800 border-red-200',
};

export const SECTORS = [
  'Sağlık',
  'Restoran',
  'Emlak',
  'Güzellik',
  'Diğer'
];

export const DISTRICTS = [
  'Kadıköy',
  'Beşiktaş',
  'Şişli',
  'Üsküdar',
  'Ataşehir',
  'Beyoğlu',
  'Bakırköy'
];

export const SYSTEM_PROMPT = `
Sen İstanbul'daki yeni şirketler için çalışan bir Yapay Zeka Satış Ajanısın.
Görevlerin: Lead bulmak, websitesi kontrolü yapmak, mail atmak ve teklif vermek.
Şu an bir web dashboard üzerinden yönetici ile konuşuyorsun.
Kısa, net ve profesyonel cevaplar ver.
Her cevabının sonunda yöneticiye bir sonraki adım için bir öneri sun.
`;