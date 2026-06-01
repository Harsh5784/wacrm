type MailOptions = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};
export declare function isMailConfigured(): boolean;
export declare function sendMail(options: MailOptions): Promise<{
    sent: boolean;
    skipped: boolean;
    messageId?: undefined;
} | {
    sent: boolean;
    skipped: boolean;
    messageId: string;
}>;
export declare function invitationEmail(params: {
    name: string;
    email: string;
    password: string;
    loginUrl: string;
    orgName?: string;
}): {
    text: string;
    html: string;
};
export declare function passwordResetEmail(params: {
    name: string;
    resetUrl: string;
}): {
    text: string;
    html: string;
};
export declare function welcomeEmail(params: {
    name: string;
    loginUrl: string;
    orgName?: string;
}): {
    text: string;
    html: string;
};
export {};
//# sourceMappingURL=mail.service.d.ts.map