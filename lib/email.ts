import "server-only";

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Courant <onboarding@resend.dev>";

/**
 * Send a transactional email. Uses Resend when RESEND_API_KEY is set;
 * otherwise logs the email (dev / pre-email-provider mode, fail-open).
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!RESEND_KEY) {
    console.log(`[email:not-configured] to=${to} subject=${subject}\n${text}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`[email] Resend send failed: ${res.status}`);
    }
  } catch (e) {
    console.error("[email] send error", e);
  }
}