import { Lead, Task, ActionLog, DashboardStats, Interaction } from '../types';

// Mock Leads
export const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    firma_adi: 'Ataşehir Estetik',
    sektor: 'Sağlık',
    ilce: 'Ataşehir',
    telefon: '0532 100 20 30',
    email: 'info@atasehirestetik.com',
    yetkili_adi: 'Dr. Selin Y.',
    kaynak: 'Google Maps',
    websitesi_var_mi: 'Hayır',
    lead_durumu: 'aktif',
    lead_skoru: 5,
    eksik_alanlar: [],
    son_kontakt_tarihi: '2024-05-20',
  },
  {
    id: '2',
    firma_adi: 'Kadıköy Burger House',
    sektor: 'Restoran',
    ilce: 'Kadıköy',
    telefon: '0216 300 40 50',
    email: '',
    kaynak: 'Facebook',
    websitesi_var_mi: 'Hayır',
    lead_durumu: 'beklemede',
    lead_skoru: 3,
    eksik_alanlar: ['email'],
    notlar: 'Telefon var, email bulunamadı.',
  },
  {
    id: '3',
    firma_adi: 'Modern Emlak Ofisi',
    sektor: 'Emlak',
    ilce: 'Şişli',
    telefon: '0555 999 88 77',
    email: 'iletisim@modernemlak.com',
    yetkili_adi: 'Ahmet Bey',
    kaynak: 'Google Maps',
    websitesi_var_mi: 'Hayır',
    lead_durumu: 'teklif_gonderildi',
    lead_skoru: 4,
    eksik_alanlar: [],
    son_kontakt_tarihi: '2024-05-18',
  },
  {
    id: '4',
    firma_adi: 'Zen Yoga Stüdyosu',
    sektor: 'Güzellik',
    ilce: 'Beşiktaş',
    telefon: '',
    email: 'hello@zenyoga.com',
    kaynak: 'Google Maps',
    websitesi_var_mi: 'Hayır',
    lead_durumu: 'takipte',
    lead_skoru: 4,
    eksik_alanlar: ['telefon'],
    son_kontakt_tarihi: '2024-05-19',
  },
  {
    id: '5',
    firma_adi: 'Yeni Nesil Kahve',
    sektor: 'Restoran',
    ilce: 'Moda',
    telefon: '0216 111 22 33',
    email: 'kahve@yeninesil.com',
    kaynak: 'Google Maps',
    websitesi_var_mi: 'Evet',
    lead_durumu: 'gecersiz',
    lead_skoru: 1,
    eksik_alanlar: [],
    notlar: 'Websitesi mevcut.',
  }
];

// Mock Tasks
export const MOCK_TASKS: Task[] = [
  {
    id: 'T-101',
    firma_adi: 'Kadıköy Burger House',
    lead_durumu: 'beklemede',
    gorev_tipi: 'eksik_bilgi',
    aciklama: 'E-posta adresi bul',
    oncelik: 'Yüksek',
    son_tarih: '2024-05-21',
    durum: 'açık',
  },
  {
    id: 'T-102',
    firma_adi: 'Zen Yoga Stüdyosu',
    lead_durumu: 'takipte',
    gorev_tipi: 'follow_up',
    aciklama: 'Follow-up 2 (D5-7) gönder',
    oncelik: 'Orta',
    son_tarih: '2024-05-22',
    durum: 'açık',
  },
  {
    id: 'T-103',
    firma_adi: 'Modern Emlak Ofisi',
    lead_durumu: 'teklif_gonderildi',
    gorev_tipi: 'teklif_kontrol',
    aciklama: 'Teklif yanıtı kontrol et',
    oncelik: 'Yüksek',
    son_tarih: '2024-05-23',
    durum: 'açık',
  }
];

// Mock Logs
export const MOCK_LOGS: ActionLog[] = [
  { id: 'L-1', timestamp: '10:42', action: 'Lead Bulundu', detail: 'Ataşehir Estetik (Sağlık)', type: 'success' },
  { id: 'L-2', timestamp: '10:45', action: 'Website Kontrolü', detail: 'Ataşehir Estetik: Site yok -> Lead', type: 'info' },
  { id: 'L-3', timestamp: '11:00', action: 'Mail Gönderildi', detail: 'Modern Emlak Ofisi (Teklif)', type: 'success' },
  { id: 'L-4', timestamp: '11:15', action: 'Hata', detail: 'SMTP Bağlantı hatası (Geçici)', type: 'error' },
  { id: 'L-5', timestamp: '11:30', action: 'Veri Çıkarma', detail: 'Kadıköy Burger House: Email eksik', type: 'warning' },
];

// Mock Interactions
export const MOCK_INTERACTIONS: Interaction[] = [
    {
        id: 'I-1',
        leadId: '3', // Modern Emlak
        type: 'email',
        direction: 'outbound',
        date: '2024-05-18',
        time: '14:30',
        summary: 'Teklif Gönderildi: Kurumsal Emlak Paketi (23.000 TL)',
        status: 'sent'
    },
    {
        id: 'I-2',
        leadId: '3', // Modern Emlak
        type: 'whatsapp',
        direction: 'inbound',
        date: '2024-05-19',
        time: '09:15',
        summary: 'Fiyat konusunda bir soru sordu: "Ödeme seçenekleri nedir?"',
        status: 'read'
    },
    {
        id: 'I-3',
        leadId: '3', // Modern Emlak
        type: 'whatsapp',
        direction: 'outbound',
        date: '2024-05-19',
        time: '09:20',
        summary: 'Cevap: "Kredi kartına 3 taksit imkanı var."',
        status: 'read'
    },
    {
        id: 'I-4',
        leadId: '1', // Ataşehir Estetik
        type: 'email',
        direction: 'outbound',
        date: '2024-05-20',
        time: '10:00',
        summary: 'İlk Tanışma: Kliniklere özel randevu sistemi önerisi.',
        status: 'delivered'
    },
    {
        id: 'I-5',
        leadId: '4', // Zen Yoga
        type: 'email',
        direction: 'outbound',
        date: '2024-05-15',
        time: '11:00',
        summary: 'İlk Tanışma',
        status: 'read'
    },
    {
        id: 'I-6',
        leadId: '4', // Zen Yoga
        type: 'email',
        direction: 'outbound',
        date: '2024-05-18',
        time: '15:00',
        summary: 'Follow-up 1: "Gözden kaçmış olabilir mi?"',
        status: 'sent'
    }
];


export const getStats = (): DashboardStats => ({
  taranan_firma: 85,
  lead_sayisi: 42,
  mail_gonderildi: 38,
  geri_donus: 3,
  sicak_leadler: 2,
  hedef_orani: 85,
});