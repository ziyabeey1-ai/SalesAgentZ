
export type LeadStatus = 
  | 'aktif' 
  | 'beklemede' 
  | 'gecersiz' 
  | 'takipte' 
  | 'teklif_gonderildi' 
  | 'onay_bekliyor' // New status for drafts waiting approval
  | 'olumlu' 
  | 'olumsuz';

export interface Competitor {
    name: string;
    website: string;
    strengths: string[];
    weaknesses: string[];
}

export interface CompetitorAnalysis {
    competitors: Competitor[];
    summary: string; // AI generated comparison text
    lastUpdated: string;
}

export interface InstagramAnalysis {
    username: string;
    bio: string;
    recentPostTheme: string;
    suggestedDmOpener: string;
    lastAnalyzed: string;
}

// NEW: Persona Types (DISC Model Simplified)
export type PersonaType = 'Dominant' | 'Analitik' | 'Sosyal' | 'Guven_Odakli' | 'Bilinmiyor';

export interface PersonaAnalysis {
    type: PersonaType;
    traits: string[]; // e.g. ["Hızlı sonuç ister", "Veri odaklı", "Risk almaz"]
    communicationStyle: string; // e.g. "Kısa, net ve sonuç odaklı yaz."
    reasoning: string;
}

// NEW: Strategy Prediction Types
export interface ResponseDrafts {
    aggressive: string;
    neutral: string;
    consultative: string;
}

export interface PredictedQuestion {
    question: string;
    category: 'pricing' | 'timeline' | 'social_proof' | 'technical' | 'contract' | 'other';
    responses: ResponseDrafts;
}

export interface StrategyResult {
    possibleQuestions: PredictedQuestion[];
    recommendedTone: 'aggressive' | 'neutral' | 'consultative';
    reasoning: string;
}

// NEW: Market Analysis Types (War Room)
export interface MarketAnalysis {
    sectorDigitalMaturity: number; // 1-10
    regionEconomicActivity: number; // 1-10
    seasonalFactor: string;
    overallOpportunity: 'Yüksek' | 'Orta' | 'Düşük';
}

export interface IdealLeadProfile {
    companyAge: string;
    employeeCount: string;
    estimatedRevenue: string;
    digitalMaturity: number;
    hasWebsite: boolean;
    reasoning: string;
}

export interface StrategyPriority {
    name: string;
    priority: number;
    score: number;
    reasoning: string;
    searchTerms: string[];
}

export interface RegionRotation {
    district: string;
    priority: number;
    reasoning: string;
}

export interface ActionPlan {
    nextCycle: string;
    expectedLeadQuality: string;
    estimatedConversion: string;
}

export interface MarketStrategyResult {
    marketAnalysis: MarketAnalysis;
    idealLeadProfile: IdealLeadProfile;
    strategyPriority: StrategyPriority[];
    regionRotation: RegionRotation[];
    actionPlan: ActionPlan;
    lastUpdated?: string;
}

// NEW: Lead Scoring Types
export interface LeadScoreDetails {
    categoryScores: {
        website: number;
        seo: number;
        socialMedia: number;
        onlineSystem: number;
        contentQuality: number;
        competitorGap: number;
        sectorUrgency: number;
    };
    bonusFactors: Record<string, number>;
    totalScore: number;
    finalLeadScore: number; // 1-5
    digitalWeaknesses: string[];
    opportunityAreas: string[];
    estimatedConversionProbability: string;
    reasoning: string;
    lastCalculated: string;
}

export interface Lead {
  id: string;
  firma_adi: string;
  sektor: string;
  ilce: string;
  telefon: string;
  email: string;
  yetkili_adi?: string;
  adres?: string;
  kaynak: 'Google Maps' | 'Facebook' | 'AI Asistan';
  websitesi_var_mi: 'Evet' | 'Hayır';
  lead_durumu: LeadStatus;
  lead_skoru: number;
  eksik_alanlar: string[];
  son_kontakt_tarihi?: string;
  acilis_tarihi?: string;
  created_at?: string; // New: Creation timestamp
  notlar?: string;
  lastUsedTemplateId?: string; 
  draftResponse?: { 
      subject: string;
      body: string;
      intent: string;
      created_at: string;
  };
  competitorAnalysis?: CompetitorAnalysis;
  instagramProfile?: InstagramAnalysis; // New Field
  generatedHeroImage?: string; // New Field (Base64)
  scoreDetails?: LeadScoreDetails; // NEW FIELD
  
  // NEW FIELDS FOR ADVANCED OUTREACH
  digitalWeakness?: string; // e.g. "Mobil Uyumsuzluk", "Site Yok", "Kırık Linkler"
  targetAudience?: string; // e.g. "Lüks Konut Alıcıları", "Üniversite Öğrencileri"
  personaAnalysis?: PersonaAnalysis; // NEW FIELD: Nöro-Pazarlama
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

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end: string;   // ISO string
  description?: string;
  attendees?: string[]; // emails
  location?: string;
  type?: 'meeting' | 'task' | 'reminder' | 'blocked';
}

export interface ActionLog {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// NEW: Structured Thought Process for Agent
export interface AgentThought {
    id: string;
    timestamp: string;
    type: 'decision' | 'analysis' | 'action' | 'wait' | 'error' | 'info' | 'success' | 'warning';
    message: string;
    metadata?: any;
}

export interface RegionStat {
    name: string;
    totalLeads: number;
    converted: number; // positive + proposal
    conversionRate: number;
}

export interface DashboardStats {
  taranan_firma: number;
  lead_sayisi: number;
  mail_gonderildi: number;
  geri_donus: number;
  sicak_leadler: number;
  hedef_orani: number; 
  toplam_maliyet: number; // New cost field
  districtBreakdown: RegionStat[]; // New Regional Data
}

export type InteractionType = 'email' | 'whatsapp' | 'phone' | 'instagram';
export type InteractionDirection = 'inbound' | 'outbound';
export type InteractionStatus = 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'missed';

export interface InteractionAnalysis {
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: 'price_inquiry' | 'meeting_request' | 'objection' | 'not_interested' | 'info_request' | 'other';
    suggested_reply: string;
    suggested_status: LeadStatus;
}

export interface Interaction {
  id: string;
  leadId: string;
  type: InteractionType;
  direction: InteractionDirection;
  date: string;
  time: string;
  summary: string;
  status: InteractionStatus;
  analysis?: InteractionAnalysis; 
}

export interface UsageStats {
    date: string;
    aiCalls: number;
    searchCalls: number;
    dailyLimit: number;
    estimatedCost: number; // USD
}

export interface TemplateStats {
    useCount: number;
    successCount: number;
}

export interface EmailTemplate {
    id: string;
    name: string;
    type: 'intro' | 'followup1' | 'followup2';
    subject: string;
    body: string;
    isActive: boolean;
    // Legacy global stats (kept for backward compatibility display)
    useCount: number; 
    successCount: number; 
    // New Contextual Learning Data
    sectorStats?: Record<string, TemplateStats>; // Key: Sector Name
    // Evolution Fields
    origin?: 'system' | 'human' | 'ai_auto';
    iteration?: number; // Version number
    parentTemplateId?: string; // If evolved from another
    performanceScore?: number; // 0-100 calculated score
}

// NEW: A/B Testing Variant
export interface ABVariant {
    id: string;
    subject: string;
    body: string;
    predictedOpenRate: number; // 0-100
    reasoning: string;
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string; 
    unlockedAt?: string; 
}

export interface UserProgress {
    xp: number;
    level: number;
    streakDays: number;
    lastActiveDate: string;
    dailyActions: {
        leads: number;
        emails: number;
        calls: number;
        date: string;
    };
    achievements: Achievement[];
}

export interface PricingPackage {
    id: string;
    name: string; // e.g. "Başlangıç Paketi"
    price: number; // Sales Price
    cost: number;  // Base Cost (Maliyet)
    profit: number; // Calculated Profit
    features: string[]; // AI Generated Features
    description: string;
}

export interface UserProfile {
    fullName: string;
    companyName: string;
    role: string;
    website: string;
    phone: string;
    email: string;
    tone: string; // e.g. "Profesyonel", "Samimi"
    logo?: string; // New Field: Base64 or URL
    packages?: PricingPackage[]; // New Field
    isSetupComplete?: boolean; // New Flag
}

export interface AgentConfig {
    targetDistrict: string; // 'Tümü' or specific district
    targetSector: string;   // 'Tümü' or specific sector
    focusMode: 'balanced' | 'discovery_only' | 'outreach_only'; // Strategy
}

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}
