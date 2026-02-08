export type LeadStatus = 
  | 'aktif' 
  | 'beklemede' 
  | 'gecersiz' 
  | 'takipte' 
  | 'teklif_gonderildi' 
  | 'olumlu' 
  | 'olumsuz';

export interface Lead {
  id: string;
  firma_adi: string;
  sektor: string;
  ilce: string;
  telefon: string;
  email: string;
  yetkili_adi?: string;
  adres?: string;
  kaynak: 'Google Maps' | 'Facebook';
  websitesi_var_mi: 'Evet' | 'Hayır';
  lead_durumu: LeadStatus;
  lead_skoru: number;
  eksik_alanlar: string[];
  son_kontakt_tarihi?: string;
  acilis_tarihi?: string;
  notlar?: string;
}

export interface Task {
  id: string;
  firma_adi: string;
  lead_durumu: LeadStatus;
  gorev_tipi: 'eksik_bilgi' | 'follow_up' | 'teklif_kontrol' | 'yeniden_temas';
  aciklama: string;
  oncelik: 'Düşük' | 'Orta' | 'Yüksek';
  son_tarih: string;
  durum: 'açık' | 'tamamlandı';
}

export interface ActionLog {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface DashboardStats {
  taranan_firma: number;
  lead_sayisi: number;
  mail_gonderildi: number;
  geri_donus: number;
  sicak_leadler: number;
  hedef_orani: number; // Percentage of 100 daily target
}

export type InteractionType = 'email' | 'whatsapp' | 'phone';
export type InteractionDirection = 'inbound' | 'outbound';
export type InteractionStatus = 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'missed';

export interface Interaction {
  id: string;
  leadId: string;
  type: InteractionType;
  direction: InteractionDirection;
  date: string;
  time: string;
  summary: string;
  status: InteractionStatus;
}