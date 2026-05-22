import nodemailer from "nodemailer";

const createTransporter = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim();

  if (!from) {
    throw new Error("Missing sender email. Please set EMAIL_FROM or SMTP_USER.");
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
};

export default sendEmail;
