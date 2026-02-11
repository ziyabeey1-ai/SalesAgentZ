
export class GmailService {
    private static readonly EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    private static readonly KNOWN_INVALID_DOMAINS = new Set(['example.com', 'email.com', 'test.com', 'localhost', 'localdomain']);

    private extractDomain(email: string): string | null {
        const normalized = (email || '').trim().toLowerCase();
        const atIndex = normalized.lastIndexOf('@');
        if (atIndex === -1 || atIndex === normalized.length - 1) return null;
        return normalized.slice(atIndex + 1).trim() || null;
    }

    private hasValidDomainFormat(domain: string): boolean {
        if (!domain || domain.includes(' ') || !domain.includes('.')) return false;
        if (GmailService.KNOWN_INVALID_DOMAINS.has(domain)) return false;
        return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
    }

    private async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        } finally {
            clearTimeout(timer);
        }
    }

    private async validateRecipientBeforeSend(recipientEmail: string): Promise<void> {
        const normalizedEmail = (recipientEmail || '').trim().toLowerCase();
        if (!GmailService.EMAIL_REGEX.test(normalizedEmail)) {
            throw new Error(`ALICI_EMAIL_GECERSIZ:${recipientEmail}`);
        }

        const domain = this.extractDomain(normalizedEmail);
        if (!domain || !this.hasValidDomainFormat(domain)) {
            throw new Error(`ALICI_DOMAIN_FORMAT_GECERSIZ:${recipientEmail}`);
        }

        // DNS doğrulaması: kesin olarak yoksa (NXDOMAIN) gönderimi engelle.
        // Ağ/CORS sorunlarında fail-open davranıp kullanıcıyı gereksiz bloklamayalım.
        try {
            const dnsUrl = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
            const res = await this.fetchWithTimeout(dnsUrl, 4000);
            if (!res.ok) return;

            const data = await res.json();
            if (data?.Status === 3) {
                throw new Error(`ALICI_DOMAIN_DNS_HATASI:${domain}`);
            }
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('ALICI_DOMAIN_DNS_HATASI:')) {
                throw error;
            }
            console.warn(`[EMAIL VALIDATION] DNS doğrulaması yapılamadı, gönderime devam ediliyor: ${domain}`);
        }
    }
    
    /**
     * Constructs a MIME message with optional attachments.
     */
    private createMimeMessage(to: string, subject: string, body: string, attachments?: { filename: string, content: string, mimeType: string }[]): string {
        const boundary = "foo_bar_baz";
        const nl = "\r\n";
        
        // FIX: Proper UTF-8 Encoding for Subject (RFC 2047)
        // Format: =?utf-8?B?base64_encoded_string?=
        // This prevents characters like 'Ş', 'İ', 'ğ' from appearing as garbage characters.
        const encodedSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
        
        let msg = "";
        
        // Headers
        msg += `To: ${to}${nl}`;
        msg += `Subject: ${encodedSubject}${nl}`;
        msg += `MIME-Version: 1.0${nl}`;
        msg += `Content-Type: multipart/mixed; boundary="${boundary}"${nl}${nl}`;
        
        // Body (HTML) - Ensure UTF-8 charset
        msg += `--${boundary}${nl}`;
        msg += `Content-Type: text/html; charset=utf-8${nl}`;
        msg += `Content-Transfer-Encoding: 7bit${nl}${nl}`;
        
        // Wrap body in a basic HTML structure for better rendering
        const htmlBody = `
            <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
                ${body.replace(/\n/g, '<br/>')}
            </div>
        `;
        
        msg += `${htmlBody}${nl}${nl}`;
        
        // Attachments
        if (attachments && attachments.length > 0) {
            for (const att of attachments) {
                msg += `--${boundary}${nl}`;
                msg += `Content-Type: ${att.mimeType}; name="${att.filename}"${nl}`;
                msg += `Content-Description: ${att.filename}${nl}`;
                msg += `Content-Disposition: attachment; filename="${att.filename}"; size=${att.content.length}${nl}`;
                msg += `Content-Transfer-Encoding: base64${nl}${nl}`;
                msg += `${att.content}${nl}${nl}`;
            }
        }
        
        msg += `--${boundary}--`;

        // Base64url encoding for the API payload
        return btoa(unescape(encodeURIComponent(msg)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    public async sendEmail(to: string, subject: string, body: string, attachments?: { filename: string, content: string, mimeType: string }[]): Promise<any> {
        if (!window.gapi?.client?.gmail) {
            throw new Error('Gmail API hazır değil. Lütfen Ayarlar > Google entegrasyonunda tekrar oturum açın.');
        }

        await this.validateRecipientBeforeSend(to);

        const raw = this.createMimeMessage(to, subject, body, attachments);

        try {
            const response = await window.gapi.client.gmail.users.messages.send({
                'userId': 'me',
                'resource': {
                    'raw': raw
                }
            });
            return response.result;
        } catch (error) {
            console.error("Gmail Send Error:", error);
            throw error;
        }
    }
}

export const gmailService = new GmailService();
