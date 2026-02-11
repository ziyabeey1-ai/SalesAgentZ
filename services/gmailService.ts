
export class GmailService {
    private static readonly EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    private static readonly KNOWN_INVALID_DOMAINS = new Set(['example.com', 'email.com', 'test.com', 'localhost', 'localdomain']);
    private static readonly BLOCKED_LOCAL_PARTS = new Set([
        'mailer-daemon',
        'postmaster',
        'no-reply',
        'noreply',
        'bounce',
        'do-not-reply',
        'donotreply'
    ]);
    private static readonly BOUNCE_SUBJECT_PATTERNS = [
        /delivery status notification/i,
        /delivery failure/i,
        /mail delivery failed/i,
        /undeliverable/i,
        /returned mail/i,
        /failure notice/i,
        /rejected/i,
        /bounce/i
    ];

    private getLocalPart(email: string): string {
        const normalized = (email || '').trim().toLowerCase();
        const atIndex = normalized.lastIndexOf('@');
        if (atIndex <= 0) return '';
        return normalized.slice(0, atIndex).trim();
    }

    private isBlockedMailbox(email: string): boolean {
        const localPart = this.getLocalPart(email);
        if (!localPart) return false;

        if (GmailService.BLOCKED_LOCAL_PARTS.has(localPart)) return true;
        return [...GmailService.BLOCKED_LOCAL_PARTS].some(blocked => localPart.includes(blocked));
    }

    private isBounceLikeSubject(subject: string): boolean {
        const normalized = (subject || '').trim();
        return GmailService.BOUNCE_SUBJECT_PATTERNS.some(pattern => pattern.test(normalized));
    }

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

        if (this.isBlockedMailbox(normalizedEmail)) {
            throw new Error(`ALICI_BLOKLU_MAILBOX:${recipientEmail}`);
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

    private parseFromHeader(fromHeader: string): { fromEmail: string; fromName: string } {
        const raw = (fromHeader || '').trim();
        const angleMatch = raw.match(/^(.*)<([^>]+)>$/);

        if (angleMatch) {
            const fromName = angleMatch[1].replace(/(^"|"$)/g, '').trim();
            const fromEmail = (angleMatch[2] || '').trim().toLowerCase();
            return { fromEmail, fromName: fromName || fromEmail };
        }

        const emailOnly = raw.toLowerCase();
        return { fromEmail: emailOnly, fromName: emailOnly };
    }

    public async listUnreadInbox(limit: number = 10): Promise<Array<{ id: string; threadId?: string; fromEmail: string; fromName: string; subject: string; snippet: string; date: string }>> {
        if (!window.gapi?.client?.gmail) return [];

        try {
            const listRes = await window.gapi.client.gmail.users.messages.list({
                userId: 'me',
                maxResults: limit,
                q: 'in:inbox is:unread -from:me newer_than:14d'
            });

            const messages = listRes.result?.messages || [];
            if (!Array.isArray(messages) || messages.length === 0) return [];

            const detailed = await Promise.all(messages.map(async (msg: any) => {
                const detail = await window.gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date']
                });

                const headers = detail.result?.payload?.headers || [];
                const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(Konu Yok)';
                const date = headers.find((h: any) => h.name === 'Date')?.value || new Date().toISOString();
                const parsedFrom = this.parseFromHeader(fromHeader);

                return {
                    id: detail.result?.id || msg.id,
                    threadId: detail.result?.threadId,
                    fromEmail: parsedFrom.fromEmail,
                    fromName: parsedFrom.fromName,
                    subject,
                    snippet: detail.result?.snippet || '',
                    date
                };
            }));

            return detailed.filter(d => {
                if (!d.fromEmail || !d.fromEmail.includes('@')) return false;
                if (this.isBlockedMailbox(d.fromEmail)) return false;
                if (this.isBounceLikeSubject(d.subject)) return false;
                return true;
            });
        } catch (error) {
            console.error('Gmail unread inbox fetch failed', error);
            return [];
        }
    }

    public async markAsRead(messageId: string): Promise<void> {
        if (!window.gapi?.client?.gmail || !messageId) return;
        try {
            await window.gapi.client.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                resource: {
                    removeLabelIds: ['UNREAD']
                }
            });
        } catch (error) {
            console.error('Gmail mark as read failed', error);
        }
    }
}

export const gmailService = new GmailService();
