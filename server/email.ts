import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

// Initialize Resend Client as secondary fallback
export function getResend(): Resend | null {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Get Gmail Nodemailer transporter dynamically from environment or configured credentials
export function getGmailTransporter(): nodemailer.Transporter | null {
  const user = (
    process.env.GMAIL_USER ||
    process.env.GMAIL_EMAIL ||
    process.env.EMAIL_USER ||
    'srisaigentspg78@gmail.com'
  ).trim();

  const rawPass = (
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GMAIL_APP ||
    process.env.GMAIL_PASSWORD ||
    process.env.EMAIL_PASSWORD ||
    ''
  ).trim();

  // Strip spaces from 16-character Google App Password (e.g., 'ubor iixf ngdu uexj' -> 'uboriixfngduuexj')
  const pass = rawPass.replace(/\s+/g, '');

  if (!user || !pass) {
    return null;
  }

  try {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL/TLS on port 465
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } catch (err) {
    console.error('[Gmail Transporter Init Error]:', err);
    return null;
  }
}

// Clean and validate email helper
function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 3 && trimmed.includes('@') && trimmed.includes('.');
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  cid?: string;
  contentType?: string;
  encoding?: string;
}

/**
 * Universal Email Sender
 * Prioritizes Gmail SMTP with Google App Password (delivers to 100% of recipient inboxes with no domain restrictions)
 * Supports inline CID attachments so logos render 100% reliably in Gmail, Outlook, Apple Mail & mobile clients.
 * Falls back to Resend API if Gmail credentials are not configured.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from,
  attachments = [],
  pgLogo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
  pgLogo?: string;
}): Promise<{ success: boolean; data?: any; error?: string; provider?: string }> {
  try {
    // Validate recipient
    let recipients: string[] = [];
    if (Array.isArray(to)) {
      recipients = to.map((e) => e.trim()).filter(isValidEmail);
    } else if (isValidEmail(to)) {
      recipients = [to.trim()];
    }

    if (recipients.length === 0) {
      console.warn('[Email Dispatch Skip]: No valid recipient email provided, skipping send.');
      return { success: false, error: 'No valid recipient email provided' };
    }

    let finalHtml = html;
    const finalAttachments: any[] = [...attachments];

    // Process pgLogo: If it is a base64 Data URI, convert to CID inline attachment
    if (pgLogo && pgLogo.trim().startsWith('data:image/')) {
      const match = pgLogo.trim().match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const ext = mimeType.split('/')[1]?.split('+')[0] || 'png';
        const logoBuffer = Buffer.from(base64Data, 'base64');

        // Check if CID attachment already added
        if (!finalAttachments.some((a) => a.cid === 'pg-brand-logo')) {
          finalAttachments.push({
            filename: `pg-brand-logo.${ext}`,
            content: logoBuffer,
            cid: 'pg-brand-logo',
            contentType: mimeType,
          });
        }
      }
    }

    // Auto-convert any remaining base64 img tags in HTML into CID attachments
    const base64ImgRegex = /<img[^>]+src=["'](data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([^"']+))["'][^>]*>/gi;
    let imgIndex = 1;
    let matchResult;
    while ((matchResult = base64ImgRegex.exec(html)) !== null) {
      const fullDataUri = matchResult[1];
      const mimeType = matchResult[2];
      const base64Data = matchResult[3];
      const cidName = `inline-img-${imgIndex}`;
      const ext = mimeType.split('/')[1]?.split('+')[0] || 'png';

      finalAttachments.push({
        filename: `attachment-${imgIndex}.${ext}`,
        content: Buffer.from(base64Data, 'base64'),
        cid: cidName,
        contentType: mimeType,
      });

      finalHtml = finalHtml.replaceAll(fullDataUri, `cid:${cidName}`);
      imgIndex++;
    }

    const gmailUser = (process.env.GMAIL_USER || 'srisaigentspg78@gmail.com').trim();
    const gmailTransporter = getGmailTransporter();

    // 1. Primary: Direct Gmail SMTP using Google App Password
    if (gmailTransporter) {
      try {
        const fromAddress = from || `Sri Sai Gents PG <${gmailUser}>`;
        console.log(`[Gmail SMTP] Dispatching email "${subject}" with ${finalAttachments.length} attachments to:`, recipients);

        const info = await gmailTransporter.sendMail({
          from: fromAddress,
          to: recipients.join(', '),
          subject,
          html: finalHtml,
          attachments: finalAttachments.map((att) => ({
            filename: att.filename,
            content: att.content,
            cid: att.cid,
            contentType: att.contentType,
          })),
        });

        console.log(`[Gmail SMTP Success] Message sent successfully to ${recipients.join(', ')} (MsgID: ${info.messageId})`);
        return {
          success: true,
          data: { id: info.messageId },
          provider: 'gmail_smtp',
        };
      } catch (gmailErr: any) {
        console.error('[Gmail SMTP Error, falling back to Resend]:', gmailErr?.message || gmailErr);
      }
    }

    // 2. Fallback: Resend API
    const client = getResend();
    if (!client) {
      console.warn('[Email Dispatch]: Neither Gmail SMTP nor Resend API credentials configured.');
      return { success: false, error: 'Email delivery credentials not configured' };
    }

    console.log(`[Resend Fallback] Attempting dispatch via Resend API to:`, recipients);
    const result = await client.emails.send({
      from: from || 'Sri Sai Gents PG <onboarding@resend.dev>',
      to: recipients.length === 1 ? recipients[0] : recipients,
      subject,
      html: finalHtml,
      attachments: finalAttachments.map((att) => ({
        filename: att.filename,
        content: att.content instanceof Buffer ? att.content : Buffer.from(att.content, 'base64'),
      })),
    });

    if (result.error) {
      console.error(`[Resend Error]:`, result.error.message || result.error.name);
      return {
        success: false,
        error: result.error.message || 'Email delivery failed',
        provider: 'resend',
      };
    }

    console.log(`[Resend Success]: Email sent with ID:`, result.data?.id);
    return { success: true, data: result.data, provider: 'resend' };
  } catch (error: any) {
    console.error('[Email Dispatch Exception]:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to send email' };
  }
}

// Helper to render branded email header with optional PG logo
export function renderEmailHeader({
  pgName,
  pgLogo,
  subtitle,
  themeColor = '#4f46e5',
}: {
  pgName: string;
  pgLogo?: string;
  subtitle?: string;
  themeColor?: string;
}): string {
  let logoHtml = '';
  if (pgLogo && pgLogo.trim() !== '') {
    const isBase64 = pgLogo.trim().startsWith('data:image/');
    // If base64, use CID reference which Gmail & email clients render with 100% reliability
    const imageSrc = isBase64 ? 'cid:pg-brand-logo' : pgLogo.trim();
    logoHtml = `
      <div style="text-align: center; margin-bottom: 14px;">
        <img src="${imageSrc}" alt="${pgName}" style="max-height: 60px; max-width: 200px; width: auto; height: auto; object-fit: contain; display: inline-block; border-radius: 8px; border: 1px solid #e2e8f0; padding: 4px; background: #ffffff;" />
      </div>
    `;
  }

  return `
    <div style="text-align: center; padding-bottom: 18px; border-bottom: 2px solid #f1f5f9;">
      ${logoHtml}
      <h2 style="color: ${themeColor}; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">${pgName}</h2>
      ${subtitle ? `<p style="color: #64748b; margin: 5px 0 0 0; font-size: 13px; font-weight: 500;">${subtitle}</p>` : ''}
    </div>
  `;
}

// Helper to render dynamic PG Address, Help Desk & Contact footer
function renderEmailFooter({
  pgName,
  pgAddress,
  pgContact,
  pgEmail,
}: {
  pgName: string;
  pgAddress?: string;
  pgContact?: string;
  pgEmail?: string;
}): string {
  const addressHtml = pgAddress && pgAddress.trim() !== ''
    ? `<div style="margin-bottom: 4px; color: #334155;"><strong>📍 PG Address:</strong> ${pgAddress.trim()}</div>`
    : '';

  const contactHtml = pgContact && pgContact.trim() !== ''
    ? `<div style="margin-bottom: 4px; color: #334155;"><strong>📞 Helpdesk / Contact:</strong> ${pgContact.trim()}</div>`
    : '';

  const emailHtml = pgEmail && pgEmail.trim() !== ''
    ? `<div style="color: #334155;"><strong>✉️ Official Support Email:</strong> ${pgEmail.trim()}</div>`
    : '';

  return `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-top: 24px; font-size: 12px; line-height: 1.6; text-align: left;">
      <div style="font-weight: bold; color: #0f172a; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Helpdesk & Property Information</div>
      ${addressHtml}
      ${contactHtml}
      ${emailHtml}
    </div>
    <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; margin-top: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
      <p style="margin: 0;">${pgName} • Automated Real-Time PG Management</p>
    </div>
  `;
}

export const DEFAULT_PG_RULES = [
  {
    title: 'Curfew & Gate Timings',
    category: 'Curfew & Timings',
    description: 'Main gate closes strictly at 10:30 PM. Late entry is permitted only under genuine emergencies with prior intimation to the PG manager.',
  },
  {
    title: 'Monthly Rent Payment Schedule',
    category: 'Payment Terms',
    description: 'Monthly rent must be paid on or before the 5th of each calendar month. A late payment fee may apply for delayed dues.',
  },
  {
    title: 'Visitor & Guest Policy',
    category: 'Security & Visitors',
    description: 'Visitors and guests of the opposite gender are strictly not allowed in personal rooms. Visitors are permitted in the reception/lobby area only with prior permission.',
  },
  {
    title: 'Cleanliness & Waste Disposal',
    category: 'Cleanliness',
    description: 'Residents must maintain cleanliness inside rooms, shared washrooms, and corridors. Trash must be placed inside designated bins daily.',
  },
  {
    title: 'No Smoking, Alcohol or Illegal Substances',
    category: 'Code of Conduct',
    description: 'Consuming alcohol, smoking, or possessing illegal substances is strictly forbidden within the PG premises and grounds.',
  },
  {
    title: 'Electrical Appliances & Power Conservation',
    category: 'Safety & Energy',
    description: 'Use of high-power heating coils, induction stoves, or unauthorized iron boxes in rooms is strictly prohibited. Please switch off lights, fans, and geysers when leaving.',
  },
  {
    title: 'Notice Period for Vacating',
    category: 'Notice & Settlement',
    description: 'A mandatory minimum 30 days written notice must be submitted before vacating to be eligible for security deposit refund.',
  },
  {
    title: 'Security Deposit Terms',
    category: 'Security Deposit',
    description: 'Security deposit is fully refundable at the time of check-out after room inspection, key return, and deduction of any unpaid dues or damage costs.',
  },
];

// Helper to render Agreed Rules & Regulations into transactional emails
export function renderRulesHtml(rules?: Array<{ title: string; category?: string; description: string }>): string {
  const activeRules = rules && rules.length > 0 ? rules : DEFAULT_PG_RULES;

  const rulesListHtml = activeRules
    .map(
      (r, idx) => `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
        <div style="margin-bottom: 3px;">
          <span style="font-weight: 700; color: #1e293b; font-size: 13px;">${idx + 1}. ${r.title}</span>
          ${r.category ? `<span style="font-size: 10px; font-weight: 600; color: #475569; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${r.category}</span>` : ''}
        </div>
        <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">${r.description}</p>
      </div>
    `
    )
    .join('');

  return `
    <div style="margin-top: 24px; border-top: 2px dashed #e2e8f0; padding-top: 18px;">
      <div style="margin-bottom: 8px;">
        <span style="display: inline-block; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
          ✓ Agreed & Acknowledged Rules
        </span>
      </div>
      <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 15px; font-weight: 700;">📜 PG Hostel Rules & Code of Conduct</h4>
      <p style="color: #64748b; font-size: 12px; margin: 0 0 14px 0; line-height: 1.5;">
        As agreed during onboarding, all residents must adhere to the following house regulations during their stay:
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: left;">
        ${rulesListHtml}
      </div>
    </div>
  `;
}

// 0. Email Verification OTP Email
export async function sendEmailOtp({
  email,
  otp,
  name,
  pgName,
  pgLogo,
  pgAddress,
  pgContact,
  pgEmail,
}: {
  email: string;
  otp: string;
  name?: string;
  pgName: string;
  pgLogo?: string;
  pgAddress?: string;
  pgContact?: string;
  pgEmail?: string;
}) {
  if (!isValidEmail(email)) return { success: false, error: 'Invalid email address' };

  const senderUser = (
    process.env.GMAIL_USER ||
    process.env.GMAIL_EMAIL ||
    'srisaigentspg78@gmail.com'
  ).trim();

  const headerHtml = renderEmailHeader({
    pgName,
    pgLogo,
    subtitle: 'Resident Onboarding Email Verification',
    themeColor: '#4f46e5',
  });

  const footerHtml = renderEmailFooter({
    pgName,
    pgAddress,
    pgContact,
    pgEmail: pgEmail || senderUser,
  });

  return sendEmail({
    to: email.trim(),
    from: `${pgName} <${senderUser}>`,
    subject: `🔐 Your Verification Code: ${otp} - ${pgName}`,
    pgLogo,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        ${headerHtml}

        <div style="padding: 24px 0; text-align: center;">
          <p style="color: #334155; font-size: 14px; margin-bottom: 16px; line-height: 1.6;">
            ${name ? `Hello <strong>${name}</strong>,<br/>` : ''}
            Please use the following 6-digit One-Time Password (OTP) to verify your Gmail address for PG onboarding:
          </p>

          <div style="display: inline-block; background-color: #f5f3ff; border: 2px dashed #818cf8; border-radius: 12px; padding: 14px 28px; margin: 12px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4338ca;">${otp}</span>
          </div>

          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
          </p>
        </div>

        ${footerHtml}
      </div>
    `,
  });
}

// 1. Application Submitted Email with Reference ID
export async function sendApplicationSubmittedEmails({
  applicantEmail,
  applicantName,
  applicantPhone,
  applicationId,
  pgName,
  pgLogo,
  pgAddress,
  pgContact,
  adminEmail,
  rules,
}: {
  applicantEmail?: string;
  applicantName: string;
  applicantPhone: string;
  applicationId: string;
  pgName: string;
  pgLogo?: string;
  pgAddress?: string;
  pgContact?: string;
  adminEmail?: string;
  rules?: Array<{ title: string; category?: string; description: string }>;
}) {
  const senderUser = (process.env.GMAIL_USER || 'srisaigentspg78@gmail.com').trim();
  const rulesSectionHtml = renderRulesHtml(rules);

  // To Applicant: Send Reference ID & Confirmation
  if (applicantEmail && applicantEmail.includes('@')) {
    const headerHtml = renderEmailHeader({
      pgName,
      pgLogo,
      subtitle: 'Resident Onboarding Portal',
      themeColor: '#2563eb',
    });

    const footerHtml = renderEmailFooter({
      pgName,
      pgAddress,
      pgContact,
      pgEmail: adminEmail || senderUser,
    });

    await sendEmail({
      to: applicantEmail.trim(),
      from: `${pgName} <${senderUser}>`,
      subject: `📋 Application Received (Ref: ${applicationId}) - ${pgName}`,
      pgLogo,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          ${headerHtml}

          <div style="padding: 20px 0;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 17px;">Hello ${applicantName},</h3>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Thank you for submitting your onboarding application. Your details, KYC documents, and house policy agreements have been successfully registered under Reference ID <strong>${applicationId}</strong>.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Application / Reference ID:</strong> <span style="color: #2563eb; font-weight: bold; font-size: 16px;">${applicationId}</span></p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Applicant Name:</strong> ${applicantName}</p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Registered Mobile:</strong> ${applicantPhone}</p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Registered Email:</strong> ${applicantEmail}</p>
              <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Status:</strong> <span style="background-color: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 6px; font-weight: bold; font-size: 12px;">Under Admin Review</span></p>
            </div>

            <p style="color: #475569; font-size: 13px; line-height: 1.6;">
              The PG management team is currently reviewing your application and verifying your Aadhaar KYC documents. Once approved, you will receive an official room and bed allocation confirmation via email.
            </p>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; margin-top: 16px; font-size: 13px; color: #1e40af;">
              💡 <em>Keep this reference ID <strong>(${applicationId})</strong> handy for any future correspondence with the management.</em>
            </div>

            ${rulesSectionHtml}
          </div>

          ${footerHtml}
        </div>
      `,
    });
  }

  // To Admin: Notification
  const targetAdmin = adminEmail || 'srisaigentspg78@gmail.com';
  await sendEmail({
    to: targetAdmin,
    from: `${pgName} <${senderUser}>`,
    subject: `🔔 New Tenant Application: ${applicantName} (${applicationId})`,
    pgLogo,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">New Resident Application Received</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">
          A new tenant has submitted their onboarding form and accepted all PG house rules on your public portal.
        </p>

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Application ID:</strong> ${applicationId}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Applicant Name:</strong> ${applicantName}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Phone:</strong> ${applicantPhone}</p>
          <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Email:</strong> ${applicantEmail || 'Not provided'}</p>
        </div>

        <p style="color: #475569; font-size: 13px;">
          Log into your Admin Dashboard to verify Aadhaar KYC documents and allocate a room/bed.
        </p>
      </div>
    `,
  });
}

// 2. Application Approved & Room Allotment Email (Welcoming Message with Logo & Dynamic Address/Helpdesk)
export async function sendApplicationApprovedEmail({
  residentEmail,
  residentName,
  residentId,
  roomNumber,
  bedNumber,
  sharingType,
  monthlyRent,
  securityDeposit,
  moveInDate,
  pgName,
  pgLogo,
  pgAddress,
  pgContact,
  pgEmail,
  rules,
}: {
  residentEmail?: string;
  residentName: string;
  residentId: string;
  roomNumber: string;
  bedNumber: string;
  sharingType: string;
  monthlyRent: number;
  securityDeposit: number;
  moveInDate: string;
  pgName: string;
  pgLogo?: string;
  pgAddress: string;
  pgContact: string;
  pgEmail?: string;
  rules?: Array<{ title: string; category?: string; description: string }>;
}) {
  if (!residentEmail || !residentEmail.includes('@')) return;

  const senderUser = (process.env.GMAIL_USER || 'srisaigentspg78@gmail.com').trim();
  const rulesSectionHtml = renderRulesHtml(rules);

  const headerHtml = renderEmailHeader({
    pgName,
    pgLogo,
    subtitle: 'Official Admission & Room Allotment Confirmation',
    themeColor: '#16a34a',
  });

  const footerHtml = renderEmailFooter({
    pgName,
    pgAddress,
    pgContact,
    pgEmail: pgEmail || senderUser,
  });

  await sendEmail({
    to: residentEmail.trim(),
    from: `${pgName} <${senderUser}>`,
    subject: `🎉 Welcome to ${pgName}! Room ${roomNumber} Allotted (${residentId})`,
    pgLogo,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        ${headerHtml}

        <div style="padding: 20px 0;">
          <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">Dear ${residentName},</h3>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            We are thrilled to welcome you to <strong>${pgName}</strong>! Your application has been approved, and your room allocation has been confirmed with the following details:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
              <p style="margin: 0 0 6px 0; color: #334155;"><strong>Resident ID:</strong> <span style="color: #2563eb; font-weight: bold;">${residentId}</span></p>
              <p style="margin: 0 0 6px 0; color: #334155;"><strong>Room Allocated:</strong> Room ${roomNumber}</p>
              <p style="margin: 0 0 6px 0; color: #334155;"><strong>Bed Number:</strong> Bed ${bedNumber} (${sharingType})</p>
              <p style="margin: 0 0 6px 0; color: #334155;"><strong>Move-in Date:</strong> ${moveInDate}</p>
              <p style="margin: 0 0 6px 0; color: #334155;"><strong>Monthly Rent:</strong> ₹${monthlyRent.toLocaleString('en-IN')}</p>
              <p style="margin: 0; color: #334155;"><strong>Security Deposit:</strong> ₹${securityDeposit.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #166534; line-height: 1.5;">
            <strong>✓ Next Steps:</strong> Please bring your original ID proof at the time of check-in and adhere to our curfew guidelines (10:30 PM) & premise cleanliness policies.
          </div>

          ${rulesSectionHtml}

          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0;">
            If you need any assistance during your move-in, please reach out to our helpdesk team. Welcome aboard!
          </p>
        </div>

        ${footerHtml}
      </div>
    `,
  });
}

// 3. Payment Receipt Email
export async function sendPaymentReceiptEmail({
  residentEmail,
  residentName,
  paymentId,
  billingMonth,
  amountPaid,
  totalDue,
  remainingBalance,
  paymentMethod,
  transactionReference,
  pgName,
  pgLogo,
  pgAddress,
  pgContact,
  pgEmail,
}: {
  residentEmail?: string;
  residentName: string;
  paymentId: string;
  billingMonth: string;
  amountPaid: number;
  totalDue: number;
  remainingBalance: number;
  paymentMethod: string;
  transactionReference?: string;
  pgName: string;
  pgLogo?: string;
  pgAddress?: string;
  pgContact?: string;
  pgEmail?: string;
}) {
  if (!residentEmail || !residentEmail.includes('@')) return;

  const senderUser = (process.env.GMAIL_USER || 'srisaigentspg78@gmail.com').trim();

  const headerHtml = renderEmailHeader({
    pgName,
    pgLogo,
    subtitle: '✓ Digital Payment & Rent Receipt',
    themeColor: '#0f172a',
  });

  const footerHtml = renderEmailFooter({
    pgName,
    pgAddress,
    pgContact,
    pgEmail: pgEmail || senderUser,
  });

  await sendEmail({
    to: residentEmail.trim(),
    from: `${pgName} <${senderUser}>`,
    subject: `Digital Rent Receipt: ₹${amountPaid.toLocaleString('en-IN')} (${billingMonth}) - ${pgName}`,
    pgLogo,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        ${headerHtml}

        <div style="padding: 20px 0;">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Receipt No:</strong> ${paymentId}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Resident Name:</strong> ${residentName}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Billing Period:</strong> ${billingMonth}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Payment Method:</strong> ${paymentMethod}</p>
            ${transactionReference ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Ref / UPI UTR:</strong> ${transactionReference}</p>` : ''}
            <div style="border-top: 1px dashed #cbd5e1; margin: 12px 0; padding-top: 12px;">
              <p style="margin: 0 0 6px 0; font-size: 16px; color: #0f172a;"><strong>Amount Paid:</strong> <span style="color: #16a34a; font-weight: bold;">₹${amountPaid.toLocaleString('en-IN')}</span></p>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Total Due: ₹${totalDue.toLocaleString('en-IN')} | Remaining Balance: ₹${remainingBalance.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <p style="color: #475569; font-size: 13px; line-height: 1.5;">
            This is a computer-generated digital receipt for your records. Thank you for paying your rent on time!
          </p>
        </div>

        ${footerHtml}
      </div>
    `,
  });
}

// 4. Rent Due Reminder Email (Dispatches to Tenant and alerts Owner)
export async function sendRentDueReminderEmail({
  residentEmail,
  residentName,
  roomNumber,
  bedNumber,
  billingMonth,
  dueAmount,
  totalRent,
  dueDate,
  pgName,
  pgLogo,
  pgAddress,
  pgContact,
  pgEmail,
  upiId,
  adminEmail,
}: {
  residentEmail?: string;
  residentName: string;
  roomNumber: string;
  bedNumber: string;
  billingMonth: string;
  dueAmount: number;
  totalRent: number;
  dueDate: string;
  pgName: string;
  pgLogo?: string;
  pgAddress?: string;
  pgContact?: string;
  pgEmail?: string;
  upiId?: string;
  adminEmail?: string;
}): Promise<{ success: boolean; tenantSent: boolean; ownerSent: boolean; error?: string }> {
  const senderUser = (process.env.GMAIL_USER || 'srisaigentspg78@gmail.com').trim();
  let tenantSent = false;
  let ownerSent = false;
  let lastError = '';

  // 1. Send Due Alert Email to Tenant
  if (residentEmail && residentEmail.includes('@')) {
    const activeUpiId = (upiId || 'srisaigentspg78@oksbi').trim();
    const upiPayUri = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(pgName)}&am=${encodeURIComponent(dueAmount.toString())}&tn=${encodeURIComponent(`Rent ${billingMonth} - ${residentName}`)}&cu=INR`;
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(upiPayUri)}`;

    const headerHtml = renderEmailHeader({
      pgName,
      pgLogo,
      subtitle: 'Monthly Rent Payment Notice',
      themeColor: '#dc2626',
    });

    const footerHtml = renderEmailFooter({
      pgName,
      pgAddress,
      pgContact,
      pgEmail: pgEmail || adminEmail || senderUser,
    });

    const tenantRes = await sendEmail({
      to: residentEmail.trim(),
      from: `${pgName} <${senderUser}>`,
      subject: `⚠️ Rent Due Reminder: ₹${dueAmount.toLocaleString('en-IN')} for ${billingMonth} - ${pgName}`,
      pgLogo,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          ${headerHtml}

          <div style="padding: 20px 0;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 17px;">Dear ${residentName},</h3>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              This is a friendly reminder that your monthly rent for <strong>${billingMonth}</strong> has a pending balance. Please find your fee summary and instant QR payment details below.
            </p>

            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 18px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #991b1b;"><strong>Resident:</strong> ${residentName} (Room ${roomNumber} - Bed ${bedNumber})</p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #991b1b;"><strong>Billing Period:</strong> ${billingMonth}</p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #991b1b;"><strong>Total Monthly Rent:</strong> ₹${totalRent.toLocaleString('en-IN')}</p>
              <p style="margin: 0 0 8px 0; font-size: 18px; color: #dc2626;"><strong>Pending Due Amount:</strong> ₹${dueAmount.toLocaleString('en-IN')}</p>
              <p style="margin: 0; font-size: 13px; color: #7f1d1d;"><strong>Due Date:</strong> ${dueDate}</p>
            </div>

            <!-- Instant UPI Scan & Pay Card with dynamic QR and visible UPI ID below -->
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1.5px solid #86efac; border-radius: 16px; padding: 20px; margin: 24px 0; text-align: center;">
              <div style="display: inline-block; background-color: #15803d; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 10px; border-radius: 9999px; margin-bottom: 12px;">
                ⚡ Scan & Pay via UPI
              </div>
              <h4 style="margin: 0 0 4px 0; color: #14532d; font-size: 16px; font-weight: 700;">Instant QR Payment (₹${dueAmount.toLocaleString('en-IN')})</h4>
              <p style="margin: 0 0 16px 0; color: #166534; font-size: 12px;">
                Scan with <strong>Google Pay, PhonePe, Paytm, BHIM</strong> or any banking app
              </p>

              <!-- Centered Generated QR Code for this exact UPI ID and Amount -->
              <div style="display: inline-block; background: #ffffff; padding: 12px; border-radius: 12px; border: 1px solid #bbf7d0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); margin-bottom: 14px;">
                <img
                  src="${qrCodeImageUrl}"
                  alt="UPI QR Code - Scan to Pay ₹${dueAmount}"
                  width="180"
                  height="180"
                  style="display: block; border-radius: 6px; margin: 0 auto;"
                />
              </div>

              <!-- UPI ID automatically visible right below the QR code -->
              <div style="margin-top: 4px;">
                <span style="font-size: 11px; color: #475569; font-weight: 600; display: block; margin-bottom: 4px;">
                  Registered UPI ID:
                </span>
                <div style="display: inline-block; font-family: monospace; font-size: 14px; font-weight: 700; color: #0f172a; background-color: #ffffff; border: 1.5px dashed #22c55e; border-radius: 8px; padding: 6px 14px;">
                  ${activeUpiId}
                </div>
              </div>

              <!-- Direct 1-Tap Mobile UPI Payment Button -->
              <div style="margin-top: 14px;">
                <a
                  href="${upiPayUri}"
                  style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 22px; border-radius: 10px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);"
                >
                  📲 Tap to Pay ₹${dueAmount.toLocaleString('en-IN')} in UPI App
                </a>
              </div>
              <p style="margin: 12px 0 0 0; color: #64748b; font-size: 11px; line-height: 1.4;">
                <em>After payment, please share transaction ID / screenshot with the management for receipt acknowledgment.</em>
              </p>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
              If you have already made the payment, please reach out to the PG desk at <strong>${pgContact || 'Management'}</strong> so we can update your ledger.
            </p>
          </div>

          ${footerHtml}
        </div>
      `,
    });

    if (tenantRes.success) {
      tenantSent = true;
    } else {
      lastError = tenantRes.error || 'Failed to deliver email to resident';
    }
  }

  // 2. Send Summary/Alert to Owner/Admin
  const targetAdmin = adminEmail || senderUser || 'srisaigentspg78@gmail.com';
  const ownerRes = await sendEmail({
    to: targetAdmin,
    from: `${pgName} <${senderUser}>`,
    subject: `📢 Rent Due Alert: ${residentName} (₹${dueAmount.toLocaleString('en-IN')} Due) - ${pgName}`,
    pgLogo,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <h3 style="color: #0f172a; margin-top: 0;">Payment Due Alert Dispatched</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">
          A payment reminder was dispatched to resident <strong>${residentName}</strong> (Room ${roomNumber}, Bed ${bedNumber}) for <strong>${billingMonth}</strong>.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Resident:</strong> ${residentName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Email:</strong> ${residentEmail || 'N/A'}</p>
          <p style="margin: 0 0 6px 0;"><strong>Pending Due Amount:</strong> ₹${dueAmount.toLocaleString('en-IN')}</p>
          <p style="margin: 0 0 6px 0;"><strong>Total Rent:</strong> ₹${totalRent.toLocaleString('en-IN')}</p>
          <p style="margin: 0;"><strong>Billing Month:</strong> ${billingMonth}</p>
        </div>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          Log into your PG Admin Dashboard to record payment once received.
        </p>
      </div>
    `,
  });

  if (ownerRes.success) {
    ownerSent = true;
  }

  return {
    success: tenantSent || ownerSent,
    tenantSent,
    ownerSent,
    error: lastError || undefined,
  };
}

