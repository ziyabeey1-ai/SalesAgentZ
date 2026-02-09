
import { Lead, Task, ActionLog, Interaction, DashboardStats, CalendarEvent, EmailTemplate } from '../types';

export class GoogleSheetsService {
  public isAuthenticated = false;
  private spreadsheetId = '';

  constructor() {}

  public setSpreadsheetId(id: string) {
    this.spreadsheetId = id;
  }

  public async initialize(apiKey: string, clientId: string): Promise<void> {
      if (!window.gapi) {
          console.warn("Google API script not loaded");
          return;
      }
      try {
          await new Promise<void>((resolve, reject) => {
              window.gapi.load('client:auth2', {
                  callback: resolve,
                  onerror: reject
              });
          });
          
          await window.gapi.client.init({
              apiKey: apiKey,
              clientId: clientId,
              discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest", "https://gmail.googleapis.com/$discovery/rest?version=v1"],
              scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send",
          });

          // Listen for sign-in state changes.
          window.gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus.bind(this));

          // Handle the initial sign-in state.
          this.updateSigninStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
      } catch (error) {
          console.error("GAPI Init Error", error);
      }
  }

  private updateSigninStatus(isSignedIn: boolean) {
      this.isAuthenticated = isSignedIn;
  }

  public async handleAuthClick(): Promise<void> {
      if (window.gapi) await window.gapi.auth2.getAuthInstance().signIn();
  }

  public async handleSignoutClick(): Promise<void> {
      if (window.gapi) await window.gapi.auth2.getAuthInstance().signOut();
  }

  // Leads
  public async getLeads(): Promise<Lead[]> { 
      // Placeholder for actual sheet reading logic
      return []; 
  }
  public async addLead(lead: Lead): Promise<void> {}
  public async updateLead(lead: Lead): Promise<void> {}

  // Tasks
  public async getTasks(): Promise<Task[]> { return []; }
  public async addTask(task: Task): Promise<void> {}
  public async updateTask(task: Task): Promise<void> {}

  // Interactions
  public async getInteractions(): Promise<Interaction[]> { return []; }
  public async addInteraction(interaction: Interaction): Promise<void> {}

  // Logs
  public async getLogs(): Promise<ActionLog[]> { return []; }
  public async logAction(log: ActionLog): Promise<void> {}

  // Stats
  public async calculateStats(): Promise<DashboardStats> { 
      // Minimal stub
      return {
          taranan_firma: 0,
          lead_sayisi: 0,
          mail_gonderildi: 0,
          geri_donus: 0,
          sicak_leadler: 0,
          hedef_orani: 0,
          toplam_maliyet: 0,
          districtBreakdown: []
      };
  }

  // CALENDAR OPERATIONS
  public async getCalendarEvents(): Promise<CalendarEvent[]> {
      try {
          const response = await window.gapi.client.calendar.events.list({
              'calendarId': 'primary',
              'timeMin': (new Date()).toISOString(),
              'showDeleted': false,
              'singleEvents': true,
              'maxResults': 20,
              'orderBy': 'startTime'
          });
          const events = response.result.items;
          return events.map((event: any) => ({
              id: event.id,
              title: event.summary,
              start: event.start.dateTime || event.start.date,
              end: event.end.dateTime || event.end.date,
              description: event.description,
              location: event.location,
              attendees: event.attendees ? event.attendees.map((a: any) => a.email) : [],
              type: event.summary?.includes('MÜSAİT DEĞİL') ? 'blocked' : 'meeting'
          }));
      } catch (e) {
          console.error("Calendar fetch error", e);
          return [];
      }
  }

  public async createCalendarEvent(event: Partial<CalendarEvent>): Promise<string> {
      // Unique Request ID for conference generation
      const requestId = Math.random().toString(36).substring(7);

      const resource: any = {
          summary: event.title,
          location: event.location,
          description: event.description,
          start: {
              dateTime: event.start,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
              dateTime: event.end,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          attendees: event.attendees?.map(email => ({ email })),
      };

      // Request Google Meet Link if location is 'Google Meet'
      if (event.location === 'Google Meet') {
          resource.conferenceData = {
              createRequest: {
                  requestId: requestId,
                  conferenceSolutionKey: {
                      type: "hangoutsMeet"
                  }
              }
          };
      }

      try {
          const response = await window.gapi.client.calendar.events.insert({
              'calendarId': 'primary',
              'resource': resource,
              'conferenceDataVersion': 1 // Crucial for generating Meet links
          });
          
          // Return the generated Meet Link (hangoutLink) or null
          return response.result.hangoutLink || '';
      } catch (error) {
          console.error("Error creating calendar event", error);
          throw error;
      }
  }
}

export const sheetsService = new GoogleSheetsService();
