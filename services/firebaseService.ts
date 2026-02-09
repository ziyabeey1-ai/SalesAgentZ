
import { initializeApp, FirebaseApp, getApps, deleteApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Firestore,
  setDoc,
  query,
  orderBy,
  limit,
  getDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { Lead, Task, ActionLog, Interaction, CalendarEvent, EmailTemplate, UserProfile, UserProgress, DashboardStats, RegionStat } from '../types';

export class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  public auth: Auth | null = null;
  public isInitialized = false;
  public currentUser: User | null = null;

  constructor() {
    this.initialize();
  }

  public initialize() {
    const configStr = localStorage.getItem('firebaseConfig');
    if (configStr) {
      try {
        const firebaseConfig = JSON.parse(configStr);
        // Simple check to ensure config has minimal required fields
        if (firebaseConfig.apiKey && firebaseConfig.projectId) {
            // Check if app already exists to avoid duplicate error
            if (getApps().length === 0) {
                this.app = initializeApp(firebaseConfig);
            } else {
                this.app = getApps()[0];
            }

            this.db = getFirestore(this.app);
            this.auth = getAuth(this.app);
            this.isInitialized = true;
            
            // Listen to auth state
            onAuthStateChanged(this.auth, (user) => {
                this.currentUser = user;
            });

            console.log("Firebase initialized successfully");
        }
      } catch (e) {
        console.error("Firebase initialization failed", e);
        this.isInitialized = false;
      }
    }
  }

  public async saveConfig(config: string) {
      localStorage.setItem('firebaseConfig', config);
      
      // Cleanup existing app if it exists to allow re-init
      if (this.app) {
        try {
            await deleteApp(this.app);
        } catch (e) { 
            console.warn("Error deleting firebase app instance", e); 
        }
      }
      
      this.app = null;
      this.db = null;
      this.auth = null;
      this.isInitialized = false;
      
      // Re-initialize with new config
      this.initialize();
  }

  // --- AUTHENTICATION ---
  public async login(email: string, pass: string) {
      if (!this.auth) throw new Error("Firebase henüz yapılandırılmadı. Ayarlar sayfasından config ekleyin.");
      return await signInWithEmailAndPassword(this.auth, email, pass);
  }

  public async register(email: string, pass: string) {
      if (!this.auth) throw new Error("Firebase henüz yapılandırılmadı.");
      return await createUserWithEmailAndPassword(this.auth, email, pass);
  }

  public async logout() {
      if (!this.auth) return;
      await signOut(this.auth);
  }

  // --- LEADS ---
  public async getLeads(): Promise<Lead[]> {
    if (!this.db) return [];
    try {
        const snapshot = await getDocs(collection(this.db, 'leads'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
    } catch (e) {
        console.error("Error fetching leads from Firebase", e);
        return [];
    }
  }

  public async addLead(lead: Lead): Promise<void> {
    if (!this.db) return;
    try {
        // Use lead.id as doc ID if present to maintain consistency
        if (lead.id) {
            await setDoc(doc(this.db, 'leads', lead.id), lead);
        } else {
            await addDoc(collection(this.db, 'leads'), lead);
        }
    } catch (e) {
        console.error("Error adding lead to Firebase", e);
    }
  }

  public async updateLead(lead: Lead): Promise<void> {
    if (!this.db) return;
    try {
        const leadRef = doc(this.db, 'leads', lead.id);
        await updateDoc(leadRef, { ...lead });
    } catch (e) {
        console.error("Error updating lead in Firebase", e);
    }
  }

  // --- TASKS ---
  public async getTasks(): Promise<Task[]> {
    if (!this.db) return [];
    try {
        const snapshot = await getDocs(collection(this.db, 'tasks'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    } catch (e) { return []; }
  }

  public async addTask(task: Task): Promise<void> {
    if (!this.db) return;
    if (task.id) {
        await setDoc(doc(this.db, 'tasks', task.id), task);
    } else {
        await addDoc(collection(this.db, 'tasks'), task);
    }
  }

  public async updateTask(task: Task): Promise<void> {
    if (!this.db) return;
    await updateDoc(doc(this.db, 'tasks', task.id), { ...task });
  }

  // --- INTERACTIONS ---
  public async getInteractions(): Promise<Interaction[]> {
    if (!this.db) return [];
    try {
        const snapshot = await getDocs(collection(this.db, 'interactions'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Interaction));
    } catch (e) { return []; }
  }

  public async addInteraction(interaction: Interaction): Promise<void> {
    if (!this.db) return;
    await addDoc(collection(this.db, 'interactions'), interaction);
  }

  // --- LOGS ---
  public async getLogs(): Promise<ActionLog[]> {
    if (!this.db) return [];
    try {
        const q = query(collection(this.db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionLog));
    } catch (e) { return []; }
  }

  public async logAction(log: ActionLog): Promise<void> {
    if (!this.db) return;
    await addDoc(collection(this.db, 'logs'), log);
  }

  // --- CALENDAR ---
  public async getCalendarEvents(): Promise<CalendarEvent[]> {
      if (!this.db) return [];
      try {
          const snapshot = await getDocs(collection(this.db, 'events'));
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
      } catch (e) { return []; }
  }

  public async addCalendarEvent(event: CalendarEvent): Promise<void> {
      if (!this.db) return;
      if (event.id) {
          await setDoc(doc(this.db, 'events', event.id), event);
      } else {
          await addDoc(collection(this.db, 'events'), event);
      }
  }

  // --- TEMPLATES ---
  public async getTemplates(): Promise<EmailTemplate[]> {
      if (!this.db) return [];
      try {
          const snapshot = await getDocs(collection(this.db, 'templates'));
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate));
      } catch (e) { return []; }
  }

  public async saveTemplate(template: EmailTemplate): Promise<void> {
      if (!this.db) return;
      if (template.id) {
          await setDoc(doc(this.db, 'templates', template.id), template);
      } else {
          await addDoc(collection(this.db, 'templates'), template);
      }
  }

  public async updateTemplate(template: EmailTemplate): Promise<void> {
      if (!this.db) return;
      await updateDoc(doc(this.db, 'templates', template.id), { ...template });
  }

  public async deleteTemplate(id: string): Promise<void> {
      if (!this.db) return;
      await deleteDoc(doc(this.db, 'templates', id));
  }

  // --- USER PROFILE & GAMIFICATION (SINGLETON DOCS) ---
  
  public async getUserProfile(): Promise<UserProfile | null> {
      if (!this.db) return null;
      try {
          const docRef = doc(this.db, 'settings', 'profile');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
              return docSnap.data() as UserProfile;
          }
      } catch (e) { console.error(e); }
      return null;
  }

  public async saveUserProfile(profile: UserProfile): Promise<void> {
      if (!this.db) return;
      await setDoc(doc(this.db, 'settings', 'profile'), profile);
  }

  public async getUserProgress(): Promise<UserProgress | null> {
      if (!this.db) return null;
      try {
          const docRef = doc(this.db, 'settings', 'gamification');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
              return docSnap.data() as UserProgress;
          }
      } catch (e) { console.error(e); }
      return null;
  }

  public async saveUserProgress(progress: UserProgress): Promise<void> {
      if (!this.db) return;
      await setDoc(doc(this.db, 'settings', 'gamification'), progress);
  }

  // --- STATS ---
  public async calculateStats(): Promise<DashboardStats> {
      const leads = await this.getLeads();
      
      const totalLeads = leads.length;
      const contacted = leads.filter(l => ['takipte', 'teklif_gonderildi', 'olumlu', 'olumsuz'].includes(l.lead_durumu)).length;
      const responses = leads.filter(l => ['olumlu', 'olumsuz', 'teklif_gonderildi'].includes(l.lead_durumu)).length;
      const hotLeads = leads.filter(l => l.lead_skoru >= 4 && l.lead_durumu !== 'olumlu').length;
      const scanned = Math.floor(totalLeads * 1.5) + 20;

      // Calculate Regional Breakdown
      const districtMap: Record<string, {total: number, converted: number}> = {};
      leads.forEach(l => {
          const dist = l.ilce || 'Diğer';
          if (!districtMap[dist]) districtMap[dist] = { total: 0, converted: 0 };
          
          districtMap[dist].total++;
          if (['teklif_gonderildi', 'olumlu'].includes(l.lead_durumu)) {
              districtMap[dist].converted++;
          }
      });

      const districtBreakdown: RegionStat[] = Object.keys(districtMap).map(key => ({
          name: key,
          totalLeads: districtMap[key].total,
          converted: districtMap[key].converted,
          conversionRate: districtMap[key].total > 0 ? (districtMap[key].converted / districtMap[key].total) * 100 : 0
      })).sort((a,b) => b.totalLeads - a.totalLeads);

      return {
        taranan_firma: scanned,
        lead_sayisi: totalLeads,
        mail_gonderildi: contacted,
        geri_donus: responses,
        sicak_leadler: hotLeads,
        hedef_orani: Math.min(100, Math.round((totalLeads / 100) * 100)),
        toplam_maliyet: 0, // Not tracked in basic firebase stats yet
        districtBreakdown: districtBreakdown
      };
  }
}

export const firebaseService = new FirebaseService();
