// Minimal email service placeholder - integrate provider (SendGrid, SES) later
async function sendEmail({ to, subject, text, html }) {
  console.log("sendEmail called", { to, subject });
  return true;
}

module.exports = { sendEmail };
