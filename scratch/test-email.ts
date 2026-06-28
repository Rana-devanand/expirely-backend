
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const mailUser = process.env.MAILJET_API_KEY || process.env.SMTP_USER || process.env.EMAILS;
const mailPass = process.env.MAILJET_SECRET_KEY || process.env.SMTP_PASS || process.env.PASSWORD;
const mailFromEmail = process.env.MAIL_FROM_EMAIL || process.env.EMAILS;
const mailFromName = process.env.MAIL_FROM_NAME || "Expirely App";

console.log("SMTP Config:");
console.log("- User:", mailUser);
console.log("- Pass length:", mailPass?.length);
console.log("- From Email:", mailFromEmail);
console.log("- From Name:", mailFromName);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "in-v3.mailjet.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: mailUser,
    pass: mailPass,
  },
  debug: true, // Show SMTP traffic
  logger: true, // Log to console
});

async function main() {
  try {
    console.log("Sending test email...");
    const info = await transporter.sendMail({
      from: `"${mailFromName}" <${mailFromEmail}>`,
      to: "dev.cloudapp93@gmail.com",
      subject: "Expirely Mailjet Test",
      text: "This is a test email sent from backend using Mailjet SMTP.",
      html: "<h3>This is a test email sent from backend using Mailjet SMTP.</h3>",
    });
    console.log("✅ Email sent successfully!");
    console.log("Response:", info);
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
  }
}

main();
