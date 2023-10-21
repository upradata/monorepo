import Mailgun from 'mailgun.js';
import { MailgunClientOptions as MailgunOptions } from 'mailgun.js/Types/MailgunClient';

import formData from 'form-data';

export type MailgunClientOptions = Omit<MailgunOptions, 'key'> & { apiKey: string; };

export const mailgunApi = (options: MailgunClientOptions) => {
    const { apiKey, ...mailgunOptions } = options;

    const mailgun = new Mailgun(formData);
    const mg = mailgun.client({ ...mailgunOptions, key: apiKey });

    return mg;
};
