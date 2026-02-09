
export class GmailService {
    
    /**
     * Constructs a MIME message with optional attachments.
     */
    private createMimeMessage(to: string, subject: string, body: string, attachments?: { filename: string, content: string, mimeType: string }[]): string {
        const boundary = "foo_bar_baz";
        const nl = "\r\n";
        
        let msg = "";
        
        // Headers
        msg += `To: ${to}${nl}`;
        msg += `Subject: ${subject}${nl}`;
        msg += `MIME-Version: 1.0${nl}`;
        msg += `Content-Type: multipart/mixed; boundary="${boundary}"${nl}${nl}`;
        
        // Body (HTML) - CHANGED FROM text/plain TO text/html
        msg += `--${boundary}${nl}`;
        msg += `Content-Type: text/html; charset=utf-8${nl}`;
        msg += `Content-Transfer-Encoding: 7bit${nl}${nl}`;
        
        // Wrap body in a basic HTML structure for better compatibility
        const htmlBody = `
            <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
                ${body}
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

        // Base64url encoding
        return btoa(unescape(encodeURIComponent(msg)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    public async sendEmail(to: string, subject: string, body: string, attachments?: { filename: string, content: string, mimeType: string }[]): Promise<any> {
        if (!window.gapi?.client?.gmail) {
            // Fallback / Mock behavior if API not loaded
            console.log("Mock Email Sent:", { to, subject, hasAttachments: !!attachments });
            return { id: 'mock-id' };
        }

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
