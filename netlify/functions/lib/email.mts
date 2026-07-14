import type { NeonQueryFunction } from "@neondatabase/serverless";
import nodemailer from "nodemailer";

export function normalizeGmailAppPassword(value: string | undefined): string {
  return value?.replace(/\s+/g, "") ?? "";
}

function gmailConfig() {
  const user = process.env.GMAIL_USER?.trim();
  // Google displays app passwords in four groups. Accept values pasted with
  // those spaces while passing the canonical 16 characters to SMTP.
  const pass = normalizeGmailAppPassword(process.env.GMAIL_APP_PASSWORD);
  return user && pass ? { user, pass } : null;
}

export async function sendEmailNow(message: { to: string; subject: string; text: string }) {
  const config = gmailConfig();
  if (!config) throw new Error("Gmail delivery is not configured.");
  const transport = nodemailer.createTransport({ service: "gmail", auth: config });
  await transport.sendMail({ from: config.user, ...message });
}

export async function flushEmailOutbox(sql: NeonQueryFunction<false, false>, limit = 10) {
  const config = gmailConfig();
  if (!config) return { sent: 0, skipped: true };
  const transport = nodemailer.createTransport({ service: "gmail", auth: config });
  const rows = await sql`
    SELECT id, recipient, subject, text_body FROM email_outbox
    WHERE sent_at IS NULL AND next_attempt_at <= now() AND attempts < 8
    ORDER BY created_at LIMIT ${limit}
  `;
  let sent = 0;
  for (const row of rows as Array<Record<string, string>>) {
    try {
      await transport.sendMail({ from: config.user, to: row.recipient, subject: row.subject, text: row.text_body });
      await sql`UPDATE email_outbox SET sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = ${row.id}::uuid`;
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1_000) : "Unknown mail error";
      await sql`UPDATE email_outbox SET attempts = attempts + 1, last_error = ${message}, next_attempt_at = now() + interval '15 minutes' * (attempts + 1) WHERE id = ${row.id}::uuid`;
    }
  }
  return { sent, skipped: false };
}
