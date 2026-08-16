import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";

const mailUser = process.env.MAILJET_API_KEY;
const mailPass = process.env.MAILJET_SECRET_KEY;
const VERIFIED_MAIL_FROM_EMAIL = "noreply-expirely@foocusedai.com";
const configuredMailFromEmail = process.env.MAIL_FROM_EMAIL?.trim().toLowerCase();
const mailFromEmail = VERIFIED_MAIL_FROM_EMAIL;
const mailFromName = process.env.MAIL_FROM_NAME || "Expirely Team";

if (configuredMailFromEmail && configuredMailFromEmail !== VERIFIED_MAIL_FROM_EMAIL) {
  console.warn(
    `[Email] Ignoring stale MAIL_FROM_EMAIL="${configuredMailFromEmail}"; using verified sender "${VERIFIED_MAIL_FROM_EMAIL}".`,
  );
}
console.info(`[Email] Outgoing sender: "${mailFromName}" <${mailFromEmail}>`);

const transporter = nodemailer.createTransport({
  host: process.env.MAILJET_SMTP_HOST || "in-v3.mailjet.com",
  port: Number(process.env.MAILJET_SMTP_PORT || 587),
  secure: process.env.MAILJET_SMTP_SECURE === "true",
  auth: {
    user: mailUser,
    pass: mailPass,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  template: string; // EJS template file name (without extension)
  data: Record<string, any>;
}

interface SendRawEmailOptions {
  to: string;
  subject: string;
  html: string;
}

const getFromAddress = () => `"${mailFromName}" <${mailFromEmail}>`;

const assertEmailConfig = () => {
  if (!mailUser || !mailPass || !mailFromEmail) {
    throw new Error(
      "Missing email configuration. Set MAILJET_API_KEY and MAILJET_SECRET_KEY.",
    );
  }
};

export const sendEmail = async ({ to, subject, template, data }: SendEmailOptions): Promise<void> => {
  assertEmailConfig();

  const templatePath = path.join(__dirname, "../../templates", `${template}.ejs`);

  const html = await ejs.renderFile(templatePath, data);

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });
};

export const sendRawEmail = async ({ to, subject, html }: SendRawEmailOptions): Promise<void> => {
  assertEmailConfig();

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });
};

export const sendEmailWithAttachment = async ({
  to,
  subject,
  html,
  attachments
}: {
  to: string;
  subject: string;
  html: string;
  attachments: { filename: string; content: Buffer }[];
}): Promise<{
  messageId: string;
  headerFrom: string;
  envelopeFrom: string | undefined;
  accepted: string[];
  rejected: string[];
  response: string;
}> => {
  assertEmailConfig();

  const from = getFromAddress();
  console.info("[Email] Sending attachment email", {
    from,
    to,
    subject,
    attachmentNames: attachments.map((attachment) => attachment.filename),
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    attachments,
  });

  console.info("[Email] Mailjet accepted attachment email", {
    messageId: info.messageId,
    envelopeFrom: info.envelope?.from || undefined,
    envelopeTo: info.envelope?.to,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    headerFrom: from,
  });

  return {
    messageId: info.messageId,
    headerFrom: from,
    envelopeFrom: info.envelope?.from || undefined,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
    response: info.response,
  };
};
