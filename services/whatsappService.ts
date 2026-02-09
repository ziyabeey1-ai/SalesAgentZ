
export class WhatsAppService {
    private getCredentials() {
        return {
            token: localStorage.getItem('waToken'),
            phoneId: localStorage.getItem('waPhoneId'),
            adminPhone: localStorage.getItem('adminPhone')
        };
    }

    private formatPhoneNumber(phone: string): string {
        // Remove all non-numeric chars
        let cleaned = phone.replace(/\D/g, '');
        // If starts with 0, remove it (0532 -> 532)
        if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
        // If doesn't start with 90, add it (assuming TR for local context, or adjust logic)
        if (!cleaned.startsWith('90') && cleaned.length === 10) cleaned = '90' + cleaned;
        
        return cleaned;
    }

    /**
     * Tries to use the Cloud API first.
     * If credentials are missing, returns a special flag to UI to open WhatsApp Web instead.
     */
    public async sendTextMessage(to: string, message: string): Promise<any> {
        const { token, phoneId } = this.getCredentials();
        const formattedPhone = this.formatPhoneNumber(to);

        // --- FREE MODE (WHATSAPP WEB) ---
        // If no API token is saved, we immediately default to Web Mode.
        if (!token || !phoneId) {
            console.log("WhatsApp API keys not found. Using Web Mode (Free).");
            this.openWhatsAppWeb(formattedPhone, message);
            return { status: 'fallback_web', message: 'WhatsApp Web açıldı.' };
        }

        // --- PAID MODE (CLOUD API) ---
        try {
            const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: formattedPhone,
                    type: 'text',
                    text: { body: message }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data;
        } catch (error) {
            console.error("WhatsApp API Error, switching to Web Mode:", error);
            // Fallback to Web if API fails (e.g. token expired)
            this.openWhatsAppWeb(formattedPhone, message);
            return { status: 'fallback_web', message: 'API hatası nedeniyle Web açıldı.' };
        }
    }

    public openWhatsAppWeb(to: string, text: string) {
        // Detect if mobile device to decide between 'api.whatsapp.com' (better for mobile app) or 'web.whatsapp.com'
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const baseUrl = isMobile ? 'https://api.whatsapp.com/send' : 'https://web.whatsapp.com/send';
        
        const url = `${baseUrl}?phone=${to}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    public async sendDailyReport(stats: any, hotLeads: any[]): Promise<any> {
        const { adminPhone } = this.getCredentials();
        
        // If no admin phone, ask user
        let targetPhone = adminPhone;
        if (!targetPhone) {
            const input = prompt("Raporun gönderileceği telefon numarasını girin (Örn: 532 123 45 67):");
            if (!input) return { status: 'cancelled' };
            targetPhone = input;
        }

        const date = new Date().toLocaleDateString('tr-TR');
        
        let reportMsg = `📊 *Günlük Rapor - ${date}*\n\n`;
        reportMsg += `✅ Taranan: ${stats.taranan_firma}\n`;
        reportMsg += `🎯 Lead: ${stats.lead_sayisi}\n`;
        reportMsg += `📩 Mail: ${stats.mail_gonderildi}\n`;
        reportMsg += `🔥 Sıcak Fırsat: ${stats.sicak_leadler}\n\n`;

        if (hotLeads.length > 0) {
            reportMsg += `*Sıcak Leadler:*\n`;
            hotLeads.forEach(lead => {
                reportMsg += `• ${lead.firma_adi} (${lead.sektor})\n`;
            });
        } else {
            reportMsg += `_Sıcak lead bulunmuyor._`;
        }

        return this.sendTextMessage(targetPhone, reportMsg);
    }
}

export const whatsappService = new WhatsAppService();
