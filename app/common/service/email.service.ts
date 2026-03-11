import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAILS,
    pass: process.env.PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  template: string; // EJS template file name (without extension)
  data: Record<string, any>;
}

export const sendEmail = async ({ to, subject, template, data }: SendEmailOptions): Promise<void> => {
  const templatePath = path.join(__dirname, "../../templates", `${template}.ejs`);

  const html = await ejs.renderFile(templatePath, data);

  const mailOptions = {
    from: `"Expirely App" <${process.env.EMAILS}>`,
    to,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};
