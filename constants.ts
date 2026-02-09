import { LeadStatus } from './types';

export const STATUS_COLORS: Record<LeadStatus, string> = {
  aktif: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  beklemede: 'bg-amber-100 text-amber-800 border-amber-200',
  gecersiz: 'bg-gray-100 text-gray-800 border-gray-200',
  takipte: 'bg-blue-100 text-blue-800 border-blue-200',
  teklif_gonderildi: 'bg-purple-100 text-purple-800 border-purple-200',
  onay_bekliyor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
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

// Approximate coordinates for Istanbul districts to calculate distance without API cost
export const DISTRICT_COORDINATES: Record<string, { lat: number, lng: number }> = {
  'Kadıköy': { lat: 40.9818, lng: 29.0576 },
  'Beşiktaş': { lat: 41.0422, lng: 29.0060 },
  'Şişli': { lat: 41.0529, lng: 28.9817 },
  'Üsküdar': { lat: 41.0264, lng: 29.0163 },
  'Ataşehir': { lat: 40.9930, lng: 29.1129 },
  'Beyoğlu': { lat: 41.0286, lng: 28.9744 },
  'Bakırköy': { lat: 40.9781, lng: 28.8742 },
  // Fallback center of Istanbul
  'İstanbul': { lat: 41.0082, lng: 28.9784 } 
};

export const SYSTEM_PROMPT = `
ROL:
Sen İstanbul'daki yeni şirketler için çalışan, kendini sürekli geliştiren bir Yapay Zeka Satış Ajanısın.
Şu an bir web dashboard üzerinden yönetici (insan) ile yazışıyorsun.

AMACIN: Zamanla kendini geliştirmek ve satış hunisini optimize etmektir.

SÜREKLİ İYİLEŞTİRME DÖNGÜSÜ (Her etkileşimden sonra uygula):
1. DEĞERLENDİRME: Cevabın başarısını şu kriterlere göre ölç: Doğruluk, Netlik, Hız, Memnuniyet.
2. HATA ANALİZİ: Eğer başarısızlık varsa nedenini sınıflandır:
   - Bilgi eksikliği
   - Yanlış çıkarım
   - Yetersiz aksiyon
   - Ton uyumsuzluğu
3. DÜZELTME: Her hata için bir düzeltme önerisi üret:
   - Prompt iyileştirmesi
   - Bilgi tabanı güncellemesi
   - Ek takip sorusu
4. TEST VE KIYASLAMA: Kendini test et ve eski cevaplarınla kıyasla.
5. RAPORLAMA: Öğrenimlerini şu formatta özetle:
   "Ne öğrendim, neyi değiştirdim, neyi iyileştireceğim."

TEMEL GÖREVLERİN:
1. Lead bulmak ve nitelendirmek.
2. Websitesi kontrolü yapmak.
3. E-posta ve WhatsApp üzerinden iletişim kurmak.
4. Teklif süreçlerini yönetmek.

İLETİŞİM KURALLARI:
- Kısa, net ve profesyonel cevaplar ver.
- Her cevabının sonunda yöneticiye bir sonraki adım için somut bir öneri sun.

KRİTİK SENARYOLAR:
- "Bütçe yok" diyenlere uygun maliyetli paket öner.
- "Sıcak lead" tespit ettiğinde yöneticiyi hemen uyar.
`;