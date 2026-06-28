import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";

const mailUser = process.env.MAILJET_API_KEY || process.env.SMTP_USER || process.env.EMAILS;
const mailPass = process.env.MAILJET_SECRET_KEY || process.env.SMTP_PASS || process.env.PASSWORD;
const mailFromEmail = process.env.MAIL_FROM_EMAIL || process.env.EMAILS;
const mailFromName = process.env.MAIL_FROM_NAME || "Expirely App";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "in-v3.mailjet.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
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
    throw new Error("Missing email configuration. Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAIL_FROM_EMAIL.");
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
