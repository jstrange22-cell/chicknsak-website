/**
 * Chick N Sak - Contact Form Email Notification
 *
 * Triggered when a new lead is created in the 'leads' collection.
 * Sends an email notification to the restaurant owner.
 *
 * Note: Requires a mail-sending service to be configured.
 * Options:
 * 1. Firebase Extensions "Trigger Email" (uses Firestore + SendGrid/Mailgun)
 * 2. Direct SendGrid API call
 * 3. Nodemailer with SMTP
 *
 * For now, this logs the lead and can be extended with email sending later.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

export const onNewContactLead = onDocumentCreated(
  {
    document: "leads/{leadId}",
    region: "us-central1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      logger.warn("No data in new lead document");
      return;
    }

    const { name, email, phone, inquiryType, message } = data;

    logger.info("New contact lead received", {
      leadId: event.params.leadId,
      name,
      email,
      inquiryType,
      hasPhone: !!phone,
    });

    // TODO: Configure email sending
    // Option 1: Use Firebase Extensions "Trigger Email"
    //   - Install the extension and it auto-sends on Firestore writes
    //   - Write to a 'mail' collection with to/subject/body
    //
    // Option 2: SendGrid API
    //   const sgMail = require('@sendgrid/mail');
    //   sgMail.setApiKey(sendgridApiKey.value());
    //   await sgMail.send({
    //     to: 'owner@chicknsak.com',
    //     from: 'noreply@chicknsak.com',
    //     subject: `New ${inquiryType} inquiry from ${name}`,
    //     html: `<p><strong>Name:</strong> ${name}</p>
    //            <p><strong>Email:</strong> ${email}</p>
    //            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
    //            <p><strong>Type:</strong> ${inquiryType}</p>
    //            <p><strong>Message:</strong> ${message}</p>`,
    //   });

    logger.info(
      `Lead processed: ${inquiryType} from ${name} (${email})`
    );
  }
);
