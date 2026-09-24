import * as nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../config/env'

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST || env.SMTP_HOST
  const user = process.env.SMTP_USER || env.SMTP_USER
  const rawPass = process.env.SMTP_PASS || env.SMTP_PASS

  if (user && rawPass) {
    const cleanPass = rawPass.replace(/[\s"']/g, '').trim()
    const isGmail = host?.toLowerCase().includes('gmail') || user.toLowerCase().includes('@gmail.com')

    try {
      if (isGmail) {
        return nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: user.trim(),
            pass: cleanPass,
          },
        })
      }

      return nodemailer.createTransport({
        host: host || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE || env.SMTP_SECURE) === 'true',
        auth: {
          user: user.trim(),
          pass: cleanPass,
        },
      })
    } catch (err) {
      console.error('Failed to initialize SMTP transporter:', err)
      return null
    }
  }

  return null
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`
  }
  const visibleStart = local.slice(0, 2)
  const visibleEnd = local.slice(-1)
  return `${visibleStart}***${visibleEnd}@${domain}`
}

export interface SendOtpEmailOptions {
  to: string
  name: string
  otp: string
}

export async function sendOtpEmail({ to, name, otp }: SendOtpEmailOptions): Promise<{ success: boolean; simulated?: boolean }> {
  const mailTransporter = getTransporter()

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gopinathji Gems Login Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 30px 15px;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 520px; width: 100%; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 89, 92, 0.08); border: 1px solid #e2e8f0;" border="0" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f595c 0%, #158084 100%); padding: 32px 30px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">ગોપીનાથજી જેમ્સ</h1>
              <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85; letter-spacing: 1px; text-transform: uppercase;">Gopinathji Gems — Login Security</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 35px 32px; color: #334155;">
              <h2 style="margin: 0 0 12px; font-size: 19px; color: #0f172a; font-weight: 700;">
                Login Verification Code
              </h2>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #64748b;">
                Hello <strong>${escapeHtml(name)}</strong>,<br>
                A request was made to sign in to your Gopinathji Gems account using Email Verification. Use the one-time code below to complete your login:
              </p>

              <!-- OTP Code Display -->
              <div style="background: #f8fafc; border: 2px dashed #0f595c; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #0f595c; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">
                  Your 6-Digit OTP Code
                </div>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0f595c; font-family: 'Courier New', Courier, monospace;">
                  ${otp}
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
                  Valid for 10 minutes • Do not share this code with anyone
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; font-size: 12px; color: #92400e; line-height: 1.5; margin-top: 24px;">
                <strong>Security Alert:</strong> If you did not attempt to sign in to Gopinathji Gems, please secure your account immediately and inform the system administrator.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center; font-size: 12px; color: #94a3b8;">
              © ${new Date().getFullYear()} Gopinathji Gems. All rights reserved.<br>
              Automated security message — please do not reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const textContent = `Gopinathji Gems - Login Verification Code\n\n` +
    `Hello ${name},\n\n` +
    `Your one-time login verification code is: ${otp}\n\n` +
    `This code will expire in 10 minutes.\n` +
    `If you did not request this code, please secure your account immediately.`

  const brevoApiKey = process.env.BREVO_API_KEY || env.BREVO_API_KEY
  if (brevoApiKey) {
    try {
      const cleanKey = brevoApiKey.replace(/[\s"']/g, '').trim()
      const senderEmail = process.env.BREVO_SENDER_EMAIL || env.BREVO_SENDER_EMAIL || 'dhamopandav1311@gmail.com'

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': cleanKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'Gopinathji Gems',
            email: senderEmail,
          },
          to: [
            {
              email: to,
              name: name || 'User',
            },
          ],
          subject: `[${otp}] Your Gopinathji Gems Login Verification Code`,
          htmlContent: htmlContent,
          textContent: textContent,
        }),
      })

      if (response.ok) {
        const resData = await response.json().catch(() => ({})) as any
        console.log(`📧 [EMAIL SENT VIA BREVO] OTP sent successfully to ${maskEmail(to)} (MessageId: ${resData?.messageId || 'ok'})`)
        return { success: true }
      } else {
        const errData = await response.json().catch(() => null)
        console.error(`❌ [BREVO ERROR] Failed to send email via Brevo:`, errData || response.statusText)
      }
    } catch (brevoErr) {
      console.error('❌ [BREVO EXCEPTION] Request failed:', brevoErr)
    }
  }

  if (mailTransporter) {
    try {
      const user = process.env.SMTP_USER || env.SMTP_USER
      const fromAddr = process.env.SMTP_FROM || env.SMTP_FROM || process.env.EMAIL_FROM || (user ? `Gopinathji Gems <${user}>` : 'Gopinathji Gems <no-reply@gopinathjigems.com>')
      await mailTransporter.sendMail({
        from: fromAddr,
        to,
        subject: `[${otp}] Your Gopinathji Gems Login Verification Code`,
        text: textContent,
        html: htmlContent,
      })
      console.log(`📧 [EMAIL SENT VIA SMTP] Verification OTP sent successfully to ${maskEmail(to)}`)
      return { success: true }
    } catch (err) {
      console.error(`❌ [EMAIL ERROR] Failed to deliver email to ${to} via SMTP:`, err)
      // Fall through to dev console output so dev/local is never blocked
    }
  }

  // Fallback / Development mode logging
  console.log(`\n` +
    `┌─────────────────────────────────────────────────────────────┐\n` +
    `│ 🔑 [DEVELOPMENT / SMTP FALLBACK] EMAIL OTP CODE             │\n` +
    `│ Destination: ${to.padEnd(46)} │\n` +
    `│ Recipient:   ${name.padEnd(46)} │\n` +
    `│ OTP Code:    ${otp.padEnd(46)} │\n` +
    `│ Valid for:   10 minutes                                     │\n` +
    `└─────────────────────────────────────────────────────────────┘\n`
  )

  return { success: true, simulated: !brevoApiKey && !mailTransporter }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
