
export class GmailService {
    
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
